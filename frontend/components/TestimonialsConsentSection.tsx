'use client';

import React from 'react';
import { Quote } from 'lucide-react';
import { ScrollCarousel } from './ScrollCarousel';
import { Card } from './ui/primitives';
import type { CmsContent } from '../lib/types';

/**
 * Editorial Client Reflections carousel rendered on the public landing page.
 * Uses the existing ScrollCarousel with anonymized client attributions.
 */
export function TestimonialsConsentSection({ cms }: { cms: CmsContent }) {
  const items = (cms.testimonials ?? []).filter((t) => t.isActive !== false);
  if (items.length === 0) return null;

  return (
    <section
      id="testimonials"
      className="scroll-mt-24 space-y-6 border-t border-mist pt-12 lg:space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-ink">
            Client Reflections
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight text-pine">
            Experiences in Structured Care
          </h2>
        </div>
      </div>

      <ScrollCarousel
        ariaLabel="Client reflections carousel"
        trackClassName="gap-4 pb-3 pt-1"
        deps={[items.length]}
      >
        {items.map((item, idx) => {
          const tint = idx % 2 === 0 ? 'parchment' : 'mist';
          return (
            <div
              key={item.id}
              className="flex w-[20rem] sm:w-[24rem] shrink-0 snap-start"
            >
              <Card
                className={`flex h-full w-full flex-col justify-between gap-6 p-7 border transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lift ${
                  tint === 'parchment'
                    ? 'bg-parchment border-mist'
                    : 'bg-surface-raised border-mist'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full bg-sage/15 px-2.5 py-1 text-[11px] font-medium text-pine">
                      {item.serviceCategory}
                    </span>
                    <Quote
                      className="h-4 w-4 shrink-0 text-sage/60"
                      aria-hidden="true"
                    />
                  </div>
                  <blockquote className="font-heading text-xl leading-relaxed text-pine/95">
                    &ldquo;{item.quote}&rdquo;
                  </blockquote>
                </div>

                <footer className="border-t border-mist/80 pt-3">
                  <p className="text-xs font-medium tracking-wide text-pine/70">
                    {item.authorLabel}
                  </p>
                </footer>
              </Card>
            </div>
          );
        })}
      </ScrollCarousel>
    </section>
  );
}
