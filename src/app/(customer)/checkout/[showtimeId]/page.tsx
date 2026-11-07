// src/app/(customer)/checkout/[showtimeId]/page.tsx
// Seat selection and checkout page

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getShowtimeSeatMap } from "@/services/seat.service";
import { getPaymentProvider } from "@/lib/payment-config";
import { getOpenPromptPayCheckout } from "@/services/payment.service";
import SeatSelectionClient from "./SeatSelectionClient";

export const dynamic = "force-dynamic";

export default async function SeatSelectionPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const { showtimeId } = await params;
    redirect(`/login?callbackUrl=/checkout/${showtimeId}`);
  }

  const { showtimeId } = await params;
  const initialData = await getShowtimeSeatMap(showtimeId, session.user.id);

  if (!initialData) {
    redirect("/movies");
  }

  const paymentProvider = getPaymentProvider();
  const initialCheckout =
    paymentProvider === "stripe"
      ? await getOpenPromptPayCheckout(session.user.id, showtimeId)
      : null;

  return (
    <main className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <SeatSelectionClient
        showtimeId={showtimeId}
        initialData={initialData}
        paymentProvider={paymentProvider}
        initialCheckout={initialCheckout}
      />
    </main>
  );
}
