import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  let phoneNumber, superkey, newPassword;

  try {
    const body = await request.json();
    phoneNumber = body.phoneNumber;
    superkey = body.superkey;
    newPassword = body.newPassword;
  } catch (parseError) {
    console.error("Error parsing request body:", parseError);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate input
  if (!phoneNumber || !superkey || !newPassword) {
    return NextResponse.json(
      { error: "Phone number, superkey, and new password are required" },
      { status: 400 }
    );
  }

  // Validate phone number format
  if (!/^[0-9]{10}$/.test(phoneNumber)) {
    return NextResponse.json(
      { error: "Invalid phone number format. Please enter a 10-digit number" },
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

    // Check if user exists with matching phone number and superkey
    const [users] = await connection.query(
      "SELECT id FROM users WHERE store_contact = ? AND superkey = ? LIMIT 1",
      [phoneNumber, superkey]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: "Invalid phone number or superkey" },
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

    return NextResponse.json({ success: true });
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