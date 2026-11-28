import fs from 'fs';
import path from 'path';
import { test as setup, expect } from '@playwright/test';
import { AUTH_FILES, CREDS } from './helpers';

const authDir = path.dirname(AUTH_FILES.client);
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

async function uiLoginAndSave(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
  expectedPathPattern: RegExp,
  outputPath: string
) {
  await page.goto('/login');
  await expect(page.locator('#login-username')).toBeVisible();
  await page.locator('#login-username').fill(username);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();

  // Wait either for redirect away from /login or an API error banner
  await page.waitForURL(expectedPathPattern, { timeout: 25_000 });
  await page.waitForLoadState('networkidle');
  await page.context().storageState({ path: outputPath });
}

setup('authenticate as client', async ({ page }) => {
  expect(CREDS.client.username, 'E2E_CLIENT_USERNAME must be set').toBeTruthy();
  await uiLoginAndSave(
    page,
    CREDS.client.username,
    CREDS.client.password,
    /\/(bookings|book|profiles|account)/,
    AUTH_FILES.client
  );
});

setup('authenticate as psychologist', async ({ page }) => {
  expect(CREDS.psychologist.username, 'E2E_PSYCH_USERNAME must be set').toBeTruthy();
  await uiLoginAndSave(
    page,
    CREDS.psychologist.username,
    CREDS.psychologist.password,
    /\/psych/,
    AUTH_FILES.psychologist
  );
});

setup('authenticate as admin', async ({ page }) => {
  expect(CREDS.admin.username, 'E2E_ADMIN_USERNAME must be set').toBeTruthy();
  await uiLoginAndSave(
    page,
    CREDS.admin.username,
    CREDS.admin.password,
    /\/admin/,
    AUTH_FILES.admin
  );
});
