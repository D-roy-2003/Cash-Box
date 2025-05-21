import { NextResponse } from "next/server";
import { pool } from "@/lib/database";

export async function GET() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT 1 + 1 AS result");
    connection.release();
    return NextResponse.json({ success: true, result: rows[0].result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
