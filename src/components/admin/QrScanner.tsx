"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

interface Props {
  onScan: (decodedText: string) => void;
  paused: boolean;
}

// "unknown" errors are often a blocked permission too, so they get the same help steps
type CameraError = { message: string; kind: "permission" | "unknown" | "other" };

function cameraError(err: unknown): CameraError {
  const text = String(err);
  if (text.includes("NotAllowedError")) return { kind: "permission", message: "Camera access is blocked." };
  if (text.includes("NotFoundError")) return { kind: "other", message: "No camera was found on this device." };
  if (text.includes("NotReadableError"))
    return { kind: "other", message: "The camera is being used by another app. Close it, then try again." };
  return { kind: "unknown", message: "Could not start the camera. The browser may be blocking it." };
}

export default function QrScanner({ onScan, paused }: Props) {
  const elementId = `qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again" to restart the camera

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
        setError({ kind: "other", message: "The camera needs HTTPS (or localhost)." });
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
        try {
          scanner.clear(); // remove the half-built video so "Try again" starts clean
        } catch {}
        if (!cancelled) setError(cameraError(err));
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
  }, [elementId, attempt]);

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

  function retry() {
    setError(null);
    setReady(false);
    setAttempt((a) => a + 1);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div id={elementId} key={attempt} className="w-full" />
      {!ready && !error && <p className="p-6 text-center text-sm text-zinc-400">Starting camera…</p>}
      {ready && !paused && (
        <p className="border-t border-white/10 px-4 py-2.5 text-center text-sm text-emerald-300">
          Ready — hold the ticket QR inside the frame
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-3 p-6 text-sm text-amber-200">
          <p className="font-semibold">{error.message}</p>
          {error.kind !== "other" && (
            <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
              <li>Click the camera or lock icon in the browser&apos;s address bar → Camera → Allow.</li>
              <li>
                On Windows, also check Settings → Privacy &amp; security → Camera (camera access and &quot;Let desktop
                apps access your camera&quot; on).
              </li>
              <li>Then press Try again.</li>
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="min-h-11 rounded-xl bg-white/90 px-5 font-bold text-black hover:bg-white"
            >
              Try again
            </button>
            <span className="text-zinc-400">or type the ticket code below.</span>
          </div>
        </div>
      )}
    </div>
  );
}
