'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Shared snap-scroll carousel (dependency-free): a horizontal snap track with
 * centered prev/next controls. The scrollbar is hidden (.scrollbar-none) but
 * the track stays fully scrollable by touch, wheel, and keyboard — the buttons
 * are an extra affordance, and disable themselves at the edges.
 *
 * Used by the About card cycle and the home services carousel.
 */
export function ScrollCarousel({
  ariaLabel,
  children,
  trackClassName = '',
  wrapperClassName = '',
  deps = [],
}: {
  ariaLabel: string;
  children: React.ReactNode;
  /** Extra classes for the snap track (gap, padding, rounding, …). */
  trackClassName?: string;
  /** Extra classes for the outer wrapper (e.g. a full-bleed breakout). */
  wrapperClassName?: string;
  /** Re-measure the edges when these change (slide count, data load, …). */
  deps?: React.DependencyList;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateEdges, ...deps]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const firstSlide = el.firstElementChild as HTMLElement | null;
    // Step by one card + the track's own column gap (varies per carousel)
    const gap = parseFloat(getComputedStyle(el).columnGap) || 24;
    const step = firstSlide ? firstSlide.offsetWidth + gap : el.clientWidth * 0.85;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className={wrapperClassName}>
      <div
        ref={trackRef}
        onScroll={updateEdges}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className={`scrollbar-none flex snap-x snap-mandatory overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage ${trackClassName}`}
      >
        {children}
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
