import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-strong-secret-here";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export async function signJwt(userId: string) {
  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign({ userId }, JWT_SECRET, options);
}

export async function verifyJwt(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    console.error("JWT Verification Error:", error);
    throw new Error("Invalid or expired token");
  }
}

export async function auth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const userId = await verifyJwt(token);
    return userId;
  } catch (error) {
    return null;
  }
}
