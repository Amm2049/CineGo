// src/services/payment.service.ts
// CineGo — Stripe PromptPay payments (Phase 9).
//
// Flow: start → customer scans the QR → Stripe webhook (or status poll) → settle.
// Only a payment Stripe reports as `succeeded` can turn a booking PAID, and every path that
// can see that (webhook, poll, cancel-race) goes through settleSucceededPayment(), which is
// idempotent. The three layers that solve "seat hold vs. payment time":
//   1. startStripePayment() extends the hold ONCE: 10-min window + 2-min grace.
//   2. closePayment() cancels the PaymentIntent when the window ends (client timer, status
//      poll, or another customer's hold on the seats). A cancel that loses the race to a
//      last-second payment settles it instead.
//   3. settleSucceededPayment() confirms if the booking still owns its seats, otherwise refunds.

import { randomUUID } from "crypto";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { MOVIE_NOT_ON_SALE } from "@/lib/movie-sales";
import {
  decideSettlement,
  getPaymentWindow,
  toSatang,
} from "@/lib/payment-config";
import {
  createTicketsForBooking,
  getBookingReference,
} from "@/services/ticket.service";
import { invalidateUserRecommendations } from "@/services/recommendation.service";
import type {
  PaymentStatusName,
  PaymentStatusResponse,
  PromptPayCheckout,
} from "@/types";

const PENDING_REFERENCE_PREFIX = "PENDING-"; // placeholder until Stripe returns the pi_ id

/** Why a payment is being closed without money: decides the final Payment/Booking status. */
export type CloseReason = "customer" | "expired" | "failed";

const CLOSE_STATUS: Record<
  CloseReason,
  { payment: "CANCELLED" | "FAILED"; booking: "CANCELLED" | "EXPIRED" }
> = {
  customer: { payment: "CANCELLED", booking: "CANCELLED" },
  expired: { payment: "CANCELLED", booking: "EXPIRED" },
  failed: { payment: "FAILED", booking: "EXPIRED" },
};

const STATUS_MESSAGES: Partial<Record<PaymentStatusName, string>> = {
  CANCELLED: "The payment was cancelled and your seats were released.",
  FAILED:
    "The payment failed and your seats were released. Please select your seats again.",
  REFUNDED:
    "Your payment was refunded because the seats were no longer available.",
};

export type StartStripePaymentResult =
  | { success: true; checkout: PromptPayCheckout }
  | { success: false; error: string; status: number };

function isConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function hasStripeIntent(reference: string): boolean {
  return reference.startsWith("pi_");
}

function checkoutFromIntent(
  paymentId: string,
  amount: number,
  expiresAt: Date,
  intent: Stripe.PaymentIntent,
): PromptPayCheckout | null {
  const qr = intent.next_action?.promptpay_display_qr_code;
  if (!qr) return null;
  return {
    paymentId,
    amount,
    expiresAt: expiresAt.toISOString(),
    qrImageUrl: qr.image_url_png,
    hostedInstructionsUrl: qr.hosted_instructions_url,
  };
}

// ── Start ──────────────────────────────────────────────────

/**
 * Start (or resume) a PromptPay payment for the seats the user holds for a showtime.
 * A second call while the window is open returns the same QR and does NOT extend the hold.
 */
