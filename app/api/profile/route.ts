// app/api/profile/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { pool } from "@/lib/database";
import { verifyJwt } from "@/lib/auth";
import { initializeDatabase } from "@/lib/database";

interface UserProfile {
  id: string | number;
  name: string;
  email: string;
  createdAt: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeCountryCode: string;
  profilePhoto?: string | null;
  isProfileComplete: boolean;
}

interface UpdateProfilePayload {
  name: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeCountryCode: string;
  profilePhoto?: string | null;
}

export async function GET(request: Request) {
  await initializeDatabase();
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    connection = await pool.getConnection();

    const [users] = await connection.query(
      `SELECT 
        id, name, email, 
        created_at AS createdAt,
        store_name AS storeName, 
        store_address AS storeAddress, 
        store_contact AS storeContact, 
        store_country_code AS storeCountryCode, 
        profile_photo AS profilePhoto,
        profile_complete AS isProfileComplete
       FROM users 
       WHERE id = ? LIMIT 1`,
      [decoded.userId]
    );

    const user = (users as UserProfile[])[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}

export async function PUT(request: Request) {
  await initializeDatabase();
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization header missing or invalid" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Invalid content type. Must be application/json" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Missing required fields", missingFields },
        { status: 400 }
      );
    }

    // Additional validation for store contact (10 digits)
    if (!/^\d{10}$/.test(updateData.storeContact)) {
      return NextResponse.json(
        { error: "Store contact must be exactly 10 digits" },
        { status: 400 }
      );
    }

    // Determine if profile is complete
    const isProfileComplete = requiredFields.every(
      (field) => updateData[field as keyof UpdateProfilePayload]
    );

    connection = await pool.getConnection();

    const [result]: any = await connection.query(
      `UPDATE users SET 
        name = ?, 
        store_name = ?, 
        store_address = ?, 
        store_contact = ?, 
        store_country_code = ?, 
        profile_photo = ?,
        profile_complete = ?
       WHERE id = ?`,
      [
        updateData.name,
        updateData.storeName,
        updateData.storeAddress,
        updateData.storeContact,
        updateData.storeCountryCode,
        updateData.profilePhoto || null,
        isProfileComplete ? 1 : 0,
        decoded.userId,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "User not found or no changes made" },
        { status: 404 }
      );
    }

    // Get the updated user profile
    const [updatedUser] = await connection.query(
      `SELECT 
        id, name, email,
        created_at AS createdAt,
        store_name AS storeName, 
        store_address AS storeAddress, 
        store_contact AS storeContact, 
        store_country_code AS storeCountryCode, 
        profile_photo AS profilePhoto,
        profile_complete AS isProfileComplete
       FROM users 
       WHERE id = ? LIMIT 1`,
      [decoded.userId]
    );

    return NextResponse.json({
      success: true,
      updatedProfile: (updatedUser as UserProfile[])[0],
      isProfileComplete,
    });
  } catch (error) {
    console.error("PUT /profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}

// Add this endpoint to handle just the completion status update
export async function PATCH(request: Request) {
  await initializeDatabase();
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization header missing or invalid" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];
  let connection: mysql.PoolConnection | undefined;

  try {
    const decoded = await verifyJwt(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { isProfileComplete } = await request.json();

    connection = await pool.getConnection();

    const [result]: any = await connection.query(
      `UPDATE users SET profile_complete = ? WHERE id = ?`,
      [isProfileComplete ? 1 : 0, decoded.userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "User not found or no changes made" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      isProfileComplete,
    });
  } catch (error) {
    console.error("PATCH /profile/complete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}