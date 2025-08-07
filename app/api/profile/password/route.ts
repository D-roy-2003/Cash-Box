import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

export async function PUT(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization header missing or invalid" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const userId = await verifyJwt(token);
    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current and new password are required" },
        { status: 400 }
      );
    }

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: "Passwords must be strings" },
        { status: 400 }
      );
    }

    const pool = await getPool();
    connection = await pool.getConnection();

    // Get user's current password hash
    const [users]: any = await connection!.query(
      `SELECT password FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = users[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await connection!.query(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword,userId]
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred." },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}