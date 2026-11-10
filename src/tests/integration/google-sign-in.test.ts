// src/tests/integration/google-sign-in.test.ts
// "Continue with Google" against the real database, without calling Google: the NextAuth callbacks
// are called directly with the profile Google would send.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NextAuthOptions } from "next-auth";
import prisma from "@/lib/prisma";
import { USE_GOOGLE_ERROR } from "@/lib/google-sign-in";

type SignInArgs = Parameters<NonNullable<NonNullable<NextAuthOptions["callbacks"]>["signIn"]>>[0];
type JwtArgs = Parameters<NonNullable<NonNullable<NextAuthOptions["callbacks"]>["jwt"]>>[0];

const stamp = Date.now();
const newEmail = `google-new-${stamp}@test.cinego.local`;
const existingEmail = `google-existing-${stamp}@test.cinego.local`;
const staffEmail = `google-staff-${stamp}@test.cinego.local`;
const emails = [newEmail, existingEmail, staffEmail];

let authOptions: NextAuthOptions;

beforeAll(async () => {
  // The Google provider is only registered when these are set, and they are read at import time
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  ({ authOptions } = await import("@/lib/auth"));

  // An existing customer who registered with a password, using capital letters in the email
  await prisma.user.create({
    data: { email: existingEmail.replace("google-existing", "Google-Existing"), passwordHash: "x", role: "CUSTOMER" },
  });
  await prisma.user.create({ data: { email: staffEmail, passwordHash: "x", role: "STAFF" } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails, mode: "insensitive" } } });
});

function googleSignIn(email: string, emailVerified = true, name = "Google Tester") {
  const args = {
    user: { id: "google-sub-123", email, name },
    account: { provider: "google", type: "oauth", providerAccountId: "google-sub-123" },
    profile: { email, email_verified: emailVerified, name },
  } as unknown as SignInArgs;
  return authOptions.callbacks!.signIn!(args);
}

async function googleJwt(email: string) {
  const args = {
    token: { email },
    user: { id: "google-sub-123", email },
    account: { provider: "google", type: "oauth", providerAccountId: "google-sub-123" },
  } as unknown as JwtArgs;
  return authOptions.callbacks!.jwt!(args);
}

describe("Continue with Google", () => {
  it("is registered as a provider when the credentials are set", () => {
    expect(authOptions.providers.map((p) => p.id)).toContain("google");
  });

  it("creates a CUSTOMER account without a password for a new email", async () => {
    expect(await googleSignIn(newEmail)).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: newEmail } });
    expect(user.role).toBe("CUSTOMER");
    expect(user.passwordHash).toBeNull();
    expect(user.name).toBe("Google Tester");

    // The session carries OUR user id and role, not Google's id
    const token = await googleJwt(newEmail);
    expect(token.id).toBe(user.id);
    expect(token.role).toBe("CUSTOMER");
  });

  it("signing in again does not create a second account", async () => {
    expect(await googleSignIn(newEmail)).toBe(true);
    expect(await prisma.user.count({ where: { email: newEmail } })).toBe(1);
  });

  it("logs an existing customer into their password account (email matched without case)", async () => {
    expect(await googleSignIn(existingEmail)).toBe(true);
    const accounts = await prisma.user.findMany({ where: { email: { equals: existingEmail, mode: "insensitive" } } });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].passwordHash).toBe("x"); // the password still works too
    expect((await googleJwt(existingEmail)).id).toBe(accounts[0].id);
  });

  it("refuses staff and admin accounts", async () => {
    expect(await googleSignIn(staffEmail)).toBe("/login?error=StaffUsePassword");
  });

  it("refuses an unverified Google email and creates nothing", async () => {
    const email = `google-unverified-${stamp}@test.cinego.local`;
    expect(await googleSignIn(email, false)).toBe("/login?error=EmailNotVerified");
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it("the password form tells a Google-only account to use Google", async () => {
    const credentials = authOptions.providers.find((p) => p.id === "credentials") as unknown as {
      options: { authorize: (c: Record<string, string>) => Promise<unknown> };
    };
    await expect(credentials.options.authorize({ email: newEmail, password: "anything" })).rejects.toThrow(
      USE_GOOGLE_ERROR
    );
  });
});
