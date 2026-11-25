import { NextRequest, NextResponse } from 'next/server';
import {
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  getBackendBaseUrl,
  isTokenExpired,
  setAuthCookies,
  userFromIdToken,
} from '@/lib/authCookies';

export async function GET(req: NextRequest) {
  let idToken = req.cookies.get(ID_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!idToken || isTokenExpired(idToken)) {
    if (!refreshToken) {
      const res = NextResponse.json({ isAuthenticated: false, user: null });
      clearAuthCookies(res);
      return res;
    }

    try {
      const upstream = await fetch(`${getBackendBaseUrl()}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!upstream.ok) {
        const res = NextResponse.json({ isAuthenticated: false, user: null });
        clearAuthCookies(res);
        return res;
      }
      const data = (await upstream.json()) as {
        AccessToken?: string;
        IdToken?: string;
      };
      if (!data.IdToken) {
        const res = NextResponse.json({ isAuthenticated: false, user: null });
        clearAuthCookies(res);
        return res;
      }
      idToken = data.IdToken;
      const user = userFromIdToken(idToken);
      const res = NextResponse.json({ isAuthenticated: true, user });
      setAuthCookies(res, {
        idToken: data.IdToken,
        accessToken: data.AccessToken,
      });
      return res;
    } catch {
      return NextResponse.json({ isAuthenticated: false, user: null });
    }
  }

  return NextResponse.json({
    isAuthenticated: true,
    user: userFromIdToken(idToken),
  });
}
