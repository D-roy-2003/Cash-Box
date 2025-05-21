import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { RowDataPacket } from "mysql2/promise";

interface SimpleResult extends RowDataPacket {
  result: number;
}

export async function GET() {
  console.log("[API] /api/test route hit");

  let connection;
  try {
    connection = await pool.getConnection();
    console.log("[API] Database connection established");

    const [rows] = await connection.query<SimpleResult[]>("SELECT 1 + 1 AS result");
    const result = rows[0]?.result;
    console.log("[API] Query executed successfully. Result:", result);

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[API] Error in /api/test route:", error);

    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.stack : error.message,
        type: "database_error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.release();
      console.log("[API] Database connection released");
    }
  }
}
