"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

interface Props {
  onScan: (decodedText: string) => void;
  paused: boolean;
}

function cameraErrorMessage(err: unknown): string {
  const text = String(err);
  if (text.includes("NotAllowedError")) return "Camera permission was denied. Allow it in the browser's site settings.";
  if (text.includes("NotFoundError")) return "No camera was found on this device.";
  if (text.includes("NotReadableError")) return "The camera is being used by another app.";
  return "Could not start the camera. Use manual entry below.";
}

export default function QrScanner({ onScan, paused }: Props) {
  const elementId = `qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Long-lived camera callback always calls the parent's latest onScan, without restarting the camera
  const handleDecoded = useEffectEvent((text: string) => onScan(text));

  // Start the camera once on mount, stop it on unmount
  useEffect(() => {
    let cancelled = false; // Strict Mode mounts twice in dev: the first run gives up here
    let scanner: Html5Qrcode | null = null;
    let starting: Promise<unknown> | null = null;

    (async () => {
      // Imported here, not at the top: the library touches `window` and must not run on the server
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      if (!window.isSecureContext) {
        setError("The camera needs HTTPS (or localhost). Use manual entry below.");
        return;
      }

      scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;
      starting = scanner.start(
        { facingMode: "environment" }, // back camera on phones
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => handleDecoded(decodedText),
        () => {} // called for every frame without a QR: ignore
      );
      try {
        await starting;
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current = null;
      const s = scanner;
      // Stopping a camera that has not finished starting throws, so wait for start() first
      if (s && starting) {
        starting.then(() => s.stop()).then(() => s.clear()).catch(() => {});
      }
    };
  }, [elementId]);

  // Pause decoding while a result is on screen, resume afterwards
  useEffect(() => {
    const s = scannerRef.current;
    if (!s || !ready) return;
    try {
      if (paused) s.pause(true);
      else s.resume();
    } catch {
      // Not in a pausable state (e.g. still starting): safe to ignore
    }
  }, [paused, ready]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div id={elementId} className="w-full" />
      {!ready && !error && <p className="p-6 text-center text-sm text-zinc-400">Starting camera…</p>}
      {error && <p className="p-6 text-center text-sm text-amber-300">{error}</p>}
    </div>
  );
}
