// src/components/tickets/TicketQRCode.tsx
// Scannable QR code for the digital ticket pass (read by the Phase 8 admin WebCam scanner)

"use client";

import { QRCodeSVG } from "qrcode.react";

interface TicketQRCodeProps {
  payload: string;
  size?: number;
}

export default function TicketQRCode({ payload, size = 200 }: TicketQRCodeProps) {
  return (
    <div className="inline-block p-4 rounded-2xl bg-white">
      <QRCodeSVG value={payload} size={size} level="M" marginSize={0} />
    </div>
  );
}
