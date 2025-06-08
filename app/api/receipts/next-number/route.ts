// app/api/receipts/next-number/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

function generatePrefix(storeName: string, userName: string, extraChars: number = 0): string {
  const firstStore = storeName[0].toUpperCase();
  const firstUser = userName[0].toUpperCase();
  const lastStore = storeName.slice(-1).toUpperCase();
  
  // Get additional characters from store name if needed
  let extraPrefix = '';
  if (extraChars > 0) {
    // Skip first and last characters as they're already used
    const availableChars = storeName.slice(1, -1).toUpperCase();
    for (let i = 0; i < extraChars && i < availableChars.length; i++) {
      extraPrefix += availableChars[i];
    }
    // If we need more characters, use user's name
    if (extraChars > availableChars.length) {
      const userChars = userName.slice(1).toUpperCase();
      for (let i = 0; i < extraChars - availableChars.length && i < userChars.length; i++) {
        extraPrefix += userChars[i];
      }
    }
  }
  
  return `${firstStore}${firstUser}${lastStore}${extraPrefix}-`;
}

async function generateUniqueReceiptNumber(connection: any, storeName: string, userName: string, userId: string, retryCount = 0): Promise<string> {
  const prefix = generatePrefix(storeName, userName, retryCount);
  
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

  // Check if this receipt number already exists
  const [existingReceipts] = await connection.query(
    "SELECT COUNT(*) as count FROM receipts WHERE receipt_number = ?",
    [receiptNumber]
  );

  if (existingReceipts[0].count > 0) {
    // Try again with an extra character in the prefix
    return generateUniqueReceiptNumber(connection, storeName, userName, userId, retryCount + 1);
  }

  return receiptNumber;
}

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
    const userId = String(decoded.userId);

    const pool = await getPool();
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

    // Generate unique receipt number
    const receiptNumber = await generateUniqueReceiptNumber(connection, storeName, userName, userId);

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
