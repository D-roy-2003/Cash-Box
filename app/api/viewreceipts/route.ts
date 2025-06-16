import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import type { PoolConnection } from "mysql2/promise";

async function verifyToken(request: Request): Promise<{ userId: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.split(" ")[1];
  const userId = await verifyJwt(token);
  if (!userId) throw new Error("Invalid token");

  return { userId: Number(userId) };
}

export async function GET(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const pool = await getPool();
    connection = await pool.getConnection();

    // Query with explicit type casting for numeric fields
    const [rows] = await connection!.execute(
      `
      SELECT 
        r.id,
        r.receipt_number AS receiptNumber,
        r.date,
        r.customer_name AS customerName,
        CAST(r.total AS DECIMAL(10,2)) AS total,
        r.payment_status AS paymentStatus,
        CASE 
          WHEN r.payment_status = 'due' AND EXISTS (
            SELECT 1 FROM due_records d 
            WHERE d.receipt_number = r.receipt_number 
            AND d.is_paid = TRUE
          ) THEN 'due_paid'
          ELSE r.payment_status 
        END AS displayStatus
      FROM receipts r
      WHERE r.user_id = ?
      ORDER BY r.date DESC
    `,
      [userId]
    );

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
