'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AppLink, useAppRouter } from '../lib/navigation';
import { useAppStore } from '../stores/useAppStore';
import { Button, Card } from '../components/ui/primitives';
import { TestimonialsConsentSection } from '../components/TestimonialsConsentSection';

export default function HomePage() {
  const { navigate } = useAppRouter();
  const { setCognitoRole, updateIntakeDraft } = useAppStore();

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
      title: 'Persona & Clinical Intake',
      roleLabel: 'Client Action',
      description:
        'Select a Persona (Self or Dependent) and complete the structured clinical intake form with presenting concerns and service choice.',
      actionLabel: 'Open Intake Form',
      onAction: () => {
        setCognitoRole('client');
        navigate('/personas');
      },
    },
    {
      step: '02',
      title: 'Pending Queue & Notification',
      roleLabel: 'System + Queue',
      description:
        'Submitted intake enters the pending queue visible to PRC-verified psychologists (and preliminary admin audit view).',
      actionLabel: 'Inspect Queue',
      onAction: () => {
        setCognitoRole('psychologist');
        navigate('/psych/queue');
      },
    },
    {
      step: '03',
      title: 'Verified Pick-Up + 3 Slots + Fee',
      roleLabel: 'Verified Psychologist',
      description:
        'Only verified psychologists can pick up a request, set the session price, and propose exactly 3 distinct date/time slots.',
      actionLabel: 'Test Proposal Creator',
      onAction: () => {
        setCognitoRole('psychologist');
        navigate('/psych/queue');
      },
    },
    {
      step: '04',
      title: 'Slot Selection & Payment Finalization',
      roleLabel: 'Client Action',
      description:
        'Client receives a proposal alert, reviews the 3 proposed slots, selects 1, and pays. Finalized ONLY on payment success.',
      actionLabel: 'Review Proposal #102',
      onAction: () => {
        setCognitoRole('client');
        navigate('/proposal/BK-2026-102');
      },
    },
    {
      step: '05',
      title: 'Contact Unlock & 24h / 1h Reminders',
      roleLabel: 'Automated Lifecycle',
      description:
        'Payment confirmation unlocks direct session contact for both parties, dispatches 24h/1h reminders, and enables real-time status updates.',
      actionLabel: 'View Confirmed Booking',
      onAction: () => {
        setCognitoRole('client');
        navigate('/bookings');
      },
    },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-white border border-[#C0D3C3] rounded-2xl p-8 lg:p-12">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Philippine Mental-Health Care Navigation</span>
            <span aria-hidden="true">·</span>
            <span>PRC-Verified Clinical Roster</span>
            <span aria-hidden="true">·</span>
            <span>Canonical Flow C Architecture</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-[#25372D] leading-[1.08]">
            Structured, Trustworthy Psychological Care Built Around Clinical Clarity.
          </h1>

          <p className="text-base sm:text-lg text-[#25372D]/80 max-w-2xl leading-relaxed">
            PSYCHAVE PH connects individuals, couples, families, and early-career practitioners
            with credential-verified psychologists through a guided intake and 3-slot proposal workflow—never exposing personal client quotes or unverified providers.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setCognitoRole('client');
                navigate('/personas');
              }}
            >
              Start Flow C Intake
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/services')}
            >
              Explore 7 Services & Guardrails
            </Button>
            <AppLink
              href="/book"
              className="text-sm font-medium text-[#25372D]/80 hover:text-[#25372D] underline underline-offset-4 px-2"
            >
              External Booking Fallback
            </AppLink>
          </div>
        </div>

        {/* Calming Botanical & Clinical Architecture SVG Graphic (No real photos per constraint) */}
        <div className="lg:col-span-5">
          <div className="bg-[#F1F6F2] border border-[#C0D3C3] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#C0D3C3] pb-3">
              <div>
                <p className="font-heading text-lg font-bold text-[#25372D]">
                  Flow C Clinical Safeguards
                </p>
                <p className="text-xs text-[#25372D]/70">
                  Real-time state synchronization across 3 Cognito roles
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
                    1. Persona Selection (Self or Dependent)
                  </p>
                  <p className="text-[#25372D]/70 mt-0.5">
                    Separate intake records for primary adult accounts and adolescent/dependent wards.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#5D8B69] font-semibold tabular-nums">
                  STEP 01
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#C0D3C3]/80 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#25372D]">
                    2. Verified Psychologist Pick-Up + 3 Slots
                  </p>
                  <p className="text-[#25372D]/70 mt-0.5">
                    Unverified accounts are blocked. Verified psychologists set price &amp; propose 3 slots.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#5D8B69] font-semibold tabular-nums">
                  STEP 03
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#D0E187]/35 border border-[#8FBE8F] flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#25372D]">
                    3. Payment-Gated Finalization &amp; Contact Unlock
                  </p>
                  <p className="text-[#25372D]/80 mt-0.5">
                    Contact unlocks ONLY after payment succeeds. Automated 24h &amp; 1h reminders follow.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#25372D] font-semibold tabular-nums">
                  STEP 04–05
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Canonical Flow C Walkthrough */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div>
            <p className="text-xs font-semibold text-[#5D8B69]">
              Official Booking Architecture
            </p>
            <h2 className="font-heading text-3xl font-bold text-[#25372D]">
              Flow C End-to-End Interactive Prototype
            </h2>
          </div>
          <p className="text-sm text-[#25372D]/75 max-w-md">
            Click any stage below to automatically switch the mock AWS Cognito role and test that screen with live state.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              Durations &amp; Scope Guardrails
            </p>
            <h2 className="font-heading text-3xl font-bold text-[#25372D]">
              Clinical &amp; Advisory Services Directory
            </h2>
          </div>
          <AppLink
            href="/services"
            className="text-sm font-semibold text-[#5D8B69] hover:text-[#25372D] underline underline-offset-4"
          >
            View Full Services Specification →
          </AppLink>
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
                    Guardrail: {srv.guardrailTitle}
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
                    updateIntakeDraft({ serviceId: srv.id });
                    setCognitoRole('client');
                    navigate('/personas');
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
