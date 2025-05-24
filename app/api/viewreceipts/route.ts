import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { pool } from "@/lib/database"
import { verifyJwt } from "@/lib/auth"

export async function GET(request: Request) {
  let connection: mysql.PoolConnection | undefined

  try {
    const { userId } = await verifyToken(request)
    connection = await pool.getConnection()

    const [receipts] = await connection.query(`
      SELECT 
        id, 
        receipt_number as receiptNumber, 
        date,
        customer_name as customerName, 
        total, 
        payment_status as paymentStatus
      FROM receipts
      WHERE user_id = ?
      ORDER BY date DESC
    `, [userId])

    return NextResponse.json(receipts)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    )
  } finally {
    if (connection) connection.release()
  }
}

async function verifyToken(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized")
  }

  const token = authHeader.split(" ")[1]
  const decoded = await verifyJwt(token)
  if (!decoded?.userId) throw new Error("Invalid token")
  
  return { userId: decoded.userId }
}