'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { Button, Card } from '../../components/ui/primitives';
import { ArrowRight } from 'lucide-react';
import { AboutCarousel } from '../../components/AboutCarousel';
import { TestimonialsConsentSection } from '../../components/TestimonialsConsentSection';

/** Booking safeguards staged as one editorial pine slab (design refresh). */
const SAFEGUARD_STEPS = [
  {
    step: 'STEP 01',
    title: 'Persona Selection (Self or Dependent)',
    description:
      'Separate booking records for primary adult accounts and adolescent/dependent wards.',
  },
  {
    step: 'STEP 03',
    title: 'Verified Psychologist Pick-Up + 3 Slots',
    description:
      'Unverified accounts are blocked. Verified psychologists set price & propose 3 slots.',
  },
  {
    step: 'STEP 04–05',
    title: 'Payment-Gated Finalization & Contact Unlock',
    description:
      'Contact unlocks ONLY after payment succeeds. Automated 24h & 1h reminders follow.',
  },
];

/** Bento rhythm across the 12-col grid: 6/6, 4/4/4, 6/6 (7 services). */
const BENTO_SPANS = [
  'lg:col-span-6',
  'lg:col-span-6',
  'lg:col-span-4',
  'lg:col-span-4',
  'lg:col-span-4',
  'lg:col-span-6',
  'lg:col-span-6',
];

const BENTO_TINTS: Array<'sage' | 'mint' | 'lime' | 'sand'> = [
  'sage',
  'mint',
  'lime',
  'sand',
  'sage',
  'mint',
  'lime',
];

/**
 * Single public scroll page: Hero → Booking safeguards → #services → #about
 * → consent governance. Only /book, /login, and /register remain separate
 * public routes; dashboards and the booking flow are app routes.
 */
export default function HomePage() {
  const router = useRouter();
  const { setCognitoRole, updateBookingDraft } = useAppStore();

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const { data: cms } = useQuery({
    queryKey: ['cms'],
    queryFn: () => api.getCmsContent(),
  });

  // Public verified roster only (anonymized role identifiers, no personal names)
  const { data: publicRoster = [] } = useQuery({
    queryKey: ['roster', 'public'],
    queryFn: () => api.getRoster(false),
  });

  const scrollToServices = () => {
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div id="top" className="space-y-24">
      {/* Hero — centered editorial */}
      <section className="relative">
        {/* Static concentric-circle decoration (pure CSS, aria-hidden) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-72 w-72 rounded-full border border-mint/40 sm:h-96 sm:w-96" />
          <div className="absolute h-96 w-96 rounded-full border border-mint/25 sm:h-[34rem] sm:w-[34rem]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center space-y-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-mint px-3 py-1 text-xs font-semibold text-accent-ink">
              Philippine Mental-Health Care Navigation
            </span>
            <span className="rounded-full border border-mint px-3 py-1 text-xs font-semibold text-accent-ink">
              PRC-Verified Clinical Roster
            </span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-normal text-pine leading-[1.05]">
            Structured, Trustworthy Psychological Care Built Around Clinical Clarity.
          </h1>

          <p className="text-base sm:text-lg text-pine/80 max-w-2xl mx-auto leading-relaxed">
            PSYCHAVE PH connects individuals, couples, families, and early-career practitioners
            with credential-verified psychologists through a guided booking and 3-slot proposal
            workflow—never exposing personal client quotes or unverified providers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setCognitoRole('client');
                router.push('/personas');
              }}
            >
              Start Booking
            </Button>
            <Button variant="outline" size="lg" onClick={scrollToServices}>
              Explore Services
            </Button>
          </div>

          <p className="text-sm">
            <Link
              href="/book"
              className="font-medium text-pine/80 hover:text-pine underline underline-offset-4 transition-colors duration-200"
            >
              External Booking Fallback
            </Link>
          </p>
        </div>
      </section>

      {/* Booking safeguards — pine slab */}
      <section className="bg-pine rounded-3xl px-6 py-12 sm:px-12 sm:py-16">
        <div className="text-center space-y-4">
          <span className="inline-flex items-center rounded-full border border-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-soft">
            How Booking Works
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-medium text-white">
            Clinical Booking Safeguards
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-white/70 leading-relaxed">
            Real-time state synchronization across 3 Cognito roles — client, verified
            psychologist, and admin.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {SAFEGUARD_STEPS.map((item) => (
            <div key={item.step} className="space-y-2">
              <p className="font-mono text-xs font-semibold tracking-widest text-lime-soft tabular-nums">
                {item.step}
              </p>
              <p className="font-heading text-xl font-medium text-white">
                {item.title}
              </p>
              <p className="text-sm text-white/70 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Services — pastel bento (single source of the directory; no duplicate page) */}
      <section id="services" className="scroll-mt-24 space-y-10">
        <div className="text-center space-y-4">
          <span className="inline-flex items-center rounded-full border border-mint px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent-ink">
            Durations &amp; Scope Guardrails
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-medium text-pine">
            Clinical &amp; Advisory Services Directory
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
          {services.map((srv, index) => (
            <Card
              key={srv.id}
              tint={BENTO_TINTS[index % BENTO_TINTS.length]}
              className={`flex flex-col justify-between gap-5 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lift ${BENTO_SPANS[index % BENTO_SPANS.length]}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-pine/70">
                  <span className="font-mono font-semibold text-accent-ink tabular-nums">
                    {srv.indexNumber}. {srv.categoryGroup}
                  </span>
                  <span className="font-mono font-semibold text-pine/65 tabular-nums">
                    {srv.durationLabel}
                  </span>
                </div>

                <h3 className="font-heading text-2xl font-medium text-pine">
                  {srv.title}
                </h3>

                <p className="text-sm text-pine/80 leading-relaxed">
                  {srv.description}
                </p>

                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-pine">
                    Guardrail: {srv.guardrailTitle}
                  </p>
                  <p className="text-pine/70 leading-relaxed">
                    {srv.guardrailNotice}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-pine/10 flex items-center justify-between">
                <span className="text-xs text-pine/65">{srv.clinicalFormat}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateBookingDraft({ serviceId: srv.id });
                    setCognitoRole('client');
                    router.push('/personas');
                  }}
                >
                  Book Service
                  <ArrowRight
                    className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* About — institutional card cycle (Vision / Clinic / Mission + anonymized roster) */}
      <section id="about" className="scroll-mt-24 space-y-10">
        <div className="text-center space-y-4">
          <span className="inline-flex items-center rounded-full border border-mint px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent-ink">
            Institutional Governance
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-medium text-pine">
            About PSYCHAVE PH (PsychAvenuePH)
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-pine/70 leading-relaxed">
            Structured ethical mental-health practice built around verified clinical
            credentials, transparent scope boundaries, and privacy-first care navigation.
          </p>
        </div>

        <AboutCarousel cms={cms} roster={publicRoster} />

        <p className="text-center text-xs text-pine/65 max-w-3xl mx-auto leading-relaxed">
          Individual personal names and photographs are intentionally excluded from public
          display. Cases are matched via verified PRC credentials and specialization fit
          during booking.
        </p>
      </section>

      {/* Consent governance — keeps the ra-10173-consent anchor used by /register */}
      {cms && <TestimonialsConsentSection cms={cms} />}
    </div>
  );
}
