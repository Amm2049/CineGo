// src/app/(customer)/profile/page.tsx
// Profile & Genre Preferences page -- Clean Server Component querying user.service.ts

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserProfile, getGenresWithUserSelection } from "@/services/user.service";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile & Preferences",
  description: "Manage your CineGo account and favorite genres for AI recommendations.",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const [user, genresWithSelection] = await Promise.all([
    getUserProfile(session.user.id),
    getGenresWithUserSelection(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  const selectedGenreIds = user.interests.map((i) => i.genreId);
  const allGenres = genresWithSelection.map((g) => ({ id: g.id, name: g.name }));

  return (
    <main className="flex-1 min-h-screen bg-[#03030d] text-white py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProfileClient
          user={{
            id: user.id,
            email: user.email,
            name: user.name || "Cinema Enthusiast",
            role: user.role,
            createdAt: user.createdAt.toISOString(),
          }}
          allGenres={allGenres}
          initialSelectedGenreIds={selectedGenreIds}
        />
      </div>
    </main>
  );
}
