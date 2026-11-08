// src/app/admin/showtimes/page.tsx
import { getShowtimeFormOptions, listShowtimesForDay } from "@/services/showtime.service";
import { todayInCinemaTz } from "@/lib/schedule";
import { requireAdminPage } from "@/lib/admin-guard";
import AdminShowtimesClient from "./AdminShowtimesClient";

export const dynamic = "force-dynamic";

export default async function AdminShowtimesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdminPage();
  const { date } = await searchParams;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayInCinemaTz();

  const [{ movies, screens }, showtimes] = await Promise.all([
    getShowtimeFormOptions(),
    listShowtimesForDay(day),
  ]);

  // Not keyed by day: the form keeps its movie/theatre when the admin moves between days
  return (
    <AdminShowtimesClient
      day={day}
      nowIso={new Date().toISOString()} // one clock for "Now playing", server and client
      movies={movies}
      screens={screens}
      showtimes={showtimes}
    />
  );
}
