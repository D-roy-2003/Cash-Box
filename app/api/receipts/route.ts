import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";
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
  paymentType: "cash" | "online";
  paymentStatus: "full" | "advance" | "due";
  paymentDate?: string;
  notes?: string;
  total: number;
  dueTotal: number;
  items: ReceiptItem[];
  paymentDetails?: PaymentDetails;
  gstPercentage?: number;
  gstAmount?: number;
}

interface JwtPayload {
  userId: string | number;
  [key: string]: any;
}

// New helper function to format date for MySQL DATE column (YYYY-MM-DD)
function formatDateOnlyForMySQL(date: Date | string): string {
  let d: Date;

  if (typeof date === "string") {
    if (date.includes("T")) {
      d = new Date(date);
    } else {
      d = new Date(date + "T00:00:00"); // Assuming local timezone input if no T
    }
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format: ${date}`);
  }

  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatLocalDateForMySQL(date: Date | string): string {
  let d: Date;

  if (typeof date === "string") {
    if (date.includes("T")) {
      d = new Date(date);
    } else {
      d = new Date(date + "T00:00:00");
    }
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format: ${date}`);
  }

  const pad = (num: number) => num.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function validateReceiptBody(body: ReceiptBody): string | null {
  if (!body.receiptNumber) return "Receipt number is required";
  if (!body.date) return "Date is required";
  if (!body.customerName) return "Customer name is required";
  if (!body.customerContact) return "Customer contact is required";

  const validTypes = ["cash", "online"];
  if (
    !body.paymentType ||
    !validTypes.includes(body.paymentType.toLowerCase())
  ) {
    return `Payment type must be one of: ${validTypes.join(", ")}`;
  }

  const validStatuses = ["full", "advance", "due"];
  if (
    !body.paymentStatus ||
    !validStatuses.includes(body.paymentStatus.toLowerCase())
  ) {
    return `Payment status must be one of: ${validStatuses.join(", ")}`;
  }

  if (body.paymentStatus === "due" && !body.paymentDate) {
    return "Expected payment date is required for due payments";
  }

  if (body.paymentDate) {
    const paymentDate = new Date(body.paymentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(paymentDate.getTime())) {
      return "Invalid payment date format";
    }

    if (paymentDate < today) {
      return "Payment date cannot be in the past";
    }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "At least one item is required";
  }

  for (const [index, item] of body.items.entries()) {
    if (!item.description) return `Item ${index + 1} description is required`;
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return `Item ${index + 1} quantity must be a positive number`;
    }
    if (typeof item.price !== "number" || item.price < 0) {
      return `Item ${index + 1} price must be a non-negative number`;
    }
  }

  if (body.paymentStatus === "full" && body.dueTotal !== 0) {
    return "Due total must be 0 for full payment";
  }

  if (body.paymentStatus === "advance") {
    const totalAdvance = body.items.reduce(
      (sum, item) => sum + (item.advanceAmount || 0),
      0
    );
    if (totalAdvance <= 0) {
      return "Advance payment must have positive advance amounts";
    }
    if (Math.abs(totalAdvance - (body.total - body.dueTotal)) > 0.01) {
      return "Advance amounts don't match calculated total";
    }
  }

  if (body.paymentStatus === "due") {
    const totalDue = body.items.reduce(
      (sum, item) => sum + (item.dueAmount || 0),
      0
    );
    if (totalDue <= 0) {
      return "Due payment must have positive due amounts";
    }
    if (Math.abs(totalDue - body.dueTotal) > 0.01) {
      return "Item due amounts don't match total due amount";
    }
  }

  if (
    body.gstPercentage &&
    (body.gstPercentage < 0 || body.gstPercentage > 28)
  ) {
    return "GST percentage must be between 0 and 28";
  }

  return null;
}

