'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppStore } from '../stores/useAppStore';
import { Button, Card } from '../components/ui/primitives';
import { TestimonialsConsentSection } from '../components/TestimonialsConsentSection';

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

  const flowCSteps = [
    {
      step: '01',
      title: 'Share who the session is for',
      roleLabel: 'You share',
      description:
        'Choose who the session is for (yourself or someone you care for), pick a service, and describe your concerns in plain words.',
      actionLabel: 'Start a booking',
      onAction: () => {
        setCognitoRole('client');
        router.push('/personas');
      },
    },
    {
      step: '02',
      title: 'Get 3 proposed times',
      roleLabel: 'Verified psychologist',
      description:
        'A verified psychologist reviews your request, sets a clear session fee, and proposes 3 distinct times that fit the service duration.',
      actionLabel: 'Explore services',
      onAction: () => {
        router.push('/services');
      },
    },
    {
      step: '03',
      title: 'Pick 1 time, pay & meet',
      roleLabel: 'You confirm',
      description:
        'Pick the time that works for you and complete payment. Your session contact unlocks, with reminders before the appointment.',
      actionLabel: 'Other ways to book',
      onAction: () => {
        router.push('/book');
      },
    },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-white border border-[#C0D3C3] rounded-2xl p-8 lg:p-12">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Verified psychologists</span>
            <span aria-hidden="true">·</span>
            <span>Structured booking</span>
            <span aria-hidden="true">·</span>
            <span>Private by design</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-[#25372D] leading-[1.08]">
            Book trusted psychological care, with clarity at every step.
          </h1>

          <p className="text-base sm:text-lg text-[#25372D]/80 max-w-2xl leading-relaxed">
            PSYCHAVE PH matches you with a verified psychologist. Tell us who the session is for,
            receive 3 proposed times with a clear fee, then pick one and pay to confirm — your
            personal details stay private until then.
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
              Book a session
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/services')}
            >
              Explore services
            </Button>
            <Link
              href="/book"
              className="text-sm font-medium text-[#25372D]/80 hover:text-[#25372D] underline underline-offset-4 px-2"
            >
              Other ways to book
            </Link>
          </div>
        </div>

        {/* Calming Botanical & Clinical Architecture SVG Graphic (No real photos per constraint) */}
        <div className="lg:col-span-5">
          <div className="bg-[#F1F6F2] border border-[#C0D3C3] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#C0D3C3] pb-3">
              <div>
                <p className="font-heading text-lg font-bold text-[#25372D]">
                  How booking protects you
                </p>
                <p className="text-xs text-[#25372D]/70">
                  Verified psychologists only · Your details stay private
                </p>
              </div>
              <svg
                className="w-8 h-8 text-[#5D8B69]"
                viewBox="0 0 32 32"
                fill="none"
              >
                <rect x="3" y="3" width="26" height="26" rx="7" stroke="#5D8B69" strokeWidth="2" />
                <path
                  d="M10 17.5C12.5 12 16 9.5 22 9.5C22 15.5 19.5 19 14 21.5C11.5 22.5 9.5 21 10 17.5Z"
                  fill="#8FBE8F"
                  fillOpacity="0.4"
                  stroke="#25372D"
                  strokeWidth="1.75"
                />
                <path d="M10 22L17 15" stroke="#25372D" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg bg-white border border-[#C0D3C3]/80 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#25372D]">
                    1. Tell us who the session is for
                  </p>
                  <p className="text-[#25372D]/70 mt-0.5">
                    Book for yourself or someone you care for, with consent handled up front.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#5D8B69] font-semibold tabular-nums">
                  Step 1
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#C0D3C3]/80 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#25372D]">
                    2. A verified psychologist replies with 3 times
                  </p>
                  <p className="text-[#25372D]/70 mt-0.5">
                    Only verified psychologists can reply. They set a clear fee and propose 3 times.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#5D8B69] font-semibold tabular-nums">
                  Step 2
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#D0E187]/35 border border-[#8FBE8F] flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#25372D]">
                    3. Pick 1 time, pay &amp; meet
                  </p>
                  <p className="text-[#25372D]/80 mt-0.5">
                    Session contact unlocks after payment succeeds. Reminders follow before your session.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#25372D] font-semibold tabular-nums">
                  Step 3
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How booking works */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div>
            <p className="text-xs font-semibold text-[#5D8B69]">
              How booking works
            </p>
            <h2 className="font-heading text-3xl font-bold text-[#25372D]">
              Booking in three steps
            </h2>
          </div>
          <p className="text-sm text-[#25372D]/75 max-w-md">
            Start a booking, receive proposed times from a verified psychologist, then confirm with payment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {flowCSteps.map((item) => (
            <div
              key={item.step}
              className="bg-white border border-[#C0D3C3] rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-[#5D8B69] transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#25372D]/65">
                  <span className="font-mono font-bold text-[#5D8B69] tabular-nums">
                    {item.step}
                  </span>
                  <span>{item.roleLabel}</span>
                </div>
                <h3 className="font-heading text-xl font-bold text-[#25372D]">
                  {item.title}
                </h3>
                <p className="text-xs text-[#25372D]/75 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={item.onAction}
                className="w-full justify-between"
              >
                <span>{item.actionLabel}</span>
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Services & Clinical Guardrails Overview */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div>
            <p className="text-xs font-semibold text-[#5D8B69]">
              Session lengths &amp; scope
            </p>
            <h2 className="font-heading text-3xl font-bold text-[#25372D]">
              Clinical &amp; Advisory Services Directory
            </h2>
          </div>
          <Link
            href="/services"
            className="text-sm font-semibold text-[#5D8B69] hover:text-[#25372D] underline underline-offset-4"
          >
            View Full Services Specification →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((srv) => (
            <Card
              key={srv.id}
              className={`flex flex-col justify-between gap-5 ${
                srv.isStandaloneConsultation
                  ? 'border-[#5D8B69] bg-[#F1F6F2]/70'
                  : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#25372D]/70">
                  <span className="font-mono font-semibold text-[#5D8B69] tabular-nums">
                    {srv.indexNumber}. {srv.categoryGroup}
                  </span>
                  <span className="font-mono font-semibold text-[#25372D] tabular-nums">
                    {srv.durationLabel}
                  </span>
                </div>

                <h3 className="font-heading text-2xl font-bold text-[#25372D]">
                  {srv.title}
                </h3>

                <p className="text-sm text-[#25372D]/80 leading-relaxed">
                  {srv.description}
                </p>

                <div className="p-3 rounded-lg bg-[#EBF2EC] border-l-3 border-[#5D8B69] text-xs text-[#25372D] space-y-1">
                  <p className="font-semibold text-[#25372D]">
                    Good to know: {srv.guardrailTitle}
                  </p>
                  <p className="text-[#25372D]/80 leading-relaxed">
                    {srv.guardrailNotice}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#C0D3C3]/60 flex items-center justify-between">
                <span className="text-xs text-[#25372D]/65">{srv.clinicalFormat}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    updateBookingDraft({ serviceId: srv.id });
                    setCognitoRole('client');
                    router.push('/personas');
                  }}
                >
                  Book Service →
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
