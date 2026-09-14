// src/app/api/auth/register/route.ts
// Registration endpoint: validates input, hashes password, creates User record

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { email, password, name } = body as {
            email: string;
            password: string;
            name?: string;
        }

        // Validation
        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Check for existing account
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "An account with that email already exists" },
                { status: 409 }
            );
        }

        // Hash passaword & create user
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