'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Card } from './ui/primitives';
import { AwaitingContent } from './AwaitingContent';
import { CmsContent, ResidentPsychologist } from '../lib/types';

/**
 * About carousel — August-Health-style card cycle, built dependency-free.
 * Native horizontal scroll-snap track (touch / trackpad / keyboard) with
 * centered prev/next controls. No autoplay, no looping — user-driven only.
 *
 * Cycle order: RP-01, RP-02 → Vision → Clinic Overview → Mission → RP-03.
 * Roster cards bookend the cycle; the institution blocks sit in the middle.
 */

type Tint = 'sage' | 'mint' | 'lime' | 'sand';

const SLIDE_MOTION =
  'transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lift';

function RosterSlide({
  resident,
  tint,
}: {
  resident: ResidentPsychologist;
  tint: Tint;
}) {
  return (
    <Card tint={tint} className={`h-full flex flex-col justify-between gap-5 ${SLIDE_MOTION}`}>
      <div className="space-y-3">
        {/* Anonymized role identifier — strictly no personal name; no badge/avatar box */}
        <div>
          <h3 className="font-heading text-xl font-medium text-pine">
            {resident.anonymizedTitle}
          </h3>
          <p className="text-xs text-pine/65">{resident.yearsPractice}</p>
        </div>

        <p className="text-sm text-pine/85 leading-relaxed">
          {resident.specialization}
        </p>

        <div className="space-y-1.5 pt-2">
          <p className="text-xs font-semibold text-pine">Authorized Service Scope:</p>
          <p className="text-xs text-pine/75 leading-relaxed">
            {resident.serviceEligibility.join(' · ')}
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-pine/10 flex items-center justify-between text-xs text-pine/70">
        <span>Languages: {resident.languages.join(', ')}</span>
      </div>
    </Card>
  );
}

function StatementSlide({
  title,
  body,
  awaitingLabel,
  tint,
}: {
  title: string;
  body?: string;
  awaitingLabel: string;
  tint: Tint;
}) {
  return (
    <Card tint={tint} className={`h-full flex flex-col gap-3 ${SLIDE_MOTION}`}>
      <h3 className="font-heading text-2xl font-medium text-pine">{title}</h3>
      {body ? (
        <p className="text-sm text-pine/85 leading-relaxed">{body}</p>
      ) : (
        <AwaitingContent label={awaitingLabel} />
      )}
    </Card>
  );
}

function ClinicSlide({ cms }: { cms?: CmsContent }) {
  return (
    <Card tint="pine" className={`h-full flex flex-col justify-between gap-6 ${SLIDE_MOTION}`}>
      <div className="space-y-3">
        <h3 className="font-heading text-2xl font-medium text-white">
          Clinic Overview
        </h3>
        {cms?.clinicOverview ? (
          <p className="text-sm text-white/75 leading-relaxed">{cms.clinicOverview}</p>
        ) : (
          <AwaitingContent label="Clinic Overview" tone="dark" />
        )}
        {cms?.impactNarrative && (
          <p className="text-xs text-white/65 leading-relaxed">{cms.impactNarrative}</p>
        )}
        {cms && cms.impactMetrics.length > 0 && (
          <div className="divide-y divide-white/10">
            {cms.impactMetrics.map((metric) => (
              <div
                key={metric.id}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white/85">{metric.metricLabel}</p>
                  <p className="text-xs text-white/55">{metric.timeframeContext}</p>
                </div>
                <span className="font-heading text-2xl text-lime-soft tabular-nums shrink-0">
                  {metric.metricValue}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/admin/cms"
        className="text-xs font-semibold text-lime-soft hover:text-white underline underline-offset-4 transition-colors duration-200 w-fit"
      >
        Edit in Admin CMS
      </Link>
    </Card>
  );
}

export function AboutCarousel({
  cms,
  roster,
}: {
  cms?: CmsContent;
  roster: ResidentPsychologist[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges, roster.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const firstSlide = el.firstElementChild as HTMLElement | null;
    const step = firstSlide ? firstSlide.offsetWidth + 24 : el.clientWidth * 0.85;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const rosterHead = roster.slice(0, 2);
  const rosterTail = roster.slice(2);

  const slides: React.ReactNode[] = [
    ...rosterHead.map((resident, i) => (
      <RosterSlide
        key={resident.id}
        resident={resident}
        tint={i === 0 ? 'sage' : 'mint'}
      />
    )),
    <StatementSlide
      key="vision"
      title="Vision Statement"
      body={cms?.vision || undefined}
      awaitingLabel="Vision"
      tint="sand"
    />,
    <ClinicSlide key="clinic" cms={cms} />,
    <StatementSlide
      key="mission"
      title="Mission Statement"
      body={cms?.mission || undefined}
      awaitingLabel="Mission"
      tint="lime"
    />,
    ...rosterTail.map((resident, i) => (
      <RosterSlide
        key={resident.id}
        resident={resident}
        tint={(['sage', 'mint', 'lime', 'sand'] as Tint[])[i % 4]}
      />
    )),
  ];

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={updateEdges}
        tabIndex={0}
        role="region"
        aria-label="About PsychAvenuePH cards"
        className="scrollbar-none flex snap-x snap-mandatory gap-6 overflow-x-auto rounded-3xl py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            className="w-[85%] shrink-0 snap-start sm:w-[24rem] lg:w-[27rem]"
          >
            {slide}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label="Previous cards"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mint bg-surface-raised text-pine transition-colors duration-200 hover:border-sage hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label="Next cards"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mint bg-surface-raised text-pine transition-colors duration-200 hover:border-sage hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
