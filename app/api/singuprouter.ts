// app/api/signup/route.ts
import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { dbConfig } from '@/lib/db'

interface SignupRequestBody {
  name: string
  email: string
  password: string
}

export async function POST(request: Request) {
  let connection

  try {
    const { name, email, password } = (await request.json()) as SignupRequestBody

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    connection = await mysql.createConnection(dbConfig)

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    )

    // `existing` can be typed as RowDataPacket[] but to be safe:
    if (Array.isArray(existing) && existing.length > 0) {
      await connection.end()
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert new user
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    )

    // `result` type is ResultSetHeader in mysql2
    const insertId = (result as any).insertId
    if (!insertId) {
      await connection.end()
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Initialize account balance for the new user
    await connection.execute(
      'INSERT INTO account_balances (user_id, balance) VALUES (?, ?)',
      [insertId, 0]
    )

    await connection.end()

    return NextResponse.json({
      id: insertId,
      name,
      email,
      createdAt: new Date().toISOString(),
    }, { status: 201 })

  } catch (error) {
    if (connection) {
      await connection.end()
    }
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
