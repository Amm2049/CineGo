// src/app/(customer)/profile/loading.tsx
// Instant skeleton for Profile & Preferences while account + genres load

import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <LoadingRegion
      label="Loading profile"
      className="flex-1 min-h-screen bg-[#03030d] text-white py-12"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>

        {/* Account details panel */}
        <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-4">
          <Skeleton className="h-4 w-36" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Genre preferences panel */}
        <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-4">
          <Skeleton className="h-4 w-44" />
          <div className="flex flex-wrap gap-2">
            {[80, 64, 96, 72, 88, 60, 104, 76].map((w, i) => (
              <Skeleton key={i} className="h-9 rounded-xl" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
