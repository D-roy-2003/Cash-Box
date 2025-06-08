import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import type { PoolConnection } from "mysql2/promise";

async function verifyToken(request: Request): Promise<{ userId: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  
  const token = authHeader.split(" ")[1];
  const decoded = await verifyJwt(token);
  if (!decoded?.userId) throw new Error("Invalid token");
  
  return { userId: decoded.userId };
}

export async function GET(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const pool = await getPool();
    connection = await pool.getConnection();

    // Query with explicit type casting for numeric fields
    const [rows] = await connection!.execute(`
      SELECT 
        id,
        receipt_number AS receiptNumber,
        date,
        customer_name AS customerName,
        CAST(total AS DECIMAL(10,2)) AS total,
        payment_status AS paymentStatus
      FROM receipts
      WHERE user_id = ?
      ORDER BY date DESC
    `, [userId]);

    // Simple response without additional processing
    return NextResponse.json(rows);
    
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}