export async function startStripePayment(params: {
  userId: string;
  showtimeId: string;
}): Promise<StartStripePaymentResult> {
  const { userId, showtimeId } = params;
  const now = new Date();

  type Reserved =
    | { kind: "error"; error: string; status: number }
    | { kind: "existing"; paymentId: string }
    | {
        kind: "new";
        paymentId: string;
        bookingId: string;
        amount: number;
        expiresAt: Date;
        email: string;
        previousHolds: { id: string; heldUntil: Date | null }[];
      };

  let reserved: Reserved;
  try {
    // Step 1 (DB only): lock in the price and extend the hold. No network calls inside a transaction.
    reserved = await prisma.$transaction(
      async (tx): Promise<Reserved> => {
        const booking = await tx.booking.findFirst({
          where: { showtimeId, userId, status: "PENDING" },
          include: {
            user: { select: { email: true } },
            showtime: { select: { startsAt: true, movie: { select: { isActive: true } } } },
            seats: { include: { seat: true } },
            payment: true,
          },
        });

        if (!booking || booking.seats.length === 0) {
          return {
            kind: "error",
            error: "You have no held seats to pay for.",
            status: 409,
          };
        }

        if (booking.payment) {
          const p = booking.payment;
          if (
            p.status === "PENDING" &&
            p.provider === "STRIPE" &&
            p.expiresAt &&
            p.expiresAt > now
          ) {
            return { kind: "existing", paymentId: p.id }; // resume, never extend again
          }
          return {
            kind: "error",
            error:
              "Your payment window has closed. Please select your seats again.",
            status: 409,
          };
        }

        if (booking.showtime.startsAt <= now) {
          return {
            kind: "error",
            error: "This showtime has already started.",
            status: 409,
          };
        }

        // Checked after the resume branch above: a payment opened before the movie was hidden
        // may still finish; a new one can't start
        if (!booking.showtime.movie.isActive) {
          return { kind: "error", error: MOVIE_NOT_ON_SALE, status: 409 };
        }

        if (booking.seats.some((bs) => !bs.heldUntil || bs.heldUntil <= now)) {
          return {
            kind: "error",
            error:
              "Your seat hold has expired. Please select your seats again.",
            status: 409,
          };
        }

        // Server-side price revalidation from the Seat table (never the client)
        const amount = booking.seats.reduce(
          (sum, bs) => sum + Number(bs.seat.price),
          0,
        );
        const { expiresAt, holdUntil } = getPaymentWindow(now);

        for (const bs of booking.seats) {
          await tx.bookingSeat.update({
            where: { id: bs.id },
            data: { priceAtPurchase: bs.seat.price, heldUntil: holdUntil },
          });
        }
        await tx.booking.update({
          where: { id: booking.id },
          data: { totalAmount: amount },
        });

        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: "STRIPE",
            status: "PENDING",
            amount,
            transactionReference: `${PENDING_REFERENCE_PREFIX}${randomUUID()}`,
            expiresAt,
          },
        });

        return {
          kind: "new",
          paymentId: payment.id,
          bookingId: booking.id,
          amount,
          expiresAt,
          email: booking.user.email,
          previousHolds: booking.seats.map((bs) => ({
            id: bs.id,
            heldUntil: bs.heldUntil,
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch (error) {
    if (isConflict(error)) {
      return {
        success: false,
        error: "Your payment is already being prepared. Please wait a moment.",
        status: 409,
      };
    }
    throw error;
  }

  if (reserved.kind === "error")
    return { success: false, error: reserved.error, status: reserved.status };
  if (reserved.kind === "existing")
    return resumeStripePayment(reserved.paymentId);

  // Step 2 (network): create and confirm the PromptPay PaymentIntent
  const { paymentId, bookingId, amount, expiresAt, email, previousHolds } =
    reserved;
  let intent: Stripe.PaymentIntent;
  try {
    intent = await getStripe().paymentIntents.create(
      {
        amount: toSatang(amount),
        currency: "thb",
        allowed_payment_method_types: ["promptpay"], // renamed from payment_method_types in API 2026-10
        payment_method_data: { type: "promptpay", billing_details: { email } },
        confirm: true,
        description: `CineGo booking ${getBookingReference(bookingId)}`,
        metadata: { paymentId, bookingId, userId, showtimeId },
      },
      { idempotencyKey: `cinego-start-${paymentId}` },
    );
  } catch (error) {
    console.error("[PaymentService] PaymentIntent create failed:", error);
    // Undo step 1 so the customer keeps the seat hold they had before clicking Pay
    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });
      for (const hold of previousHolds) {
        await tx.bookingSeat.updateMany({
          where: { id: hold.id, bookingId },
          data: { heldUntil: hold.heldUntil },
        });
      }
    });
    return {
      success: false,
      error: "Could not start the PromptPay payment. Please try again.",
      status: 502,
    };
  }

  // Step 3: record the pi_ id — only if nothing closed the payment meanwhile (compare-and-set)
  const linked = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { transactionReference: intent.id },
  });
  const checkout = checkoutFromIntent(paymentId, amount, expiresAt, intent);

  if (linked.count === 0 || !checkout) {
    await getStripe()
      .paymentIntents.cancel(intent.id)
      .catch(() => undefined);
    if (linked.count > 0) await closePayment(paymentId, "failed");
    return {
      success: false,
      error: "Could not start the PromptPay payment. Please try again.",
      status: 502,
    };
  }

  return { success: true, checkout };
}