async function createReceipt(
  connection: mysql.PoolConnection,
  body: ReceiptBody,
  userId: string
): Promise<number> {
  console.log("Creating receipt with data:", {
    receiptNumber: body.receiptNumber,
    customerName: body.customerName,
    total: body.total,
  });

  // Initialize all values to 0, let the trigger calculate the actual values
  const initialSubtotal = 0;
  const initialTotalTax = 0;
  const initialTotalDiscount = 0;
  const initialTotal = 0; // Initialize total to 0

  try {
    const [result] = await connection.query<mysql.ResultSetHeader>(
      `INSERT INTO receipts (
        receipt_number, date, customer_name, customer_contact, customer_country_code,
        payment_type, payment_status, notes,
        subtotal, total_tax, total_discount,
        total, due_total, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.receiptNumber,
        formatDateOnlyForMySQL(body.date),
        body.customerName,
        body.customerContact,
        body.customerCountryCode,
        body.paymentType.toLowerCase(),
        body.paymentStatus.toLowerCase(),
        body.notes || null,
        initialSubtotal,
        initialTotalTax,
        initialTotalDiscount,
        initialTotal, // Use initialTotal instead of body.total
        body.dueTotal,
        userId,
        formatLocalDateForMySQL(new Date()),
      ]
    );

    console.log("Receipt created with ID:", result.insertId);
    return result.insertId;
  } catch (error) {
    console.error("Error creating receipt:", error);
    throw error;
  }
}

async function processReceiptItems(
  connection: mysql.PoolConnection,
  receiptId: number,
  items: ReceiptItem[],
  gstPercentage?: number
): Promise<void> {
  console.log("Processing receipt items for receipt ID:", receiptId);

  try {
    for (const [index, item] of items.entries()) {
      console.log(`Processing item ${index + 1}:`, {
        description: item.description,
        quantity: item.quantity,
        price: item.price,
      });

      // Calculate item subtotal
      const itemSubtotal = item.price * item.quantity;

      // Calculate tax if GST percentage is provided
      const itemTax = gstPercentage ? (itemSubtotal * gstPercentage) / 100 : 0;

      await connection.query(
        `INSERT INTO receipt_items (
          receipt_id, description, quantity, price, 
          advance_amount, due_amount, tax_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          receiptId,
          item.description,
          item.quantity,
          item.price,
          item.advanceAmount ?? 0,
          item.dueAmount ?? 0,
          itemTax,
        ]
      );
    }
    console.log("All items processed successfully");
  } catch (error) {
    console.error("Error processing receipt items:", error);
    throw new Error("Failed to process receipt items");
  }
}

async function processPaymentDetails(
  connection: mysql.PoolConnection,
  receiptId: number,
  paymentDetails?: PaymentDetails
): Promise<void> {
  if (!paymentDetails) return;

  console.log("Processing payment details for receipt ID:", receiptId);

  try {
    await connection.query(
      `INSERT INTO payment_details (
        receipt_id, card_number, phone_number, phone_country_code
      ) VALUES (?, ?, ?, ?)`,
      [
        receiptId,
        paymentDetails.cardNumber || null,
        paymentDetails.phoneNumber || null,
        paymentDetails.phoneCountryCode || null,
      ]
    );
    console.log("Payment details processed successfully");
  } catch (error) {
    console.error("Error processing payment details:", error);
    throw new Error("Failed to process payment details");
  }
}

async function processDueRecords(
  connection: mysql.PoolConnection,
  receiptId: number,
  body: ReceiptBody,
  userId: string
): Promise<void> {
  if (body.paymentStatus !== "due") return;

  console.log("Processing due records for receipt ID:", receiptId);

  try {
    const productOrdered = body.items.map((i) => i.description).join(", ");
    const totalQuantity = body.items.reduce((sum, i) => sum + i.quantity, 0);

    // Use the paymentDate from the form, or default to 7 days from now if not provided
    const expectedPaymentDate = body.paymentDate
      ? new Date(body.paymentDate)
      : (() => {
          const date = new Date();
          date.setDate(date.getDate() + 7);
          return date;
        })();

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
        formatDateOnlyForMySQL(expectedPaymentDate),
        userId,
        body.receiptNumber,
      ]
    );
    console.log("Due records processed successfully");
  } catch (error) {
    console.error("Error processing due records:", error);
    throw new Error("Failed to process due records");
  }
}

