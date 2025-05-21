// app/api/transactions/route.ts

import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import { RowDataPacket } from "mysql2/promise";

interface BalanceResult extends RowDataPacket {
  balance: number;
  total_due_balance: number;
}

interface Transaction extends RowDataPacket {
  id: number;
  particulars: string;
  amount: number;
  type: string;
  user_id: number;
  transaction_date: string;
}

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connection;
  try {
    const decoded = await verifyJwt(token);
    connection = await pool.getConnection();

    const [transactions] = await connection.query<Transaction[]>(
      `SELECT * FROM account_transactions
       WHERE user_id = ? ORDER BY transaction_date DESC`,
      [decoded.userId]
    );

    const [balanceResult] = await connection.query<BalanceResult[]>(
      `SELECT balance, total_due_balance FROM account_balances
       WHERE user_id = ?`,
      [decoded.userId]
    );

    const balanceRow = balanceResult[0] || { balance: 0, total_due_balance: 0 };

    return NextResponse.json({
      transactions,
      balance: balanceRow.balance,
      totalDueBalance: balanceRow.total_due_balance,
    });

  } catch (error) {
    console.error("GET /transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connection;
  try {
    const decoded = await verifyJwt(token);
    const { particulars, amount, type } = await request.json();

    if (
      !particulars ||
      typeof particulars !== "string" ||
      typeof amount !== "number" ||
      !["credit", "debit"].includes(type)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    connection = await pool.getConnection();

    await connection.query(
      `INSERT INTO account_transactions (particulars, amount, type, user_id)
       VALUES (?, ?, ?, ?)`,
      [particulars, amount, type, decoded.userId]
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("POST /transactions error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}
