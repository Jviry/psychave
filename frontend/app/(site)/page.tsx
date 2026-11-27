'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card, CircleArrow } from '@/components/ui/primitives';
import { AboutGrid } from '@/components/AboutGrid';
import { ScrollCarousel } from '@/components/ScrollCarousel';
import { TestimonialsConsentSection } from '@/components/TestimonialsConsentSection';
import { ServiceItem } from '@/lib/types';

/** Brand-scheme solids (spec palette), rotated across the services cards. */
const SERVICE_TINTS: Array<'sage' | 'mint' | 'lime' | 'mist'> = [
  'sage',
  'mint',
  'lime',
  'mist',
  'sage',
  'mint',
  'lime',
];

export default function HomePage() {
  const router = useRouter();
  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const handleBookSessionClick = () => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }
    if (user.role === 'admin') {
      router.push('/admin/users');
    } else if (user.role === 'psychologist') {
      router.push('/psych/queue');
    } else {
      router.push('/bookings');
    }
  };

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getPublicServices(),
  });

  const { data: cms } = useQuery({
    queryKey: ['cms'],
    queryFn: () => api.getCmsContent(),
  });

  const { data: publicRoster = [] } = useQuery({
    queryKey: ['roster', 'public'],
    queryFn: () => api.getRoster(false),
  });

  const selectService = (srv?: ServiceItem) => {
    if (!srv) return;
    updateBookingDraft({ serviceId: srv.id });
    router.push('/book');
  };

  return (
    <div id="top" className="space-y-28 lg:space-y-32">
      {/* Hero — centered brand mark with concentric rings */}
      <section className="relative flex min-h-[calc(100svh-9rem)] items-center justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-80 w-80 rounded-full border border-mint/40 sm:h-[26rem] sm:w-[26rem]" />
          <div className="absolute h-[26rem] w-[26rem] rounded-full border border-mint/25 sm:h-[38rem] sm:w-[38rem]" />
        </div>

        <div className="relative mx-auto max-w-4xl space-y-8 text-center">
          <h1 className="sr-only">PSYCHAVE PH — PRC-verified mental health care in the Philippines</h1>
          <img
            src="/psychave-logo.png"
            alt="PSYCHAVE PH"
            width={1024}
            height={720}
            className="mx-auto h-auto w-64 sm:w-72 lg:w-80"
          />

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-pine/80 sm:text-lg">
            Verified psychologists, transparent fees, and three proposed time slots.
          </p>

          <div className="flex flex-wrap items-center justify-center pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={handleBookSessionClick}
            >
              Book a session
            </Button>
          </div>
        </div>
      </section>

      {/* Services — infinite carousel aligned with page container */}
      <section id="services" className="scroll-mt-24 space-y-6 lg:space-y-8">
        <div className="text-center">
          <h2 className="font-heading text-4xl font-semibold tracking-tight text-pine sm:text-5xl">
            Clinical &amp; Advisory Services Directory
          </h2>
        </div>

        <ScrollCarousel
          ariaLabel="Clinical and advisory services cards"
          trackClassName="gap-4 pb-3 pt-1"
          loop
          onItemActivate={(index) => selectService(services[index])}
          deps={[services.length]}
        >
          {services.map((srv, index) => {
            const tint = SERVICE_TINTS[index % SERVICE_TINTS.length];
            return (
              <div
                key={srv.id}
                className="flex min-h-[28rem] w-[19rem] shrink-0 snap-start sm:min-h-[30rem] sm:w-[21rem] lg:min-h-[32rem] lg:w-[22rem]"
              >
                <Card
                  tint={tint}
                  className="flex h-full w-full flex-col p-8 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <button
                    type="button"
                    onClick={() => selectService(srv)}
                    className="group flex h-full w-full flex-1 flex-col justify-between gap-12 rounded-lg text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold opacity-80">
                        <span>{srv.durationLabel}</span>
                        {srv.rateLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{srv.rateLabel}</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                        {srv.title}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div aria-hidden="true" className="h-px w-full bg-current opacity-20" />
                      <div className="flex min-h-[4.5rem] items-end justify-between gap-6">
                        <p className="line-clamp-3 text-base leading-relaxed opacity-85">
                          {srv.description}
                        </p>
                        <CircleArrow tone={tint === 'sage' ? 'light' : 'dark'} />
                      </div>
                    </div>
                  </button>
                </Card>
              </div>
            );
          })}
        </ScrollCarousel>
      </section>

      {/* About — staggered mosaic */}
      <section id="about" className="scroll-mt-24">
        <AboutGrid cms={cms} roster={publicRoster} />
      </section>

      {/* Consent governance — keeps the ra-10173-consent anchor used by /register */}
      {cms && <TestimonialsConsentSection cms={cms} />}
    </div>
  );
}
