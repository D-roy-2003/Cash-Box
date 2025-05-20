// app/api/login/route.ts
import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { dbConfig } from '@/lib/db'
import { signJwt } from '@/lib/auth'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  try {
    const connection = await mysql.createConnection(dbConfig)

    // Fetch user by email
    const [rows] = await connection.query<any[]>(
      `SELECT id, name, email, password FROM users WHERE email = ?`,
      [email]
    )

    await connection.end()

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = rows[0]

    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Generate JWT
    const token = await signJwt(user.id)

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      token,
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
