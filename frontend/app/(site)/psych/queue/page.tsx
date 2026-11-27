'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { useActivePsychologist } from '@/hooks/useActivePsychologist';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives';

export default function PsychologistQueuePage() {
  const router = useRouter();
  const { activePsych } = useActivePsychologist();

  const hasSocialLinks = (activePsych?.socialMediaLinks?.length ?? 0) > 0;

  const {
    data: bookings = [],
    isLoading,
    refetch,
    isFetching: isRefetchingBookings,
    error: bookingsError,
  } = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  const pendingQueue = bookings.filter((b) => b.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-mist pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
              Pending Booking Requests
            </h1>
            {!isLoading && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold tabular-nums rounded-full bg-surface-sunken border border-mist text-pine">
                {pendingQueue.length} {pendingQueue.length === 1 ? 'request' : 'requests'}
              </span>
            )}
          </div>
          <p className="text-sm text-pine/75 max-w-2xl">
            Select a booking request to review the client&apos;s full intake profile, preferred
            schedules, and claim the session.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetchingBookings}
          className="self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefetchingBookings ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isRefetchingBookings ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>

      {!hasSocialLinks && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="space-y-1">
            <p className="font-semibold">
              Add a social media link before claiming a booking.
            </p>
            <p className="text-amber-900/90 leading-relaxed">
              Confirmed clients receive your social media links as their contact channel. You can
              still inspect pending requests, but claiming is unlocked once a link is added.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/psych/profile')}
            className="shrink-0"
          >
            Update Profile
          </Button>
        </div>
      )}

      {bookingsError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Could not load pending bookings.</p>
              <p className="mt-0.5 break-words text-red-800">
                {getFriendlyErrorMessage(
                  bookingsError,
                  'Something went wrong while loading pending bookings. Please try again.'
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetchingBookings}
            className="shrink-0"
          >
            {isRefetchingBookings ? 'Retrying…' : 'Try Again'}
          </Button>
        </div>
      )}

      {/* Pending Bookings Table */}
      <div className="rounded-2xl border border-mist bg-surface-raised overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">
              Pending client booking requests awaiting psychologist review and claim
            </caption>
            <thead>
              <tr className="border-b border-mist bg-parchment text-pine/70">
                <th scope="col" className="py-3 px-5 font-semibold">
                  Client &amp; Profile
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Service
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Submitted
                </th>
                <th scope="col" className="py-3 px-5 font-semibold text-right">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={4} className="py-3.5 px-5">
                      <Skeleton className="h-10" />
                    </td>
                  </tr>
                ))
              ) : pendingQueue.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={CheckCircle2}
                      title="Pending Queue is All Clear"
                      description="All submitted client booking requests have been claimed and scheduled. View confirmed appointments in your schedule."
                      action={
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => router.push('/psych/schedule')}
                        >
                          Go to Schedule
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                pendingQueue.map((item) => {
                  const detailHref = `/psych/queue/${encodeURIComponent(item.id)}`;

                  return (
                    <tr
                      key={item.id}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest('a, button')) return;
                        router.push(detailHref);
                      }}
                      className="group hover:bg-parchment transition-colors duration-150 cursor-pointer"
                    >
                      <td className="py-4 px-5 align-middle">
                        <Link
                          href={detailHref}
                          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-pine group-hover:text-accent-ink transition-colors">
                              {item.profileLabel}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-surface-sunken text-accent-ink border border-mist/70">
                              {item.profileType}
                            </span>
                          </div>
                        </Link>
                      </td>

                      <td className="py-4 px-4 align-middle">
                        <p className="text-sm font-medium text-pine">{item.serviceTitle}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-pine/60 tabular-nums">
                          {item.serviceDuration}
                        </p>
                      </td>

                      <td className="py-4 px-4 align-middle font-mono text-pine/70 tabular-nums whitespace-nowrap">
                        {item.submittedAt}
                      </td>

                      <td className="py-4 px-5 align-middle text-right whitespace-nowrap">
                        <Link
                          href={detailHref}
                          aria-label={`View details for ${item.profileLabel} (${item.serviceTitle})`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink group-hover:text-pine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded-sm"
                        >
                          <span>View details</span>
                          <ChevronRight
                            className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-mist/60">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : pendingQueue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Pending Queue is All Clear"
              description="All submitted client booking requests have been claimed and scheduled."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/psych/schedule')}
                >
                  Go to Schedule
                </Button>
              }
            />
          ) : (
            pendingQueue.map((item) => {
              const detailHref = `/psych/queue/${encodeURIComponent(item.id)}`;
              return (
                <Link
                  key={item.id}
                  href={detailHref}
                  className="block p-4 hover:bg-parchment transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-pine truncate">
                          {item.profileLabel}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-surface-sunken text-accent-ink border border-mist/70">
                          {item.profileType}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-pine/85">{item.serviceTitle}</p>
                      <p className="text-[11px] font-mono text-pine/60 tabular-nums">
                        {item.serviceDuration}
                      </p>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 text-pine/45 shrink-0 mt-1"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-end text-[11px]">
                    <span className="font-mono text-pine/60 tabular-nums">{item.submittedAt}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