/** Return the open payment's QR again (page reload, second click on Pay). */
async function resumeStripePayment(
  paymentId: string,
): Promise<StartStripePaymentResult> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING" || !payment.expiresAt) {
    return {
      success: false,
      error: "Your payment window has closed. Please select your seats again.",
      status: 409,
    };
  }
  if (!hasStripeIntent(payment.transactionReference)) {
    return {
      success: false,
      error: "Your payment is already being prepared. Please wait a moment.",
      status: 409,
    };
  }

  const intent = await getStripe().paymentIntents.retrieve(
    payment.transactionReference,
  );
  const checkout = checkoutFromIntent(
    payment.id,
    Number(payment.amount),
    payment.expiresAt,
    intent,
  );
  if (!checkout) {
    // QR is gone (already paid, failed, or cancelled on Stripe's side): let the poll settle it
    await syncPaymentWithStripe(payment.id);
    return {
      success: false,
      error: "This payment is no longer waiting for a scan. Refreshing…",
      status: 409,
    };
  }
  return { success: true, checkout };
}

/** The checkout page uses this to show the QR again after a reload. */
export async function getOpenPromptPayCheckout(
  userId: string,
  showtimeId: string,
): Promise<PromptPayCheckout | null> {
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "STRIPE",
      status: "PENDING",
      expiresAt: { gt: new Date() },
      booking: { userId, showtimeId, status: "PENDING" },
    },
  });
  if (!payment) return null;
  try {
    const resumed = await resumeStripePayment(payment.id);
    return resumed.success ? resumed.checkout : null;
  } catch (error) {
    console.error("[PaymentService] could not resume payment:", error);
    return null;
  }
}

// ── Settle (the only Stripe path to PAID) ──────────────────

type SettleOutcome = {
  status: PaymentStatusName;
  bookingId: string | null; // set once paid: the tickets are at /tickets/<bookingId>
  message: string | null;
};

/**
 * Stripe reports the PaymentIntent succeeded. Confirm the booking if it still owns its seats,
 * otherwise refund. Safe to call any number of times, concurrently (webhook + poll).
 */
