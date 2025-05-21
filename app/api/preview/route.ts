// app/api/preview/[id]/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { pool } from "@/lib/database";

// Type definitions
interface ReceiptPreview {
  receiptId: string | number;
  receiptNumber: string;
  date: string;
  customerName: string;
  customerContact: string;
  customerCountryCode: string;
  paymentType: string;
  paymentStatus: string;
  notes?: string | null;
  total: number;
  dueTotal: number;
  userId: string | number;
  items: ReceiptItem[];
  paymentDetails: PaymentDetails;
  storeInfo: StoreInfo;
}

interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  advanceAmount: number;
  dueAmount: number;
}

interface PaymentDetails {
  cardNumber?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
}

interface StoreInfo {
  name: string;
  address: string;
  contact: string;
  countryCode: string;
}

// Helper function to convert database row to PaymentDetails
function toPaymentDetails(row: mysql.RowDataPacket | undefined): PaymentDetails {
  if (!row) return {};
  return {
    cardNumber: row.cardNumber || undefined,
    phoneNumber: row.phoneNumber || undefined,
    phoneCountryCode: row.phoneCountryCode || undefined
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Validate receipt ID parameter
  if (!params.id || !/^\d+$/.test(params.id)) {
    return NextResponse.json(
      { error: "Invalid receipt ID format" },
      { status: 400 }
    );
  }

  let connection: mysql.PoolConnection | undefined;

  try {
    connection = await pool.getConnection();

    // Get receipt with store info
    const [receipts] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        r.id, r.receipt_number, r.date, 
        r.customer_name, r.customer_contact, r.customer_country_code,
        r.payment_type, r.payment_status, r.notes,
        r.total, r.due_total, r.user_id,
        u.store_name AS storeName,
        u.store_address AS storeAddress,
        u.store_contact AS storeContact,
        u.store_country_code AS storeCountryCode
       FROM receipts r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ? LIMIT 1`,
      [params.id]
    );

    if (receipts.length === 0) {
      return NextResponse.json(
        { error: "Receipt not found" }, 
        { status: 404 }
      );
    }

    const receipt = receipts[0];

    // Get receipt items
    const [items] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        description, quantity, price, 
        advance_amount AS advanceAmount, 
        due_amount AS dueAmount
       FROM receipt_items 
       WHERE receipt_id = ?`,
      [params.id]
    );

    // Get payment details
    const [paymentDetailsRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT 
        card_number AS cardNumber, 
        phone_number AS phoneNumber, 
        phone_country_code AS phoneCountryCode
       FROM payment_details 
       WHERE receipt_id = ? LIMIT 1`,
      [params.id]
    );

    // Compose final result
    const response: ReceiptPreview = {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      date: receipt.date,
      customerName: receipt.customer_name,
      customerContact: receipt.customer_contact,
      customerCountryCode: receipt.customer_country_code,
      paymentType: receipt.payment_type,
      paymentStatus: receipt.payment_status,
      notes: receipt.notes || null,
      total: receipt.total,
      dueTotal: receipt.due_total,
      userId: receipt.user_id,
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        advanceAmount: item.advanceAmount || 0,
        dueAmount: item.dueAmount || 0
      })),
      paymentDetails: toPaymentDetails(paymentDetailsRows[0]),
      storeInfo: {
        name: receipt.storeName,
        address: receipt.storeAddress,
        contact: receipt.storeContact,
        countryCode: receipt.storeCountryCode
      }
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to fetch receipt data";
    console.error("Error in GET /api/preview/[id]:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}