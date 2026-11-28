import { test, expect } from '@playwright/test';
import { AUTH_FILES, attachPageMonitors } from './helpers';

test.describe('02 — Client Profiles, Consent & Account', () => {
  test.use({ storageState: AUTH_FILES.client });

  test('client /profiles and /account pages render cleanly', async ({ page }) => {
    const monitors = attachPageMonitors(page);

    await page.goto('/profiles');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible();

    await page.goto('/account');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible();

    expect(monitors.pageErrors).toEqual([]);
    expect(monitors.failedRequests).toEqual([]);
  });

  test('profile API CRUD + consent lifecycle with validation edge cases and cleanup', async ({
    page,
  }) => {
    // 1. Negative edge case: future date of birth rejected
    const futureDobRes = await page.request.post('/api/proxy/profiles', {
      data: {
        profile: {
          relation_to_account_holder: 'child',
          profile_name: '[QA-E2E] Future DOB',
          date_of_birth: '2099-01-01',
        },
        consent: {
          consent_version: 'v2',
          terms_agreed: true,
          scope_acknowledged: true,
          information_confirmed: true,
        },
      },
    });
    expect([400, 422]).toContain(futureDobRes.status());

    // 2. Negative edge case: blank profile name rejected
    const blankNameRes = await page.request.post('/api/proxy/profiles', {
      data: {
        profile: {
          relation_to_account_holder: 'child',
          profile_name: '   ',
          date_of_birth: '2000-05-15',
        },
        consent: {
          consent_version: 'v2',
          terms_agreed: true,
          scope_acknowledged: true,
          information_confirmed: true,
        },
      },
    });
    expect([400, 422]).toContain(blankNameRes.status());

    // 3. Create valid dependent profile with consent
    const createRes = await page.request.post('/api/proxy/profiles', {
      data: {
        profile: {
          relation_to_account_holder: 'other',
          first_name: 'QA-E2E',
          last_name: 'Dependent',
          date_of_birth: '1998-06-15',
          nationality: 'Filipino',
          occupation: 'QA Tester',
          contact_number: '09171234567',
          preferred_contact_mode: 'phone',
          permanent_address: 'Manila, PH',
          present_address: 'Manila, PH',
          emergency_contact_name: 'QA Emergency',
          emergency_contact_relation: 'Sibling',
          emergency_contact_number: '09177654321',
          socmed_platform: 'messenger',
          socmed_username: 'qa_e2e_test',
        },
        consent: {
          consent_version: 'v2',
          terms_agreed: true,
          terms_signer_name: 'QA-E2E Signer',
          terms_signer_relation: 'legal guardian',
          scope_acknowledged: true,
          is_overseas_or_foreign: false,
          information_confirmed: true,
          consent_signer_name: 'QA-E2E Signer',
        },
      },
    });
    const createBody = await createRes.json().catch(() => ({}));
    expect(createRes.status(), `Create profile failed: ${JSON.stringify(createBody)}`).toBe(200);
    const profileId = createBody.profile_id as string;
    expect(profileId).toBeTruthy();

    try {
      // 4. Verify it shows up on /profiles UI and edit page loads
      await page.goto('/profiles');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('QA-E2E Dependent').first()).toBeVisible({ timeout: 15_000 });

      await page.goto(`/profiles/${profileId}/edit`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/QA-E2E|Dependent/i).first()).toBeVisible();

      // 5. Update profile via PUT (full ProfileCreate payload)
      const updateRes = await page.request.put(`/api/proxy/profiles/${profileId}`, {
        data: {
          relation_to_account_holder: 'other',
          first_name: 'QA-E2E',
          last_name: 'Dependent Updated',
          date_of_birth: '1998-06-15',
          nationality: 'Filipino',
          occupation: 'Senior QA Tester',
          contact_number: '09171234567',
          preferred_contact_mode: 'phone',
          permanent_address: 'Manila, PH',
          present_address: 'Manila, PH',
          emergency_contact_name: 'QA Emergency',
          emergency_contact_relation: 'Sibling',
          emergency_contact_number: '09177654321',
          socmed_platform: 'messenger',
          socmed_username: 'qa_e2e_test',
        },
      });
      expect(updateRes.status(), `PUT /profiles failed: ${await updateRes.text()}`).toBe(200);
      const updated = await updateRes.json();
      expect(updated.profile_name).toBe('QA-E2E Dependent Updated');

      // 6. Re-submit consent endpoint directly
      const consentRes = await page.request.post(`/api/proxy/profiles/${profileId}/consent`, {
        data: {
          consent_version: 'v2',
          terms_agreed: true,
          terms_signer_name: 'QA-E2E Signer',
          terms_signer_relation: 'legal guardian',
          scope_acknowledged: true,
          is_overseas_or_foreign: false,
          information_confirmed: true,
          consent_signer_name: 'QA-E2E Signer',
        },
      });
      expect(consentRes.status(), `POST /consent failed: ${await consentRes.text()}`).toBe(200);
    } finally {
      // 7. Clean up QA dependent profile
      const delRes = await page.request.delete(`/api/proxy/profiles/${profileId}`);
      expect([200, 204]).toContain(delRes.status());
    }
  });
});
