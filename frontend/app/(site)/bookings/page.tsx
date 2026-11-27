'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { BookingRequest, BookingStatus } from '@/lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
  sortBookingsNewestFirst,
} from '@/lib/booking';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import {
  AlertCircle,
  ArrowDown,
  Calendar,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  BookingStatusTag,
  Button,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives';

const FILTER_TABS: { id: 'all' | BookingStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Waiting' },
  { id: 'awaiting-review', label: 'In Review' },
  { id: 'awaiting-client', label: 'Action Needed' },
  { id: 'awaiting-payment', label: 'Payment Due' },
  { id: 'paid-confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function CompactScheduleCell({ booking }: { booking: BookingRequest }) {
  const chosenSlot = agreedSlot(booking);
  const preferred = clientPreferredSlots(booking);
  const counter = psychologistCounterSlot(booking);

  if (
    chosenSlot &&
    (booking.status === 'awaiting-payment' ||
      booking.status === 'paid-confirmed' ||
      booking.status === 'completed' ||
      booking.status === 'reschedule-requested')
  ) {
    return (
      <span className="text-xs font-medium text-pine tabular-nums whitespace-nowrap">
        {chosenSlot.dateLabel}
      </span>
    );
  }

  if (booking.status === 'awaiting-client' && counter) {
    return (
      <span className="text-xs font-semibold text-amber-900 tabular-nums whitespace-nowrap">
        Suggested: {counter.dateLabel}
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

export default function ClientBookingsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');

  const {
    data: bookings = [],
    isLoading,
    error: bookingsError,
    refetch: refetchBookings,
    isFetching: isRefetchingBookings,
  } = useQuery({
    queryKey: ['bookings', 'client'],
    queryFn: () => api.getBookingsForRole('client'),
  });

  const sortedBookings = useMemo(
    () => sortBookingsNewestFirst(bookings),
    [bookings]
  );

  const actionNeeded = useMemo(
    () =>
      sortedBookings.filter(
        (b) => b.status === 'awaiting-client' || b.status === 'awaiting-payment'
      ),
    [sortedBookings]
  );
  const firstAction = actionNeeded[0];

  const filteredBookings = useMemo(
    () =>
      statusFilter === 'all'
        ? sortedBookings
        : sortedBookings.filter((b) => b.status === statusFilter),
    [sortedBookings, statusFilter]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-mist pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
              My Bookings
            </h1>
            {!isLoading && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold tabular-nums rounded-full bg-surface-sunken border border-mist text-pine">
                {sortedBookings.length}{' '}
                {sortedBookings.length === 1 ? 'booking' : 'bookings'}
              </span>
            )}
          </div>
          <p className="text-sm text-pine/75 max-w-2xl">
            Select any booking to view full schedule options, session notes, payment details, or
            psychologist contact links. All times are in{' '}
            <strong className="font-semibold text-pine">Philippine Time (PHT, GMT+8)</strong>.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/book')}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Request a Session
        </Button>
      </header>

      {/* Action banner */}
      {firstAction && (
        <div className="bg-lime-soft/25 border border-lime-soft/60 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-pine">
              {firstAction.status === 'awaiting-payment'
                ? 'Payment due · Your session time is reserved'
                : 'New time suggested · Please respond'}
            </p>
            <p className="text-sm text-pine/90">
              You have <strong>{actionNeeded.length}</strong>{' '}
              {actionNeeded.length === 1 ? 'session request' : 'session requests'} waiting for your
              response.
              {firstAction.status === 'awaiting-payment' && firstAction.paymentDeadline
                ? ` Please complete payment before ${formatManilaDateTime(firstAction.paymentDeadline)} PHT (${formatDeadlineCountdown(firstAction.paymentDeadline)}) to keep your slot.`
                : ' Review the psychologist’s suggested time or share new preferred times.'}
            </p>
          </div>
          <Button
            variant="dark"
            size="md"
            onClick={() => router.push(`/proposal/${firstAction.id}`)}
          >
            {firstAction.status === 'awaiting-payment'
              ? 'Complete Payment'
              : 'Review Suggested Time'}
          </Button>
        </div>
      )}

      {/* Interactive Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter bookings by status"
          className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist"
        >
          {FILTER_TABS.map((tab) => {
            const count =
              tab.id === 'all'
                ? sortedBookings.length
                : sortedBookings.filter((b) => b.status === tab.id).length;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sage ${
                  isActive
                    ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                    : 'text-pine/70 hover:text-pine'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {bookingsError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">We couldn&apos;t load your bookings.</p>
              <p className="mt-0.5 text-red-800">
                {getFriendlyErrorMessage(
                  bookingsError,
                  'Something went wrong while fetching your booking history. Please try again.'
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

      {/* Bookings Table */}
      {bookingsError && sortedBookings.length === 0 ? null : (
        <div className="rounded-2xl border border-mist bg-surface-raised overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <caption className="sr-only">
                Your session booking requests sorted newest first. Select a row to view full
                booking details.
              </caption>
              <thead>
                <tr className="border-b border-mist bg-parchment text-pine/70">
                  <th scope="col" className="py-3 pl-5 pr-4 font-semibold">
                    Service
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
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={Calendar}
                        title={
                          statusFilter === 'all'
                            ? 'No bookings yet'
                            : 'No bookings matching selected status'
                        }
                        description={
                          statusFilter === 'all'
                            ? 'Start a new session request under a Self or Dependent profile to get matched with a licensed psychologist.'
                            : 'Switch the filter above to view your other bookings, or submit a new session request.'
                        }
                        action={
                          <div className="flex flex-wrap justify-center gap-2">
                            {statusFilter !== 'all' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setStatusFilter('all')}
                              >
                                Reset Filter
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => router.push('/book')}
                            >
                              Start Booking
                            </Button>
                          </div>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest('a, button')) return;
                        if (window.getSelection()?.toString()) return;
                        router.push(`/bookings/${booking.id}`);
                      }}
                      className="group transition-colors duration-150 cursor-pointer hover:bg-parchment"
                    >
                      {/* Service */}
                      <td className="py-4 pl-5 pr-4 align-middle">
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
                        >
                          <span className="block text-sm font-medium text-pine group-hover:text-accent-ink transition-colors duration-150">
                            {booking.serviceTitle}
                          </span>
                          <span className="block mt-0.5 text-xs text-pine/65">
                            {booking.profileLabel}
                          </span>
                        </Link>
                      </td>

                      {/* Schedule */}
                      <td className="py-4 px-4 align-middle">
                        <CompactScheduleCell booking={booking} />
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-middle">
                        <BookingStatusTag status={booking.status} />
                      </td>

                      {/* Submitted + Row affordance */}
                      <td className="py-4 pl-4 pr-5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-3">
                          <span className="font-mono text-xs text-pine/70 tabular-nums">
                            {booking.submittedAt}
                          </span>
                          <ChevronRight
                            className="w-4 h-4 text-pine/40 group-hover:text-accent-ink group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
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
            ) : filteredBookings.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={
                  statusFilter === 'all'
                    ? 'No bookings yet'
                    : 'No bookings matching selected status'
                }
                description={
                  statusFilter === 'all'
                    ? 'Start a new session request under a Self or Dependent profile.'
                    : 'Switch the filter above to view all existing bookings.'
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {statusFilter !== 'all' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                      >
                        Reset Filter
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => router.push('/book')}
                    >
                      Start Booking
                    </Button>
                  </div>
                }
              />
            ) : (
              filteredBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className="group flex items-center justify-between gap-3 p-4 hover:bg-parchment transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div>
                      <p className="text-sm font-medium text-pine group-hover:text-accent-ink transition-colors duration-150 truncate">
                        {booking.serviceTitle}
                      </p>
                      <p className="text-xs text-pine/65 mt-0.5">
                        {booking.profileLabel} ·{' '}
                        <span className="font-mono tabular-nums">{booking.submittedAt}</span>
                      </p>
                    </div>
                    <BookingStatusTag status={booking.status} />
                  </div>

                  <ChevronRight
                    className="w-4 h-4 text-pine/40 group-hover:text-accent-ink group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
