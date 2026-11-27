'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { BookingRequest, BookingStatus } from '@/lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
} from '@/lib/booking';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { AlertCircle, Clock } from 'lucide-react';
import { SocialLinksList } from '@/components/SocialLinksList';
import {
  BookingStatusTag,
  Button,
  Card,
  Modal,
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

function PreferredScheduleList({
  slots,
  emptyMessage,
}: {
  slots: ReturnType<typeof clientPreferredSlots>;
  emptyMessage: string;
}) {
  if (slots.length === 0) {
    return <p className="text-xs text-pine/60">{emptyMessage}</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {slots.map((slot, index) => (
        <div key={slot.id} className="rounded-lg border border-mist bg-surface-sunken/40 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-pine/50">
            Option {index + 1}
          </p>
          <p className="text-xs font-medium text-pine">{slot.dateLabel}</p>
          <p className="text-xs text-pine/70">{slot.timeLabel}</p>
        </div>
      ))}
    </div>
  );
}

export default function ClientBookingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const publishFlowEvent = useAppStore((s) => s.publishFlowEvent);
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [cancelTarget, setCancelTarget] = useState<BookingRequest | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => api.cancelBooking(bookingId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCancelError(null);
      setCancelTarget(null);
      publishFlowEvent(
        'Booking Cancelled',
        `Booking ${updated.id} has been marked as cancelled.`
      );
    },
    onError: (err) => {
      setCancelError(
        getFriendlyErrorMessage(
          err,
          'We could not cancel this booking right now. Please try again.'
        )
      );
    },
  });

  const actionNeeded = bookings.filter(
    (b) => b.status === 'awaiting-client' || b.status === 'awaiting-payment'
  );
  const firstAction = actionNeeded[0];
  const filteredBookings =
    statusFilter === 'all'
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-medium text-pine">
            My Bookings
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Track your session requests from psychologist matching and scheduling through payment
            and completion. Your details remain private and all times are shown in{' '}
            <strong className="font-semibold text-pine">Philippine Time (PHT, GMT+8)</strong>.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/book')}
        >
          + Request a Session
        </Button>
      </header>

      {/* Action banner */}
      {firstAction && (
        <div className="bg-lime-soft/25 border border-lime-soft/60 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
            {firstAction.status === 'awaiting-payment' ? 'Complete Payment' : 'Review Suggested Time'}
          </Button>
        </div>
      )}

      {/* Interactive Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Filter bookings by status"
          className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist"
        >
          {FILTER_TABS.map((tab) => {
            const count =
              tab.id === 'all'
                ? bookings.length
                : bookings.filter((b) => b.status === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                    : 'text-pine/70 hover:text-pine'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <span className="text-xs text-pine/65">
          Your psychologist&apos;s contact details unlock automatically once payment is confirmed.
        </span>
      </div>

      {/* Error Banner */}
      {bookingsError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900"
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

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-44" />
          ))}
        </div>
      ) : bookingsError && bookings.length === 0 ? null : filteredBookings.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <p className="font-heading text-2xl font-medium text-pine">
            No Bookings Matching Selected Status
          </p>
          <p className="text-sm text-pine/75 max-w-md mx-auto">
            Start a new booking under a Self or Dependent profile, or switch the filter above
            to view all existing bookings.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
              Reset Filter
            </Button>
            <Button variant="primary" size="sm" onClick={() => router.push('/book')}>
              Start Booking
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredBookings.map((booking) => {
            const chosenSlot = agreedSlot(booking);
            const preferred = clientPreferredSlots(booking);
            const counter = psychologistCounterSlot(booking);
            const canCancel = [
              'pending',
              'awaiting-review',
              'awaiting-client',
              'awaiting-payment',
            ].includes(booking.status);

            return (
              <Card key={booking.id} className="space-y-5">
                {/* Top Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist/70 pb-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-pine/75">
                    <span className="font-mono font-medium text-pine tabular-nums">
                      {booking.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Profile: {booking.profileLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>Submitted {booking.submittedAt}</span>
                  </div>

                  <BookingStatusTag status={booking.status} />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="font-heading text-2xl font-medium text-pine">
                        {booking.serviceTitle}
                      </h2>
                      <span className="font-mono text-xs font-semibold text-accent-ink tabular-nums shrink-0">
                        Duration: {booking.serviceDuration}
                      </span>
                    </div>

                    <p className="text-xs text-accent-ink font-medium">
                      Session note: {booking.serviceGuardrail}
                    </p>

                    <p className="text-sm text-pine/85 leading-relaxed">
                      {booking.concernsSummary}
                    </p>

                    {(booking.status === 'pending' ||
                      booking.status === 'awaiting-review') && (
                      <div className="space-y-2 border-t border-mist/60 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          Your preferred times (PHT)
                        </p>
                        <PreferredScheduleList
                          slots={preferred}
                          emptyMessage="No preferred times were saved for this request."
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Status Panel */}
                  <div className="lg:col-span-5">
                    {booking.status === 'pending' && (
                      <div className="p-4 rounded-lg bg-parchment border border-dashed border-mint/50 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-900">
                          <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                          <span>Waiting for a psychologist</span>
                        </div>
                        <p className="text-xs text-pine/80 leading-relaxed">
                          Verified psychologists are reviewing your request and preferred times.
                          You won&apos;t be charged until you agree on a schedule together.
                        </p>
                      </div>
                    )}

                    {booking.status === 'awaiting-review' && (
                      <div className="p-4 rounded-lg bg-surface-raised border border-mist space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-pine">
                            Assigned to {booking.psychologistCode}
                          </span>
                          <span className="font-mono font-medium text-pine tabular-nums">
                            Fee: ₱{booking.pricePhp?.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-pine/80">
                          Your psychologist is reviewing your preferred times. We&apos;ll notify you
                          as soon as they confirm a slot or suggest an alternative.
                        </p>
                        <PreferredScheduleList
                          slots={preferred}
                          emptyMessage="No preferred times were saved for this request."
                        />
                      </div>
                    )}

                    {booking.status === 'awaiting-client' && counter && (
                      <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200 space-y-3">
                        <p className="text-xs font-semibold text-amber-900">
                          Alternative Time Offered
                        </p>
                        <div className="p-2.5 rounded-lg bg-surface-raised border border-mist text-xs">
                          <p className="font-semibold text-pine">{counter.dateLabel}</p>
                          <p className="font-mono text-accent-ink tabular-nums">
                            {counter.timeLabel}
                          </p>
                        </div>
                        <p className="text-xs text-pine/80">
                          Accept this time to move to payment, or propose new preferred schedules.
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() => router.push(`/proposal/${booking.id}`)}
                        >
                          Review &amp; Respond
                        </Button>
                      </div>
                    )}

                    {booking.status === 'awaiting-payment' && (
                      <div className="p-4 rounded-lg bg-surface-raised border border-mist space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-pine">
                            Agreed with {booking.psychologistCode}
                          </span>
                          <span className="font-mono font-medium text-pine tabular-nums">
                            Fee: ₱{booking.pricePhp?.toLocaleString()}
                          </span>
                        </div>
                        {chosenSlot && (
                          <div className="p-2.5 rounded-lg bg-surface-raised border border-mist text-xs">
                            <p className="font-semibold text-pine">{chosenSlot.dateLabel}</p>
                            <p className="font-mono text-accent-ink tabular-nums">
                              {chosenSlot.timeLabel}
                            </p>
                          </div>
                        )}
                        {booking.paymentDeadline && (
                          <p className="text-xs text-pine/80">
                            Pay by{' '}
                            <strong className="text-pine">
                              {formatManilaDateTime(booking.paymentDeadline)} PHT
                            </strong>{' '}
                            · {formatDeadlineCountdown(booking.paymentDeadline)}
                          </p>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() => router.push(`/proposal/${booking.id}`)}
                        >
                          Pay Now
                        </Button>
                      </div>
                    )}

                    {(booking.status === 'paid-confirmed' ||
                      booking.status === 'completed' ||
                      booking.status === 'reschedule-requested') && (
                      <div className="p-4 rounded-lg bg-surface-raised border border-mist space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-pine">
                            {booking.status === 'completed'
                              ? `Completed with ${booking.psychologistCode}`
                              : `Confirmed with ${booking.psychologistCode}`}
                          </span>
                          <span className="font-mono font-semibold text-accent-ink tabular-nums">
                            Paid ₱{booking.pricePhp?.toLocaleString()}
                          </span>
                        </div>

                        {chosenSlot && (
                          <div className="p-2.5 rounded-lg bg-surface-raised border border-mist text-xs">
                            <p className="font-semibold text-pine">
                              Agreed Schedule: {chosenSlot.dateLabel}
                            </p>
                            <p className="font-mono text-accent-ink tabular-nums">
                              {chosenSlot.timeLabel}
                            </p>
                          </div>
                        )}

                        {booking.contactUnlocked && (
                          <div className="space-y-2 text-xs bg-surface-raised p-3 rounded-lg border border-mist">
                            <p className="font-bold text-pine">
                              How to reach your psychologist:
                            </p>
                            <p className="text-pine/75">
                              Connect using any link below to coordinate your session.
                            </p>
                            <SocialLinksList
                              links={booking.psychologistSocialLinks}
                              emptyMessage="Your psychologist has not added contact links yet."
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {booking.status === 'cancelled' && (
                      <div className="p-4 rounded-lg bg-red-50/60 border border-red-200 text-xs text-red-900 space-y-1">
                        <p className="font-bold">Session Cancelled</p>
                        <p>This session request has been cancelled. You can submit a new request anytime.</p>
                      </div>
                    )}

                    {canCancel && (
                      <div className="pt-2 mt-2 border-t border-mist flex items-center justify-end text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setCancelError(null);
                            setCancelTarget(booking);
                          }}
                          disabled={cancelMutation.isPending}
                          className="underline text-red-700 hover:text-red-900 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                        >
                          Cancel request
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Booking Confirmation Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => {
          if (!cancelMutation.isPending) {
            setCancelTarget(null);
            setCancelError(null);
          }
        }}
        title="Cancel this booking request?"
        description={
          cancelTarget
            ? `${cancelTarget.serviceTitle} (${cancelTarget.id})`
            : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setCancelTarget(null);
                setCancelError(null);
              }}
              disabled={cancelMutation.isPending}
            >
              Keep Booking
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate(cancelTarget.id);
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel Request'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-pine/85">
          <p>
            If you cancel now, this request will be closed and any held or preferred schedule
            slots will be released. You can always submit a new booking request whenever
            you&apos;re ready.
          </p>
          {cancelError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
            >
              {cancelError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
