// src/app/(customer)/checkout/[showtimeId]/page.tsx
// Seat selection and checkout page

import Link from "next/link";
import { redirect } from "next/navigation";
import { homePathForRole, isCustomer } from "@/lib/roles";
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

  // Admin and staff accounts run the cinema; buying tickets needs a customer account
  if (!isCustomer(session.user.role)) {
    const home = homePathForRole(session.user.role);
    return (
      <main className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-3xl" aria-hidden>🎟️</p>
          <h1 className="mt-3 text-xl font-black">Booking is for customer accounts</h1>
          <p className="mt-2 text-sm text-zinc-300">
            You&apos;re signed in as <span className="font-semibold">{session.user.role.toLowerCase()}</span>.
            Staff and admin accounts run the cinema; to buy a ticket, sign in with a customer account.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={home} className="btn-cobalt rounded-xl px-5 py-2.5 text-sm font-bold">
              {home === "/admin" ? "Go to Admin" : "Go to Scanner"}
            </Link>
            <Link
              href="/movies"
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/[0.06]"
            >
              Back to Movies
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
