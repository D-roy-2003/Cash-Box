// app/api/due/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

// Type definitions
interface DueRecord {
  id: number;
  customer_name: string;
  amount_due: number;
  expected_payment_date: string;
  is_paid: boolean;
  paid_at?: string | null;
  [key: string]: any;
}

interface AccountTransaction {
  particulars: string;
  amount: number;
  type: string;
  user_id: string | number;
  due_record_id: number;
}

interface JwtPayload {
  userId: string | number;
  [key: string]: any;
}

interface PaymentRequest {
  id: number;
}

// Helper: Verify JWT from request headers
async function verifyToken(request: Request): Promise<JwtPayload> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authorization header missing or invalid");
  }

  const token = authHeader.split(" ")[1];
  const decoded = await verifyJwt(token) as JwtPayload;
  if (!decoded?.userId) {
    throw new Error("Invalid token");
  }
  return decoded;
}

// GET /api/due - Fetch unpaid dues
export async function GET(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    connection = await pool.getConnection();

    // Type-safe query
    const [dueRecords] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        id, 
        customer_name, 
        amount_due, 
        expected_payment_date,
        is_paid,
        paid_at
       FROM due_records
       WHERE user_id = ? AND is_paid = FALSE
       ORDER BY expected_payment_date ASC`,
      [userId]
    );

    return NextResponse.json(dueRecords as DueRecord[]);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Database error";
    console.error("[GET] /api/due error:", error);
    
    return NextResponse.json(
      { error: errorMessage },
      {
        status: error instanceof Error && error.message.includes("Unauthorized") ? 401 : 500
      }
    );
  } finally {
    if (connection) await connection.release();
  }
}

// PUT /api/due - Mark a due as paid and create a transaction
export async function PUT(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const requestData: PaymentRequest = await request.json();

    // Validate ID
    if (typeof requestData.id !== "number" || requestData.id <= 0) {
      return NextResponse.json(
        { error: "Invalid due record ID" },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Mark the due record as paid
      const [updateResult] = await connection.query<mysql.ResultSetHeader>(
        `UPDATE due_records 
         SET is_paid = TRUE, paid_at = NOW()
         WHERE id = ? AND user_id = ? AND is_paid = FALSE`,
        [requestData.id, userId]
      );

      // Check if the record was actually updated
      if (updateResult.affectedRows === 0) {
        throw new Error("Due record not found or already paid");
      }

      // 2. Get the due record details for the transaction
      const [dueRecords] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT customer_name, amount_due 
         FROM due_records WHERE id = ? LIMIT 1`,
        [requestData.id]
      );

      if (dueRecords.length === 0) {
        throw new Error("Due record details not found");
      }

      const dueRecord = dueRecords[0];

      // 3. Create the transaction record
      const transactionData: AccountTransaction = {
        particulars: `Payment from ${dueRecord.customer_name}`,
        amount: dueRecord.amount_due,
        type: "credit",
        user_id: userId,
        due_record_id: requestData.id,
      };

      await connection.query(
        `INSERT INTO account_transactions
         (particulars, amount, type, user_id, due_record_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          transactionData.particulars,
          transactionData.amount,
          transactionData.type,
          transactionData.user_id,
          transactionData.due_record_id,
        ]
      );

      await connection.commit();
      
      return NextResponse.json({ 
        success: true,
        message: "Payment processed successfully"
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Payment processing failed";
    
    console.error("[PUT] /api/due error:", error);
    
    return NextResponse.json(
      { error: errorMessage },
      {
        status: error instanceof Error && error.message.includes("Unauthorized") 
          ? 401 
          : 400
      }
    );
  } finally {
    if (connection) await connection.release();
  }
}