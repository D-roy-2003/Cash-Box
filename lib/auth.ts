import jwt from "jsonwebtoken";
import { cookies } from "next/headers"; // next/headers is valid in app directory

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

export async function signJwt(userId: string | number) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export async function verifyJwt(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

// ✅ Correct usage with `cookies().get()` — no await needed in this context
export async function auth() {
  const token = cookies().get("token")?.value;
  if (!token) return null;

  try {
    const decoded = await verifyJwt(token);
    return { user: { id: decoded.userId } };
  } catch (error) {
    return null;
  }
}