export async function settleSucceededPayment(
  paymentId: string,
  intent: Stripe.PaymentIntent,
): Promise<SettleOutcome> {
  const now = new Date();

  type Decided =
    | { kind: "done"; outcome: SettleOutcome }
    | { kind: "paid"; bookingId: string; userId: string }
    | { kind: "refund"; reason: string };

  let decided: Decided;
  try {
    decided = await prisma.$transaction(
      async (tx): Promise<Decided> => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: {
            booking: {
              include: {
                seats: true,
                showtime: { select: { startsAt: true } },
                _count: { select: { tickets: true } },
              },
            },
          },
        });
        if (!payment) throw new Error(`Payment ${paymentId} not found`);

        if (payment.status === "SUCCESS") {
          return {
            kind: "done",
            outcome: {
              status: "SUCCESS",
              bookingId: payment.booking._count.tickets > 0 ? payment.booking.id : null,
              message: null,
            },
          };
        }
        if (payment.status === "REFUNDED") {
          return {
            kind: "done",
            outcome: {
              status: "REFUNDED",
              bookingId: null,
              message: STATUS_MESSAGES.REFUNDED!,
            },
          };
        }

        const { booking } = payment;
        const decision = decideSettlement({
          bookingStatus: booking.status,
          heldPrices: booking.seats.map((bs) => Number(bs.priceAtPurchase)),
          paidAmount: Number(payment.amount),
          receivedSatang: intent.amount_received,
          showtimeStartsAt: booking.showtime.startsAt,
          now,
        });

        if (decision.action === "refund") {
          // Give up whatever seats are left; the refund itself happens after the transaction
          await tx.bookingSeat.deleteMany({ where: { bookingId: booking.id } });
          if (booking.status === "PENDING") {
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: "EXPIRED" },
            });
          }
          return { kind: "refund", reason: decision.reason };
        }

        await tx.bookingSeat.updateMany({
          where: { bookingId: booking.id },
          data: { heldUntil: null },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "PAID" },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            paidAt: now,
            transactionReference: intent.id,
          },
        });
        await createTicketsForBooking(tx, booking.id); // one ticket (QR) per seat
        return { kind: "paid", bookingId: booking.id, userId: booking.userId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch (error) {
    if (isConflict(error)) {
      // Another settle (webhook vs. poll) won the race — report what it decided
      const current = await getPaymentSnapshot(paymentId);
      if (current && current.status !== "PENDING") return current;
    }
    throw error; // the webhook returns 500 and Stripe retries
  }

  if (decided.kind === "done") return decided.outcome;

  if (decided.kind === "paid") {
    await invalidateUserRecommendations(decided.userId);
    return { status: "SUCCESS", bookingId: decided.bookingId, message: null };
  }

  // Refund: idempotency key makes retries safe; mark REFUNDED only after Stripe accepts it
  await getStripe().refunds.create(
    {
      payment_intent: intent.id,
      reason: "requested_by_customer",
      metadata: { paymentId, reason: decided.reason },
    },
    { idempotencyKey: `cinego-refund-${paymentId}` },
  );
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      transactionReference: intent.id,
    },
  });
  console.warn(
    `[PaymentService] refunded payment ${paymentId}: ${decided.reason}`,
  );
  return {
    status: "REFUNDED",
    bookingId: null,
    message: `${STATUS_MESSAGES.REFUNDED} ${decided.reason}`,
  };
}

// ── Close (window over, customer cancel, failure) ──────────

/** Mark a PENDING payment closed and release its seats. Compare-and-set: a no-op if already closed. */
async function markPaymentClosed(
  paymentId: string,
  reason: CloseReason,
): Promise<void> {
  const target = CLOSE_STATUS[reason];
  await prisma.$transaction(async (tx) => {
    const closed = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: target.payment },
    });
    if (closed.count === 0) return;

    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    await tx.bookingSeat.deleteMany({
      where: { bookingId: payment.bookingId },
    });
    await tx.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING" },
      data: { status: target.booking },
    });
  });
}

/**
 * Close an open payment: cancel the PaymentIntent so the QR stops working, then release the seats.
 * If Stripe refuses because the customer just paid, settle the payment instead.
 */
export async function closePayment(
  paymentId: string,
  reason: CloseReason,
): Promise<SettleOutcome | null> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (payment.status !== "PENDING") return getPaymentSnapshot(paymentId);

  const reference = payment.transactionReference;
  if (payment.provider === "STRIPE" && hasStripeIntent(reference)) {
    const stripe = getStripe();
    try {
      await stripe.paymentIntents.cancel(reference);
    } catch (error) {
      const intent = await stripe.paymentIntents.retrieve(reference);
      if (intent.status === "succeeded")
        return settleSucceededPayment(paymentId, intent);
      if (intent.status !== "canceled") throw error;
    }
  }

  await markPaymentClosed(paymentId, reason);
  return getPaymentSnapshot(paymentId);
}

/**
 * Before a customer holds seats: close any other booking's payment whose window is over but whose
 * seats are among the requested ones, plus this user's own expired payment for the showtime.
 * Layer 2 without a cron job (Vercel Hobby crons run at most once a day).
 */
export async function closeExpiredPaymentsForSeats(params: {
  showtimeId: string;
  seatIds: string[];
  userId: string;
}): Promise<void> {
  const { showtimeId, seatIds, userId } = params;
  const stale = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: new Date() },
      booking: {
        showtimeId,
        status: "PENDING",
        OR: [{ userId }, { seats: { some: { seatId: { in: seatIds } } } }],
      },
    },
    select: { id: true },
  });

  for (const { id } of stale) {
    try {
      await closePayment(id, "expired");
    } catch (error) {
      console.error(
        `[PaymentService] could not close expired payment ${id}:`,
        error,
      );
    }
  }
}

