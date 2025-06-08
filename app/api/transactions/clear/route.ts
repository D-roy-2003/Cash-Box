import { NextResponse } from "next/server";
import { getPool, beginTransaction, commitTransaction, rollbackTransaction } from "@/lib/database";
import bcrypt from "bcrypt";
import { verifyJwt } from "@/lib/auth";

export async function POST(req: Request) {
  let connection = null;
  
  try {
    // Get the authorization token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    
    // Verify the token and get the user ID
    let userId: string | number;
    try {
      const decodedToken = await verifyJwt(token);
      userId = decodedToken.userId;
    } catch (jwtError: any) {
      return NextResponse.json(
        { message: jwtError.message || "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Get the password from request body
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json(
        { message: "Password is required" },
        { status: 400 }
      );
    }

    // Get database connection
    const pool = await getPool();
    connection = await beginTransaction();

    // Get user from database using the extracted userId
    const [users] = await connection.query(
      "SELECT id, password FROM users WHERE id = ?",
      [userId]
    );

    if (!users || users.length === 0) {
      await rollbackTransaction(connection);
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const user: any = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await rollbackTransaction(connection);
      return NextResponse.json(
        { message: "Invalid password" },
        { status: 401 }
      );
    }

    // Delete all transactions for the user
    await connection.query(
      "DELETE FROM account_transactions WHERE user_id = ?",
      [user.id]
    );

    // Update user's balance to 0
    await connection.query(
      "UPDATE account_balances SET balance = 0 WHERE user_id = ?",
      [user.id]
    );

    // Commit the transaction
    await commitTransaction(connection);

    return NextResponse.json(
      { message: "Transaction history cleared successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error("Error clearing transaction history:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 