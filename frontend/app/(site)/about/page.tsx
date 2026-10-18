'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Card } from '../../../components/ui/primitives';
import { AwaitingContent } from '../../../components/AwaitingContent';
import { TestimonialsConsentSection } from '../../../components/TestimonialsConsentSection';

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
      <header className="space-y-3 border-b border-mist pb-6">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
          <span>Institutional Governance</span>
          <span aria-hidden="true">·</span>
          <span>Anonymized Resident Roster</span>
          <span aria-hidden="true">·</span>
          <span>Payload CMS Managed</span>
        </div>
        <h1 className="font-heading text-4xl font-bold text-pine">
          About PSYCHAVE PH (PsychAvenuePH)
        </h1>
        <p className="text-base text-pine/80 max-w-3xl">
          Structured ethical mental-health practice built around verified clinical credentials,
          transparent scope boundaries, and privacy-first care navigation.
        </p>
      </header>

      {/* Vision & Mission (Live-synced with Admin CMS) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-3">
          <div className="flex items-center justify-between text-xs text-accent-ink font-semibold">
            <span>Institutional Direction</span>
            <span>CMS Block · Vision</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-pine">
            Vision Statement
          </h2>
          {cms?.vision ? (
            <p className="text-sm text-pine/85 leading-relaxed">
              {cms.vision}
            </p>
          ) : (
            <AwaitingContent label="Vision" />
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between text-xs text-accent-ink font-semibold">
            <span>Clinical Mandate</span>
            <span>CMS Block · Mission</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-pine">
            Mission Statement
          </h2>
          {cms?.mission ? (
            <p className="text-sm text-pine/85 leading-relaxed">
              {cms.mission}
            </p>
          ) : (
            <AwaitingContent label="Mission" />
          )}
        </Card>
      </section>

      {/* Clinic Overview and Impact (Live-synced with Admin CMS) */}
      <section className="bg-surface-raised border border-mist rounded-lg p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-mist pb-4">
          <div>
            <p className="text-xs font-semibold text-accent-ink">
              CMS Block · Clinic Overview &amp; Impact
            </p>
            <h2 className="font-heading text-3xl font-bold text-pine">
              Clinic Overview &amp; Ethical Impact Architecture
            </h2>
          </div>
          <Link
            href="/admin/cms"
            className="text-xs font-semibold text-accent-ink hover:text-pine underline underline-offset-4"
          >
            Edit in Admin CMS
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4 text-sm text-pine/85 leading-relaxed">
            {cms?.clinicOverview ? (
              <p>{cms.clinicOverview}</p>
            ) : (
              <AwaitingContent label="Clinic Overview" />
            )}
            {cms?.impactNarrative && (
              <p className="p-4 rounded-lg bg-surface-sunken border border-mist text-xs text-pine/80">
                {cms.impactNarrative}
              </p>
            )}
          </div>

          {cms && cms.impactMetrics.length > 0 && (
            <div className="lg:col-span-5 grid grid-cols-1 gap-3">
              {cms.impactMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="p-4 rounded-lg bg-parchment border border-mist flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-pine">
                      {metric.metricLabel}
                    </p>
                    <p className="text-xs text-pine/65">{metric.timeframeContext}</p>
                  </div>
                  <span className="font-heading text-2xl font-bold text-accent-ink tabular-nums shrink-0">
                    {metric.metricValue}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Resident Roster Section WITHOUT Individual Names */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-mist pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent-ink">
              <span>Public Clinical Roster</span>
              <span aria-hidden="true">·</span>
              <span>Strict No-Personal-Names Governance</span>
            </div>
            <h2 className="font-heading text-3xl font-bold text-pine">
              Verified Resident Psychologist Roster (Structure Only)
            </h2>
          </div>
          <p className="text-xs text-pine/70 max-w-md">
            Individual personal names and photographs are intentionally excluded from public display.
            Cases are matched via verified PRC credentials and specialization fit in Flow C.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {publicRoster.map((resident) => (
            <Card key={resident.id} className="flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-pine/70 border-b border-mist/60 pb-2.5">
                  <span className="font-mono font-semibold text-accent-ink">
                    {resident.prcCredentialCode}
                  </span>
                  <span className="text-pine font-medium">
                    Verified Credential
                  </span>
                </div>

                {/* Anonymized Role Identifier — strictly no personal name; no badge/avatar box */}
                <div>
                  <h3 className="font-heading text-xl font-bold text-pine">
                    {resident.anonymizedTitle}
                  </h3>
                  <p className="text-xs text-pine/65">{resident.yearsPractice}</p>
                </div>

                <p className="text-sm text-pine/85 leading-relaxed">
                  {resident.specialization}
                </p>

                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-semibold text-pine">
                    Authorized Flow C Service Scope:
                  </p>
                  <p className="text-xs text-pine/75 leading-relaxed">
                    {resident.serviceEligibility.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-mist/60 flex items-center justify-between text-xs text-pine/70">
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
