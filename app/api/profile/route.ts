// app/api/profile/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import { initializeDatabase } from "@/lib/database";

interface UserProfile {
  id: string | number;
  superkey: string;
  name: string;
  email: string;
  createdAt: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeCountryCode: string;
  gstNumber?: string | null;
  profilePhoto?: string | null;
  isProfileComplete: boolean;
}

interface UpdateProfilePayload {
  name: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeCountryCode: string;
  gstNumber?: string | null;
  profilePhoto?: string | null;
}

interface ErrorResponse {
  error: string;
  details?: string;
  missingFields?: string[];
}

async function ensureDatabaseConnection(): Promise<boolean> {
  try {
    await initializeDatabase();
    const pool = await getPool();
    const testConnection = await pool.getConnection();
    await testConnection.ping();
    testConnection.release();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

function createErrorResponse(error: string, status: number, details?: any): NextResponse {
  const response: ErrorResponse = { error };
  
  if (details) {
    if (typeof details === 'string') {
      response.details = details;
    } else if (Array.isArray(details)) {
      response.missingFields = details;
    } else {
      response.details = JSON.stringify(details);
    }
  }

  return NextResponse.json(response, { status });
}

export async function GET(request: Request): Promise<NextResponse> {
  const isDbConnected = await ensureDatabaseConnection();
  if (!isDbConnected) {
    return createErrorResponse("Database connection failed", 500);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return createErrorResponse("Missing or invalid authorization header", 401);
  }

  const token = authHeader.slice(7);
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return createErrorResponse("Invalid or expired token", 401);
    }

    const pool = await getPool();
    connection = await pool.getConnection();

    const [users] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        id, 
        superkey, 
        name, 
        email, 
        created_at AS createdAt,
        store_name AS storeName, 
        store_address AS storeAddress, 
        store_contact AS storeContact, 
        store_country_code AS storeCountryCode, 
        gst_number AS gstNumber,
        profile_photo AS profilePhoto,
        profile_complete AS isProfileComplete
       FROM users 
       WHERE id = ? LIMIT 1`,
      [decoded.userId]
    );

    if (!users || users.length === 0) {
      return createErrorResponse("User not found", 404);
    }

    const user = users[0] as UserProfile;
    
    const requiredFields = ['id', 'superkey', 'email'];
    const missingFields = requiredFields.filter(field => !user[field as keyof UserProfile]);

    if (missingFields.length > 0) {
      console.error('Incomplete user data returned from database', { missingFields });
      return createErrorResponse("Incomplete user data", 500, missingFields);
    }

    const responseData: UserProfile = {
      ...user,
      isProfileComplete: Boolean(user.isProfileComplete),
      createdAt: user.createdAt || new Date().toISOString()
    };

    const response = NextResponse.json(responseData);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;

  } catch (error: unknown) {
    console.error("GET /profile error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        return createErrorResponse("Session expired. Please log in again.", 401);
      }
      
      if (error.message.includes('database')) {
        return createErrorResponse("Database error occurred", 503, error.message);
      }
    }

    return createErrorResponse("Internal server error", 500, (error as Error)?.message);
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

export async function PUT(request: Request): Promise<NextResponse> {
  const isDbConnected = await ensureDatabaseConnection();
  if (!isDbConnected) {
    return createErrorResponse("Database connection failed", 500);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return createErrorResponse("Authorization header missing or invalid", 401);
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return createErrorResponse("Invalid token", 401);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return createErrorResponse("Invalid content type. Must be application/json", 400);
    }

    const updateData: UpdateProfilePayload = await request.json();

    // Validate all mandatory fields
    const requiredFields = [
      "name",
      "storeName",
      "storeAddress",
      "storeContact",
      "storeCountryCode",
    ];

    const missingFields = requiredFields.filter(
      (field) => !updateData[field as keyof UpdateProfilePayload]
    );

    if (missingFields.length) {
      return createErrorResponse("Missing required fields", 400, missingFields);
    }

    // Validate store contact (10 digits)
    if (!/^\d{10}$/.test(updateData.storeContact)) {
      return createErrorResponse("Store contact must be exactly 10 digits", 400);
    }

    // Validate GST number if provided (15 alphanumeric characters)
    if (updateData.gstNumber && !/^[0-9A-Z]{15}$/.test(updateData.gstNumber)) {
      return createErrorResponse("GST number must be exactly 15 alphanumeric characters", 400);
    }

    // Determine if profile is complete
    const isProfileComplete = requiredFields.every(
      (field) => updateData[field as keyof UpdateProfilePayload]
    );

    const pool = await getPool();
    connection = await pool.getConnection();

    const [result] = await connection!.query<mysql.OkPacket>(
      `UPDATE users SET 
        name = ?, 
        store_name = ?, 
        store_address = ?, 
        store_contact = ?, 
        store_country_code = ?, 
        gst_number = ?,
        profile_photo = ?,
        profile_complete = ?
       WHERE id = ?`,
      [
        updateData.name,
        updateData.storeName,
        updateData.storeAddress,
        updateData.storeContact,
        updateData.storeCountryCode,
        updateData.gstNumber || null,
        updateData.profilePhoto || null,
        isProfileComplete ? 1 : 0,
        decoded.userId,
      ]
    );

    if (result.affectedRows === 0) {
      return createErrorResponse("User not found or no changes made", 404);
    }

    const [updatedUser] = await connection!.query<mysql.RowDataPacket[]>(
      `SELECT 
        id, superkey, name, email,
        created_at AS createdAt,
        store_name AS storeName, 
        store_address AS storeAddress, 
        store_contact AS storeContact, 
        store_country_code AS storeCountryCode, 
        gst_number AS gstNumber,
        profile_photo AS profilePhoto,
        profile_complete AS isProfileComplete
       FROM users 
       WHERE id = ? LIMIT 1`,
      [decoded.userId]
    );

    if (!updatedUser || updatedUser.length === 0) {
      return createErrorResponse("Failed to fetch updated profile", 500);
    }

    return NextResponse.json({
      success: true,
      updatedProfile: updatedUser[0] as UserProfile,
      isProfileComplete,
    });

  } catch (error: unknown) {
    console.error("PUT /profile error:", error);
    return createErrorResponse(
      "Update failed", 
      500, 
      (error as Error)?.message
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

export async function PATCH(request: Request): Promise<NextResponse> {
  const isDbConnected = await ensureDatabaseConnection();
  if (!isDbConnected) {
    return createErrorResponse("Database connection failed", 500);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return createErrorResponse("Authorization header missing or invalid", 401);
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return createErrorResponse("Invalid token", 401);
    }

    const { isProfileComplete } = await request.json();

    const pool = await getPool();
    connection = await pool.getConnection();

    const [result] = await connection!.query<mysql.OkPacket>(
      `UPDATE users SET profile_complete = ? WHERE id = ?`,
      [isProfileComplete ? 1 : 0, decoded.userId]
    );

    if (result.affectedRows === 0) {
      return createErrorResponse("User not found or no changes made", 404);
    }

    return NextResponse.json({
      success: true,
      isProfileComplete,
    });

  } catch (error: unknown) {
    console.error("PATCH /profile/complete error:", error);
    return createErrorResponse(
      "Update failed", 
      500, 
      (error as Error)?.message
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