// app/api/login/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/database";
import { signJwt } from "@/lib/auth";

// Type definitions
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  id: string;
  name: string;
  email: string;
  token: string;
}

export async function POST(request: Request) {
  // Validate request body
  let credentials: LoginRequest;
  try {
    credentials = await request.json();
    if (!credentials.email || !credentials.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  let connection;
  try {
    // Get database connection
    connection = await pool.getConnection();

    // Type-safe query with proper MySQL2 typing
    const [rows] = await connection.query(
      `SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1`,
      [credentials.email]
    ) as [User[], mysql.FieldPacket[]];

    // Verify user exists
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = await signJwt(user.id);

    // Prepare response
    const response: LoginResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      token,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}