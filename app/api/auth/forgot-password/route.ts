import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { email, superkey, newPassword } = await request.json();

  // Validate input
  if (!email || !superkey || !newPassword) {
    return NextResponse.json(
      { error: "Email, superkey, and new password are required" },
      { status: 400 }
    );
  }

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters with uppercase, lowercase, number, and special character" },
      { status: 400 }
    );
  }

  let connection;
  try {
    const pool = await getPool();
    connection = await pool.getConnection();

    // Check if user exists with matching email and superkey (case-insensitive)
    const [users] = await connection.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND superkey = ? LIMIT 1",
      [email, superkey]
    );

    if (!Array.isArray(users) || users.length === 0) {
      console.log("Password reset attempt failed:", { email, superkey });
      return NextResponse.json(
        { error: "Invalid email or superkey combination" },
        { status: 401 }
      );
    }

    const user = users[0] as { id: string };
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await connection.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedPassword, user.id]
    );

    console.log("Password reset successful for user:", { userId: user.id, email });
    return NextResponse.json({ 
      success: true,
      message: "Password updated successfully" 
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred while resetting password" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}