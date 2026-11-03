// src/app/(customer)/tickets/loading.tsx
// Instant skeleton for My Tickets while booking history loads

import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

function TicketRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-[#06071d]">
      <Skeleton className="w-14 h-14 shrink-0 rounded-xl" />
      <Skeleton className="w-10 h-15 shrink-0 hidden sm:block" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </div>
  );
}

export default function TicketsLoading() {
  return (
    <LoadingRegion
      label="Loading your tickets"
      className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">My Tickets</h1>
        <section className="space-y-3">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 3 }, (_, i) => (
            <TicketRowSkeleton key={i} />
          ))}
        </section>
      </div>
    </LoadingRegion>
  );
}
