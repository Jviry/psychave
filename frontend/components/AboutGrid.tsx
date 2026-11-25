'use client';

import React from 'react';
import Link from 'next/link';
import { BadgeCheck, Stethoscope, Target, Telescope } from 'lucide-react';
import { Card } from './ui/primitives';
import { CmsContent, ResidentPsychologist } from '../lib/types';
import { useAuthStore } from '@/stores/authStore';

/**
 * About Us — staggered mosaic structure with placeholder copy fallbacks
 * whenever CMS fields are not yet populated.
 */

type AboutTint = 'sage' | 'mint' | 'lime' | 'mist' | 'pine';

const PLACEHOLDER_CLINIC_OVERVIEW =
  'PsychAvenuePH (PSYCHAVE PH) connects clients across the Philippines with PRC-registered resident psychologists through structured scheduling, transparent clinical fees, and consent-first data governance.';

const PLACEHOLDER_VISION =
  'Accessible, ethically grounded psychological care across the Philippines where every session begins with clarity, verified credentials, and respect for client privacy.';

const PLACEHOLDER_MISSION =
  'Deliver structured, compassionate mental health and advisory services through PRC-verified practitioners, clear booking guardrails, and strict RA 10173 confidentiality.';

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
      <h3 className="font-heading text-3xl font-semibold leading-tight tracking-tight">{title}</h3>
    </div>
  );
}

function StatementCard({
  title,
  icon,
  body,
  tint,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  body: string;
  tint: AboutTint;
}) {
  return (
    <Card tint={tint} className="flex h-full flex-col gap-5 p-6 lg:p-7">
      <CardHeading icon={icon} title={title} />
      <p className="text-base leading-relaxed opacity-90">{body}</p>
    </Card>
  );
}

function RosterCard({ resident, tint }: { resident: ResidentPsychologist; tint: AboutTint }) {
  return (
    <Card tint={tint} className="flex h-full flex-col gap-5 p-8 lg:p-10">
      <div className="space-y-1.5">
        <CardHeading icon={BadgeCheck} title={resident.anonymizedTitle} />
        <p className="text-sm opacity-75">{resident.yearsPractice}</p>
      </div>

      <p className="text-base leading-relaxed opacity-90">{resident.specialization}</p>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Authorized Service Scope:</p>
        <p className="text-sm leading-relaxed opacity-85">
          {resident.serviceEligibility.join(' · ')}
        </p>
      </div>

      <div className="mt-auto space-y-3 pt-2">
        <div aria-hidden="true" className="h-px w-full bg-current opacity-15" />
        <p className="text-sm opacity-75">Languages: {resident.languages.join(', ')}</p>
      </div>
    </Card>
  );
}

function ClinicCard({ cms }: { cms?: CmsContent }) {
  const user = useAuthStore((s) => s.user);
  return (
    <Card tint="pine" className="flex h-full flex-col gap-5 p-6 lg:p-8 max-w-[50rem]">
      <CardHeading icon={Stethoscope} title="Clinic Overview" />

      <p className="text-base leading-relaxed text-white/85">
        {cms?.clinicOverview || PLACEHOLDER_CLINIC_OVERVIEW}
      </p>

      {cms?.impactNarrative && (
        <p className="text-sm leading-relaxed text-white/70">{cms.impactNarrative}</p>
      )}

      {cms?.impactMetrics && cms.impactMetrics.length > 0 && (
        <div className="divide-y divide-white/10">
          {cms.impactMetrics.map((metric) => (
            <div key={metric.id} className="flex items-center justify-between gap-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white/85">{metric.metricLabel}</p>
                <p className="text-sm text-white/60">{metric.timeframeContext}</p>
              </div>
              <span className="font-heading text-3xl font-semibold text-lime-soft tabular-nums shrink-0">
                {metric.metricValue}
              </span>
            </div>
          ))}
        </div>
      )}

      {user?.role === 'admin' && (
        <Link
          href="/admin/cms"
          className="mt-auto w-fit text-sm font-semibold text-lime-soft hover:text-white underline underline-offset-4 transition-colors duration-200"
        >
          Edit in Admin CMS
        </Link>
      )}
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
      <div className="text-center">
        <h2 className="font-heading text-4xl font-semibold tracking-tight text-pine sm:text-5xl">
          About PSYCHAVE PH
        </h2>
      </div>

      {/* Center band — Clinic → (Vision ∥ Mission) → (RP-01 ∥ RP-02) → RP-03 */}
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="mx-auto w-full max-w-[35rem]">
          <ClinicCard cms={cms} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1fr] sm:gap-4">
          <StatementCard
            title="Vision Statement"
            icon={Telescope}
            body={cms?.vision || PLACEHOLDER_VISION}
            tint="mist"
          />
          <StatementCard
            title="Mission Statement"
            icon={Target}
            body={cms?.mission || PLACEHOLDER_MISSION}
            tint="lime"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr] sm:gap-4">
          {roster[0] && <RosterCard resident={roster[0]} tint="mint" />}
          {roster[1] && <RosterCard resident={roster[1]} tint="sage" />}
        </div>

        {roster[2] && (
          <div className="mx-auto w-full max-w-[35rem]">
            <RosterCard resident={roster[2]} tint="mist" />
          </div>
        )}
      </div>
    </div>
  );
}
