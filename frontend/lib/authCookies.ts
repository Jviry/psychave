import type { NextResponse } from 'next/server';
import type { CognitoRole } from '@/lib/types';

export const ID_TOKEN_COOKIE = 'psychave_id_token';
export const ACCESS_TOKEN_COOKIE = 'psychave_access_token';
export const REFRESH_TOKEN_COOKIE = 'psychave_refresh_token';

export interface CookieUser {
  email: string;
  username: string;
  role: CognitoRole;
  cognitoSub: string;
}

export function getBackendBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '');
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function userFromIdToken(idToken: string, fallbackUsername = ''): CookieUser {
  const payload = decodeJwtPayload(idToken) ?? {};
  const rawGroups = payload['cognito:groups'];
  const groups = Array.isArray(rawGroups) ? rawGroups.map(String) : [];
  const role: CognitoRole = groups.includes('admin')
    ? 'admin'
    : groups.includes('psychologist')
      ? 'psychologist'
      : 'client';

  return {
    email: typeof payload.email === 'string' ? payload.email : '',
    username:
      typeof payload['cognito:username'] === 'string'
        ? payload['cognito:username']
        : fallbackUsername,
    role,
    cognitoSub: typeof payload.sub === 'string' ? payload.sub : '',
  };
}

export function isTokenExpired(token: string, skewSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

export function setAuthCookies(
  res: NextResponse,
  tokens: { idToken?: string; accessToken?: string; refreshToken?: string }
): void {
  if (tokens.idToken) {
    res.cookies.set(ID_TOKEN_COOKIE, tokens.idToken, cookieOptions(60 * 60));
  }
  if (tokens.accessToken) {
    res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions(60 * 60));
  }
  if (tokens.refreshToken) {
    res.cookies.set(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      cookieOptions(60 * 60 * 24 * 30)
    );
  }
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ID_TOKEN_COOKIE, '', cookieOptions(0));
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', cookieOptions(0));
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', cookieOptions(0));
}
