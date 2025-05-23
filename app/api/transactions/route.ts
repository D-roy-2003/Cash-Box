import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

interface Transaction {
  id: string;
  particulars: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  receiptNumber?: string;
}

interface JwtPayload {
  userId: string | number;
  [key: string]: any;
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

    // Get all transactions with receipt number if available
    const [transactionRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        t.id, 
        t.particulars, 
        t.amount, 
        t.type, 
        t.created_at as date,
        r.receipt_number as receiptNumber
       FROM account_transactions t
       LEFT JOIN receipts r ON t.receipt_id = r.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );

    const transactions: Transaction[] = transactionRows.map(row => ({
      id: row.id.toString(),
      particulars: row.particulars || 'Unknown Transaction',
      amount: Number(row.amount) || 0,
      type: row.type === 'credit' ? 'credit' : 'debit',
      date: row.date || new Date().toISOString(),
      receiptNumber: row.receiptNumber || undefined
    }));

    // Calculate current account balance from transactions
    let balance = 0;
    transactions.forEach(transaction => {
      if (transaction.type === 'credit') {
        balance += transaction.amount;
      } else {
        balance -= transaction.amount;
      }
    });

    // Calculate total due balance from unpaid due records
    const [dueRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount_due), 0) as total_due
       FROM due_records
       WHERE user_id = ? AND is_paid = FALSE`,
      [userId]
    );

    const totalDueBalance = Number(dueRows[0]?.total_due) || 0;

    return NextResponse.json({
      transactions,
      balance: Number(balance.toFixed(2)),
      totalDueBalance: Number(totalDueBalance.toFixed(2)),
      summary: {
        totalCredits: transactions
          .filter(t => t.type === 'credit')
          .reduce((sum, t) => sum + t.amount, 0),
        totalDebits: transactions
          .filter(t => t.type === 'debit')
          .reduce((sum, t) => sum + t.amount, 0),
        transactionCount: transactions.length
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Database error";
    console.error("[GET] /api/transactions error:", error);
    
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

export async function POST(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const { particulars, amount, type } = await request.json();

    // Validate input
    if (!particulars || typeof particulars !== 'string' || particulars.trim().length === 0) {
      return NextResponse.json(
        { error: "Particulars is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    if (!type || !['credit', 'debit'].includes(type)) {
      return NextResponse.json(
        { error: "Type must be either 'credit' or 'debit'" },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();

    // Insert the new transaction
    const [result] = await connection.query<mysql.ResultSetHeader>(
      `INSERT INTO account_transactions 
       (particulars, amount, type, user_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [particulars.trim(), amount, type, userId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Failed to create transaction");
    }

    // Return the created transaction
    const [newTransaction] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        t.id, 
        t.particulars, 
        t.amount, 
        t.type, 
        t.created_at as date,
        r.receipt_number as receiptNumber
       FROM account_transactions t
       LEFT JOIN receipts r ON t.receipt_id = r.id
       WHERE t.id = ?`,
      [result.insertId]
    );

    const transaction = newTransaction[0];
    
    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id.toString(),
        particulars: transaction.particulars,
        amount: Number(transaction.amount),
        type: transaction.type,
        date: transaction.date,
        receiptNumber: transaction.receiptNumber || undefined
      }
    }, { status: 201 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to create transaction";
    
    console.error("[POST] /api/transactions error:", error);
    
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