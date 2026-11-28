import { test, expect } from '@playwright/test';
import { AUTH_FILES, attachPageMonitors } from './helpers';

test.describe('05 — Psychologist Portal (Queue, Schedule, Calendar, Profile)', () => {
  test.use({ storageState: AUTH_FILES.psychologist });

  test('psychologist pages render cleanly without runtime/network errors', async ({ page }) => {
    const monitors = attachPageMonitors(page);

    for (const route of ['/psych/queue', '/psych/schedule', '/psych/schedule/calendar', '/psych/profile']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading').first()).toBeVisible();
    }

    expect(monitors.pageErrors).toEqual([]);
    expect(monitors.failedRequests).toEqual([]);
  });

  test('psychologist profile round-trip PATCH + invalid social link validation + restore', async ({
    page,
  }) => {
    const meRes = await page.request.get('/api/proxy/psychologist-profile/me');
    expect(meRes.status()).toBe(200);
    const original = await meRes.json();

    // Edge case: invalid social media URL (not http/https) rejected
    const badSocialRes = await page.request.patch('/api/proxy/psychologist-profile/me', {
      data: {
        social_media_links: [{ platform: 'Facebook', url: 'not-a-valid-url' }],
      },
    });
    expect([400, 422]).toContain(badSocialRes.status());

    // Round-trip bio update & restore
    const markerBio = `${original.bio || 'Licensed Psychologist'} [QA-E2E]`.trim();
    try {
      const updateRes = await page.request.patch('/api/proxy/psychologist-profile/me', {
        data: { bio: markerBio },
      });
      expect(updateRes.status()).toBe(200);
      const updated = await updateRes.json();
      expect(updated.bio).toBe(markerBio);

      await page.goto('/psych/profile');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('[QA-E2E]').or(page.locator('textarea'))).toBeVisible();
    } finally {
      await page.request.patch('/api/proxy/psychologist-profile/me', {
        data: { bio: original.bio ?? '' },
      });
    }
  });
});