// ── Status (poll) & webhook ────────────────────────────────

async function getPaymentSnapshot(
  paymentId: string,
): Promise<SettleOutcome | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { select: { id: true, _count: { select: { tickets: true } } } } },
  });
  if (!payment) return null;
  const status = payment.status as PaymentStatusName;
  return {
    status,
    bookingId: payment.booking._count.tickets > 0 ? payment.booking.id : null,
    message: STATUS_MESSAGES[status] ?? null,
  };
}

/**
 * Bring a PENDING payment in line with Stripe. Lets the checkout page finish even when the
 * webhook is slow or not configured (e.g. local dev without `stripe listen`).
 */
async function syncPaymentWithStripe(
  paymentId: string,
): Promise<SettleOutcome | null> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (
    !payment ||
    payment.status !== "PENDING" ||
    payment.provider !== "STRIPE"
  ) {
    return getPaymentSnapshot(paymentId);
  }

  if (!hasStripeIntent(payment.transactionReference)) {
    // Creation never finished; once the window is over nothing can be paid any more
    if (payment.expiresAt && payment.expiresAt <= new Date()) {
      await markPaymentClosed(paymentId, "expired");
    }
    return getPaymentSnapshot(paymentId);
  }

  const intent = await getStripe().paymentIntents.retrieve(
    payment.transactionReference,
  );
  if (intent.status === "succeeded")
    return settleSucceededPayment(paymentId, intent);
  if (intent.status === "canceled") {
    await markPaymentClosed(paymentId, "expired");
  } else if (intent.status === "requires_payment_method") {
    await closePayment(paymentId, "failed"); // the PromptPay attempt failed
  } else if (payment.expiresAt && payment.expiresAt <= new Date()) {
    await closePayment(paymentId, "expired"); // window over: the server enforces it, not just the browser
  }
  return getPaymentSnapshot(paymentId);
}

/** Status for the customer's own payment, or null if it isn't theirs. */
export async function getPaymentStatusForUser(
  paymentId: string,
  userId: string,
): Promise<PaymentStatusResponse | null> {
  const owned = await prisma.payment.findFirst({
    where: { id: paymentId, booking: { userId } },
    select: { id: true },
  });
  if (!owned) return null;
  const snapshot = await syncPaymentWithStripe(paymentId);
  return snapshot ? { paymentId, ...snapshot } : null;
}

/** Customer pressed "Cancel payment", or their countdown hit zero. The server decides which. */
export async function cancelPaymentForUser(
  paymentId: string,
  userId: string,
): Promise<PaymentStatusResponse | null> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, booking: { userId } },
  });
  if (!payment) return null;
  const reason: CloseReason =
    payment.expiresAt && payment.expiresAt <= new Date()
      ? "expired"
      : "customer";
  const snapshot = await closePayment(paymentId, reason);
  return snapshot ? { paymentId, ...snapshot } : null;
}

async function findPaymentForIntent(intent: Stripe.PaymentIntent) {
  const byMetadata = intent.metadata?.paymentId;
  if (byMetadata) {
    const payment = await prisma.payment.findUnique({
      where: { id: byMetadata },
    });
    if (payment) return payment;
  }
  return prisma.payment.findUnique({
    where: { transactionReference: intent.id },
  });
}

/** Handle a verified Stripe webhook event. Throws on failure so the route returns 500 and Stripe retries. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const payment = await findPaymentForIntent(event.data.object);
      if (!payment) {
        console.warn(
          `[PaymentService] succeeded event for unknown intent ${event.data.object.id}`,
        );
        return;
      }
      await settleSucceededPayment(payment.id, event.data.object);
      return;
    }
    case "payment_intent.payment_failed": {
      const payment = await findPaymentForIntent(event.data.object);
      if (payment?.status === "PENDING")
        await closePayment(payment.id, "failed");
      return;
    }
    case "payment_intent.canceled": {
      const payment = await findPaymentForIntent(event.data.object);
      if (payment?.status === "PENDING")
        await markPaymentClosed(payment.id, "expired");
      return;
    }
    default:
      return; // other events are not used
  }
}
