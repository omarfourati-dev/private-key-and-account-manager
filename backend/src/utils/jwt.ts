import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function generateRefreshToken(payload: JwtPayload): { token: string; jti: string } {
  const jti = uuidv4();
  const token = jwt.sign({ ...payload, jti }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  return { token, jti };
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload & { iat: number; exp: number };
  return { userId: decoded.userId, email: decoded.email };
}

export function verifyRefreshToken(token: string): JwtPayload & { jti: string } {
  const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload & { jti: string };
  return { userId: decoded.userId, email: decoded.email, jti: decoded.jti };
}

export function getRefreshTokenExpiry(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}
