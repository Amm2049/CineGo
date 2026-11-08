// src/tests/integration/payment-window.test.ts
// Phase 9 checks deferred to the testing phase, automated:
//   • the 10-minute PromptPay window running out (customer countdown, status poll, another customer)
//   • a late payment after another customer took the seats is refunded automatically
//
// Real services + real database; Stripe is an in-memory fake so a test can "scan and pay" the QR.
// Time passing is simulated by moving Payment.expiresAt / BookingSeat.heldUntil into the past.
// Each test creates throwaway users and removes everything they created.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// ── Fake Stripe ─────────────────────────────────────────────

type FakeIntent = {
  id: string;
  object: "payment_intent";
  status: "requires_action" | "succeeded" | "canceled";
  amount: number;
  amount_received: number;
  metadata: Record<string, string>;
  next_action: unknown;
};

const fake = vi.hoisted(() => {
  const intents = new Map<string, FakeIntent>();
  const runId = Date.now();
  let seq = 0;
  let cancelError: Error | null = null;

  const get = (id: string) => {
    const intent = intents.get(id);
    if (!intent) throw new Error(`fake Stripe: no such PaymentIntent ${id}`);
    return intent;
  };
  const copy = (intent: FakeIntent) => structuredClone(intent);

  const api = {
    paymentIntents: {
      create: vi.fn(async (params: { amount: number; metadata: Record<string, string> }) => {
        const id = `pi_fake_${runId}_${++seq}`;
        const intent: FakeIntent = {
          id,
          object: "payment_intent",
          status: "requires_action",
          amount: params.amount,
          amount_received: 0,
          metadata: params.metadata,
          next_action: {
            type: "promptpay_display_qr_code",
            promptpay_display_qr_code: {
              image_url_png: `https://fake.stripe.test/${id}.png`,
              hosted_instructions_url: `https://fake.stripe.test/${id}`,
            },
          },
        };
        intents.set(id, intent);
        return copy(intent);
      }),
      retrieve: vi.fn(async (id: string) => copy(get(id))),
      cancel: vi.fn(async (id: string) => {
        if (cancelError) throw cancelError;
        const intent = get(id);
        if (intent.status === "succeeded") {
          throw new Error("You cannot cancel this PaymentIntent because it has a status of succeeded.");
        }
        intent.status = "canceled";
        intent.next_action = null;
        return copy(intent);
      }),
    },
    refunds: {
      create: vi.fn(async (params: { payment_intent: string }) => ({
        id: `re_fake_${params.payment_intent}`,
        object: "refund",
      })),
    },
  };

  return {
    api,
    /** The customer scans the QR and pays. */
    pay(id: string) {
      const intent = get(id);
      intent.status = "succeeded";
      intent.amount_received = intent.amount;
      intent.next_action = null;
    },
    intent: (id: string) => copy(get(id)),
    /** Make every cancel call fail (e.g. Stripe unreachable) until reset. */
    failCancels(error: Error | null) {
      cancelError = error;
    },
    reset() {
      cancelError = null;
      api.paymentIntents.create.mockClear();
      api.paymentIntents.retrieve.mockClear();
      api.paymentIntents.cancel.mockClear();
      api.refunds.create.mockClear();
    },
  };
});

vi.mock("@/lib/stripe", () => ({ getStripe: () => fake.api }));

import prisma from "@/lib/prisma";
import { PAYMENT_GRACE_MS, PAYMENT_WINDOW_MS } from "@/lib/payment-config";
import { holdShowtimeSeats, releaseShowtimeSeats } from "@/services/seat.service";
import {
  cancelPaymentForUser,
  closeExpiredPaymentsForSeats,
  getPaymentStatusForUser,
  handleStripeEvent,
  startStripePayment,
} from "@/services/payment.service";

// ── Fixtures ────────────────────────────────────────────────

