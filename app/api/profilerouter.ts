// app/api/profile/route.ts
import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { dbConfig } from '@/lib/db'
import { verifyJwt } from '@/lib/auth'

// Create a connection pool when the module is loaded
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10, // Adjust based on your needs
  queueLimit: 0
})

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1]

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let connection

  try {
    const decoded = await verifyJwt(token)
    connection = await pool.getConnection()

    const [users] = await connection.query(
      `SELECT id, name, email, 
              store_name AS storeName, 
              store_address AS storeAddress, 
              store_contact AS storeContact, 
              store_country_code AS storeCountryCode, 
              profile_photo AS profilePhoto 
       FROM users 
       WHERE id = ?`,
      [decoded.userId]
    )

    return NextResponse.json(users[0] || {})
  } catch (error: any) {
    console.error('GET /profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    )
  } finally {
    if (connection) connection.release() // Release back to the pool instead of ending
  }
}

export async function PUT(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1]
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let connection

  try {
    const decoded = await verifyJwt(token)
    const data = await request.json()

    // Basic validation
    const {
      name,
      storeName,
      storeAddress,
      storeContact,
      storeCountryCode,
      profilePhoto
    } = data

    if (!name || !storeName || !storeAddress || !storeContact || !storeCountryCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    connection = await pool.getConnection()

    await connection.query(
      `UPDATE users SET 
         name = ?, 
         store_name = ?, 
         store_address = ?, 
         store_contact = ?, 
         store_country_code = ?, 
         profile_photo = ?
       WHERE id = ?`,
      [
        name,
        storeName,
        storeAddress,
        storeContact,
        storeCountryCode,
        profilePhoto || null,
        decoded.userId
      ]
    )

    return NextResponse.json({
      success: true,
      updatedProfile: {
        name,
        storeName,
        storeAddress,
        storeContact,
        storeCountryCode,
        profilePhoto
      }
    })
  } catch (error: any) {
    console.error('PUT /profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    )
  } finally {
    if (connection) connection.release() // Release back to the pool
  }
}