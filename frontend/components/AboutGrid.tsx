'use client';

import React from 'react';
import Link from 'next/link';
import { BadgeCheck, Stethoscope, Target, Telescope } from 'lucide-react';
import { Card } from './ui/primitives';
import { AwaitingContent } from './AwaitingContent';
import { CmsContent, ResidentPsychologist } from '../lib/types';

/**
 * About Us — staggered mosaic, per the user's marked-up mockup.
 * Headline block: "About PSYCHAVE PH" only (the redundant "about us" eyebrow
 * is removed). Content order matches the mockup exactly: Clinic Overview
 * (top, centered), the Vision ∥ Mission pair, the RP-01 ∥ RP-02 pair, and
 * RP-03 centered underneath — a tight center band (the decorative white
 * breather rail cards were removed after user review). Anonymized RP-0x
 * codes only; no personal names.
 */

type AboutTint = 'sage' | 'mint' | 'lime' | 'mist' | 'pine';

function CardHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-6 w-6 shrink-0 opacity-80" aria-hidden="true" />
      <h3 className="font-heading text-3xl font-medium leading-tight">{title}</h3>
    </div>
  );
}

function StatementCard({
  title,
  icon,
  body,
  awaitingLabel,
  tint,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  body?: string;
  awaitingLabel: string;
  tint: AboutTint;
}) {
  return (
    <Card tint={tint} className="flex h-full flex-col gap-5 p-8 lg:p-10">
      <CardHeading icon={icon} title={title} />
      {body ? (
        <p className="text-base leading-relaxed opacity-90">{body}</p>
      ) : (
        <AwaitingContent label={awaitingLabel} />
      )}
    </Card>
  );
}

function RosterCard({ resident, tint }: { resident: ResidentPsychologist; tint: AboutTint }) {
  return (
    <Card tint={tint} className="flex h-full flex-col gap-5 p-8 lg:p-10">
      <div className="space-y-1.5">
        {/* Anonymized role identifier — strictly no personal name */}
        <CardHeading icon={BadgeCheck} title={resident.anonymizedTitle} />
        <p className="text-sm opacity-70">{resident.yearsPractice}</p>
      </div>

      <p className="text-base leading-relaxed opacity-90">{resident.specialization}</p>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Authorized Service Scope:</p>
        <p className="text-sm leading-relaxed opacity-80">
          {resident.serviceEligibility.join(' · ')}
        </p>
      </div>

      <div className="mt-auto space-y-3 pt-2">
        <div aria-hidden="true" className="h-px w-full bg-current opacity-15" />
        <p className="text-sm opacity-70">Languages: {resident.languages.join(', ')}</p>
      </div>
    </Card>
  );
}

function ClinicCard({ cms }: { cms?: CmsContent }) {
  return (
    <Card tint="pine" className="flex h-full flex-col gap-5 p-8 lg:p-10 max-w-[35rem]">
      <CardHeading icon={Stethoscope} title="Clinic Overview" />

      {cms?.clinicOverview ? (
        <p className="text-base leading-relaxed text-white/80">{cms.clinicOverview}</p>
      ) : (
        <AwaitingContent label="Clinic Overview" tone="dark" />
      )}

      {cms?.impactNarrative && (
        <p className="text-sm leading-relaxed text-white/70">{cms.impactNarrative}</p>
      )}

      {cms && cms.impactMetrics.length > 0 && (
        <div className="divide-y divide-white/10">
          {cms.impactMetrics.map((metric) => (
            <div key={metric.id} className="flex items-center justify-between gap-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white/80">{metric.metricLabel}</p>
                <p className="text-sm text-white/60">{metric.timeframeContext}</p>
              </div>
              <span className="font-heading text-3xl text-lime-soft tabular-nums shrink-0">
                {metric.metricValue}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/admin/cms"
        className="mt-auto w-fit text-sm font-semibold text-lime-soft hover:text-white underline underline-offset-4 transition-colors duration-200"
      >
        Edit in Admin CMS
      </Link>
    </Card>
  );
}

export function AboutGrid({
  cms,
  roster,
}: {
  cms?: CmsContent;
  roster: ResidentPsychologist[];
}) {
  return (
    <div className="space-y-10 lg:space-y-12">
      {/* Centered heading — the redundant "about us" eyebrow above it is removed */}
      <div className="text-center">
        <h2 className="font-heading text-4xl font-medium text-pine sm:text-5xl">
          About PSYCHAVE PH
        </h2>
      </div>

      {/* Center band — Clinic → (Vision ∥ Mission) → (RP-01 ∥ RP-02) → RP-03
          (the decorative white rail cards from the mockup are removed) */}
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <div className="mx-auto w-full max-w-[23rem]">
          <ClinicCard cms={cms} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr] sm:gap-1">
          <StatementCard
            title="Vision Statement"
            icon={Telescope}
            body={cms?.vision || undefined}
            awaitingLabel="Vision"
            tint="mist"
          />
          <StatementCard
            title="Mission Statement"
            icon={Target}
            body={cms?.mission || undefined}
            awaitingLabel="Mission"
            tint="lime"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr] sm:gap-1">
          {roster[0] && <RosterCard resident={roster[0]} tint="mint" />}
          {roster[1] && <RosterCard resident={roster[1]} tint="sage" />}
        </div>

        {roster[2] && (
          <div className="mx-auto w-full max-w-[23rem]">
            <RosterCard resident={roster[2]} tint="mist" />
          </div>
        )}
      </div>
    </div>
  );
}
