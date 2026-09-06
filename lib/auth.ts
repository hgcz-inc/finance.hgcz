import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Currency, normalizeCurrency } from '@/lib/currency';

export const SESSION_COOKIE_NAME = 'hfinance_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthenticatedUser {
  id: number;
  loginId: string;
  currency: Currency;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!secret) {
    throw new Error('SESSION_SECRET must be configured');
  }
  return secret;
}

function signature(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('hex');
}

export function createSessionToken(userId: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

function verifySessionToken(token: string): number | null {
  const [userIdText, expiresAtText, suppliedSignature] = token.split('.');
  const userId = Number(userIdText);
  const expiresAt = Number(expiresAtText);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(expiresAt)) {
    return null;
  }
  if (expiresAt <= Math.floor(Date.now() / 1000) || !suppliedSignature) {
    return null;
  }

  const expectedSignature = signature(`${userIdText}.${expiresAtText}`);
  const supplied = Buffer.from(suppliedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  return userId;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = verifySessionToken(token);
  if (!userId) return null;

  const result = await query(
    'SELECT id, login_id, currency FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) return null;

  return {
    id: Number(user.id),
    loginId: String(user.login_id),
    currency: normalizeCurrency(user.currency),
  };
}

export function setSessionCookie(response: NextResponse, userId: number): void {
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
