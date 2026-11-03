// src/app/(customer)/checkout/[showtimeId]/loading.tsx
// Instant skeleton for seat selection while the seat map loads

import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

const ROWS = 8;
const SEATS_PER_ROW = 12;

export default function SeatSelectionLoading() {
  return (
    <LoadingRegion
      label="Loading seat map"
      className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Movie + showtime header */}
        <div className="flex items-center gap-4 pb-6 border-b border-[#2500f0]/30">
          <Skeleton className="w-14 h-20 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/2 sm:w-1/3" />
            <Skeleton className="h-3.5 w-2/3 sm:w-1/2" />
            <Skeleton className="h-3 w-1/3 sm:w-1/4" />
          </div>
        </div>

        {/* Checkout progress steps */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="h-3 w-14" />
              {step < 2 && <span className="w-6 sm:w-10 h-px bg-white/15" aria-hidden />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
          {/* Screen + seat grid */}
          <div className="space-y-6 min-w-0">
            <Skeleton className="h-2 w-3/4 mx-auto rounded-full" />
            <div className="space-y-2 overflow-hidden">
              {Array.from({ length: ROWS }, (_, r) => (
                <div key={r} className="flex justify-center gap-1.5">
                  {Array.from({ length: SEATS_PER_ROW }, (_, s) => (
                    <Skeleton key={s} className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-md" />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* Booking summary */}
          <div className="p-3 lg:p-5 rounded-2xl bg-[#06071d]/95 border border-[#2500f0]/50 space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
