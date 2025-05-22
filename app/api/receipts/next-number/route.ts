// app/api/receipts/next-number/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  let connection;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const userId = decoded.userId;

    connection = await pool.getConnection();

    // Fetch user's store details
    const [userRows] = await connection.query(
      "SELECT store_name, name FROM users WHERE id = ?",
      [userId]
    );
    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const { store_name: storeName, name: userName } = userRows[0];

    if (!storeName || !userName) {
      return NextResponse.json(
        { error: "User profile incomplete" },
        { status: 400 }
      );
    }

    // Generate prefix
    const firstStore = storeName[0].toUpperCase();
    const firstUser = userName[0].toUpperCase();
    const lastStore = storeName.slice(-1).toUpperCase();
    const prefix = `${firstStore}${firstUser}${lastStore}-`;

    // Find the last receipt number for this prefix
    const [receiptRows] = await connection.query(
      "SELECT receipt_number FROM receipts WHERE user_id = ? AND receipt_number LIKE ? ORDER BY receipt_number DESC LIMIT 1",
      [userId, `${prefix}%`]
    );

    let nextNumber = 1;
    if (receiptRows.length > 0) {
      const lastReceiptNumber = receiptRows[0].receipt_number;
      const lastNumberPart = lastReceiptNumber.replace(prefix, "");
      nextNumber = parseInt(lastNumberPart, 10) + 1;
    }

    const receiptNumber = `${prefix}${nextNumber.toString().padStart(5, "0")}`;

    return NextResponse.json({ receiptNumber });
  } catch (error) {
    console.error("Error generating next receipt number:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
