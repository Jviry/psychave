import { NextRequest, NextResponse } from 'next/server';
import {
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  getBackendBaseUrl,
  isTokenExpired,
  setAuthCookies,
} from '@/lib/authCookies';

async function tryRefresh(
  refreshToken: string
): Promise<{ idToken: string; accessToken?: string } | null> {
  try {
    const res = await fetch(`${getBackendBaseUrl()}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      AccessToken?: string;
      IdToken?: string;
    } | null;
    if (!data?.IdToken) return null;
    return { idToken: data.IdToken, accessToken: data.AccessToken };
  } catch {
    return null;
  }
}

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const targetUrl = `${getBackendBaseUrl()}/${path.join('/')}${req.nextUrl.search}`;

  let idToken = req.cookies.get(ID_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  let refreshedTokens: { idToken: string; accessToken?: string } | null = null;

  if ((!idToken || isTokenExpired(idToken)) && refreshToken) {
    refreshedTokens = await tryRefresh(refreshToken);
    if (refreshedTokens) {
      idToken = refreshedTokens.idToken;
    }
  }

  const bodyText =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await req.text();

  const forward = async (bearer?: string) =>
    fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      ...(bodyText !== undefined && bodyText.length > 0 ? { body: bodyText } : {}),
    });

  let upstream = await forward(idToken);
  if (upstream.status === 401 && refreshToken && !refreshedTokens) {
    refreshedTokens = await tryRefresh(refreshToken);
    if (refreshedTokens) {
      idToken = refreshedTokens.idToken;
      upstream = await forward(idToken);
    }
  }

  const responseText = await upstream.text();
  const res = new NextResponse(responseText || null, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    },
  });

  if (refreshedTokens) {
    setAuthCookies(res, refreshedTokens);
  } else if (upstream.status === 401 && !idToken) {
    clearAuthCookies(res);
  }

  return res;
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
