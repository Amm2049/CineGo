// Server component: loads the table data, hands it to the client component
import { listAdminMovies } from "@/services/admin.service";
import { hasTmdbCredentials } from "@/lib/tmdb";
import { requireAdminPage } from "@/lib/admin-guard";
import AdminMoviesClient from "./AdminMoviesClient";

export const dynamic = "force-dynamic";

export default async function AdminMoviesPage() {
  await requireAdminPage(); // STAFF may use the scanner only
  const movies = await listAdminMovies();
  return <AdminMoviesClient movies={movies} tmdbConfigured={hasTmdbCredentials()} />;
}
