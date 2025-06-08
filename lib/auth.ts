import jwt from "jsonwebtoken";
import { cookies } from "next/headers"; // next/headers is valid in app directory
import { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-strong-secret-here";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export async function signJwt(userId: string | number) {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };
  
  return jwt.sign({ userId }, JWT_SECRET as jwt.Secret, options);
}

export async function verifyJwt(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch (error) {
    console.error("JWT Verification Error:", error);
    throw new Error("Invalid or expired token");
  }
}

// ✅ Correct usage with `cookies().get()` — no await needed in this context
export async function auth() {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;

  try {
    const decoded = await verifyJwt(token);
    return { user: { id: decoded.userId } };
  } catch (error) {
    return null;
  }
}
