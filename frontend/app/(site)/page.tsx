'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { Button, Card } from '../../components/ui/primitives';
import { ArrowRight } from 'lucide-react';
import { AboutCarousel } from '../../components/AboutCarousel';
import { TestimonialsConsentSection } from '../../components/TestimonialsConsentSection';

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
 * Single public scroll page: Hero → #services → #about → consent governance.
 * Only /book, /login, and /register remain separate public routes; dashboards
 * and the booking flow are app routes.
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
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-medium text-pine leading-[1.05]">
            Care, done clearly.
          </h1>

          <p className="text-base sm:text-lg text-pine/80 max-w-2xl mx-auto leading-relaxed">
            Verified psychologists, transparent fees, and three proposed time slots.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-2">
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
            <button
              type="button"
              onClick={scrollToServices}
              className="text-sm font-medium text-pine/80 hover:text-pine underline underline-offset-4 transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              Explore services
            </button>
          </div>
        </div>
      </section>

      {/* Services — pastel bento (single source of the directory; no duplicate page) */}
      <section id="services" className="scroll-mt-24 space-y-10">
        <div className="text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-medium text-pine">
            Clinical &amp; Advisory Services Directory
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
          {services.map((srv, index) => (
            <Card
              key={srv.id}
              tint={BENTO_TINTS[index % BENTO_TINTS.length]}
              className={`flex flex-col justify-between gap-8 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lift ${BENTO_SPANS[index % BENTO_SPANS.length]}`}
            >
              <h3 className="font-heading text-2xl font-medium text-pine">
                {srv.title}
              </h3>

              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateBookingDraft({ serviceId: srv.id });
                    setCognitoRole('client');
                    router.push('/personas');
                  }}
                >
                  Book
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

      {/* About — carousel only (visually; the heading stays for screen readers) */}
      <section id="about" className="scroll-mt-24">
        <h2 className="sr-only">About PSYCHAVE PH (PsychAvenuePH)</h2>
        <AboutCarousel cms={cms} roster={publicRoster} />
      </section>

      {/* Consent governance — keeps the ra-10173-consent anchor used by /register */}
      {cms && <TestimonialsConsentSection cms={cms} />}
    </div>
  );
}
