// app/api/test/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/database";

export async function GET() {
  console.log("Test route hit"); // Verify in server logs
  
  let connection;
  try {
    // 1. Test basic route functionality
    const testResponse = NextResponse.json({ simpleTest: "working" });
    console.log("Basic response check passed");
    
    // 2. Test database connection
    connection = await pool.getConnection();
    console.log("Database connection established");
    
    // 3. Test simple query
    const [rows] = await connection.query("SELECT 1 + 1 AS result");
    console.log("Query executed:", rows);
    
    // 4. Verify response format
    const response = NextResponse.json({
      success: true,
      result: rows[0].result,
      timestamp: new Date().toISOString()
    });
    
    console.log("Returning response:", response);
    return response;

  } catch (error) {
    console.error("Test route error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        type: "database_error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
      console.log("Connection released");
    }
  }
}