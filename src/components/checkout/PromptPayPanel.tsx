// src/components/checkout/PromptPayPanel.tsx
// Phase 9: shows the Stripe PromptPay QR with a 10-minute countdown and polls the payment status
// every 3 seconds. SUCCESS → ticket page; CANCELLED / FAILED / REFUNDED → back to seat selection.

"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import SeatHoldTimer from "@/components/seatmap/SeatHoldTimer";
import type { PaymentStatusResponse, PromptPayCheckout } from "@/types";

const fetcher = async (url: string): Promise<PaymentStatusResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
};

interface Props {
  checkout: PromptPayCheckout;
  onPaid: (ticketId: string) => void;
  onClosed: (message: string) => void;
}

export default function PromptPayPanel({ checkout, onPaid, onClosed }: Props) {
  const [isCancelling, setIsCancelling] = useState(false);
  const finishedRef = useRef(false);

  // One place that reacts to a final status, whether it came from the poll or from cancel
  const handleStatus = (status: PaymentStatusResponse) => {
    if (finishedRef.current || status.status === "PENDING") return;
    finishedRef.current = true;
    if (status.status === "SUCCESS" && status.ticketId) {
      onPaid(status.ticketId);
    } else {
      onClosed(
        status.message ??
          "The payment was not completed. Please select your seats again.",
      );
    }
  };

  useSWR(`/api/payments/${checkout.paymentId}`, fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true,
    onSuccess: handleStatus,
  });

  // Cancel button, and the countdown reaching zero. The server cancels the PaymentIntent; if the
  // customer paid at the last second it answers SUCCESS and we go to the ticket instead.
  const cancel = async () => {
    if (finishedRef.current) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/payments/${checkout.paymentId}/cancel`, {
        method: "POST",
      });
      if (res.ok) handleStatus(await res.json());
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="promptpay-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white">Pay with PromptPay</h2>
        <SeatHoldTimer
          heldUntil={checkout.expiresAt}
          onExpire={cancel}
          label="Pay within"
        />
      </div>

      <div className="mx-auto w-fit p-3 rounded-2xl bg-white">
        {/* Stripe-hosted QR image; next/image would need Stripe's CDN whitelisted for no benefit */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={checkout.qrImageUrl}
          alt="PromptPay QR code"
          width={208}
          height={208}
          className="w-52 h-52"
        />
      </div>

      <p className="text-center text-2xl font-black text-white">
        ฿{checkout.amount.toLocaleString()}
      </p>

      <ol className="text-xs text-zinc-300 space-y-1 list-decimal list-inside">
        <li>Open any Thai banking app and choose “Scan QR”.</li>
        <li>Scan the code and confirm the amount.</li>
        <li>Keep this page open — your ticket appears automatically.</li>
      </ol>

      <p
        className="flex items-center gap-2 text-xs text-amber-200"
        role="status"
      >
        <span
          className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
          aria-hidden
        />
        Waiting for payment…
      </p>

      <a
        href={checkout.hostedInstructionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-xs text-[#9d8bff] underline underline-offset-2"
      >
        Test mode: open Stripe’s payment page to approve or fail this payment
      </a>

      <button
        type="button"
        onClick={cancel}
        disabled={isCancelling}
        className="w-full px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 disabled:opacity-40 text-zinc-200 font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        {isCancelling ? "Cancelling…" : "Cancel payment"}
      </button>
    </div>
  );
}
