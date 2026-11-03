// src/app/(customer)/tickets/[id]/loading.tsx
// Instant skeleton for the Digital Ticket Pass while the ticket loads

import Link from "next/link";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function TicketPassLoading() {
  return (
    <LoadingRegion
      label="Loading ticket"
      className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-md mx-auto space-y-5">
        <Link
          href="/tickets"
          className="inline-block text-sm font-bold text-[#c7d2fe] hover:text-white transition-colors"
        >
          ← My Tickets
        </Link>

        <div className="rounded-3xl overflow-hidden border border-[#2500f0]/40 bg-[#06071d]">
          {/* Movie header */}
          <div className="flex items-center gap-4 p-6">
            <Skeleton className="w-16 h-24 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-2/5" />
            </div>
          </div>

          {/* Theatre / seats */}
          <div className="grid grid-cols-3 gap-3 px-6 pb-6">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="col-span-2 h-16 rounded-xl" />
          </div>

          {/* Tear line */}
          <div className="relative h-0 border-t border-dashed border-white/20" aria-hidden>
            <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#02020a]" />
            <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#02020a]" />
          </div>

          {/* QR code + booking reference */}
          <div className="flex flex-col items-center gap-3 p-6">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="w-[232px] h-[232px] rounded-2xl" />
            <Skeleton className="h-3.5 w-4/5" />
            <div className="w-full pt-4 mt-1 border-t border-white/10 flex flex-col items-center gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-40" />
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
