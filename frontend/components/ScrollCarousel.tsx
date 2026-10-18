'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Shared horizontal track carousel (dependency-free).
 *
 * `loop` mode copies the reference site's "unlimited" swiper behavior:
 *  - the slide set is duplicated into an `aria-hidden` clone host; the scroll
 *    position re-bases by exactly one set width whenever it crosses an edge,
 *    so scrolling never stops in either direction. The jump is pixel-identical
 *    (the strip is periodic), so it is invisible;
 *  - free scrolling on desktop (no snapping), snap on mobile — the reference's
 *    md=768 breakpoint, with a 12px → 32px gap;
 *  - prev/next buttons stay enabled in both directions;
 *  - cloned cards stay clickable for mouse/touch (native clones carry no React
 *    handlers, so clicks are delegated back by slide index); cloned buttons
 *    leave the tab order, keeping one set for keyboard/screen-reader users.
 * If the viewport is wider than one full set the loop disables itself and the
 * track falls back to plain edge behavior. No autoplay, no drag.
 */
export function ScrollCarousel({
  ariaLabel,
  children,
  trackClassName = '',
  wrapperClassName = '',
  loop = false,
  onItemActivate,
  deps = [],
}: {
  ariaLabel: string;
  children: React.ReactNode;
  /** Extra classes for the snap track (gap, padding, …). */
  trackClassName?: string;
  /** Extra classes for the outer wrapper (e.g. a full-bleed breakout). */
  wrapperClassName?: string;
  /** Enable the infinite repeat (cloned set + scroll re-basing). */
  loop?: boolean;
  /** Called with the slide index when a cloned slide is activated. */
  onItemActivate?: (index: number) => void;
  /** Re-measure and rebuild the clone set when these change. */
  deps?: React.DependencyList;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cloneHostRef = useRef<HTMLDivElement>(null);
  const smoothRef = useRef(false);
  const rafRef = useRef(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [loopReady, setLoopReady] = useState(false);

  /** Current geometry: one set's width (delta) and the max scroll offset. */
  const metrics = useCallback(() => {
    const el = trackRef.current;
    const host = cloneHostRef.current;
    if (!el || !host) return null;
    const first = el.children[0] as HTMLElement | undefined;
    const firstClone = host.firstElementChild as HTMLElement | null;
    if (!first || !firstClone) return null;
    return {
      el,
      delta: firstClone.offsetLeft - first.offsetLeft,
      max: el.scrollWidth - el.clientWidth,
    };
  }, []);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(max <= 4 || el.scrollLeft >= max - 4);
  }, []);

  /** Instant ±one-set jump when the position crosses an edge (invisible). */
  const rebase = useCallback(() => {
    const m = metrics();
    if (!m || m.delta <= 0) return;
    const p = m.el.scrollLeft;
    if (p <= 150 && p + m.delta <= m.max) m.el.scrollLeft = p + m.delta;
    else if (p >= m.max - 150 && p - m.delta >= 0) m.el.scrollLeft = p - m.delta;
  }, [metrics]);

  const onScroll = useCallback(() => {
    if (smoothRef.current) return; // never fight an in-flight button glide
    if (!loopReady) {
      updateEdges();
      return;
    }
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      rebase();
    });
  }, [loopReady, rebase, updateEdges]);

  /** Rebuild the clone set from the current slides and re-anchor mid-strip. */
  const setup = useCallback(() => {
    const el = trackRef.current;
    const host = cloneHostRef.current;
    if (!el || !host) return;

    host.innerHTML = '';
    const originals = (Array.from(el.children) as HTMLElement[]).filter((n) => n !== host);

    if (!loop || originals.length === 0) {
      setLoopReady(false);
      updateEdges();
      return;
    }

    originals.forEach((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      // Clones are visual repeats only — keep them out of the tab order.
      clone
        .querySelectorAll<HTMLElement>('button, a[href], [tabindex]')
        .forEach((focusable) => focusable.setAttribute('tabindex', '-1'));
      host.appendChild(clone);
    });

    const first = originals[0];
    const firstClone = host.firstElementChild as HTMLElement | null;
    const delta = firstClone ? firstClone.offsetLeft - first.offsetLeft : 0;
    const max = el.scrollWidth - el.clientWidth;

    if (delta > 0 && max >= delta + 300) {
      el.scrollLeft = delta; // start one set in: both directions can repeat
      setLoopReady(true);
    } else {
      // Viewport wider than one full set — no room for a seamless repeat.
      host.innerHTML = '';
      el.scrollLeft = 0;
      setLoopReady(false);
      updateEdges();
    }
  }, [loop, updateEdges]);

  useEffect(() => {
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, ...deps]);

  // Re-anchor when the viewport changes (debounced).
  useEffect(() => {
    if (!loop) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setup(), 180);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (t) clearTimeout(t);
    };
  }, [loop, setup]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 24;
    const step = first ? first.offsetWidth + gap : el.clientWidth * 0.85;
    const reduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';

    const m = loopReady ? metrics() : null;
    if (m && m.delta > 0) {
      // Pre-emptive re-base: keep the glide inside the strip.
      if (direction > 0 && el.scrollLeft + step > m.max - 150 && el.scrollLeft > m.delta) {
        el.scrollLeft -= m.delta;
      } else if (direction < 0 && el.scrollLeft - step < 150 && el.scrollLeft + m.delta <= m.max) {
        el.scrollLeft += m.delta;
      }
      smoothRef.current = behavior === 'smooth';
      el.scrollBy({ left: direction * step, behavior });
      if (smoothRef.current) {
        window.setTimeout(() => {
          smoothRef.current = false;
          rebase();
        }, 750);
      }
      return;
    }

    el.scrollBy({ left: direction * step, behavior });
  };

  /** Delegate clicks from cloned slides back by index (no React handlers there). */
  const onCloneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = cloneHostRef.current;
    if (!host || !onItemActivate) return;
    const target = e.target as HTMLElement;
    if (!target.closest('button')) return;
    const index = Array.from(host.children).findIndex((slide) => slide.contains(target));
    if (index >= 0) onItemActivate(index);
  };

  return (
    <div className={wrapperClassName}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className={`scrollbar-none flex snap-x snap-mandatory overflow-x-auto md:snap-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage ${trackClassName}`}
      >
        {children}
        {/* Clone host — display:contents keeps the clones as direct flex items */}
        <div ref={cloneHostRef} aria-hidden="true" className="contents" onClick={onCloneClick} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={!loopReady && atStart}
          aria-label="Previous cards"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mint bg-surface-raised text-pine transition-colors duration-200 hover:border-sage hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!loopReady && atEnd}
          aria-label="Next cards"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mint bg-surface-raised text-pine transition-colors duration-200 hover:border-sage hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
