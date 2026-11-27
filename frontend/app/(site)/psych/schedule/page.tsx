'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  CalendarDays,
  ChevronRight,
  List,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { useActivePsychologist } from '@/hooks/useActivePsychologist';
import type { BookingRequest } from '@/lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  psychologistCounterSlot,
  sortBookingsNewestFirst,
} from '@/lib/booking';
import {
  BookingStatusTag,
  Button,
  EmptyState,
  Select,
  Skeleton,
} from '@/components/ui/primitives';

type ScheduleTab =
  | 'upcoming'
  | 'past'
  | 'negotiating'
  | 'awaiting-payment'
  | 'all';

function parseSlotDate(isoString?: string): Date | null {
  if (!isoString) return null;
  const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(isoString);
  const normalized = hasTimezone ? isoString : `${isoString}+08:00`;
  const slotDate = new Date(normalized);
  return Number.isNaN(slotDate.getTime()) ? null : slotDate;
}

function CompactScheduleCell({ session }: { session: BookingRequest }) {
  const chosenSlot = agreedSlot(session);
  const preferred = clientPreferredSlots(session);
  const counter = psychologistCounterSlot(session);

  if (
    chosenSlot &&
    (session.status === 'awaiting-payment' ||
      session.status === 'paid-confirmed' ||
      session.status === 'completed' ||
      session.status === 'reschedule-requested')
  ) {
    return (
      <div className="space-y-0.5 whitespace-nowrap">
        <span className="block text-xs font-medium text-pine tabular-nums">
          {chosenSlot.dateLabel}
        </span>
        <span className="block font-mono text-[11px] text-pine/65 tabular-nums">
          {chosenSlot.timeLabel}
        </span>
      </div>
    );
  }

  if (session.status === 'awaiting-client' && counter) {
    return (
      <span className="text-xs font-semibold text-amber-900 tabular-nums whitespace-nowrap">
        Offered: {counter.dateLabel}
      </span>
    );
  }

  if (preferred.length > 0) {
    return (
      <span className="text-xs text-pine/80 tabular-nums whitespace-nowrap">
        {preferred[0].dateLabel}
      </span>
    );
  }

  return <span className="text-xs text-pine/45">—</span>;
}

