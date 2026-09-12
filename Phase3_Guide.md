# Phase 3: Step-by-Step Implementation Guide

**Goal:** Implement Auth.js (NextAuth) with bcrypt password hashing, role-based session management, Login/Register UI pages, route protection middleware, and an auth-aware Navbar.

**Source of truth:** `CiniGo_Phase_Plan.md` lines 78-98 | `CiniGo_Scope.md` Sections 4.2, 5 (FR-01)

---

## Overview — What We Build in Phase 3

```
phase/phase3-auth
   feature/auth-config   (auth backend: next-auth, bcrypt, register API)
   feature/auth-ui       (login/register pages, middleware, Navbar)
```

**Deliverables:**
- `src/lib/auth.ts` -- NextAuth config (credentials provider + role in session)
- `src/app/api/auth/[...nextauth]/route.ts` -- NextAuth catch-all route
- `src/app/api/auth/register/route.ts` -- Registration endpoint with bcrypt
- `src/app/(auth)/login/page.tsx` -- Login page
- `src/app/(auth)/register/page.tsx` -- Register page
- `src/middleware.ts` -- Route protection (ADMIN only for /admin/*)
- `src/components/layout/Navbar.tsx` -- Auth-aware navigation bar
- Updated `src/app/layout.tsx` -- Wrap app in SessionProvider + Navbar

---

## Step 1: Git Branching

```bash
# Make sure you are on develop and up to date
git checkout develop
git pull origin develop

# Create permanent phase milestone branch
git checkout -b phase/phase3-auth
git push origin phase/phase3-auth

# Create first feature branch
git checkout -b feature/auth-config
```

Your branch tree is now:
```
main
develop
  phase/phase3-auth          <-- permanent milestone (NEVER delete)
    feature/auth-config      <-- you are HERE
```

---

## Step 2: Install Dependencies

```bash
npm install next-auth@4 bcryptjs
npm install -D @types/bcryptjs
```

> **Why next-auth@4?** Auth.js v5 (next-auth@5) is still in beta and has different import paths. The scope specifies Auth.js/NextAuth with credentials provider -- v4 is stable and well-documented for this use case.

---

## Step 3: Add Auth Environment Variables

Your `.env` already has placeholders from Phase 2. Make sure these are set:

```env
# ── Authentication (Phase 3) ────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000
```

Generate a secret now:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and paste it as `NEXTAUTH_SECRET` in your `.env`.

---

## Step 4: Add `name` Field to User Model (Optional but Recommended)

The scope specifies `Profile & Genre Preferences (/profile)` in Phase 4 where users manage account details. Add a `name` field to `User` in `prisma/schema.prisma` now to avoid another migration later:

```prisma
model User {
  id           String         @id @default(uuid())
  email        String         @unique
  name         String?        // Display name (optional)
  passwordHash String
  role         Role           @default(CUSTOMER)
  createdAt    DateTime       @default(now())
  bookings     Booking[]
  interests    UserInterest[]
}
```

Then create and apply the migration:
```bash
# Create migration file
npx prisma migrate dev --create-only --name add-user-name
# Then open the generated file and verify the SQL, then apply:
npx prisma migrate deploy
npx prisma generate
```

Or write the SQL manually (same pattern as the tmdbId fix):
```sql
-- prisma/migrations/<timestamp>_add_user_name/migration.sql
ALTER TABLE "User" ADD COLUMN "name" TEXT;
```

> **Note:** This is optional for Phase 3 to work. Skip if you want to keep scope minimal.

---

## Step 5: Implement `src/lib/auth.ts`

Replace the stub with the full NextAuth configuration:

```typescript
// src/lib/auth.ts
// Auth.js (NextAuth v4) configuration -- credentials provider with bcrypt + role-based session

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("No account found with that email");
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordMatch) {
          throw new Error("Incorrect password");
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, attach role + id to the JWT token
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; email: string; role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose id and role on the client-side session object
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
```

### Extend TypeScript Types for NextAuth Session

Create `src/types/next-auth.d.ts` to extend the default NextAuth types with our `id` and `role` fields:

```typescript
// src/types/next-auth.d.ts
// Extends NextAuth's built-in types to include id and role on the session user

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
```

---

## Step 6: Create NextAuth API Route Handler

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
// src/app/api/auth/[...nextauth]/route.ts
// NextAuth v4 catch-all route handler for App Router

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

---

## Step 7: Create Register API Endpoint

Create `src/app/api/auth/register/route.ts`:

```typescript
// src/app/api/auth/register/route.ts
// Registration endpoint: validates input, hashes password, creates User record

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body as {
      email: string;
      password: string;
      name?: string;
    };

    // ── Validation ──────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // ── Check for existing account ──────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    // ── Hash password & create user ─────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        ...(name ? { name } : {}),
        role: "CUSTOMER",
      },
    });

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: { id: user.id, email: user.email, role: user.role },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

## Step 8: Commit `feature/auth-config` and Merge

```bash
git add .
git commit -m "feat(phase3): auth.js credentials provider, bcrypt register endpoint, role-based JWT session"

# Merge into phase branch
git checkout phase/phase3-auth
git merge feature/auth-config

# Delete temporary feature branch
git branch -d feature/auth-config

# Create next feature branch
git checkout -b feature/auth-ui
```

---

## Step 9: Install shadcn/ui (Now Required for Auth UI)

shadcn/ui is listed in the scope as the component library. Phase 3 is the first phase to build form-heavy UI, so install it now.

```bash
npx shadcn@latest init
```

When prompted, choose:
- **Style:** Default
- **Base color:** Slate (works well with dark cinema theme)
- **CSS variables:** Yes

Then add the components we need for auth forms:

```bash
npx shadcn@latest add button input label card form
```

This creates components in `src/components/ui/`.

---

## Step 10: Build Login Page (`/login`)

Create `src/app/(auth)/login/page.tsx`:

```tsx
// src/app/(auth)/login/page.tsx
// Login page -- credentials sign-in via NextAuth

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Welcome back
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Sign in to your CineGo account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="text-center text-sm text-zinc-400 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-amber-400 hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
```

---

## Step 11: Build Register Page (`/register`)

Create `src/app/(auth)/register/page.tsx`:

```tsx
// src/app/(auth)/register/page.tsx
// Registration page -- calls POST /api/auth/register then auto-signs in

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    // 1. Register the account
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Registration failed");
      return;
    }

    // 2. Auto sign-in after successful registration
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created but sign-in failed. Please log in manually.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Create an account
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Join CineGo and start booking premium cinema experiences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-zinc-300">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <p className="text-center text-sm text-zinc-400 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-400 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
```

---

## Step 12: Create Route Protection Middleware

Create `src/middleware.ts` in the project root (next to `src/`):

```typescript
// src/middleware.ts
// Route protection: restricts /admin/* to ADMIN role only
// Unauthenticated users are redirected to /login

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;

  // Protect all /admin/* routes
  if (pathname.startsWith("/admin")) {
    if (!token) {
      // Not logged in -- redirect to login
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "ADMIN") {
      // Logged in but not admin -- redirect to homepage
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Protect /profile, /tickets, /checkout (must be logged in)
  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/tickets") ||
    pathname.startsWith("/checkout")
  ) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/tickets/:path*", "/checkout/:path*"],
};
```

---

## Step 13: Build Navbar Component

Create `src/components/layout/Navbar.tsx`:

```tsx
// src/components/layout/Navbar.tsx
// Auth-aware navigation bar -- shows different links based on auth state and role

"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-white hover:text-amber-400 transition-colors"
          >
            🎬 CineGo
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/movies" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Movies
            </Link>
            <Link href="/experiences" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Experiences
            </Link>
            {session && (
              <Link href="/tickets" className="text-sm text-zinc-400 hover:text-white transition-colors">
                My Tickets
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Auth Controls */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-zinc-800" />
            ) : session ? (
              <>
                <Link href="/profile">
                  <span className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    {session.user?.name ?? session.user?.email?.split("@")[0]}
                  </span>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-white"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  >
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

---

## Step 14: Update Root Layout with SessionProvider + Navbar

Update `src/app/layout.tsx` to wrap the app with NextAuth's `SessionProvider` and include the `Navbar`:

```tsx
// src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import Navbar from "@/components/layout/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineGo -- Premium Cinema Booking",
  description: "Discover movies, book premium seats, and get AI-powered recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}>
        <SessionProvider>
          <Navbar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

### Create the Client-Side SessionProvider Wrapper

Because `SessionProvider` from next-auth is a Client Component, but `layout.tsx` can be a Server Component, we wrap it:

Create `src/components/providers/SessionProvider.tsx`:

```tsx
// src/components/providers/SessionProvider.tsx
// Client-side wrapper for NextAuth SessionProvider
// Required because layout.tsx is a Server Component

"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

---

## Step 15: Create Admin User via Seed (or Register + DB Update)

To test Admin access, you need an ADMIN user. The easiest way is to manually update a registered user's role in the database:

**Option A: Seed an admin user (add to `prisma/seed.ts`)**

Add this block at the end of your seed's `main()` function (before the final log):

```typescript
// ── 6. Admin User ───────────────────────────────────────────
const adminPasswordHash = await bcrypt.hash("admin123", 12);
await prisma.user.upsert({
  where: { email: "admin@cinego.com" },
  update: {},
  create: {
    email: "admin@cinego.com",
    passwordHash: adminPasswordHash,
    role: "ADMIN",
  },
});
console.log("👤 Admin user created: admin@cinego.com / admin123");
```

Add the bcrypt import to the top of seed.ts:
```typescript
import bcrypt from "bcryptjs";
```

Then re-run seed:
```bash
npx prisma db seed
```

**Option B: Neon SQL Editor (quick)**

1. Register a user normally via `/register`.
2. Go to Neon dashboard > SQL Editor and run:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

---

## Step 16: Commit `feature/auth-ui` and Merge

```bash
git add .
git commit -m "feat(phase3): login/register UI, middleware route protection, auth-aware Navbar, SessionProvider"

# Merge into phase branch
git checkout phase/phase3-auth
git merge feature/auth-ui

# Delete temporary feature branch
git branch -d feature/auth-ui
```

---

## Step 17: Verification Checkpoint

Start the dev server:
```bash
npm run dev
```

Run through all verification checks:

**Auth Flow:**
- [ ] Go to `http://localhost:3000/register` -- Create a new CUSTOMER account
- [ ] After registration, you are auto-signed in and redirected to `/`
- [ ] Navbar shows your name/email and a "Sign Out" button
- [ ] Go to `http://localhost:3000/login` -- Sign in with your credentials
- [ ] Click "Sign Out" -- session is cleared, Navbar shows "Sign In / Get Started"

**Route Protection:**
- [ ] While signed out, go to `http://localhost:3000/admin` -- you should be redirected to `/login`
- [ ] While signed in as CUSTOMER, go to `/admin` -- you should be redirected to `/`
- [ ] While signed out, go to `/tickets` -- you should be redirected to `/login`

**Admin Access:**
- [ ] Sign in as `admin@cinego.com` (after seeding or role update)
- [ ] Navbar shows an **Admin** link in amber
- [ ] Navigate to `/admin` -- access is granted (page may be blank for now -- built in Phase 8)

**Run lint:**
```bash
npm run lint
```

No TypeScript or lint errors.

---

## Step 18: Merge `phase/phase3-auth` into `develop`

```bash
git checkout develop
git merge phase/phase3-auth

# Push both (keep phase branch on GitHub -- NEVER delete it)
git push origin develop
git push origin phase/phase3-auth
```

---

## Phase 3 Complete -- Summary

| What | Status |
|:---|:---|
| `next-auth@4` + `bcryptjs` installed | Done |
| `NEXTAUTH_SECRET` generated and set in `.env` | Done |
| `src/lib/auth.ts` -- credentials provider + role JWT | Done |
| `src/types/next-auth.d.ts` -- session types extended | Done |
| `POST /api/auth/register` -- bcrypt hash, duplicate check | Done |
| `GET/POST /api/auth/[...nextauth]` -- NextAuth catch-all | Done |
| `/login` page -- credentials sign-in form | Done |
| `/register` page -- registration + auto sign-in | Done |
| `src/middleware.ts` -- /admin/* guarded (ADMIN only) | Done |
| `src/components/layout/Navbar.tsx` -- auth-aware nav | Done |
| `src/components/providers/SessionProvider.tsx` -- wrapper | Done |
| `src/app/layout.tsx` -- SessionProvider + Navbar | Done |
| Admin user seeded / role updated in DB | Done |
| Verification: register, login, sign out, admin guard | Done |
| `feature/auth-config` -> `phase/phase3-auth` | Merged & deleted |
| `feature/auth-ui` -> `phase/phase3-auth` | Merged & deleted |
| `phase/phase3-auth` -> `develop` | Merged & preserved |

**Next up:** Phase 4 -- Movies Catalog, Experiences Page & Profile Settings

---

## Key Commit Messages

Follow conventional commits pattern:
```
feat(phase3): auth.js credentials provider, bcrypt register endpoint, role-based JWT session
feat(phase3): login/register UI, middleware route protection, auth-aware Navbar, SessionProvider
```