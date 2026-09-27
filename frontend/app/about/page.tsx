'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppLink } from '../../lib/navigation';
import { Card } from '../../components/ui/primitives';
import { TestimonialsConsentSection } from '../../components/TestimonialsConsentSection';

export default function AboutPage() {
  const { data: cms } = useQuery({
    queryKey: ['cms'],
    queryFn: () => api.getCmsContent(),
  });

  // Fetch public verified roster only (no personal names, only anonymized role identifiers)
  const { data: publicRoster = [] } = useQuery({
    queryKey: ['roster', 'public'],
    queryFn: () => api.getRoster(false),
  });

  return (
    <div className="space-y-14">
      {/* Header */}
      <header className="space-y-3 border-b border-[#C0D3C3] pb-6">
        <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
          <span>Institutional Governance</span>
          <span aria-hidden="true">·</span>
          <span>Anonymized Resident Roster</span>
          <span aria-hidden="true">·</span>
          <span>Payload CMS Managed</span>
        </div>
        <h1 className="font-heading text-4xl font-bold text-[#25372D]">
          About PSYCHAVE PH (PsychAvenuePH)
        </h1>
        <p className="text-base text-[#25372D]/80 max-w-3xl">
          Structured ethical mental-health practice built around verified clinical credentials,
          transparent scope boundaries, and privacy-first care navigation.
        </p>
      </header>

      {/* Vision & Mission Placeholders (Live-synced with Admin CMS) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-3 border-t-4 border-t-[#25372D]">
          <div className="flex items-center justify-between text-xs text-[#5D8B69] font-semibold">
            <span>Institutional Direction</span>
            <span>CMS Block · Vision</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-[#25372D]">
            Vision Statement Placeholder
          </h2>
          <p className="text-sm text-[#25372D]/85 leading-relaxed">
            {cms?.vision}
          </p>
        </Card>

        <Card className="space-y-3 border-t-4 border-t-[#5D8B69]">
          <div className="flex items-center justify-between text-xs text-[#5D8B69] font-semibold">
            <span>Clinical Mandate</span>
            <span>CMS Block · Mission</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-[#25372D]">
            Mission Statement Placeholder
          </h2>
          <p className="text-sm text-[#25372D]/85 leading-relaxed">
            {cms?.mission}
          </p>
        </Card>
      </section>

      {/* Clinic Overview and Impact Placeholder */}
      <section className="bg-white border border-[#C0D3C3] rounded-2xl p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div>
            <p className="text-xs font-semibold text-[#5D8B69]">
              CMS Block · Clinic Overview &amp; Impact Placeholder
            </p>
            <h2 className="font-heading text-3xl font-bold text-[#25372D]">
              Clinic Overview &amp; Ethical Impact Architecture
            </h2>
          </div>
          <AppLink
            href="/admin/cms"
            className="text-xs font-semibold text-[#5D8B69] hover:text-[#25372D] underline underline-offset-4"
          >
            Edit Placeholders in Admin CMS →
          </AppLink>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4 text-sm text-[#25372D]/85 leading-relaxed">
            <p>{cms?.clinicOverview}</p>
            <p className="p-4 rounded-lg bg-[#F1F6F2] border border-[#C0D3C3] text-xs text-[#25372D]/80">
              {cms?.impactNarrative}
            </p>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 gap-3">
            {cms?.impactMetrics.map((metric) => (
              <div
                key={metric.id}
                className="p-4 rounded-xl bg-[#F6F9F6] border border-[#C0D3C3] flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[#25372D]">
                    {metric.metricLabel}
                  </p>
                  <p className="text-xs text-[#25372D]/65">{metric.timeframeContext}</p>
                </div>
                <span className="font-heading text-2xl font-bold text-[#5D8B69] tabular-nums shrink-0">
                  {metric.metricValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resident Roster Section WITHOUT Individual Names */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#5D8B69]">
              <span>Public Clinical Roster</span>
              <span aria-hidden="true">·</span>
              <span>Strict No-Personal-Names Governance</span>
            </div>
            <h2 className="font-heading text-3xl font-bold text-[#25372D]">
              Verified Resident Psychologist Roster (Structure Only)
            </h2>
          </div>
          <p className="text-xs text-[#25372D]/70 max-w-md">
            Individual personal names and photographs are intentionally excluded from public display.
            Cases are matched via verified PRC credentials and specialization fit in Flow C.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {publicRoster.map((resident) => (
            <Card key={resident.id} className="flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#25372D]/70 border-b border-[#C0D3C3]/60 pb-2.5">
                  <span className="font-mono font-semibold text-[#5D8B69]">
                    {resident.prcCredentialCode}
                  </span>
                  <span className="text-[#25372D] font-medium">
                    Verified Credential
                  </span>
                </div>

                {/* Anonymized Role Identifier — Strictly NO personal name */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EBF2EC] border border-[#8FBE8F] flex items-center justify-center font-heading font-bold text-[#25372D]">
                    {resident.id}
                  </div>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-[#25372D]">
                      {resident.anonymizedTitle}
                    </h3>
                    <p className="text-xs text-[#25372D]/65">{resident.yearsPractice}</p>
                  </div>
                </div>

                <p className="text-sm text-[#25372D]/85 leading-relaxed">
                  {resident.specialization}
                </p>

                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-semibold text-[#25372D]">
                    Authorized Flow C Service Scope:
                  </p>
                  <p className="text-xs text-[#25372D]/75 leading-relaxed">
                    {resident.serviceEligibility.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#C0D3C3]/60 flex items-center justify-between text-xs text-[#25372D]/70">
                <span>Languages: {resident.languages.join(', ')}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials Section (Empty Cards + Consent-Flag Note) */}
      {cms && <TestimonialsConsentSection cms={cms} />}
    </div>
  );
}
