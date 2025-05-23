// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { verifyJwt } from "@/lib/auth";

// Define a custom error type that includes the code property
interface ErrorWithCode extends Error {
  code?: string;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const decoded = await verifyJwt(token);

  if (!decoded?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size too large. Maximum 5MB allowed." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename using timestamp and random number
    const ext = path.extname(file.name);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `${timestamp}-${random}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "Uploads");
    const filePath = path.join(uploadDir, filename);

    try {
      await writeFile(filePath, buffer);
    } catch (err) {
      // Type guard to check if error has a code property
      if (isErrorWithCode(err) && err.code === 'ENOENT') {
        // Directory doesn't exist, create it
        await mkdir(uploadDir, { recursive: true });
        await writeFile(filePath, buffer);
      } else {
        throw err;
      }
    }

    // Return relative path that can be stored in database
    const relativePath = `/Uploads/${filename}`;

    return NextResponse.json({
      success: true,
      filePath: relativePath,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// Type guard function to check if error is of type ErrorWithCode
function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return error instanceof Error && 'code' in error;
}