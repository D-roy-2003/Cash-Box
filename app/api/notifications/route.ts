import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const userId = String(decoded.userId);

    const pool = await getPool();
    connection = await pool.getConnection();

    // Get overdue payments
    const [rows] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        id,
        customer_name as customerName,
        customer_contact as customerContact,
        customer_country_code as customerCountryCode,
        product_ordered as productOrdered,
        quantity,
        amount_due as amountDue,
        expected_payment_date as expectedPaymentDate,
        created_at as createdAt,
        is_paid as isPaid,
        receipt_number as receiptNumber
      FROM due_records 
      WHERE user_id = ? 
      AND is_paid = false 
      AND expected_payment_date <= CURDATE()
      ORDER BY expected_payment_date ASC`,
      [userId]
    );

    // Ensure amountDue is a number and handle potential NaN values
    const notifications = rows.map(row => {
      const parsedAmount = parseFloat(row.amountDue);
      return {
        ...row,
        amountDue: isNaN(parsedAmount) ? 0 : parsedAmount,
      };
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (e) {
        // ignore
      }
    }
  }
} 