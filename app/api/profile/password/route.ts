import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { initializeDatabase } from "@/lib/database";

export async function PUT(request: Request) {
  await initializeDatabase();
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
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current and new password are required" },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();

    // Get user's current password hash
    const [users]: any = await connection.query(
      `SELECT password FROM users WHERE id = ? LIMIT 1`,
      [decoded.userId]
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
    await connection.query(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, decoded.userId]
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password update failed" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}