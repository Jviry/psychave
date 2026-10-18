'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { Button, Card } from '../../components/ui/primitives';
import { ArrowRight, Leaf } from 'lucide-react';
import { TestimonialsConsentSection } from '../../components/TestimonialsConsentSection';

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

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Philippine Mental-Health Care Navigation</span>
            <span aria-hidden="true">·</span>
            <span>PRC-Verified Clinical Roster</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-pine leading-[1.08]">
            Structured, Trustworthy Psychological Care Built Around Clinical Clarity.
          </h1>

          <p className="text-base sm:text-lg text-pine/80 max-w-2xl leading-relaxed">
            PSYCHAVE PH connects individuals, couples, families, and early-career practitioners
            with credential-verified psychologists through a guided booking and 3-slot proposal workflow—never exposing personal client quotes or unverified providers.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
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
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/services')}
            >
              Explore Services
            </Button>
            <Link
              href="/book"
              className="text-sm font-medium text-pine/80 hover:text-pine underline underline-offset-4 px-2"
            >
              External Booking Fallback
            </Link>
          </div>
        </div>

        {/* Calming Botanical & Clinical Architecture SVG Graphic (No real photos per constraint) */}
        <div className="lg:col-span-5">
          <div className="bg-surface-sunken border border-mist rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-mist pb-3">
              <div>
                <p className="font-heading text-lg font-bold text-pine">
                  Clinical Booking Safeguards
                </p>
                <p className="text-xs text-pine/70">
                  Real-time state synchronization across 3 Cognito roles
                </p>
              </div>
              <Leaf className="w-8 h-8 text-sage" aria-hidden="true" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg bg-surface-raised border border-mist/80 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-pine">
                    1. Persona Selection (Self or Dependent)
                  </p>
                  <p className="text-pine/70 mt-0.5">
                    Separate booking records for primary adult accounts and adolescent/dependent wards.
                  </p>
                </div>
                <span className="font-mono text-xs text-accent-ink font-semibold tabular-nums">
                  STEP 01
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-raised border border-mist/80 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-pine">
                    2. Verified Psychologist Pick-Up + 3 Slots
                  </p>
                  <p className="text-pine/70 mt-0.5">
                    Unverified accounts are blocked. Verified psychologists set price &amp; propose 3 slots.
                  </p>
                </div>
                <span className="font-mono text-xs text-accent-ink font-semibold tabular-nums">
                  STEP 03
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-raised border border-mist/80 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-pine">
                    3. Payment-Gated Finalization &amp; Contact Unlock
                  </p>
                  <p className="text-pine/70 mt-0.5">
                    Contact unlocks ONLY after payment succeeds. Automated 24h &amp; 1h reminders follow.
                  </p>
                </div>
                <span className="font-mono text-xs text-accent-ink font-semibold tabular-nums">
                  STEP 04–05
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services & Clinical Guardrails Overview */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-mist pb-4">
          <div>
            <p className="text-xs font-semibold text-accent-ink">
              Durations &amp; Scope Guardrails
            </p>
            <h2 className="font-heading text-3xl font-bold text-pine">
              Clinical &amp; Advisory Services Directory
            </h2>
          </div>
          <Link
            href="/services"
            className="text-sm font-semibold text-accent-ink hover:text-pine underline underline-offset-4"
          >
            <span className="inline-flex items-center gap-1">
              View full services specification
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((srv) => (
            <Card
              key={srv.id}
              className={`flex flex-col justify-between gap-5 ${
                srv.isStandaloneConsultation
                  ? 'border-sage'
                  : ''
              }`}
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

                <h3 className="font-heading text-2xl font-bold text-pine">
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

              <div className="pt-2 border-t border-mist flex items-center justify-between">
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
                  <span className="inline-flex items-center gap-1">
                    Book Service
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials as Empty Cards with Consent-Flag Note */}
      {cms && <TestimonialsConsentSection cms={cms} />}
    </div>
  );
}
