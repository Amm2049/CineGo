// src/app/(customer)/loading.tsx
// Fallback loading state for any customer page without its own skeleton

import { LoadingRegion } from "@/components/ui/Skeleton";

export default function CustomerLoading() {
  return (
    <LoadingRegion
      label="Loading"
      className="flex-1 min-h-screen bg-[#03030d] flex items-center justify-center"
    >
      <span
        aria-hidden
        className="w-10 h-10 rounded-full border-4 border-[#2500f0]/30 border-t-[#5938ff] animate-spin"
      />
    </LoadingRegion>
  );
}
