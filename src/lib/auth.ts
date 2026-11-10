// src/lib/auth.ts
// Auth.js (NextAuth v4) configuration -- credentials provider with bcrypt + role-based session,
// plus "Continue with Google" for customer accounts (only when GOOGLE_CLIENT_ID/SECRET are set).

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import {
    USE_GOOGLE_ERROR,
    decideGoogleSignIn,
    isGoogleSignInConfigured,
    normalizeEmail,
} from "./google-sign-in";

/** Accounts registered with a password may have mixed-case emails; Google always sends lowercase. */
function findUserByEmail(email: string) {
    return prisma.user.findFirst({
        where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
        select: { id: true, role: true },
    });
}

const googleProviders = isGoogleSignInConfigured()
    ? [
          GoogleProvider({
              clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
              // Let people pick which Google account to use instead of silently reusing the last one
              authorization: { params: { prompt: "select_account" } },
          }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    providers: [
        ...googleProviders,
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

                // Created with "Continue with Google": there is no password to check
                if (!user.passwordHash) {
                    throw new Error(USE_GOOGLE_ERROR);
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
        async signIn({ account, profile, user }) {
            if (account?.provider !== "google") return true;

            const googleProfile = profile as GoogleProfile | undefined;
            const email = googleProfile?.email ?? user.email ?? null;
            const existing = email ? await findUserByEmail(email) : null;
            const decision = decideGoogleSignIn({
                email,
                emailVerified: googleProfile?.email_verified,
                existingRole: existing?.role ?? null,
            });

            // Returning a path sends the browser back to the login page with a message
            if (decision.action === "refuse") return `/login?error=${decision.reason}`;

            if (decision.action === "create") {
                try {
                    await prisma.user.create({
                        data: {
                            email: normalizeEmail(email!),
                            name: googleProfile?.name ?? user.name ?? null,
                            role: "CUSTOMER",
                            passwordHash: null,
                        },
                    });
                } catch (err) {
                    // Two Google sign-ins for the same new email at once: the other one created it
                    const duplicate =
                        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
                    if (!duplicate) throw err;
                }
            }
            return true;
        },
        async jwt({ token, user, account }) {
            // Google: the `user` object carries Google's id, so look up our own account by email
            if (account?.provider === "google") {
                const dbUser = user?.email ? await findUserByEmail(user.email) : null;
                if (!dbUser) throw new Error("Google sign-in: account not found after sign-in");
                token.id = dbUser.id;
                token.role = dbUser.role;
                return token;
            }
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