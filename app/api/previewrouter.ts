// app/api/receipts/[id]/route.ts
import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { dbConfig } from '@/lib/db'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  let connection

  try {
    connection = await mysql.createConnection(dbConfig)

    // Get receipt with store info
    const [receipts] = await connection.query(
      `SELECT r.*, 
              u.store_name AS storeName,
              u.store_address AS storeAddress,
              u.store_contact AS storeContact,
              u.store_country_code AS storeCountryCode
       FROM receipts r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [params.id]
    )

    if (!receipts.length) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const receipt = receipts[0]

    // Get receipt items
    const [items] = await connection.query(
      `SELECT description, quantity, price, advance_amount AS advanceAmount, due_amount AS dueAmount
       FROM receipt_items WHERE receipt_id = ?`,
      [params.id]
    )

    // Get payment details
    const [paymentDetails] = await connection.query(
      `SELECT card_number AS cardNumber, phone_number AS phoneNumber, phone_country_code AS phoneCountryCode
       FROM payment_details WHERE receipt_id = ?`,
      [params.id]
    )

    // Compose final result
    const response = {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      date: receipt.date,
      customerName: receipt.customer_name,
      customerContact: receipt.customer_contact,
      customerCountryCode: receipt.customer_country_code,
      paymentType: receipt.payment_type,
      paymentStatus: receipt.payment_status,
      notes: receipt.notes,
      total: receipt.total,
      dueTotal: receipt.due_total,
      userId: receipt.user_id,
      items,
      paymentDetails: paymentDetails[0] || {},
      storeInfo: {
        name: receipt.storeName,
        address: receipt.storeAddress,
        contact: receipt.storeContact,
        countryCode: receipt.storeCountryCode
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  } finally {
    if (connection) await connection.end()
  }
}