async function processAccountTransaction(
  connection: mysql.PoolConnection,
  receiptId: number,
  body: ReceiptBody,
  userId: string
): Promise<void> {
  if (body.paymentStatus === "due") return;

  console.log("Processing account transaction for receipt ID:", receiptId);

  try {
    const createdAt = formatLocalDateForMySQL(new Date());
    let transactionAmount = 0;
    let particulars = "";

    if (body.paymentStatus === "full") {
      transactionAmount = body.total;
      particulars = `Full payment from ${body.customerName} (Receipt: ${body.receiptNumber})`;
    } else if (body.paymentStatus === "advance") {
      transactionAmount = body.total - body.dueTotal;
      particulars = `Advance payment from ${body.customerName} (Receipt: ${body.receiptNumber})`;
    }

    if (transactionAmount > 0) {
      await connection.query(
        `INSERT INTO account_transactions (
          particulars, amount, type, user_id, receipt_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [particulars, transactionAmount, "credit", userId, receiptId, createdAt]
      );
      console.log("Account transaction processed successfully");
    }
  } catch (error) {
    console.error("Error processing account transaction:", error);
    throw new Error("Failed to process account transaction");
  }
}

export async function POST(request: Request) {
  console.log("Receipt creation request received");

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.error("Unauthorized - No bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const userId = await verifyJwt(token);
    if (!userId) {
      console.error("Invalid token - No user ID");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    console.log("Authenticated user ID:", userId);

    const body: ReceiptBody = await request.json();
    console.log("Request body received:", JSON.stringify(body, null, 2));

    const validationError = validateReceiptBody(body);
    if (validationError) {
      console.error("Validation error:", validationError);
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const pool = await getPool();
    connection = await pool.getConnection();
    console.log("Database connection acquired");

    await connection!.beginTransaction();
    console.log("Transaction started");

    const receiptId = await createReceipt(connection!, body, userId);
    await processReceiptItems(
      connection!,
      receiptId,
      body.items,
      body.gstPercentage
    );

    if (body.paymentDetails) {
      await processPaymentDetails(connection!, receiptId, body.paymentDetails);
    }

    if (body.paymentStatus !== "full" && body.dueTotal > 0) {
      await processDueRecords(connection!, receiptId, body, userId);
    }

    // Always process the account transaction for full/advance payments
    await processAccountTransaction(connection!, receiptId, body, userId);

    await connection!.commit();
    console.log("Transaction committed successfully");

    return NextResponse.json({
      success: true,
      receiptId,
      message: "Receipt created successfully",
    });
  } catch (error: unknown) {
    console.error("Error in receipt creation:", error);

    if (connection) {
      try {
        await connection.rollback();
        console.log("Transaction rolled back");
      } catch (rollbackError: unknown) {
        console.error("Rollback failed:", rollbackError);
      }
    }

    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes("Data truncated")) {
        errorMessage = "Invalid data format for one of the fields";
      } else if (error.message.includes("foreign key constraint")) {
        errorMessage = "Invalid user reference";
      } else if (error.message.includes("Duplicate entry")) {
        errorMessage = "Receipt number already exists";
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.stack
              : null
            : undefined,
      },
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

export async function GET(request: Request) {
  // Authenticate user
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;
  try {
    const userId = await verifyJwt(token);
    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const pool = await getPool();
    connection = await pool.getConnection();
    // Fetch the latest receipt number for this user
    const [rows] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT receipt_number FROM receipts WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    let nextNumber = 1;
    let prefix = "RCPT";
    if (rows.length > 0 && rows[0].receipt_number) {
      // Extract numeric part from the last receipt number
      const match = rows[0].receipt_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const receiptNumber = `${prefix}${userId}-${nextNumber
      .toString()
      .padStart(4, "0")}`;
    return NextResponse.json({ receiptNumber });
  } catch (error) {
    console.error("Error generating receipt number:", error);
    return NextResponse.json(
      { error: "Failed to generate receipt number" },
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
