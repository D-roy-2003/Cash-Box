// app/api/transactions/route.ts
import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { dbConfig } from '@/lib/db'
import { verifyJwt } from '@/lib/auth'

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1]
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let connection
  try {
    const decoded = await verifyJwt(token)
    connection = await mysql.createConnection(dbConfig)

    const [transactions] = await connection.query(
      `SELECT * FROM account_transactions
       WHERE user_id = ? ORDER BY transaction_date DESC`,
      [decoded.userId]
    )

    const [balanceResult] = await connection.query(
      `SELECT balance, total_due_balance FROM account_balances
       WHERE user_id = ?`,
      [decoded.userId]
    )

    const balanceRow = (balanceResult as any[])[0] || {}

    return NextResponse.json({
      transactions,
      balance: balanceRow.balance || 0,
      totalDueBalance: balanceRow.total_due_balance || 0
    })

  } catch (error) {
    console.error('GET /transactions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    if (connection) await connection.end()
  }
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1]
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let connection
  try {
    const decoded = await verifyJwt(token)
    const { particulars, amount, type } = await request.json()

    // Basic input validation
    if (!particulars || typeof particulars !== 'string' ||
        !amount || typeof amount !== 'number' ||
        !['credit', 'debit'].includes(type)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    connection = await mysql.createConnection(dbConfig)

    await connection.query(
      `INSERT INTO account_transactions (particulars, amount, type, user_id)
       VALUES (?, ?, ?, ?)`,
      [particulars, amount, type, decoded.userId]
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('POST /transactions error:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  } finally {
    if (connection) await connection.end()
  }
}
