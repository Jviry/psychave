import { test, expect } from '@playwright/test';
import { AUTH_FILES, attachPageMonitors } from './helpers';

test.describe('01 — Public Pages, Auth UI & RBAC Route Guards', () => {
  test('landing page loads cleanly with 7 active services and zero console/network errors', async ({
    page,
  }) => {
    const monitors = attachPageMonitors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/PsychAvenuePH/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Book a session/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Log In/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Register/i }).first()).toBeVisible();

    expect(monitors.consoleErrors, `Console errors: ${monitors.consoleErrors.join('; ')}`).toEqual([]);
    expect(monitors.pageErrors, `Page errors: ${monitors.pageErrors.join('; ')}`).toEqual([]);
    expect(monitors.failedRequests, `Failed requests: ${JSON.stringify(monitors.failedRequests)}`).toEqual([]);
  });

  test('public /services and /about pages render cleanly', async ({ page }) => {
    const monitors = attachPageMonitors(page);

    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible();

    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible();

    expect(monitors.consoleErrors).toEqual([]);
    expect(monitors.pageErrors).toEqual([]);
    expect(monitors.failedRequests).toEqual([]);
  });

  test('login page validation, password visibility toggle, forgot-password modal, and invalid credentials', async ({
    page,
  }) => {
    await page.goto('/login');

    // Empty submit triggers client-side validation
    await page.locator('#login-submit').click();
    await expect(page.locator('#login-username-error')).toBeVisible();
    await expect(page.locator('#login-password-error')).toBeVisible();

    // Password visibility toggle
    const pwdInput = page.locator('#login-password');
    await expect(pwdInput).toHaveAttribute('type', 'password');
    await page.locator('#login-toggle-password').click();
    await expect(pwdInput).toHaveAttribute('type', 'text');
    await page.locator('#login-toggle-password').click();
    await expect(pwdInput).toHaveAttribute('type', 'password');

    // Forgot password modal opens and closes
    await page.locator('#forgot-password-trigger').click();
    await expect(page.getByRole('dialog', { name: /Reset your password/i })).toBeVisible();
    await page.keyboard.press('Escape');

    // Invalid credentials show API error banner
    await page.locator('#login-username').fill('nonexistent_qa_user_xyz');
    await page.locator('#login-password').fill('WrongPass123!');
    await page.locator('#login-submit').click();
    await expect(page.locator('#login-api-error')).toBeVisible({ timeout: 15_000 });
  });

  test('/register and /register/psychologist (invalid invite token) render expected states', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible();

    await page.goto('/register/psychologist?token=invalid-qa-token-123');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/invalid|expired|invitation/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated users are redirected to /login for all protected routes', async ({
    page,
  }) => {
    const protectedRoutes = [
      '/book',
      '/bookings',
      '/profiles',
      '/account',
      '/psych/queue',
      '/psych/schedule',
      '/admin',
      '/admin/users',
      '/admin/bookings',
      '/admin/cms',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page, `Expected ${route} to redirect to /login`).toHaveURL(/\/login/);
    }
  });

  test('RBAC: client cannot access /admin or /psych/queue', async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILES.client });
    const page = await context.newPage();

    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);

    await page.goto('/psych/queue');
    await expect(page).not.toHaveURL(/\/psych\/queue/);

    await context.close();
  });

  test('RBAC: psychologist cannot access /admin', async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILES.psychologist });
    const page = await context.newPage();

    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);

    await context.close();
  });
});
