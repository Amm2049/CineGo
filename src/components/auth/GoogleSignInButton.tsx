"use client";

// src/components/auth/GoogleSignInButton.tsx
// "Continue with Google" for the login and register pages. Renders nothing unless the server has the
// Google provider configured (GOOGLE_CLIENT_ID/SECRET), so CI and preview deploys don't show a dead button.
// Google accounts are always CUSTOMER accounts, so after sign-in they return to the page that asked for
// login (if a customer may use it) or the home page.

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { postLoginPath } from "@/lib/roles";

export default function GoogleSignInButton({ disabled = false }: { disabled?: boolean }) {
  const [available, setAvailable] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => active && setAvailable(Boolean(providers?.google)))
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  function handleClick() {
    setRedirecting(true);
    const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
    void signIn("google", { callbackUrl: postLoginPath(callbackUrl, "CUSTOMER") });
  }

  return (
    <>
      <div className="flex items-center gap-3 my-5" aria-hidden="true">
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#c7d2fe]">or</span>
        <span className="h-px flex-1 bg-white/15" />
      </div>
      <button
        id="btn-google-sign-in"
        type="button"
        onClick={handleClick}
        disabled={disabled || redirecting}
        className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1f1f1f] font-bold py-2.5 rounded-xl text-xs tracking-wide hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {redirecting ? "Opening Google…" : "Continue with Google"}
      </button>
    </>
  );
}
