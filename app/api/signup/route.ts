import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth";
import type { ResultSetHeader } from "mysql2/promise";

interface UserData {
  name: string;
  email: string;
  password: string;
}

function generateSuperkey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  let connection;
  try {
    // Validate request
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 415 }
      );
    }

    const { name, email, password } = (await request.json()) as Partial<UserData>;
    
    // Validate input
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Missing required fields (name, email, password)" },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let superkey;
      let userCreated = false;
      let attempts = 0;
      const maxAttempts = 10;

      // Retry loop for superkey uniqueness
      while (!userCreated && attempts < maxAttempts) {
        attempts++;
        superkey = generateSuperkey();

        try {
          const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO users (name, email, password, superkey) 
             VALUES (?, ?, ?, ?)`,
            [name.trim(), email.trim(), await bcrypt.hash(password, 10), superkey]
          );

          if (result.affectedRows === 1) {
            userCreated = true;
            await connection.commit();

            return NextResponse.json(
              {
                id: result.insertId,
                name: name.trim(),
                email: email.trim(),
                superkey,
                token: await signJwt(result.insertId),
              },
              { status: 201 }
            );
          }
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY' && error.message.includes('superkey')) {
            // Superkey collision, try again
            continue;
          }
          throw error; // Re-throw other errors
        }
      }

      throw new Error("Failed to generate unique superkey after maximum attempts");
    } catch (error: any) {
      await connection.rollback();
      
      if (error.code === 'ER_DUP_ENTRY' && error.message.includes('email')) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }

      console.error("Signup error:", error);
      return NextResponse.json(
        { error: error.message || "Registration failed" },
        { status: 500 }
      );
    }
  } finally {
    if (connection) await connection.release();
  }
}