import { test, expect } from '@playwright/test';
import { API_URL, CREDS, authHeaders, futureManilaSlot, loginDirectApi } from './helpers';

test.describe('07 — Direct API Contract, Edge Cases & RBAC Privacy Boundaries', () => {
  test('public endpoints, auth checks, webhook signature rejection, and invalid IDs', async ({
    request,
  }) => {
    // Public catalog endpoints
    const servicesActive = await request.get(`${API_URL}/services/active`);
    expect(servicesActive.status()).toBe(200);
    const activeList = await servicesActive.json();
    expect(activeList.length).toBeGreaterThanOrEqual(7);

    const servicesAllPublic = await request.get(`${API_URL}/services`);
    expect(servicesAllPublic.status()).toBe(200);

    const cmsPublic = await request.get(`${API_URL}/cms`);
    expect(cmsPublic.status()).toBe(200);

    const formsActive = await request.get(`${API_URL}/forms/active`);
    expect(formsActive.status()).toBe(200);

    // Auth availability check
    const availRes = await request.post(`${API_URL}/auth/check-availability`, {
      data: {
        email: CREDS.client.username,
        username: `qa_unused_${Date.now()}`,
      },
    });
    expect(availRes.status()).toBe(200);

    // Unauthenticated /auth/me rejected
    const unauthMe = await request.post(`${API_URL}/auth/me`);
    expect([401, 403]).toContain(unauthMe.status());

    // Invalid refresh token rejected
    const badRefresh = await request.post(`${API_URL}/auth/refresh-token`, {
      data: { refresh_token: 'invalid-refresh-token-qa' },
    });
    expect([400, 401, 403]).toContain(badRefresh.status());

    // Invalid psychologist invitation token rejected
    const badInvite = await request.get(`${API_URL}/auth/psychologist-invitations/invalid-token-qa`);
    expect([400, 404]).toContain(badInvite.status());

    // PayMongo webhook without valid signature rejected
    const badWebhook = await request.post(`${API_URL}/payments/webhook`, {
      data: { data: { attributes: { type: 'checkout_session.payment.paid' } } },
    });
    expect([400, 401, 403]).toContain(badWebhook.status());
  });

  test('strict RBAC & clinical privacy boundaries across Client, Psychologist, and Admin', async ({
    request,
  }) => {
    const [clientTokens, psychTokens, adminTokens] = await Promise.all([
      loginDirectApi(request, CREDS.client.username, CREDS.client.password),
      loginDirectApi(request, CREDS.psychologist.username, CREDS.psychologist.password),
      loginDirectApi(request, CREDS.admin.username, CREDS.admin.password),
    ]);

    // Verify /auth/me for all 3 roles
    for (const [label, tok] of [
      ['client', clientTokens],
      ['psychologist', psychTokens],
      ['admin', adminTokens],
    ] as const) {
      const me = await request.post(`${API_URL}/auth/me`, {
        headers: authHeaders(tok.idToken),
        data: { access_token: tok.accessToken },
      });
      expect(me.status(), `/auth/me failed for ${label}: ${await me.text()}`).toBe(200);
    }

    // Client RBAC restrictions
    expect((await request.get(`${API_URL}/admin/users`, { headers: authHeaders(clientTokens.idToken) })).status()).toBe(403);
    expect((await request.get(`${API_URL}/admin/appointments`, { headers: authHeaders(clientTokens.idToken) })).status()).toBe(403);
    expect((await request.get(`${API_URL}/appointments/pending`, { headers: authHeaders(clientTokens.idToken) })).status()).toBe(403);
    expect((await request.get(`${API_URL}/cms/admin`, { headers: authHeaders(clientTokens.idToken) })).status()).toBe(403);
    expect((await request.get(`${API_URL}/services/all`, { headers: authHeaders(clientTokens.idToken) })).status()).toBe(403);

    // Psychologist RBAC restrictions
    expect((await request.get(`${API_URL}/admin/users`, { headers: authHeaders(psychTokens.idToken) })).status()).toBe(403);
    expect((await request.get(`${API_URL}/admin/appointments`, { headers: authHeaders(psychTokens.idToken) })).status()).toBe(403);
    expect((await request.get(`${API_URL}/cms/admin`, { headers: authHeaders(psychTokens.idToken) })).status()).toBe(403);

    // Admin clinical privacy boundary: Admin must NOT access psychologist queue or client clinical profile review
    expect((await request.get(`${API_URL}/appointments/pending`, { headers: authHeaders(adminTokens.idToken) })).status()).toBe(403);

    const clientProfiles = await (
      await request.get(`${API_URL}/profiles`, { headers: authHeaders(clientTokens.idToken) })
    ).json();
    if (clientProfiles.length > 0) {
      const adminReviewRes = await request.get(
        `${API_URL}/profiles/${clientProfiles[0].profile_id}/review`,
        { headers: authHeaders(adminTokens.idToken) }
      );
      expect(
        adminReviewRes.status(),
        'PRIVACY BOUNDARY: Admin should NOT be able to access /profiles/{id}/review'
      ).toBe(403);
    }

    // Appointment creation validation edge cases (< 3 slots, > 5 slots, past slot)
    const services = await (await request.get(`${API_URL}/services/active`)).json();
    if (clientProfiles.length > 0 && services.length > 0) {
      const pid = clientProfiles[0].profile_id;
      const sid = services[0].service_id;

      // < 3 slots
      const twoSlotsRes = await request.post(`${API_URL}/appointments`, {
        headers: authHeaders(clientTokens.idToken),
        data: {
          profile_id: pid,
          service_id: sid,
          presenting_concern: 'QA edge case <3 slots',
          preferred_slots: [
            { session_date: futureManilaSlot(40, 10).session_date, start_time: '10:00:00' },
            { session_date: futureManilaSlot(41, 10).session_date, start_time: '10:00:00' },
          ],
        },
      });
      expect(twoSlotsRes.status()).toBe(422);

      // > 5 slots
      const sixSlotsRes = await request.post(`${API_URL}/appointments`, {
        headers: authHeaders(clientTokens.idToken),
        data: {
          profile_id: pid,
          service_id: sid,
          presenting_concern: 'QA edge case >5 slots',
          preferred_slots: [40, 41, 42, 43, 44, 45].map((d) => ({
            session_date: futureManilaSlot(d, 10).session_date,
            start_time: '10:00:00',
          })),
        },
      });
      expect(sixSlotsRes.status()).toBe(422);

      // Past slot
      const pastSlotsRes = await request.post(`${API_URL}/appointments`, {
        headers: authHeaders(clientTokens.idToken),
        data: {
          profile_id: pid,
          service_id: sid,
          presenting_concern: 'QA edge case past slot',
          preferred_slots: [
            { session_date: '2020-01-01', start_time: '10:00:00' },
            { session_date: '2020-01-02', start_time: '10:00:00' },
            { session_date: '2020-01-03', start_time: '10:00:00' },
          ],
        },
      });
      expect([400, 422]).toContain(pastSlotsRes.status());
    }

    // Admin API catalogs, CMS validation, testimonials CRUD + cleanup, and invitation edge cases
    const [servicesAllRes, cmsAdminRes, formsTemplatesRes] = await Promise.all([
      request.get(`${API_URL}/services/all`, { headers: authHeaders(adminTokens.idToken) }),
      request.get(`${API_URL}/cms/admin`, { headers: authHeaders(adminTokens.idToken) }),
      request.get(`${API_URL}/forms/templates`, { headers: authHeaders(adminTokens.idToken) }),
    ]);
    expect(servicesAllRes.status()).toBe(200);
    expect(cmsAdminRes.status()).toBe(200);
    expect(formsTemplatesRes.status()).toBe(200);

    const cmsOriginal = await cmsAdminRes.json();
    const badCmsRes = await request.put(`${API_URL}/cms`, {
      headers: authHeaders(adminTokens.idToken),
      data: {
        vision: cmsOriginal.vision,
        mission: cmsOriginal.mission,
        clinic_overview: cmsOriginal.clinic_overview,
        impact_narrative: cmsOriginal.impact_narrative,
        evaluation_form_url: 'http://insecure.example.com/form',
      },
    });
    expect([400, 422]).toContain(badCmsRes.status());

    const createTestRes = await request.post(`${API_URL}/cms/testimonials`, {
      headers: authHeaders(adminTokens.idToken),
      data: {
        quote: '[QA-E2E] Temporary QA testimonial',
        author_label: 'QA Client',
        service_category: 'Individual Counseling & Psychotherapy',
        is_active: false,
        display_order: 999,
      },
    });
    expect(createTestRes.status()).toBe(200);
    const tid = (await createTestRes.json()).testimonial_id as string;
    try {
      const patchRes = await request.patch(`${API_URL}/cms/testimonials/${tid}`, {
        headers: authHeaders(adminTokens.idToken),
        data: { quote: '[QA-E2E] Updated QA testimonial' },
      });
      expect(patchRes.status()).toBe(200);
      expect((await patchRes.json()).quote).toBe('[QA-E2E] Updated QA testimonial');
    } finally {
      const delRes = await request.delete(`${API_URL}/cms/testimonials/${tid}`, {
        headers: authHeaders(adminTokens.idToken),
      });
      expect([200, 204]).toContain(delRes.status());
    }

    const badInviteEmail = await request.post(`${API_URL}/admin/psychologist-invitations`, {
      headers: authHeaders(adminTokens.idToken),
      data: { email: 'not-an-email' },
    });
    expect([400, 422]).toContain(badInviteEmail.status());

    const dupInviteEmail = await request.post(`${API_URL}/admin/psychologist-invitations`, {
      headers: authHeaders(adminTokens.idToken),
      data: { email: CREDS.psychologist.username },
    });
    expect([400, 409]).toContain(dupInviteEmail.status());
  });
});
