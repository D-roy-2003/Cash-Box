import { NextResponse } from 'next/server'
import { pool } from '@/lib/db' // Assuming you've set up a connection pool
import { verifyJwt } from '@/lib/auth'

// Helper: Verify JWT from request headers
async function verifyToken(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1]
  if (!token) throw new Error('Unauthorized')
  const decoded = await verifyJwt(token)
  if (!decoded?.userId) throw new Error('Invalid token')
  return decoded
}

// GET /api/due - Fetch unpaid dues
export async function GET(request: Request) {
  try {
    const { userId } = await verifyToken(request)
    const connection = await pool.getConnection()

    const [dueRecords] = await connection.query(
      `SELECT * FROM due_records
       WHERE user_id = ? AND is_paid = FALSE
       ORDER BY expected_payment_date ASC`,
      [userId]
    )

    connection.release()
    return NextResponse.json(dueRecords)

  } catch (error) {
    console.error('[GET] /api/due error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// PUT /api/due - Mark a due as paid and create a transaction
export async function PUT(request: Request) {
  try {
    const { userId } = await verifyToken(request)
    const { id } = await request.json()

    // Validate ID
    if (typeof id !== 'number' || id <= 0) {
      return NextResponse.json({ error: 'Invalid due record ID' }, { status: 400 })
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // 1. Mark the due record as paid
      const [updateResult] = await connection.query(
        `UPDATE due_records 
         SET is_paid = TRUE, paid_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [id, userId]
      )

      // Check if the record was actually updated
      if (updateResult.affectedRows === 0) {
        throw new Error('Due record not found or already paid')
      }

      // 2. Get the due record details for the transaction
      const [dueRecord] = await connection.query(
        `SELECT customer_name, amount_due 
         FROM due_records WHERE id = ?`,
        [id]
      )

      // 3. Create the transaction record
      await connection.query(
        `INSERT INTO account_transactions
         (particulars, amount, type, user_id, due_record_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          `Payment from ${dueRecord[0].customer_name}`,
          dueRecord[0].amount_due,
          'credit',
          userId,
          id
        ]
      )

      await connection.commit()
      return NextResponse.json({ success: true })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('[PUT] /api/due error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment processing failed' },
      { 
        status: error instanceof Error && error.message === 'Unauthorized' 
          ? 401 
          : 400 
      }
    )
  }
}