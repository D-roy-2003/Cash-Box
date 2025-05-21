// lib/auth.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export async function signJwt(userId: string | number) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// You might want to add this verification function as well
export async function verifyJwt(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string | number };
}