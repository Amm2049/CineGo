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