const RUN_ID = `payment-window-${Date.now()}`;
let userSeq = 0;
let showtime: { id: string; screenId: string };
let customer: string;
let rival: string;
const createdUsers: string[] = [];

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${RUN_ID}-${label}-${++userSeq}@test.cinego.local`,
      passwordHash: "not-a-real-hash",
      name: `Payment Window Test ${label}`,
    },
  });
  createdUsers.push(user.id);
  return user.id;
}

/** Seats of the test showtime that nobody holds or has bought. */
async function freeSeats(count: number) {
  const taken = await prisma.bookingSeat.findMany({
    where: { showtimeId: showtime.id },
    select: { seatId: true },
  });
  const takenIds = new Set(taken.map((t) => t.seatId));
  const seats = await prisma.seat.findMany({
    where: { screenId: showtime.screenId },
    orderBy: [{ rowLabel: "desc" }, { seatNum: "desc" }],
  });
  const free = seats.filter((s) => !takenIds.has(s.id)).slice(0, count);
  if (free.length < count) throw new Error("Not enough free seats on the test showtime.");
  return free.map((s) => s.id);
}

/** What the hold route does: close expired payments on those seats, then hold. */
async function holdLikeRoute(userId: string, seatIds: string[]) {
  await closeExpiredPaymentsForSeats({ showtimeId: showtime.id, seatIds, userId });
  return holdShowtimeSeats({ showtimeId: showtime.id, seatIds, userId });
}

/** Hold seats and press "Pay with PromptPay". */
async function startPayment(userId: string, seatIds: string[]) {
  const hold = await holdLikeRoute(userId, seatIds);
  expect(hold.success, hold.error).toBe(true);
  const started = await startStripePayment({ userId, showtimeId: showtime.id });
  if (!started.success) throw new Error(`startStripePayment failed: ${started.error}`);
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: started.checkout.paymentId },
  });
  return { paymentId: payment.id, intentId: payment.transactionReference, bookingId: payment.bookingId };
}

/** Pretend the 10-minute window is over; with `graceOver`, the 2-minute seat grace too. */
async function passTime(paymentId: string, opts: { graceOver: boolean }) {
  const past = new Date(Date.now() - 1000);
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { expiresAt: past },
  });
  if (opts.graceOver) {
    await prisma.bookingSeat.updateMany({
      where: { bookingId: payment.bookingId },
      data: { heldUntil: past },
    });
  }
}

/** Stripe delivers payment_intent.succeeded to the webhook. */
async function deliverSucceededWebhook(intentId: string) {
  await handleStripeEvent({
    id: `evt_fake_${intentId}`,
    type: "payment_intent.succeeded",
    data: { object: fake.intent(intentId) },
  } as unknown as Stripe.Event);
}

async function bookingState(bookingId: string) {
  return prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payment: true, seats: true, ticket: true },
  });
}

beforeAll(async () => {
  const found = await prisma.showtime.findFirst({
    where: { startsAt: { gt: new Date(Date.now() + 60 * 60 * 1000) } },
    orderBy: { startsAt: "desc" },
    select: { id: true, screenId: true },
  });
  if (!found) throw new Error("No future showtime found — run the seed script first.");
  showtime = found;
});

beforeEach(async () => {
  fake.reset();
  customer = await createUser("customer");
  rival = await createUser("rival");
});

afterEach(async () => {
  const userIds = createdUsers.splice(0);
  const bookingIds = (
    await prisma.booking.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  ).map((b) => b.id);
  await prisma.ticket.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingSeat.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  vi.restoreAllMocks();
});

// ── The 10-minute window ────────────────────────────────────

describe("PromptPay payment window (10 min + 2 min grace)", () => {
  it("starting a payment extends the hold once: 10 min to pay, seats held 12 min", async () => {
    const seatIds = await freeSeats(2);
    const before = Date.now();
    const { paymentId, bookingId } = await startPayment(customer, seatIds);

    const state = await bookingState(bookingId);
    const expiresAt = state.payment!.expiresAt!.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + PAYMENT_WINDOW_MS - 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + PAYMENT_WINDOW_MS);
    for (const bs of state.seats) {
      expect(bs.heldUntil!.getTime()).toBe(expiresAt + PAYMENT_GRACE_MS);
    }

    // Pressing Pay again (or reloading) shows the same QR and never extends the window
    const again = await startStripePayment({ userId: customer, showtimeId: showtime.id });
    expect(again.success && again.checkout.paymentId).toBe(paymentId);
    expect(fake.api.paymentIntents.create).toHaveBeenCalledTimes(1);
    const after = await bookingState(bookingId);
    expect(after.payment!.expiresAt!.getTime()).toBe(expiresAt);
    expect(after.seats.map((bs) => bs.heldUntil!.getTime())).toEqual(
      state.seats.map((bs) => bs.heldUntil!.getTime()),
    );
  });

  it("seats stay locked while the window is open", async () => {
    const seatIds = await freeSeats(1);
    const { bookingId } = await startPayment(customer, seatIds);

    const stolen = await holdLikeRoute(rival, seatIds);
    expect(stolen.success).toBe(false);

    const released = await releaseShowtimeSeats({ showtimeId: showtime.id, userId: customer });
    expect(released.success).toBe(false);

    const changed = await holdShowtimeSeats({
      showtimeId: showtime.id,
      seatIds: await freeSeats(1),
      userId: customer,
    });
    expect(changed.success).toBe(false);
    expect(changed.error).toMatch(/payment in progress/i);

    expect((await bookingState(bookingId)).seats).toHaveLength(1);
    expect(fake.api.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("countdown reaching zero cancels the QR and frees the seats", async () => {
    const seatIds = await freeSeats(2);
    const { paymentId, intentId, bookingId } = await startPayment(customer, seatIds);
    await passTime(paymentId, { graceOver: false });

    // PromptPayPanel calls the cancel route when its countdown hits 0
    const result = await cancelPaymentForUser(paymentId, customer);
    expect(result?.status).toBe("CANCELLED");
    expect(result?.ticketId).toBeNull();

    // The QR can no longer be paid
    expect(fake.api.paymentIntents.cancel).toHaveBeenCalledWith(intentId);
    expect(fake.intent(intentId).status).toBe("canceled");

    const state = await bookingState(bookingId);
    expect(state.payment!.status).toBe("CANCELLED");
    expect(state.status).toBe("EXPIRED"); // window ran out, not a customer cancel
    expect(state.seats).toHaveLength(0);
    expect(state.ticket).toBeNull();

    // Paying again needs new seats; the old ones are free for anyone
    const retry = await startStripePayment({ userId: customer, showtimeId: showtime.id });
    expect(retry.success).toBe(false);
    expect((await holdLikeRoute(rival, seatIds)).success).toBe(true);
  });

  it("the status poll closes an expired payment even if the countdown never fires", async () => {
    const seatIds = await freeSeats(1);
    const { paymentId, intentId, bookingId } = await startPayment(customer, seatIds);
    await passTime(paymentId, { graceOver: false });

    const status = await getPaymentStatusForUser(paymentId, customer);
    expect(status?.status).toBe("CANCELLED");
    expect(fake.intent(intentId).status).toBe("canceled");

    const state = await bookingState(bookingId);
    expect(state.status).toBe("EXPIRED");
    expect(state.seats).toHaveLength(0);
  });

  it("another customer selecting the seats closes an expired payment (no cron needed)", async () => {
    const seatIds = await freeSeats(1);
    const { paymentId, intentId, bookingId } = await startPayment(customer, seatIds);
    await passTime(paymentId, { graceOver: false }); // still inside the 2-min grace

    const hold = await holdLikeRoute(rival, seatIds);
    expect(hold.success, hold.error).toBe(true);

    expect(fake.intent(intentId).status).toBe("canceled");
    const state = await bookingState(bookingId);
    expect(state.payment!.status).toBe("CANCELLED");
    expect(state.status).toBe("EXPIRED");
    const seat = await prisma.bookingSeat.findFirstOrThrow({
      where: { showtimeId: showtime.id, seatId: seatIds[0] },
    });
    expect(seat.bookingId).toBe(hold.bookingId);
  });

  it("a payment made at the last second wins the race with the cancel and gets a ticket", async () => {
    const seatIds = await freeSeats(2);
    const { paymentId, intentId, bookingId } = await startPayment(customer, seatIds);
    fake.pay(intentId); // customer pays…
    await passTime(paymentId, { graceOver: false }); // …just as the countdown hits zero

    const result = await cancelPaymentForUser(paymentId, customer);
    expect(result?.status).toBe("SUCCESS");
    expect(result?.ticketId).toBeTruthy();

    const state = await bookingState(bookingId);
    expect(state.status).toBe("PAID");
    expect(state.payment!.status).toBe("SUCCESS");
    expect(state.seats).toHaveLength(2);
    expect(state.seats.every((bs) => bs.heldUntil === null)).toBe(true);
    expect(state.ticket?.id).toBe(result?.ticketId);
    expect(fake.api.refunds.create).not.toHaveBeenCalled();
  });
});

// ── Late payment → automatic refund ─────────────────────────

describe("late payment after the seats were taken", () => {
  it("is refunded automatically and the other customer keeps the seat", async () => {
    const seatIds = await freeSeats(2);
    const { paymentId, intentId, bookingId } = await startPayment(customer, seatIds);
    await passTime(paymentId, { graceOver: true });

    // Stripe is unreachable when the rival selects a seat, so the old payment can't be closed;
    // its hold (window + grace) is over, so the rival still gets the seat.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    fake.failCancels(new Error("fake Stripe: connection error"));
    const hold = await holdLikeRoute(rival, [seatIds[0]]);
    fake.failCancels(null);
    expect(hold.success, hold.error).toBe(true);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining(`could not close expired payment ${paymentId}`),
      expect.anything(),
    );
    expect((await bookingState(bookingId)).payment!.status).toBe("PENDING");

    // The customer pays anyway, and Stripe's webhook arrives
    fake.pay(intentId);
    await deliverSucceededWebhook(intentId);

    const state = await bookingState(bookingId);
    expect(state.payment!.status).toBe("REFUNDED");
    expect(state.payment!.refundedAt).toBeInstanceOf(Date);
    expect(state.status).toBe("EXPIRED");
    expect(state.ticket).toBeNull();
    expect(state.seats).toHaveLength(0); // the seat the rival didn't take is released too

    expect(fake.api.refunds.create).toHaveBeenCalledTimes(1);
    expect(fake.api.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: intentId }),
      { idempotencyKey: `cinego-refund-${paymentId}` },
    );

    const rivalSeat = await prisma.bookingSeat.findFirstOrThrow({
      where: { showtimeId: showtime.id, seatId: seatIds[0] },
    });
    expect(rivalSeat.bookingId).toBe(hold.bookingId);
    expect(
      await prisma.bookingSeat.count({ where: { showtimeId: showtime.id, seatId: seatIds[1] } }),
    ).toBe(0);

    // The customer's checkout page reports the refund
    const status = await getPaymentStatusForUser(paymentId, customer);
    expect(status?.status).toBe("REFUNDED");
    expect(status?.message).toMatch(/refunded/i);
  });

  it("a repeated webhook does not refund twice", async () => {
    const seatIds = await freeSeats(1);
    const { paymentId, intentId, bookingId } = await startPayment(customer, seatIds);
    await passTime(paymentId, { graceOver: true });

    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.failCancels(new Error("fake Stripe: connection error"));
    expect((await holdLikeRoute(rival, seatIds)).success).toBe(true);
    fake.failCancels(null);

    fake.pay(intentId);
    await deliverSucceededWebhook(intentId);
    await deliverSucceededWebhook(intentId); // Stripe retries / `stripe events resend`

    expect(fake.api.refunds.create).toHaveBeenCalledTimes(1);
    const state = await bookingState(bookingId);
    expect(state.payment!.status).toBe("REFUNDED");
    expect(await prisma.payment.count({ where: { bookingId } })).toBe(1);
    expect(state.ticket).toBeNull();
  });
});
