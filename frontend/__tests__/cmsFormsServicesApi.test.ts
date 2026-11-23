/**
 * Frontend unit tests for the Forms/Wizard & Services CMS API and helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_WIZARD_PAGES,
  didConsentBlocksChange,
} from '../lib/consent';
import { serviceCmsSchema } from '../lib/schemas';
import type { WizardPage } from '../lib/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('Services Catalog CMS API & Schema', () => {
  it('validates serviceCmsSchema constraints', () => {
    const valid = serviceCmsSchema.safeParse({
      title: 'Mindfulness Workshop',
      durationMinutes: 90,
      notice: 'Not a crisis intervention session.',
      description: 'Guided group mindfulness and stress reduction workshop.',
      isActive: true,
    });
    expect(valid.success).toBe(true);

    const invalidDuration = serviceCmsSchema.safeParse({
      title: 'Quick Chat',
      durationMinutes: 5,
      notice: '',
      description: 'A very short session description that is over twenty chars.',
      isActive: true,
    });
    expect(invalidDuration.success).toBe(false);
  });

  it('calls GET /services/all, POST /services, and PATCH /services/:id', async () => {
    const svcId = '9a2b1c3d-4e5f-6071-8293-a4b5c6d7e8f9';
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              service_id: svcId,
              name: 'Life Coaching',
              description: 'Structured goal-setting and coaching.',
              is_active: false,
              duration_minutes: 60,
              guardrail_notice: 'Not a substitute for therapy.',
            },
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            service_id: svcId,
            name: 'Career Coaching',
            description: 'Executive and career transition coaching.',
            is_active: true,
            duration_minutes: 75,
            guardrail_notice: null,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            service_id: svcId,
            name: 'Career Coaching',
            description: 'Executive and career transition coaching.',
            is_active: false,
            duration_minutes: 90,
            guardrail_notice: 'Coaching notice.',
          }),
          { status: 200 }
        )
      );

    const { api } = await import('../lib/api');

    const allServices = await api.getAdminServices();
    expect(String(mockFetch.mock.calls[0][0])).toContain('/services/all');
    expect(allServices[0].isActive).toBe(false);

    const created = await api.createService({
      title: 'Career Coaching',
      description: 'Executive and career transition coaching.',
      durationMinutes: 75,
      guardrailNotice: '',
      isActive: true,
    });
    expect(String(mockFetch.mock.calls[1][0])).toContain('/services');
    expect(mockFetch.mock.calls[1][1]?.method).toBe('POST');
    expect(JSON.parse(mockFetch.mock.calls[1][1]?.body)).toEqual({
      name: 'Career Coaching',
      description: 'Executive and career transition coaching.',
      duration_minutes: 75,
      guardrail_notice: null,
      is_active: true,
    });
    expect(created.durationMinutes).toBe(75);
    expect(created.isActive).toBe(true);

    const updated = await api.updateService(svcId, {
      durationMinutes: 90,
      guardrailNotice: 'Coaching notice.',
      isActive: false,
    });
    expect(String(mockFetch.mock.calls[2][0])).toContain(`/services/${svcId}`);
    expect(mockFetch.mock.calls[2][1]?.method).toBe('PATCH');
    expect(updated.durationMinutes).toBe(90);
    expect(updated.isActive).toBe(false);
    expect(updated.guardrailNotice).toBe('Coaching notice.');
  });
});

describe('Multi-Page Wizard & Consent Forms CMS API & Diff Helper', () => {
  it('didConsentBlocksChange distinguishes demographic edits (minor) from consent edits (major)', () => {
    const base = JSON.parse(JSON.stringify(DEFAULT_WIZARD_PAGES)) as WizardPage[];
    const demographicEdited = JSON.parse(
      JSON.stringify(DEFAULT_WIZARD_PAGES)
    ) as WizardPage[];

    // Renaming a demographic page title and removing occupation (target: profile)
    demographicEdited[2].title = 'Client Demographics';
    demographicEdited[2].blocks = demographicEdited[2].blocks.filter(
      (b) => b.fieldKey !== 'occupation'
    );
    expect(didConsentBlocksChange(base, demographicEdited)).toBe(false);

    // Modifying a scrollable legal document triggers a major consent change
    const consentEdited = JSON.parse(
      JSON.stringify(DEFAULT_WIZARD_PAGES)
    ) as WizardPage[];
    consentEdited[0].blocks[0].content = 'Updated legal terms requiring re-sign.';
    expect(didConsentBlocksChange(base, consentEdited)).toBe(true);
  });

  it('calls GET /forms/active, PUT /forms/active, and POST /profiles/:id/consent', async () => {
    const templatePayload = {
      template_id: '11111111-2222-3333-4444-555555555555',
      consent_version: 'v2.1',
      informed_consent_text: 'Informed consent text',
      typing_statement: 'Typing statement',
      scope_limitations_text: 'Scope text',
      scope_ack_text: 'Scope ack',
      overseas_limitations_text: 'Overseas text',
      overseas_ack_text: 'Overseas ack',
      final_consent_statement: 'Final statement',
      wizard_pages: [
        {
          page_id: 'step-1-consent',
          title: 'Informed consent',
          description: null,
          blocks: [
            {
              block_id: 'terms_signer_name',
              type: 'text',
              label: 'Signer full name',
              target: 'consent',
              field_key: 'terms_signer_name',
              applies_to: 'all',
              required: true,
              options: [],
              show_if: null,
              system_locked: false,
            },
          ],
        },
      ],
      is_active: true,
      created_at: '2026-11-23T00:00:00Z',
      updated_at: '2026-11-23T00:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify(templatePayload), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...templatePayload, consent_version: 'v3' }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile_id: '7a3c11a2-1b2c-4d3e-8f90-112233445566',
            relation_to_account_holder: 'self',
            profile_name: 'Maria Santos',
            date_of_birth: '1993-08-20',
            socmed_platform: 'instagram',
            socmed_username: '@maria',
            details: { occupation: 'Architect' },
            signed_consent_version: 'v3',
            active_consent_version: 'v3',
            consent_outdated: false,
          }),
          { status: 200 }
        )
      );

    const { api } = await import('../lib/api');

    const active = await api.getActiveConsentForm();
    expect(String(mockFetch.mock.calls[0][0])).toContain('/forms/active');
    expect(active.consentVersion).toBe('v2.1');
    expect(active.wizardPages).toHaveLength(1);
    expect(active.wizardPages[0].blocks[0].fieldKey).toBe('terms_signer_name');

    const saved = await api.updateActiveConsentForm({
      consentVersion: 'v2.1',
      bumpType: 'auto',
      wizardPages: active.wizardPages,
    });
    expect(String(mockFetch.mock.calls[1][0])).toContain('/forms/active');
    expect(mockFetch.mock.calls[1][1]?.method).toBe('PUT');
    expect(saved.consentVersion).toBe('v3');

    const resigned = await api.resignProfileConsent(
      '7a3c11a2-1b2c-4d3e-8f90-112233445566',
      {
        consent_version: 'v3',
        terms_signer_name: 'Maria Santos',
      }
    );
    expect(String(mockFetch.mock.calls[2][0])).toContain(
      '/profiles/7a3c11a2-1b2c-4d3e-8f90-112233445566/consent'
    );
    expect(resigned.signedConsentVersion).toBe('v3');
    expect(resigned.consentOutdated).toBe(false);
    expect(resigned.details?.occupation).toBe('Architect');
  });
});
