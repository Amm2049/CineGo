// src/components/ui/Skeleton.tsx
// Shared loading placeholders used by route-level loading.tsx files

import { cn } from "@/lib/utils";

/** A single pulsing placeholder block. Size and shape come from className. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn("animate-pulse rounded-md bg-white/[0.07]", className)}
    />
  );
}

/** Wraps a page skeleton so screen readers announce a single "Loading" status. */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </main>
  );
}
