import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

interface Transaction {
  id: string;
  particulars: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  receiptNumber?: string;
  createdAt: string;
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
  const userId = await verifyJwt(token);
  if (!userId) {
    throw new Error("Invalid token");
  }
  return { userId };
}

export async function GET(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const pool = await getPool();
    connection = await pool.getConnection();

    // Get all transactions with receipt number if available
    const [transactionRows] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        t.id, 
        t.particulars, 
        t.amount, 
        t.type, 
        t.transaction_date as date,
        t.created_at as createdAt,
        r.receipt_number as receiptNumber
       FROM account_transactions t
       LEFT JOIN receipts r ON t.receipt_id = r.id
       WHERE t.user_id = ?
       ORDER BY t.transaction_date DESC, t.created_at DESC`,
      [userId]
    );

    const transactions: Transaction[] = transactionRows.map((row) => ({
      id: row.id.toString(),
      particulars: row.particulars || "Unknown Transaction",
      amount: Number(row.amount) || 0,
      type: row.type === "credit" ? "credit" : "debit",
      date: row.date || new Date().toISOString(),
      receiptNumber: row.receiptNumber || undefined,
      createdAt: row.createdAt || new Date().toISOString(),
    }));

    // Calculate current account balance from transactions
    let balance = 0;
    transactions.forEach((transaction) => {
      if (transaction.type === "credit") {
        balance += transaction.amount;
      } else {
        balance -= transaction.amount;
      }
    });

    // Calculate total due balance from unpaid due records
    const [dueRows] = await connection!.query<mysql.RowDataPacket[]>(
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
          .filter((t) => t.type === "credit")
          .reduce((sum, t) => sum + t.amount, 0),
        totalDebits: transactions
          .filter((t) => t.type === "debit")
          .reduce((sum, t) => sum + t.amount, 0),
        transactionCount: transactions.length,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Database error";
    console.error("[GET] /api/transactions error:", error);

    return NextResponse.json(
      { error: errorMessage },
      {
        status:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 500,
      }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (e: unknown) {
        // ignore
      }
    }
  }
}

export async function POST(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const { userId } = await verifyToken(request);
    const { particulars, amount, type, transactionDate } = await request.json();

    // Validate input
    if (
      !particulars ||
      typeof particulars !== "string" ||
      particulars.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Particulars is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    if (!type || !["credit", "debit"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be either 'credit' or 'debit'" },
        { status: 400 }
      );
    }

    // Validate transaction date
    if (!transactionDate || !isValidDate(transactionDate)) {
      return NextResponse.json(
        { error: "Valid transaction date is required" },
        { status: 400 }
      );
    }

    const pool = await getPool();
    connection = await pool.getConnection();

    // Insert the new transaction with the provided date
    const [result] = await connection!.query<mysql.ResultSetHeader>(
      `INSERT INTO account_transactions 
       (particulars, amount, type, user_id, transaction_date, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [particulars.trim(), amount, type, userId, transactionDate]
    );

    if (result.affectedRows === 0) {
      throw new Error("Failed to create transaction");
    }

    // Return the created transaction
    const [newTransaction] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        t.id, 
        t.particulars, 
        t.amount, 
        t.type, 
        t.transaction_date as date,
        t.created_at as createdAt,
        r.receipt_number as receiptNumber
       FROM account_transactions t
       LEFT JOIN receipts r ON t.receipt_id = r.id
       WHERE t.id = ?`,
      [result.insertId]
    );

    const transaction = newTransaction[0];

    return NextResponse.json(
      {
        success: true,
        transaction: {
          id: transaction.id.toString(),
          particulars: transaction.particulars,
          amount: Number(transaction.amount),
          type: transaction.type,
          date: transaction.date,
          receiptNumber: transaction.receiptNumber || undefined,
          createdAt: transaction.createdAt || new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create transaction";

    console.error("[POST] /api/transactions error:", error);

    return NextResponse.json(
      { error: errorMessage },
      {
        status:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 400,
      }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (e: unknown) {
        // ignore
      }
    }
  }
}

// Helper function to validate date format
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
