import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export async function PUT(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const userId = session.user.id

    // Fetching user data
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT name, store_name, store_address, store_contact FROM users WHERE id = ?',
      [userId]
    )

    const user = rows[0]

    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    // Check if all required fields are filled
    const isProfileComplete = Boolean(
      user.name && user.store_name && user.store_address && user.store_contact
    )

    // Debugging output for verification
    console.log("User profile data:", {
      name: user.name,
      store_name: user.store_name,
      store_address: user.store_address,
      store_contact: user.store_contact,
      isProfileComplete
    })

    // Update profile_complete field in the database
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE users SET profile_complete = ? WHERE id = ?',
      [isProfileComplete ? 1 : 0, userId]  // Ensure 1 for complete, 0 for incomplete
    )

    console.log("Update result:", result)

    return NextResponse.json({
      success: true,
      profile_complete: isProfileComplete,
      affectedRows: result.affectedRows
    })
  } catch (error) {
    console.error('[PROFILE_COMPLETE_PUT]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
