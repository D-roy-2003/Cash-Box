import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";

interface ReceiptPreview {
  receiptId: string | number;
  receiptNumber: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
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
  totalTax: number;
  gstNumber?: string;
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
  gstNumber?: string;
}

function formatDateForMySQL(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error("Invalid date format");
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}

// Function to get current local system time in MySQL format
function getCurrentLocalTime(): string {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}

// Function to format database datetime to local time string
function formatDatabaseDateToLocal(date: Date | string): string {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error("Invalid date format");
  
  // Return in local format: YYYY-MM-DD HH:MM:SS
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}

function toPaymentDetails(
  row: mysql.RowDataPacket | undefined
): PaymentDetails {
  if (!row) return {};
  return {
    cardNumber: row.cardNumber || undefined,
    phoneNumber: row.phoneNumber || undefined,
    phoneCountryCode: row.phoneCountryCode || undefined,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid receipt ID format" },
      { status: 400 }
    );
  }

  let connection: mysql.PoolConnection | undefined;

  try {
    const pool = await getPool();
    connection = await pool.getConnection();

    const [receipts] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        r.id, r.receipt_number, 
        DATE_FORMAT(r.date, '%Y-%m-%d') as date,
        r.created_at,
        r.updated_at,
        r.customer_name, r.customer_contact, r.customer_country_code,
        r.payment_type, r.payment_status, r.notes,
        r.total, r.due_total, r.user_id,
        r.total_tax AS totalTax,
        u.store_name AS storeName,
        u.store_address AS storeAddress,
        u.store_contact AS storeContact,
        u.store_country_code AS storeCountryCode,
        u.gst_number AS gstNumber
       FROM receipts r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ? LIMIT 1`,
      [id]
    );

    if (receipts.length === 0) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const receipt = receipts[0];

    const [items] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        description, quantity, price, 
        advance_amount AS advanceAmount, 
        due_amount AS dueAmount
       FROM receipt_items 
       WHERE receipt_id = ?`,
      [id]
    );

    const [paymentDetailsRows] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        card_number AS cardNumber, 
        phone_number AS phoneNumber, 
        phone_country_code AS phoneCountryCode
       FROM payment_details 
       WHERE receipt_id = ? LIMIT 1`,
      [id]
    );

    const response: ReceiptPreview = {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      date: receipt.date,
      createdAt: formatDatabaseDateToLocal(receipt.created_at),
      updatedAt: receipt.updated_at
        ? formatDatabaseDateToLocal(receipt.updated_at)
        : undefined,
      customerName: receipt.customer_name,
      customerContact: receipt.customer_contact,
      customerCountryCode: receipt.customer_country_code,
      paymentType: receipt.payment_type,
      paymentStatus: receipt.payment_status,
      notes: receipt.notes || null,
      total: receipt.total,
      dueTotal: receipt.due_total,
      userId: receipt.user_id,
      totalTax: receipt.totalTax || 0,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        advanceAmount: item.advanceAmount || 0,
        dueAmount: item.dueAmount || 0,
      })),
      paymentDetails: toPaymentDetails(paymentDetailsRows[0]),
      storeInfo: {
        name: receipt.storeName,
        address: receipt.storeAddress,
        contact: receipt.storeContact,
        countryCode: receipt.storeCountryCode,
        gstNumber: receipt.gstNumber || undefined,
      },
      gstNumber: receipt.gstNumber || undefined,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch receipt data";
    console.error("Error in GET /api/receipts/[id]:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

export async function POST(request: Request) {
  let connection: mysql.PoolConnection | undefined;

  try {
    const body = await request.json();
    const pool = await getPool();
    connection = await pool.getConnection();

    // Get current local system time
    const now = getCurrentLocalTime();
    const formattedDate = body.date
      ? formatDateForMySQL(body.date)
      : now;

    const [result] = await connection!.query<mysql.ResultSetHeader>(
      `INSERT INTO receipts (
        receipt_number, date, customer_name, customer_contact, 
        customer_country_code, payment_type, payment_status, 
        notes, total, due_total, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.receiptNumber,
        formattedDate,
        body.customerName,
        body.customerContact,
        body.customerCountryCode,
        body.paymentType,
        body.paymentStatus,
        body.notes,
        body.total,
        body.dueTotal,
        body.userId,
        now,
        now,
      ]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create receipt";
    console.error("Error in POST /api/receipts:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}