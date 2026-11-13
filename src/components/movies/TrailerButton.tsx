// src/components/movies/TrailerButton.tsx
// "Watch trailer" on the movie page: opens the YouTube trailer in a pop-up.
// The player is only mounted while the pop-up is open, so closing it stops the video.

"use client";

import { useRef, useState } from "react";

interface TrailerButtonProps {
  /** YouTube video id (Movie.trailerKey) */
  trailerKey: string;
  title: string;
}

export default function TrailerButton({ trailerKey, title }: TrailerButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    dialogRef.current?.showModal(); // native modal: focus trap + Escape to close
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition-colors hover:border-[#5938ff] hover:bg-[#2500f0]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5938ff]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M8 5v14l11-7z" />
        </svg>
        Watch trailer
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`${title} trailer`}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // click on the dark area around the video
        }}
        className="m-auto w-[min(92vw,960px)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/85"
      >
        <div className="flex items-center justify-end gap-1 pb-2">
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailerKey)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[#c7d2fe] hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5938ff]"
          >
            Open on YouTube ↗
          </a>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 rounded-xl px-3 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5938ff]"
          >
            Close ✕
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
          {open && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&rel=0`}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full"
            />
          )}
        </div>
      </dialog>
    </>
  );
}
