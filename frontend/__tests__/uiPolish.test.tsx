/**
 * TDD — RED phase for UI polish (audit items 2-7).
 * Seams under test (all public rendered output, never internals):
 *  A. HomePage (app/page.tsx) — task-first hero + simplified walkthrough
 *  B. AboutPage (app/about/page.tsx) — no placeholder copy
 *  C. BookFallbackPage (app/book/page.tsx) — real external FB link + copy
 *  D. SiteFooter — public links only, no role dashboards
 *  E. Tiny-type guard — touched pages use >= text-xs, no text-[11px]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({ id: 'BK-2026-102' }),
}));

const servicesFixture = [
  {
    id: 'srv-consultation',
    indexNumber: '01',
    title: 'Standalone Clinical Consultation',
    categoryGroup: 'Initial Assessment & Triage',
    durationLabel: '45 mins',
    durationMinutes: 45,
    guardrailTitle: 'Screening-Only',
    guardrailNotice: 'Screening only notice.',
    description: 'Initial consultation description.',
    clinicalFormat: '1-on-1 Screening (Telehealth)',
    isStandaloneConsultation: true,
  },
  {
    id: 'srv-individual',
    indexNumber: '02',
    title: 'Individual Counseling & Psychotherapy',
    categoryGroup: 'Core Clinical Practice',
    durationLabel: '1 hr (60 mins)',
    durationMinutes: 60,
    guardrailTitle: 'Standard 1-Hour Psychotherapy',
    guardrailNotice: 'One hour notice.',
    description: 'One-on-one therapy description.',
    clinicalFormat: '1-on-1 (Telehealth)',
  },
];

const cmsFixture = {
  vision: 'A Philippines where care is reachable.',
  mission: 'Guide every client to verified care.',
  clinicOverview: 'Clinic overview narrative.',
  impactNarrative: 'Impact narrative.',
  impactMetrics: [
    { id: 'm1', metricValue: '100%', metricLabel: 'Verified roster', timeframeContext: '2026' },
  ],
  testimonialsConfig: {
    sectionTitle: 'Client stories',
    consentFlagBanner: 'Shared only with explicit consent.',
    ethicalStandardRef: 'PAP Ethical Guidelines',
    emptyCards: [],
  },
};

const rosterFixture = [
  {
    id: 'RP-01',
    anonymizedTitle: 'Resident Psychologist #RP-01',
    prcCredentialCode: 'PRC-0001',
    specialization: 'Adult individual therapy',
    serviceEligibility: ['Individual Counseling'],
    languages: ['English', 'Filipino'],
    yearsPractice: '8 years',
    verificationStatus: 'verified',
    visibleOnPublicRoster: true,
    assignedBookingsCount: 3,
  },
];

const bookingFixture = {
  id: 'BK-2026-102',
  clientId: 'C-01',
  personaId: 'persona-self-01',
  personaType: 'self',
  personaLabel: 'Myself',
  serviceId: 'srv-individual',
  serviceTitle: 'Individual Counseling & Psychotherapy',
  serviceDuration: '1 hr (60 mins)',
  serviceGuardrail: 'One-hour sessions with a verified psychologist.',
  concernsSummary: 'Work stress and sleep disruption.',
  specificNeeds: 'Weekday evenings.',
  preferredLanguage: 'English / Taglish',
  submittedAt: '2026-09-26 14:20 PST',
  status: 'proposed',
  psychologistId: 'RP-01',
  psychologistCode: 'Resident Psychologist #RP-01',
  psychologistSpecialization: 'Adult individual therapy',
  pricePhp: 2500,
  proposedSlots: [
    { id: 'slot-1', slotNumber: 1, isoDateTime: '2026-10-02T10:00:00+08:00', dateLabel: 'Fri, Oct 2, 2026', timeLabel: '10:00 AM PST' },
    { id: 'slot-2', slotNumber: 2, isoDateTime: '2026-10-03T14:00:00+08:00', dateLabel: 'Sat, Oct 3, 2026', timeLabel: '2:00 PM PST' },
    { id: 'slot-3', slotNumber: 3, isoDateTime: '2026-10-05T18:00:00+08:00', dateLabel: 'Mon, Oct 5, 2026', timeLabel: '6:00 PM PST' },
  ],
  clinicalPrepNote: 'Join from a quiet, private space 5 minutes early.',
  contactUnlocked: false,
  reminders: { reminder24h: 'scheduled', reminder1h: 'scheduled' },
};

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      getServices: vi.fn(async () => servicesFixture),
      getCmsContent: vi.fn(async () => cmsFixture),
      getRoster: vi.fn(async () => rosterFixture),
      getPersonas: vi.fn(async () => []),
      getBookingsForRole: vi.fn(async () => []),
      getBookingById: vi.fn(async () => bookingFixture),
    },
    API_BASE_URL: 'http://localhost:8000',
    AUTH_MODE: 'mock',
  };
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Seam A — homepage speaks to patients, not architecture', () => {
  it('hero offers Book a session as the primary action', async () => {
    const { default: HomePage } = await import('../app/page');
    renderWithClient(<HomePage />);
    expect(
      await screen.findByRole('button', { name: /book a session/i })
    ).toBeInTheDocument();
  });

  it('hero does not expose internal prototype CTAs', async () => {
    const { default: HomePage } = await import('../app/page');
    const { container } = renderWithClient(<HomePage />);
    await screen.findByRole('button', { name: /book a session/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Inspect Queue/i);
    expect(text).not.toMatch(/Test Proposal Creator/i);
    expect(text).not.toMatch(/Review Proposal #102/i);
    expect(text).not.toMatch(/Canonical Flow C Architecture/i);
  });

  it('walkthrough is three plain-language steps, not five system stages', async () => {
    const { default: HomePage } = await import('../app/page');
    const { container } = renderWithClient(<HomePage />);
    await screen.findByRole('button', { name: /book a session/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/STEP 04–05/i);
    expect(text).not.toMatch(/Cognito/i);
  });

  it('services preview uses plain labels too', async () => {
    const { default: HomePage } = await import('../app/page');
    const { container } = renderWithClient(<HomePage />);
    await screen.findByRole('button', { name: /book a session/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Guardrail/i);
    expect(text).not.toMatch(/Persona\b/i);
  });
});

describe('Seam B — about page ships no placeholder copy', () => {
  it('vision/mission headings are real titles', async () => {
    const { default: AboutPage } = await import('../app/about/page');
    renderWithClient(<AboutPage />);
    expect(await screen.findByRole('heading', { name: /^our vision$/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^our mission$/i })).toBeInTheDocument();
  });

  it('never renders the word Placeholder in headings or body', async () => {
    const { default: AboutPage } = await import('../app/about/page');
    const { container } = renderWithClient(<AboutPage />);
    await screen.findByRole('heading', { name: /^our vision$/i });
    expect(container.textContent || '').not.toMatch(/placeholder/i);
  });
});

describe('Seam C — book fallback facebook channel is a real link', () => {
  it('message on facebook opens the official page in a new tab', async () => {
    const { default: BookPage } = await import('../app/book/page');
    renderWithClient(<BookPage />);
    const link = await screen.findByRole('link', { name: /message .* on facebook/i });
    expect(link).toHaveAttribute('href', 'https://facebook.com/PsychAvenuePH');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('offers a separate copy-link action instead of hijacking the link', async () => {
    const { default: BookPage } = await import('../app/book/page');
    renderWithClient(<BookPage />);
    await screen.findByRole('link', { name: /message .* on facebook/i });
    expect(await screen.findByRole('button', { name: /copy.*link/i })).toBeInTheDocument();
  });
});

describe('Seam D — footer shows public site map only', () => {
  it('lists public pages and crisis contact', async () => {
    const { SiteFooter } = await import('../components/SiteFooter');
    renderWithClient(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /services & session lengths/i })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: /other ways to book/i })).toBeInTheDocument();
    expect(footer.textContent || '').toMatch(/psychaveph\.info@gmail\.com/i);
  });

  it('does not leak role dashboards or CMS internals', async () => {
    const { SiteFooter } = await import('../components/SiteFooter');
    const { container } = renderWithClient(<SiteFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    const text = container.textContent || '';
    expect(text).not.toMatch(/Credential Verification/i);
    expect(text).not.toMatch(/Payload CMS/i);
    expect(text).not.toMatch(/Pending Queue/i);
    expect(text).not.toMatch(/My Schedules/i);
  });
});

describe('Seam F — personas page speaks plainly (W1)', () => {
  it('asks who the session is for', async () => {
    const { default: PersonasPage } = await import('../app/personas/page');
    renderWithClient(<PersonasPage />);
    expect(
      await screen.findByRole('heading', { name: /who is the session for\?/i })
    ).toBeInTheDocument();
  });

  it('contains no engineering or system vocabulary', async () => {
    const { default: PersonasPage } = await import('../app/personas/page');
    const { container } = renderWithClient(<PersonasPage />);
    await screen.findByRole('heading', { name: /who is the session for\?/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Flow C/i);
    expect(text).not.toMatch(/Pending Queue/i);
    expect(text).not.toMatch(/React Hook Form/i);
    expect(text).not.toMatch(/Zod/i);
    expect(text).not.toMatch(/Legacy quick-add/i);
    expect(text).not.toMatch(/POST \/personas/i);
    expect(text).not.toMatch(/Status: Pending/i);
  });

  it('never says Persona to patients', async () => {
    const { default: PersonasPage } = await import('../app/personas/page');
    const { container } = renderWithClient(<PersonasPage />);
    await screen.findByRole('heading', { name: /who is the session for\?/i });
    expect(container.textContent || '').not.toMatch(/persona/i);
  });
});

describe('Seam G — book page in plain language (W2)', () => {
  it('offers online booking without system names', async () => {
    const { default: BookPage } = await import('../app/book/page');
    const { container } = renderWithClient(<BookPage />);
    await screen.findByRole('link', { name: /message .* on facebook/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Flow C/i);
    expect(text).not.toMatch(/Canonical/i);
    expect(text).not.toMatch(/Fallback/i);
    expect(text).not.toMatch(/Persona/i);
  });

  it('email template uses human words', async () => {
    const { default: BookPage } = await import('../app/book/page');
    const { container } = renderWithClient(<BookPage />);
    await screen.findByRole('link', { name: /message .* on facebook/i });
    const text = container.textContent || '';
    expect(text).toMatch(/Who it's for/i);
  });
});

describe('Seam H — footer columns share one plain vocabulary (W3)', () => {
  it('uses the same plain labels in both columns', async () => {
    const { SiteFooter } = await import('../components/SiteFooter');
    renderWithClient(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /about our practice/i })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: /other ways to book/i })).toBeInTheDocument();
  });

  it('has no leftover jargon labels', async () => {
    const { SiteFooter } = await import('../components/SiteFooter');
    const { container } = renderWithClient(<SiteFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    const text = container.textContent || '';
    expect(text).not.toMatch(/Anonymized Roster/i);
    expect(text).not.toMatch(/Fallback & Booking/i);
    expect(text).not.toMatch(/Guardrails/i);
    expect(text).not.toMatch(/Flow C/i);
  });
});

describe('Seam I — services page without guardrail-speak (W5)', () => {
  it('titles the page around session lengths', async () => {
    const { default: ServicesPage } = await import('../app/services/page');
    renderWithClient(<ServicesPage />);
    expect(
      await screen.findByRole('heading', { name: 'Services & session lengths' })
    ).toBeInTheDocument();
  });

  it('contains no system vocabulary', async () => {
    const { default: ServicesPage } = await import('../app/services/page');
    const { container } = renderWithClient(<ServicesPage />);
    await screen.findByRole('heading', { name: 'Services & session lengths' });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Flow C/i);
    expect(text).not.toMatch(/Canonical/i);
    expect(text).not.toMatch(/Guardrail/i);
  });
});

describe('Seam J — bookings page in patient language (W5)', () => {
  it('is titled My bookings', async () => {
    const { default: BookingsPage } = await import('../app/bookings/page');
    renderWithClient(<BookingsPage />);
    expect(
      await screen.findByRole('heading', { name: 'My bookings' })
    ).toBeInTheDocument();
  });

  it('contains no system vocabulary', async () => {
    const { default: BookingsPage } = await import('../app/bookings/page');
    const { container } = renderWithClient(<BookingsPage />);
    await screen.findByRole('heading', { name: 'My bookings' });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Flow C/i);
    expect(text).not.toMatch(/paid-confirmed/i);
    expect(text).not.toMatch(/Tiered Access/i);
    expect(text).not.toMatch(/Persona/i);
  });
});

describe('Seam L — about roster explains itself plainly (W5)', () => {
  it('explains anonymity and scope in human words', async () => {
    const { default: AboutPage } = await import('../app/about/page');
    const { container } = renderWithClient(<AboutPage />);
    await screen.findByRole('heading', { name: /^our vision$/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Governance/i);
    expect(text).not.toMatch(/Anonymized/i);
    expect(text).not.toMatch(/Flow C/i);
  });
});
describe('Seam K — proposal page in patient language (W5)', () => {
  it('asks the patient to choose a time', async () => {
    const { default: ProposalPage } = await import('../app/proposal/[id]/page');
    renderWithClient(<ProposalPage />);
    expect(
      await screen.findByRole('heading', { name: /choose your session time/i })
    ).toBeInTheDocument();
  });

  it('contains no system vocabulary', async () => {
    const { default: ProposalPage } = await import('../app/proposal/[id]/page');
    const { container } = renderWithClient(<ProposalPage />);
    await screen.findByRole('heading', { name: /choose your session time/i });
    const text = container.textContent || '';
    expect(text).not.toMatch(/Flow C/i);
    expect(text).not.toMatch(/Payment-Gated/i);
    expect(text).not.toMatch(/Guardrail/i);
    expect(text).not.toMatch(/Persona/i);
    expect(text).not.toMatch(/Mock Gateway/i);
  });
});

describe('Seam M — CMS mock defaults are publishable copy (W4)', () => {
  it('default vision/mission/overview/narrative never say Placeholder', async () => {
    const { INITIAL_CMS } = await import('../lib/api');
    for (const field of [INITIAL_CMS.vision, INITIAL_CMS.mission, INITIAL_CMS.clinicOverview, INITIAL_CMS.impactNarrative]) {
      expect(field).not.toMatch(/placeholder/i);
      expect(field.length).toBeGreaterThan(20);
    }
  });

  it('default impact metrics avoid system names', async () => {
    const { INITIAL_CMS } = await import('../lib/api');
    const text = INITIAL_CMS.impactMetrics.map((m) => `${m.metricLabel} ${m.timeframeContext}`).join(' ');
    expect(text).not.toMatch(/Flow C/i);
    expect(text).not.toMatch(/Canonical/i);
    expect(text).not.toMatch(/Placeholder/i);
  });
});

describe('Seam E — minimum type size on touched pages', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['home', '../app/page'],
    ['about', '../app/about/page'],
    ['book', '../app/book/page'],
  ])('%s renders no text-[11px] elements', async (_label, path) => {
    const mod = await import(path);
    const Page = mod.default;
    const { container } = renderWithClient(<Page />);
    // wait for async content to settle
    await new Promise((r) => setTimeout(r, 50));
    const tiny = container.querySelectorAll('[class*="text-[11px]"]');
    expect(tiny.length).toBe(0);
  });

  it('footer renders no text-[11px] elements', async () => {
    const { SiteFooter } = await import('../components/SiteFooter');
    const { container } = renderWithClient(<SiteFooter />);
    expect(container.querySelectorAll('[class*="text-[11px]"]').length).toBe(0);
  });
});
