import { test, expect } from '@playwright/test';
import { AUTH_FILES, attachPageMonitors } from './helpers';

test.describe('06 — Admin Portal UI (Dashboard, Users, Bookings, CMS Tabs)', () => {
  test.use({ storageState: AUTH_FILES.admin });

  test('admin dashboard, users list + detail, bookings tabs, and CMS tabs render cleanly', async ({
    page,
  }) => {
    const monitors = attachPageMonitors(page);

    for (const route of ['/admin', '/admin/users', '/admin/bookings', '/admin/cms']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading').first()).toBeVisible();
    }

    // Switch tabs on /admin/cms so every CMS tab is visually verified in video
    await page.goto('/admin/cms');
    await page.waitForLoadState('networkidle');
    for (const tabName of [/Services/i, /Testimonials/i, /Wizard|Consent|Form/i]) {
      const tab = page
        .getByRole('tab', { name: tabName })
        .or(page.getByRole('button', { name: tabName }))
        .first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Switch tabs on /admin/bookings
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('tab', { name: /Paid & Refunds/i })
      .or(page.getByRole('button', { name: /Paid & Refunds/i }))
      .click();
    await page.waitForLoadState('networkidle');

    // Open a user detail page from /admin/users
    const usersRes = await page.request.get('/api/proxy/admin/users?page=1&page_size=5');
    expect(usersRes.status()).toBe(200);
    const usersData = await usersRes.json();
    expect(usersData.items.length).toBeGreaterThan(0);

    await page.goto(`/admin/users/${usersData.items[0].user_id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible();

    expect(monitors.pageErrors).toEqual([]);
    expect(monitors.failedRequests).toEqual([]);
  });
});
