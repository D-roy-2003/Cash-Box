// app/api/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth";
import { query } from "@/lib/database";

// Type definitions
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  superkey: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  id: number;
  superkey: string;
  name: string;
  email: string;
  token: string;
}

export async function POST(request: Request) {
  try {
    // Validate request body
    const credentials: LoginRequest = await request.json();

    // Input validation
    if (!credentials.email || !credentials.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password length
    if (credentials.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    try {
      // Use the query function from database.js
      const users = (await query(
        `SELECT id, superkey, name, email, password FROM users WHERE email = ? LIMIT 1`,
        [credentials.email]
      )) as User[];

      if (users.length === 0) {
        // Generic error message to prevent user enumeration
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      const user = users[0];

      // Timing-safe password comparison
      const isValidPassword = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      // Generate JWT token
      const token = await signJwt(user.id.toString());

      // Prepare response without sensitive data
      const response: LoginResponse = {
        id: user.id,
        superkey: user.superkey,
        name: user.name,
        email: user.email,
        token,
      };

      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    } catch (error) {
      console.error("Database error during login:", error);
      return NextResponse.json(
        { error: "An error occurred during login" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Login error:", error);

    // Generic error message to avoid leaking sensitive information
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
