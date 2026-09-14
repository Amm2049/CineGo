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