export default function PsychologistSchedulePage() {
  const router = useRouter();
  const { activePsych } = useActivePsychologist();
  const [activeTab, setActiveTab] = useState<ScheduleTab>('upcoming');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const {
    data: bookings = [],
    isLoading,
    error: bookingsError,
    refetch: refetchBookings,
    isFetching: isRefetchingBookings,
  } = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  // getBookingsForRole('psychologist') also returns the open pending queue.
  // This page only owns requests already claimed by this psychologist, newest first.
  const myAssignedSessions = useMemo(
    () => sortBookingsNewestFirst(bookings.filter((session) => session.psychologistId)),
    [bookings]
  );

  const categorizedSessions = useMemo(() => {
    const upcoming: BookingRequest[] = [];
    const past: BookingRequest[] = [];
    const negotiating: BookingRequest[] = [];
    const awaitingPayment: BookingRequest[] = [];

    const isSlotPast = (isoString?: string) => {
      const slotDate = parseSlotDate(isoString);
      return slotDate !== null && slotDate.getTime() < currentTime;
    };

    myAssignedSessions.forEach((session) => {
      if (
        session.status === 'completed' ||
        session.status === 'partially-refunded' ||
        session.status === 'refunded'
      ) {
        past.push(session);
      } else if (session.status === 'paid-confirmed') {
        const confirmedSlot = agreedSlot(session);
        if (confirmedSlot && isSlotPast(confirmedSlot.isoDateTime)) {
          past.push(session);
        } else {
          upcoming.push(session);
        }
      } else if (session.status === 'awaiting-payment') {
        awaitingPayment.push(session);
      } else if (
        session.status === 'awaiting-review' ||
        session.status === 'awaiting-client' ||
        session.status === 'reschedule-requested' ||
        session.status === 'no-show'
      ) {
        negotiating.push(session);
      }
    });

    return {
      upcoming,
      past,
      negotiating,
      awaitingPayment,
      all: myAssignedSessions,
    };
  }, [myAssignedSessions, currentTime]);

  const displayedSessions =
    activeTab === 'awaiting-payment'
      ? categorizedSessions.awaitingPayment
      : activeTab === 'negotiating'
        ? categorizedSessions.negotiating
        : activeTab === 'upcoming'
          ? categorizedSessions.upcoming
          : activeTab === 'past'
            ? categorizedSessions.past
            : categorizedSessions.all;

  const emptyTitle =
    (activeTab === 'upcoming' && 'No Upcoming Confirmed Sessions') ||
    (activeTab === 'past' && 'No Past Sessions Recorded') ||
    (activeTab === 'negotiating' && 'No Active Schedule Negotiations') ||
    (activeTab === 'awaiting-payment' && 'No Agreed Sessions Awaiting Payment') ||
    'No Sessions Assigned to this Account Yet';

  const emptyDescription =
    (activeTab === 'upcoming' &&
      'When a client pays for an agreed schedule, the confirmed session appears here.') ||
    (activeTab === 'past' &&
      'Completed or past appointments will be cataloged in this archive view.') ||
    (activeTab === 'negotiating' &&
      'Requests waiting on your review or the client’s response appear here.') ||
    (activeTab === 'awaiting-payment' &&
      'Agreed schedules stay here until the client pays or the payment deadline releases the slot.') ||
    'Visit the Pending Requests queue to pick up new bookings and agree on schedules.';

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-mist pb-5">
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
          My Practice Schedule
        </h1>

        <nav
          aria-label="Schedule views"
          className="inline-flex items-center rounded-full border border-mist bg-surface-sunken p-1 self-start sm:self-auto"
        >
          <Link
            href="/psych/schedule"
            aria-current="page"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-pine shadow-field"
          >
            <List className="w-3.5 h-3.5" aria-hidden="true" />
            Sessions
          </Link>
          <Link
            href="/psych/schedule/calendar"
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            Calendar
          </Link>
        </nav>
      </header>

      {bookingsError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Could not load your schedule.</p>
              <p className="mt-1 break-words text-red-800">
                {getFriendlyErrorMessage(
                  bookingsError,
                  'Something went wrong while loading your schedule. Please try again.'
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchBookings()}
            disabled={isRefetchingBookings}
            className="shrink-0"
          >
            {isRefetchingBookings ? 'Retrying…' : 'Try Again'}
          </Button>
        </div>
      )}

      {/* Schedule Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="w-full sm:w-72">
          <Select
            id="schedule-status-filter"
            aria-label="Filter schedule sessions"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as ScheduleTab)}
          >
            <option value="upcoming">
              Upcoming Confirmed ({categorizedSessions.upcoming.length})
            </option>
            <option value="negotiating">
              In Negotiation ({categorizedSessions.negotiating.length})
            </option>
            <option value="awaiting-payment">
              Awaiting Client Payment ({categorizedSessions.awaitingPayment.length})
            </option>
            <option value="past">
              Past Confirmed ({categorizedSessions.past.length})
            </option>
            <option value="all">
              All Assigned ({categorizedSessions.all.length})
            </option>
          </Select>
        </div>

        <div className="text-xs text-pine/70 font-mono">
          Psychologist:{' '}
          <span className="font-semibold text-accent-ink">
            {activePsych?.anonymizedTitle ?? 'Authenticated psychologist'}
          </span>
        </div>
      </div>

      {/* Schedule Table */}
      {bookingsError && myAssignedSessions.length === 0 ? null : (
        <div className="rounded-2xl border border-mist bg-surface-raised overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <caption className="sr-only">
                Your assigned schedule sessions sorted newest first. Select a row to view full
                session details and actions.
              </caption>
              <thead>
                <tr className="border-b border-mist bg-parchment text-pine/70">
                  <th scope="col" className="py-3 pl-5 pr-4 font-semibold">
                    Client &amp; Service
                  </th>
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Schedule
                  </th>
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    aria-sort="descending"
                    className="py-3 pl-4 pr-5 font-semibold whitespace-nowrap text-right"
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      Submitted
                      <ArrowDown className="w-3 h-3 text-pine/60" aria-hidden="true" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={4} className="py-3.5 px-5">
                        <Skeleton className="h-9" />
                      </td>
                    </tr>
                  ))
                ) : displayedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={CalendarDays}
                        title={emptyTitle}
                        description={emptyDescription}
                        action={
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => router.push('/psych/queue')}
                          >
                            Open Pending Requests Queue
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  displayedSessions.map((session) => {
                    const detailHref = `/psych/schedule/${encodeURIComponent(session.id)}`;
                    return (
                      <tr
                        key={session.id}
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest('a, button')) return;
                          if (window.getSelection()?.toString()) return;
                          router.push(detailHref);
                        }}
                        className="group transition-colors duration-150 cursor-pointer hover:bg-parchment"
                      >
                        <td className="py-4 pl-5 pr-4 align-middle">
                          <Link
                            href={detailHref}
                            className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
                          >
                            <span className="block text-sm font-medium text-pine group-hover:text-accent-ink transition-colors duration-150">
                              {session.serviceTitle}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-pine/65">
                              <span>{session.profileLabel}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wide bg-surface-sunken text-accent-ink border border-mist/70">
                                {session.profileType}
                              </span>
                            </span>
                          </Link>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <CompactScheduleCell session={session} />
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <BookingStatusTag status={session.status} perspective="psychologist" />
                        </td>

                        <td className="py-4 pl-4 pr-5 align-middle text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-3">
                            <span className="font-mono text-xs text-pine/70 tabular-nums">
                              {session.submittedAt}
                            </span>
                            <ChevronRight
                              className="w-4 h-4 text-pine/40 group-hover:text-accent-ink group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                              aria-hidden="true"
                            />
                          </div>
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
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : displayedSessions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={emptyTitle}
                description={emptyDescription}
                action={
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/psych/queue')}
                  >
                    Open Pending Requests Queue
                  </Button>
                }
              />
            ) : (
              displayedSessions.map((session) => {
                const detailHref = `/psych/schedule/${encodeURIComponent(session.id)}`;
                return (
                  <Link
                    key={session.id}
                    href={detailHref}
                    className="group flex items-center justify-between gap-3 p-4 hover:bg-parchment transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div>
                        <p className="text-sm font-medium text-pine group-hover:text-accent-ink transition-colors duration-150 truncate">
                          {session.serviceTitle}
                        </p>
                        <p className="text-xs text-pine/65 mt-0.5">
                          {session.profileLabel} ·{' '}
                          <span className="font-mono tabular-nums">{session.submittedAt}</span>
                        </p>
                      </div>
                      <BookingStatusTag status={session.status} perspective="psychologist" />
                    </div>

                    <ChevronRight
                      className="w-4 h-4 text-pine/40 group-hover:text-accent-ink group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
