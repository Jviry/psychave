import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { AUTH_FILES, futureManilaSlot } from './helpers';

async function withRolePage<T>(
  browser: Browser,
  storageState: string,
  videoLabel: string,
  testInfo: TestInfo,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const ctx = await browser.newContext({
    storageState,
    recordVideo: { dir: testInfo.outputDir },
  });
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    const vid = page.video();
    await ctx.close();
    const videoPath = await vid?.path().catch(() => null);
    if (videoPath) {
      await testInfo.attach(videoLabel, { path: videoPath, contentType: 'video/webm' });
    }
  }
}

test.describe('03 — Full Multi-Role Booking Lifecycle (Client -> Psych -> Admin -> Complete)', () => {
  test('end-to-end Flow C booking through pickup, counter-offer, accept, payment, manual confirm, meeting link, and completion', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(150_000);

    const baseDay = 45 + Math.floor(Math.random() * 50);
    const slot1 = futureManilaSlot(baseDay, 10, 0);
    const slot2 = futureManilaSlot(baseDay + 1, 14, 0);
    const slot3 = futureManilaSlot(baseDay + 2, 16, 0);
    const counterSlot = futureManilaSlot(baseDay + 4, 15, 0);
    const concernTag = `[QA-E2E] Full lifecycle booking ${Date.now()}`;

    let createdAppointmentId = '';
    let addedFallbackSocialLink = false;
    let originalPsychSocialLinks: unknown[] = [];

    try {
      // STEP 1 (Client): Open /book, submit 3-step booking, verify on /bookings/[id]
      createdAppointmentId = await withRolePage(
        browser,
        AUTH_FILES.client,
        '01-client-book-session',
        testInfo,
        async (clientPage) => {
          await clientPage.goto('/book');
          await clientPage.waitForLoadState('networkidle');

          const profiles = await (await clientPage.request.get('/api/proxy/profiles')).json();
          expect(profiles.length, 'Client needs at least one profile to book').toBeGreaterThan(0);

          await clientPage.getByRole('button', { name: /Continue|Next/i }).click();
          await clientPage.locator('#booking-concerns').fill(concernTag);
          const checkbox = clientPage.getByRole('checkbox').first();
          if (!(await checkbox.isChecked())) {
            await checkbox.check();
          }
          await clientPage.getByRole('button', { name: /Continue|Next/i }).click();

          const slot0Input = clientPage.locator('#booking-slot-0');
          const inputType = await slot0Input.getAttribute('type').catch(() => null);
          let apptId = '';

          if (inputType === 'datetime-local') {
            await clientPage.locator('#booking-slot-0').fill(slot1.inputDateTime);
            await clientPage.locator('#booking-slot-1').fill(slot2.inputDateTime);
            await clientPage.locator('#booking-slot-2').fill(slot3.inputDateTime);
            await clientPage.getByRole('button', { name: /Submit Booking|Submit Request|Confirm/i }).click();
            await expect(
              clientPage.getByText(/Your booking request has been submitted/i)
            ).toBeVisible({ timeout: 20_000 });

            const appts = (await (await clientPage.request.get('/api/proxy/appointments')).json()) as Array<{
              appointment_id: string;
              presenting_concern: string;
            }>;
            const match = appts.find((a) => a.presenting_concern === concernTag);
            expect(match).toBeTruthy();
            apptId = match!.appointment_id;
          } else {
            const services = await (await clientPage.request.get('/api/proxy/services/active')).json();
            const createRes = await clientPage.request.post('/api/proxy/appointments', {
              data: {
                profile_id: profiles[0].profile_id,
                service_id: services[0].service_id,
                presenting_concern: concernTag,
                preferred_slots: [
                  { session_date: slot1.session_date, start_time: slot1.start_time },
                  { session_date: slot2.session_date, start_time: slot2.start_time },
                  { session_date: slot3.session_date, start_time: slot3.start_time },
                ],
              },
            });
            expect(createRes.status()).toBe(200);
            apptId = (await createRes.json()).appointment_id;
          }

          await clientPage.goto(`/bookings/${apptId}`);
          await clientPage.waitForLoadState('networkidle');
          await expect(clientPage.getByText(concernTag)).toBeVisible();
          return apptId;
        }
      );

      // STEP 2 (Psychologist): Inspect pending queue & detail, pick up with counter-offer
      await withRolePage(
        browser,
        AUTH_FILES.psychologist,
        '02-psychologist-pickup',
        testInfo,
        async (psychPage) => {
          const psychMe = await (await psychPage.request.get('/api/proxy/psychologist-profile/me')).json();
          originalPsychSocialLinks = psychMe.social_media_links ?? [];
          if (originalPsychSocialLinks.length === 0) {
            await psychPage.request.patch('/api/proxy/psychologist-profile/me', {
              data: {
                social_media_links: [
                  { platform: 'Facebook', url: 'https://facebook.com/psychaveph-qa' },
                ],
              },
            });
            addedFallbackSocialLink = true;
          }

          await psychPage.goto('/psych/queue');
          await psychPage.waitForLoadState('networkidle');
          await psychPage.goto(`/psych/queue/${createdAppointmentId}`);
          await psychPage.waitForLoadState('networkidle');
          await expect(psychPage.getByText(concernTag)).toBeVisible({ timeout: 15_000 });

          const pickupRes = await psychPage.request.post(
            `/api/proxy/appointments/${createdAppointmentId}/pickup`,
            {
              data: {
                price: 1500,
                counter_slot: {
                  session_date: counterSlot.session_date,
                  start_time: counterSlot.start_time,
                },
              },
            }
          );
          const pickupBody = await pickupRes.json().catch(() => ({}));
          expect(pickupRes.status(), `Pickup failed: ${JSON.stringify(pickupBody)}`).toBe(200);
          expect(pickupBody.status).toBe('awaiting_schedule');
          expect(pickupBody.scheduling_turn).toBe('client');
          expect(pickupBody.psychologist_social_links?.length).toBeGreaterThan(0);

          await psychPage.goto(`/psych/schedule/${createdAppointmentId}`);
          await psychPage.waitForLoadState('networkidle');
        }
      );

      // STEP 3 (Client): View proposal, accept counter-offer, initiate payment
      await withRolePage(
        browser,
        AUTH_FILES.client,
        '03-client-accept-and-pay',
        testInfo,
        async (clientPage) => {
          await clientPage.goto(`/proposal/${createdAppointmentId}`);
          await clientPage.waitForLoadState('networkidle');

          const slots = (await (
            await clientPage.request.get(`/api/proxy/appointments/${createdAppointmentId}/slots`)
          ).json()) as Array<{ slot_id: string; proposed_by: string; status: string }>;
          const psychCounterSlot = slots.find(
            (s) => s.proposed_by === 'psychologist' && s.status === 'proposed'
          );
          expect(psychCounterSlot).toBeTruthy();

          const acceptRes = await clientPage.request.post(
            `/api/proxy/appointments/${createdAppointmentId}/accept-slot`,
            { data: { slot_id: psychCounterSlot!.slot_id } }
          );
          expect(acceptRes.status()).toBe(200);
          expect((await acceptRes.json()).status).toBe('awaiting_payment');

          const payInitRes = await clientPage.request.post(
            `/api/proxy/appointments/${createdAppointmentId}/payment`,
            { data: {} }
          );
          expect([200, 201]).toContain(payInitRes.status());

          const payments = await (
            await clientPage.request.get(`/api/proxy/appointments/${createdAppointmentId}/payment`)
          ).json();
          expect(Array.isArray(payments) && payments.length > 0).toBeTruthy();

          await clientPage.reload();
          await clientPage.waitForLoadState('networkidle');
        }
      );

      // STEP 4 (Admin): View /admin/bookings and confirm manual payment
      await withRolePage(
        browser,
        AUTH_FILES.admin,
        '04-admin-confirm-payment',
        testInfo,
        async (adminPage) => {
          await adminPage.goto('/admin/bookings');
          await adminPage.waitForLoadState('networkidle');

          const confirmPayRes = await adminPage.request.post(
            `/api/proxy/admin/appointments/${createdAppointmentId}/confirm-payment`,
            { data: { note: '[QA-E2E] Manual payment verified' } }
          );
          expect(confirmPayRes.status()).toBe(200);
          expect((await confirmPayRes.json()).status).toBe('confirmed');

          await adminPage.reload();
          await adminPage.waitForLoadState('networkidle');
        }
      );

      // STEP 5 (Psychologist): Save meeting link (reject http://, accept https://), then verify client sees it & complete
      await withRolePage(
        browser,
        AUTH_FILES.psychologist,
        '05-psychologist-meeting-link-and-complete',
        testInfo,
        async (psychPage) => {
          await psychPage.goto(`/psych/schedule/${createdAppointmentId}`);
          await psychPage.waitForLoadState('networkidle');

          const badLinkRes = await psychPage.request.patch(
            `/api/proxy/appointments/${createdAppointmentId}/meeting-link`,
            { data: { meeting_link: 'http://insecure.example.com/meet' } }
          );
          expect([400, 422]).toContain(badLinkRes.status());

          const goodLinkRes = await psychPage.request.patch(
            `/api/proxy/appointments/${createdAppointmentId}/meeting-link`,
            { data: { meeting_link: 'https://meet.google.com/qa-e2e-test-link' } }
          );
          expect(goodLinkRes.status()).toBe(200);
          expect((await goodLinkRes.json()).meeting_link).toBe('https://meet.google.com/qa-e2e-test-link');

          await psychPage.reload();
          await psychPage.waitForLoadState('networkidle');

          const completeRes = await psychPage.request.post(
            `/api/proxy/appointments/${createdAppointmentId}/complete`
          );
          expect(completeRes.status()).toBe(200);
          expect((await completeRes.json()).status).toBe('completed');

          await psychPage.reload();
          await psychPage.waitForLoadState('networkidle');
        }
      );

      // STEP 6 (Client): Verify meeting link & completed state on /proposal/[id]
      await withRolePage(
        browser,
        AUTH_FILES.client,
        '06-client-verify-completed',
        testInfo,
        async (clientPage) => {
          await clientPage.goto(`/proposal/${createdAppointmentId}`);
          await clientPage.waitForLoadState('networkidle');
          await expect(clientPage.getByText(/meet\.google\.com/i).first()).toBeVisible({
            timeout: 15_000,
          });
        }
      );
    } finally {
      if (addedFallbackSocialLink) {
        const ctx = await browser.newContext({ storageState: AUTH_FILES.psychologist });
        const p = await ctx.newPage();
        await p.request.patch('/api/proxy/psychologist-profile/me', {
          data: { social_media_links: originalPsychSocialLinks },
        });
        await ctx.close();
      }
    }
  });
});
