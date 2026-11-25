import { NextRequest, NextResponse } from 'next/server';
import {
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  userFromIdToken,
} from '@/lib/authCookies';

const PROTECTED_PREFIXES = [
  '/book',
  '/bookings',
  '/proposal',
  '/profiles',
  '/account',
  '/psych',
  '/admin',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const idToken = req.cookies.get(ID_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!idToken && !refreshToken) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (idToken) {
    const user = userFromIdToken(idToken);
    if (pathname.startsWith('/admin') && user.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (pathname.startsWith('/psych') && user.role !== 'psychologist') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/book/:path*',
    '/bookings/:path*',
    '/proposal/:path*',
    '/profiles/:path*',
    '/account/:path*',
    '/psych/:path*',
    '/admin/:path*',
  ],
};
