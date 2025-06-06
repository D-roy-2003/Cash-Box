import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth";
import type { ResultSetHeader } from "mysql2/promise";

interface UserData {
  name: string;
  email: string;
  password: string;
}

function generateSuperkey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  // Content-Type validation
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(
      { error: "Invalid content type" },
      { status: 415 }
    );
  }

  // Extract and validate request body
  const { name, email, password } = (await request.json()) as Partial<UserData>;
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Missing required fields (name, email, password)" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const hashedPassword = await bcrypt.hash(password, 10);

  let connection;

  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const maxAttempts = 10;
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const superkey = generateSuperkey();

      try {
        const [rawResult] = await connection.execute(
          `INSERT INTO users (name, email, password, superkey)
           VALUES (?, ?, ?, ?)`,
          [trimmedName, trimmedEmail, hashedPassword, superkey]
        );

        const result = rawResult as ResultSetHeader;

        if (result.affectedRows === 1) {
          await connection.commit();

          const token = await signJwt(result.insertId);

          return NextResponse.json(
            {
              id: result.insertId,
              name: trimmedName,
              email: trimmedEmail,
              superkey,
              token,
            },
            { status: 201 }
          );
        }
      } catch (error: any) {
        if (error.code === "ER_DUP_ENTRY") {
          if (error.message.includes("superkey")) {
            // Retry on superkey conflict
            continue;
          }
          if (error.message.includes("email")) {
            await connection.rollback();
            return NextResponse.json(
              { error: "Email already exists" },
              { status: 409 }
            );
          }
        }

        // Re-throw unexpected DB errors
        throw error;
      }
    }

    throw new Error("Failed to generate unique superkey after multiple attempts");
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
} 