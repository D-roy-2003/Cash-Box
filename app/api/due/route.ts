import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

interface DueRecord {
  id: number;
  customer_name: string;
  customer_contact: string;
  customer_country_code: string;
  product_ordered: string;
  quantity: number;
  amount_due: number;
  expected_payment_date: string;
  created_at: string;
  is_paid: boolean;
  paid_at?: string | null;
  receipt_number?: string;
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

export async function GET(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    connection = await pool.getConnection();

    const [dueRecords] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        id, 
        customer_name,
        customer_contact,
        customer_country_code,
        product_ordered,
        quantity,
        amount_due, 
        expected_payment_date,
        created_at,
        is_paid,
        paid_at,
        receipt_number
       FROM due_records
       WHERE user_id = ? AND is_paid = FALSE
       ORDER BY expected_payment_date ASC`,
      [userId]
    );

    const transformedRecords = dueRecords.map(record => ({
      id: record.id.toString(),
      customerName: record.customer_name || 'Unknown Customer',
      customerContact: record.customer_contact || '',
      customerCountryCode: record.customer_country_code || '+91',
      productOrdered: record.product_ordered || 'Unknown Product',
      quantity: Number(record.quantity) || 0,
      amountDue: Number(record.amount_due) || 0,
      expectedPaymentDate: record.expected_payment_date || new Date().toISOString(),
      createdAt: record.created_at || new Date().toISOString(),
      isPaid: Boolean(record.is_paid),
      paidAt: record.paid_at || null,
      receiptNumber: record.receipt_number || null
    }));

    return NextResponse.json(transformedRecords);
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

export async function PUT(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const requestData: PaymentRequest = await request.json();

    // Validate ID
    if (!requestData.id || (typeof requestData.id !== "number" && typeof requestData.id !== "string")) {
      return NextResponse.json(
        { error: "Invalid due record ID" },
        { status: 400 }
      );
    }

    const dueId = typeof requestData.id === "string" ? parseInt(requestData.id) : requestData.id;
    
    if (isNaN(dueId) || dueId <= 0) {
      return NextResponse.json(
        { error: "Invalid due record ID format" },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Get the due record details first (before updating)
      const [dueRecords] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT customer_name, amount_due, is_paid, receipt_number
         FROM due_records 
         WHERE id = ? AND user_id = ?`,
        [dueId, userId]
      );

      if (dueRecords.length === 0) {
        throw new Error("Due record not found");
      }

      const dueRecord = dueRecords[0];

      if (dueRecord.is_paid) {
        throw new Error("Due record is already paid");
      }

      // 2. Mark the due record as paid
      const [updateResult] = await connection.query<mysql.ResultSetHeader>(
        `UPDATE due_records 
         SET is_paid = TRUE, paid_at = NOW()
         WHERE id = ? AND user_id = ? AND is_paid = FALSE`,
        [dueId, userId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error("Failed to update due record");
      }

      // 3. Create the transaction record
      const transactionData: AccountTransaction = {
        particulars: `Payment received from ${dueRecord.customer_name}${dueRecord.receipt_number ? ` (Receipt: ${dueRecord.receipt_number})` : ''}`,
        amount: Number(dueRecord.amount_due),
        type: "credit",
        user_id: userId,
        due_record_id: dueId,
      };

      await connection.query(
        `INSERT INTO account_transactions
         (particulars, amount, type, user_id, due_record_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
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
        message: "Payment processed successfully",
        amountProcessed: transactionData.amount
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
        status: error instanceof Error && 
               (error.message.includes("Unauthorized") || error.message.includes("Invalid token"))
          ? 401 
          : 400
      }
    );
  } finally {
    if (connection) await connection.release();
  }
}