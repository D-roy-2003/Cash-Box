import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import type { PoolConnection } from "mysql2/promise";

// Extracted helper to verify token
async function verifyToken(request: Request): Promise<{ userId: number }> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  const decoded = await verifyJwt(token);

  if (!decoded?.userId) {
    throw new Error("Invalid token");
  }

  return { userId: decoded.userId };
}

export async function GET(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
  
    const poolInstance = await getPool();
    connection = await poolInstance.getConnection();
  
    if (!connection) {
      throw new Error("Failed to establish database connection");
    }
  
    const [rows] = await connection.query(
      `
      SELECT 
        id,
        receipt_number AS receiptNumber,
        date,
        customer_name AS customerName,
        total,
        payment_status AS paymentStatus
      FROM receipts
      WHERE user_id = ?
      ORDER BY date DESC
      `,
      [userId]
    );
  
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  } finally {
    connection?.release(); // ✅ No more warning
  }
}
