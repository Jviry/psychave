import path from 'path';
import type { APIRequestContext, Page } from '@playwright/test';

export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || 'https://psychave-dev.vercel.app';
export const API_URL =
  process.env.PLAYWRIGHT_API_URL ||
  'https://px17q55g19.execute-api.ap-southeast-1.amazonaws.com';

export const AUTH_FILES = {
  client: path.resolve(__dirname, '.auth/client.json'),
  psychologist: path.resolve(__dirname, '.auth/psychologist.json'),
  admin: path.resolve(__dirname, '.auth/admin.json'),
} as const;

export const CREDS = {
  client: {
    username: process.env.E2E_CLIENT_USERNAME || '',
    password: process.env.E2E_CLIENT_PASSWORD || '',
  },
  psychologist: {
    username: process.env.E2E_PSYCH_USERNAME || '',
    password: process.env.E2E_PSYCH_PASSWORD || '',
  },
  admin: {
    username: process.env.E2E_ADMIN_USERNAME || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  },
};

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export async function loginDirectApi(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<AuthTokens> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok() || !body.IdToken) {
    throw new Error(
      `Direct API login failed for ${username}: HTTP ${res.status()} ${JSON.stringify(body)}`
    );
  }
  return {
    idToken: body.IdToken,
    accessToken: body.AccessToken || '',
    refreshToken: body.RefreshToken || '',
  };
}

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Generates a future date/time in Asia/Manila timezone.
 * Returns both API format ({ session_date, start_time }) and datetime-local input format.
 */
export function futureManilaSlot(daysAhead: number, hour: number, minute = 0) {
  const now = new Date();
  const target = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(target);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '01';
  const session_date = `${get('year')}-${get('month')}-${get('day')}`;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return {
    session_date,
    start_time: `${hh}:${mm}:00`,
    inputDateTime: `${session_date}T${hh}:${mm}`,
  };
}

export function attachPageMonitors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: { url: string; status: number; method: string }[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push({
        url: res.url(),
        status: res.status(),
        method: res.request().method(),
      });
    }
  });

  return { consoleErrors, pageErrors, failedRequests };
}
