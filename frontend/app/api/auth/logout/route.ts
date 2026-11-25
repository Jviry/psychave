import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  ID_TOKEN_COOKIE,
  clearAuthCookies,
  getBackendBaseUrl,
} from '@/lib/authCookies';

export async function POST(req: NextRequest) {
  const idToken = req.cookies.get(ID_TOKEN_COOKIE)?.value;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (idToken && accessToken) {
    try {
      await fetch(`${getBackendBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ access_token: accessToken }),
      });
    } catch {
      // Best-effort server revocation; always clear local cookies.
    }
  }

  const res = NextResponse.json({ message: 'logout successful' }, { status: 200 });
  clearAuthCookies(res);
  return res;
}
