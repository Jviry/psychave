import { NextRequest, NextResponse } from 'next/server';
import {
  getBackendBaseUrl,
  setAuthCookies,
  userFromIdToken,
} from '@/lib/authCookies';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  if (!body?.username || !body?.password) {
    return NextResponse.json(
      { detail: 'Username and password are required.' },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: body.username,
        password: body.password,
      }),
    });
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach authentication service.' },
      { status: 502 }
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    AccessToken?: string;
    IdToken?: string;
    RefreshToken?: string;
    detail?: string;
    code?: string;
  };

  if (!upstream.ok || !data.IdToken) {
    return NextResponse.json(data, { status: upstream.status || 401 });
  }

  const user = userFromIdToken(data.IdToken, body.username);
  const res = NextResponse.json({ user }, { status: 200 });
  setAuthCookies(res, {
    idToken: data.IdToken,
    accessToken: data.AccessToken,
    refreshToken: data.RefreshToken,
  });
  return res;
}
