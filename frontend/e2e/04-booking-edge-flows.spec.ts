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

test.describe('04 — Booking Edge Flows (Cancel, Re-propose, Reschedule, No-Show, Refund)', () => {
  test('client cancellation flow and double-cancel guard', async ({ browser }, testInfo) => {
    await withRolePage(
      browser,
      AUTH_FILES.client,
      'client-cancel-flow',
      testInfo,
      async (clientPage) => {
        const profiles = await (await clientPage.request.get('/api/proxy/profiles')).json();
        const services = await (await clientPage.request.get('/api/proxy/services/active')).json();

        const baseDay = 100 + Math.floor(Math.random() * 30);
        const s1 = futureManilaSlot(baseDay, 9, 0);
        const s2 = futureManilaSlot(baseDay + 1, 10, 0);
        const s3 = futureManilaSlot(baseDay + 2, 11, 0);

        const createRes = await clientPage.request.post('/api/proxy/appointments', {
          data: {
            profile_id: profiles[0].profile_id,
            service_id: services[0].service_id,
            presenting_concern: `[QA-E2E] Cancel flow test ${Date.now()}`,
            preferred_slots: [
              { session_date: s1.session_date, start_time: s1.start_time },
              { session_date: s2.session_date, start_time: s2.start_time },
              { session_date: s3.session_date, start_time: s3.start_time },
            ],
          },
        });
        expect(createRes.status()).toBe(200);
        const created = await createRes.json();

        await clientPage.goto(`/bookings/${created.appointment_id}`);
        await clientPage.waitForLoadState('networkidle');

        // Cancel via DELETE and verify updated UI
        const cancelRes = await clientPage.request.delete(
          `/api/proxy/appointments/${created.appointment_id}`
        );
        expect(cancelRes.status()).toBe(200);
        expect((await cancelRes.json()).status).toBe('cancelled');

        await clientPage.reload();
        await clientPage.waitForLoadState('networkidle');

        // Double-cancel guard
        const secondCancelRes = await clientPage.request.delete(
          `/api/proxy/appointments/${created.appointment_id}`
        );
        expect([400, 409]).toContain(secondCancelRes.status());
      }
    );
  });

  test('negotiation re-proposal (client preferred-slots -> psych accept-preferred-slot), reschedule, no-show & refund guards', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(150_000);

    const baseDay = 135 + Math.floor(Math.random() * 40);
    let apptId = '';
    let round2SlotId = '';
    let addedFallbackSocialLink = false;
    let originalSocialLinks: unknown[] = [];

    try {
      // 1. Client creates booking
      apptId = await withRolePage(
        browser,
        AUTH_FILES.client,
        '01-client-create-for-negotiation',
        testInfo,
        async (clientPage) => {
          const profiles = await (await clientPage.request.get('/api/proxy/profiles')).json();
          const services = await (await clientPage.request.get('/api/proxy/services/active')).json();

          const s1 = futureManilaSlot(baseDay, 9, 0);
          const s2 = futureManilaSlot(baseDay + 1, 10, 0);
          const s3 = futureManilaSlot(baseDay + 2, 11, 0);
          const createRes = await clientPage.request.post('/api/proxy/appointments', {
            data: {
              profile_id: profiles[0].profile_id,
              service_id: services[0].service_id,
              presenting_concern: `[QA-E2E] Negotiation & reschedule test ${Date.now()}`,
              preferred_slots: [
                { session_date: s1.session_date, start_time: s1.start_time },
                { session_date: s2.session_date, start_time: s2.start_time },
                { session_date: s3.session_date, start_time: s3.start_time },
              ],
            },
          });
          expect(createRes.status()).toBe(200);
          const id = (await createRes.json()).appointment_id as string;
          await clientPage.goto(`/bookings/${id}`);
          await clientPage.waitForLoadState('networkidle');
          return id;
        }
      );

      // 2. Psychologist picks up with counter-offer
      await withRolePage(
        browser,
        AUTH_FILES.psychologist,
        '02-psych-counter-offer',
        testInfo,
        async (psychPage) => {
          const psychMe = await (await psychPage.request.get('/api/proxy/psychologist-profile/me')).json();
          originalSocialLinks = psychMe.social_media_links ?? [];
          if (originalSocialLinks.length === 0) {
            await psychPage.request.patch('/api/proxy/psychologist-profile/me', {
              data: {
                social_media_links: [
                  { platform: 'Facebook', url: 'https://facebook.com/psychaveph-qa' },
                ],
              },
            });
            addedFallbackSocialLink = true;
          }

          const c1 = futureManilaSlot(baseDay + 3, 13, 0);
          const pickupRes = await psychPage.request.post(`/api/proxy/appointments/${apptId}/pickup`, {
            data: {
              price: 1200,
              counter_slot: { session_date: c1.session_date, start_time: c1.start_time },
            },
          });
          expect(pickupRes.status()).toBe(200);
          await psychPage.goto(`/psych/schedule/${apptId}`);
          await psychPage.waitForLoadState('networkidle');
        }
      );

      // 3. Client re-proposes 3 new preferred slots
      round2SlotId = await withRolePage(
        browser,
        AUTH_FILES.client,
        '03-client-repropose-slots',
        testInfo,
        async (clientPage) => {
          const r1 = futureManilaSlot(baseDay + 4, 9, 0);
          const r2 = futureManilaSlot(baseDay + 5, 10, 0);
          const r3 = futureManilaSlot(baseDay + 6, 11, 0);
          const reproposeRes = await clientPage.request.post(
            `/api/proxy/appointments/${apptId}/preferred-slots`,
            {
              data: {
                slots: [
                  { session_date: r1.session_date, start_time: r1.start_time },
                  { session_date: r2.session_date, start_time: r2.start_time },
                  { session_date: r3.session_date, start_time: r3.start_time },
                ],
              },
            }
          );
          expect(reproposeRes.status()).toBe(200);
          const reproposed = await reproposeRes.json();
          const round2Slot = (
            reproposed.proposed_slots as Array<{ slot_id: string; proposed_by: string; status: string }>
          ).find((s) => s.proposed_by === 'client' && s.status === 'proposed');
          expect(round2Slot).toBeTruthy();

          await clientPage.goto(`/proposal/${apptId}`);
          await clientPage.waitForLoadState('networkidle');
          return round2Slot!.slot_id;
        }
      );

      // 4. Psychologist accepts client's preferred slot -> awaiting_payment
      await withRolePage(
        browser,
        AUTH_FILES.psychologist,
        '04-psych-accept-preferred',
        testInfo,
        async (psychPage) => {
          const acceptPrefRes = await psychPage.request.post(
            `/api/proxy/appointments/${apptId}/accept-preferred-slot`,
            { data: { slot_id: round2SlotId } }
          );
          expect(acceptPrefRes.status()).toBe(200);
          expect((await acceptPrefRes.json()).status).toBe('awaiting_payment');
          await psychPage.goto(`/psych/schedule/${apptId}`);
          await psychPage.waitForLoadState('networkidle');
        }
      );

      // 5. Admin confirms manual payment & tests refund validation bounds
      await withRolePage(
        browser,
        AUTH_FILES.admin,
        '05-admin-confirm-and-refund-guards',
        testInfo,
        async (adminPage) => {
          await adminPage.goto('/admin/bookings');
          await adminPage.waitForLoadState('networkidle');

          const confirmRes = await adminPage.request.post(
            `/api/proxy/admin/appointments/${apptId}/confirm-payment`,
            { data: { note: '[QA-E2E] Confirm for reschedule/no-show/refund checks' } }
          );
          expect(confirmRes.status()).toBe(200);

          for (const badPayload of [
            { percentage: 0, reason: 'QA invalid zero' },
            { percentage: 100, reason: 'QA invalid full refund' },
            { percentage: 25, reason: '   ' },
          ]) {
            const r = await adminPage.request.post(
              `/api/proxy/admin/appointments/${apptId}/refund`,
              { data: badPayload }
            );
            expect([400, 422]).toContain(r.status());
          }

          await adminPage.reload();
          await adminPage.waitForLoadState('networkidle');
        }
      );

      // 6. Client requests free reschedule (>= 2h before) & verifies paid-rescheduled cancel block
      await withRolePage(
        browser,
        AUTH_FILES.client,
        '06-client-reschedule-and-cancel-guard',
        testInfo,
        async (clientPage) => {
          const ns1 = futureManilaSlot(baseDay + 8, 10, 0);
          const ns2 = futureManilaSlot(baseDay + 9, 11, 0);
          const ns3 = futureManilaSlot(baseDay + 10, 14, 0);
          const reschedRes = await clientPage.request.post(
            `/api/proxy/appointments/${apptId}/reschedule-request`,
            {
              data: {
                reason: '[QA-E2E] Free reschedule test',
                preferred_slots: [
                  { session_date: ns1.session_date, start_time: ns1.start_time },
                  { session_date: ns2.session_date, start_time: ns2.start_time },
                  { session_date: ns3.session_date, start_time: ns3.start_time },
                ],
              },
            }
          );
          expect(reschedRes.status()).toBe(200);

          const blockCancelRes = await clientPage.request.delete(`/api/proxy/appointments/${apptId}`);
          expect([400, 409]).toContain(blockCancelRes.status());

          await clientPage.goto(`/bookings/${apptId}`);
          await clientPage.waitForLoadState('networkidle');
        }
      );

      // 7. Psychologist verifies early no-show guard & sends counter-offer on rescheduled booking
      await withRolePage(
        browser,
        AUTH_FILES.psychologist,
        '07-psych-noshow-guard-and-counter',
        testInfo,
        async (psychPage) => {
          const earlyNoShowRes = await psychPage.request.post(
            `/api/proxy/appointments/${apptId}/no-show`
          );
          expect([400, 409]).toContain(earlyNoShowRes.status());

          const rc = futureManilaSlot(baseDay + 11, 15, 0);
          const counterRes = await psychPage.request.post(
            `/api/proxy/appointments/${apptId}/counter-offer`,
            { data: { session_date: rc.session_date, start_time: rc.start_time } }
          );
          expect(counterRes.status()).toBe(200);

          await psychPage.goto(`/psych/schedule/${apptId}`);
          await psychPage.waitForLoadState('networkidle');
        }
      );
    } finally {
      if (addedFallbackSocialLink) {
        const ctx = await browser.newContext({ storageState: AUTH_FILES.psychologist });
        const p = await ctx.newPage();
        await p.request.patch('/api/proxy/psychologist-profile/me', {
          data: { social_media_links: originalSocialLinks },
        });
        await ctx.close();
      }
    }
  });
});
