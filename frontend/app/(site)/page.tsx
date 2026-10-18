'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { Button, Card, CircleArrow } from '../../components/ui/primitives';
import { AboutGrid } from '../../components/AboutGrid';
import { ScrollCarousel } from '../../components/ScrollCarousel';
import { TestimonialsConsentSection } from '../../components/TestimonialsConsentSection';
import { ServiceItem } from '../../lib/types';

/** Brand-scheme solids (spec palette), rotated across the services cards. */
/**
 * One-line card subtexts — minimal editorial copy owned by the page, so the
 * service records (and the future API payload) keep their full descriptions.
 */
const SERVICE_SUBTEXTS: Record<string, string> = {
  'srv-consultation': 'Initial screening, booking clarity, and care navigation.',
  'srv-individual': 'One-on-one therapy for anxiety, mood, and life transitions.',
  'srv-couples': 'Structured therapy for communication, trust, and conflict repair.',
  'srv-family-group': 'Systemic counseling for families and therapeutic groups.',
  'srv-coaching': 'Goal-oriented coaching for career, habits, and milestones.',
  'srv-supervision': 'Case conceptualization and skill-building for early-career practitioners.',
  'srv-academic': 'Methodology, research design, and data analysis guidance.',
};

/**
 * Single public scroll page: Hero → #services → #about → consent governance.
 * Only /book, /login, and /register remain separate public routes; dashboards
 * and the booking flow are app routes. The services carousel breaks out of the
 * container (full-bleed), so the root clips stray horizontal overflow.
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

  /** Card action — shared by the React slide and its native clone (by index). */
  const selectService = (srv?: ServiceItem) => {
    if (!srv) return;
    updateBookingDraft({ serviceId: srv.id });
    setCognitoRole('client');
    router.push('/personas');
  };

  return (
    <div id="top" className="space-y-28 overflow-x-clip lg:space-y-32">
      {/* Hero — fills the first screen (editorial, centered) */}
      <section className="relative flex min-h-[calc(100svh-9rem)] items-center justify-center">
        {/* Static concentric-circle decoration (pure CSS, aria-hidden) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-80 w-80 rounded-full border border-mint/40 sm:h-[26rem] sm:w-[26rem]" />
          <div className="absolute h-[26rem] w-[26rem] rounded-full border border-mint/25 sm:h-[38rem] sm:w-[38rem]" />
        </div>

        <div className="relative mx-auto max-w-4xl space-y-8 text-center">
          {/* Big brand logo replaces the headline (user mockup); sr-only h1 keeps an accessible document title */}
          <h1 className="sr-only">PSYCHAVE PH — PRC-verified mental health care in the Philippines</h1>
          <img
            src="/psychave-logo.png"
            alt="PSYCHAVE PH"
            width={1024}
            height={720}
            className="mx-auto h-auto w-[22rem] sm:w-[28rem] lg:w-[32rem]"
          />

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-pine/80 sm:text-lg">
            Verified psychologists, transparent fees, and three proposed time slots.
          </p>

          <div className="flex flex-wrap items-center justify-center pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setCognitoRole('client');
                router.push('/personas');
              }}
            >
              Book a session
            </Button>
          </div>
        </div>
      </section>

      {/* Services — full-bleed infinite carousel of user-painted color blocks */}
      <section id="services" className="scroll-mt-24 space-y-6 lg:space-y-8">
        <div className="text-center">
          <h2 className="font-heading text-4xl font-medium text-pine sm:text-5xl">
            Clinical &amp; Advisory Services Directory
          </h2>
        </div>

        <ScrollCarousel
          ariaLabel="Clinical and advisory services cards"
          wrapperClassName="relative left-1/2 w-screen -translate-x-1/2"
          trackClassName="gap-1.5 pb-3 pt-1 md:gap-2"
          loop
          onItemActivate={(index) => selectService(services[index])}
          deps={[services.length]}
        >
          {services.map((srv) => (
            <div
              key={srv.id}
              className="flex min-h-[28rem] w-[19rem] shrink-0 snap-start sm:min-h-[30rem] sm:w-[21rem] lg:min-h-[32rem] lg:w-[23rem]"
            >
              <Card
                tint="leaf"
                className="flex h-full w-full flex-col p-8 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lift"
              >
                {/* Whole card is the action — tall green block, pine outline, tight gaps */}
                <button
                  type="button"
                  onClick={() => selectService(srv)}
                  className="group flex h-full w-full flex-col justify-between gap-12 rounded-lg text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
                >
                  <h3 className="font-heading text-3xl font-medium leading-tight sm:text-4xl">
                    {srv.title}
                  </h3>

                  <div className="space-y-4">
                    <div aria-hidden="true" className="h-px w-full bg-current opacity-20" />
                    <div className="flex items-end justify-between gap-6">
                      <p className="text-base leading-relaxed opacity-80">
                        {SERVICE_SUBTEXTS[srv.id] ?? srv.description}
                      </p>
                      <CircleArrow tone="light" />
                    </div>
                  </div>
                </button>
              </Card>
            </div>
          ))}
        </ScrollCarousel>
      </section>

      {/* About — static "Get to know us"-style card grid */}
      <section id="about" className="scroll-mt-24">
        <AboutGrid cms={cms} roster={publicRoster} />
      </section>

      {/* Consent governance — keeps the ra-10173-consent anchor used by /register */}
      {cms && <TestimonialsConsentSection cms={cms} />}
    </div>
  );
}
