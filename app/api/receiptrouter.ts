// app/api/receipts/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";

interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  advanceAmount?: number;
  dueAmount?: number;
}

interface PaymentDetails {
  cardNumber?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
}

interface ReceiptBody {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerContact: string;
  customerCountryCode: string;
  paymentType: string;
  paymentStatus: string;
  notes?: string;
  total: number;
  dueTotal: number;
  items: ReceiptItem[];
  paymentDetails?: PaymentDetails;
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connection;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) throw new Error("Invalid token payload");

    const body: ReceiptBody = await request.json();

    // Basic validation
    if (
      !body.receiptNumber ||
      !body.date ||
      !body.customerName ||
      !body.customerContact ||
      !body.paymentType ||
      !body.paymentStatus ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields or items" },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insert receipt
    const [receiptResult] = await connection.query<mysql.ResultSetHeader>(
      `INSERT INTO receipts (
        receipt_number, date, customer_name, customer_contact, customer_country_code,
        payment_type, payment_status, notes, total, due_total, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.receiptNumber,
        body.date,
        body.customerName,
        body.customerContact,
        body.customerCountryCode,
        body.paymentType,
        body.paymentStatus,
        body.notes || null,
        body.total,
        body.dueTotal,
        decoded.userId,
      ]
    );

    const receiptId = receiptResult.insertId;

    // Insert receipt items
    for (const item of body.items) {
      if (
        !item.description ||
        typeof item.quantity !== "number" ||
        typeof item.price !== "number"
      ) {
        await connection.rollback();
        return NextResponse.json(
          { error: "Invalid item data" },
          { status: 400 }
        );
      }

      await connection.query(
        `INSERT INTO receipt_items (
          receipt_id, description, quantity, price, advance_amount, due_amount
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          receiptId,
          item.description,
          item.quantity,
          item.price,
          item.advanceAmount ?? 0,
          item.dueAmount ?? 0,
        ]
      );
    }

    // Insert payment details if provided
    if (body.paymentDetails) {
      await connection.query(
        `INSERT INTO payment_details (
          receipt_id, card_number, phone_number, phone_country_code
        ) VALUES (?, ?, ?, ?)`,
        [
          receiptId,
          body.paymentDetails.cardNumber || null,
          body.paymentDetails.phoneNumber || null,
          body.paymentDetails.phoneCountryCode || null,
        ]
      );
    }

    // Insert due record if payment is partial or due exists
    if (body.paymentStatus !== "full" && body.dueTotal > 0) {
      const productOrdered = body.items.map((i) => i.description).join(", ");
      const totalQuantity = body.items.reduce(
        (sum, i) => sum + (i.quantity || 0),
        0
      );
      const expectedPaymentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      await connection.query(
        `INSERT INTO due_records (
          customer_name, customer_contact, customer_country_code,
          product_ordered, quantity, amount_due, expected_payment_date,
          user_id, receipt_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.customerName,
          body.customerContact,
          body.customerCountryCode,
          productOrdered,
          totalQuantity,
          body.dueTotal,
          expectedPaymentDate,
          decoded.userId,
          body.receiptNumber,
        ]
      );
    }

    // Insert account transaction if total > 0 (payment received)
    if (body.total > 0) {
      await connection.query(
        `INSERT INTO account_transactions (
          particulars, amount, type, user_id, receipt_id
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          `Payment from ${body.customerName}`,
          body.total,
          "credit",
          decoded.userId,
          receiptId,
        ]
      );
    }

    await connection.commit();

    return NextResponse.json({ success: true, receiptId });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback errors
      }
    }
    console.error("Error creating receipt:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create receipt" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}
