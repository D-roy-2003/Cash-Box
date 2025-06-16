// app/api/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth";
import { query } from "@/lib/database";

// Type definitions
interface User {
  id: number;
  name: string;
  store_contact: string;
  password: string;
  superkey: string;
}

interface LoginRequest {
  mobile: string;
  password: string;
}

interface LoginResponse {
  id: number;
  superkey: string;
  name: string;
  mobile: string;
  token: string;
}

export async function POST(request: Request) {
  try {
    // Validate request body
    const credentials: LoginRequest = await request.json();

    // Input validation
    if (!credentials.mobile || !credentials.password) {
      return NextResponse.json(
        { error: "Mobile number and password are required" },
        { status: 400 }
      );
    }

    // Validate mobile number format (10 digits)
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(credentials.mobile)) {
      return NextResponse.json(
        { error: "Invalid mobile number format" },
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
        `SELECT id, superkey, name, store_contact, password FROM users WHERE store_contact = ? LIMIT 1`,
        [credentials.mobile]
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
        mobile: user.store_contact,
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
