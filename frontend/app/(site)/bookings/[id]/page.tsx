'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import { BookingStatus } from '@/lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
} from '@/lib/booking';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
} from 'lucide-react';
import { SocialLinksList } from '@/components/SocialLinksList';
import {
  Button,
  EmptyState,
  Modal,
  Skeleton,
} from '@/components/ui/primitives';

const CANCELLABLE_STATUSES: BookingStatus[] = [
  'pending',
  'awaiting-review',
  'awaiting-client',
  'awaiting-payment',
];

export default function ClientBookingDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const routeParams = useParams<{ id: string }>();
  const bookingId = routeParams.id || '';
  const publishFlowEvent = useAppStore((s) => s.publishFlowEvent);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const {
    data: booking,
    isLoading,
    error: bookingError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.getBookingById(bookingId),
    enabled: Boolean(bookingId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelBooking(bookingId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      setCancelError(null);
      setCancelModalOpen(false);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-36" />
        <div className="border-b border-mist pb-5 space-y-2.5">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-36" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (bookingError) {
    return (
      <div className="space-y-6">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to My Bookings
        </Link>

        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">We couldn&apos;t load this booking.</p>
              <p className="mt-0.5 text-red-800">
                {getFriendlyErrorMessage(
                  bookingError,
                  'Something went wrong while loading the booking details. Please try again.'
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0"
          >
            {isFetching ? 'Retrying…' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to My Bookings
        </Link>

        <div className="rounded-2xl border border-mist bg-surface-raised">
          <EmptyState
            icon={Calendar}
            title="Booking not found"
            description="We could not locate this booking record. It may belong to another account or no longer exist."
            action={
              <Button variant="primary" size="sm" onClick={() => router.push('/bookings')}>
                Return to My Bookings
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const chosenSlot = agreedSlot(booking);
  const preferredSlots = clientPreferredSlots(booking);
  const counterSlot = psychologistCounterSlot(booking);
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);
  const isPaid =
    booking.status === 'paid-confirmed' ||
    booking.status === 'completed' ||
    booking.status === 'reschedule-requested';
  const durationMinutesLabel =
    typeof booking.serviceDurationMinutes === 'number' &&
    booking.serviceDurationMinutes > 0
      ? `${booking.serviceDurationMinutes} mins`
      : booking.serviceDuration;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to My Bookings
        </Link>
      </nav>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-mist pb-5">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
            {booking.serviceTitle}
          </h1>
        </div>

        {(booking.status === 'awaiting-client' || booking.status === 'awaiting-payment') && (
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            {booking.status === 'awaiting-client' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push(`/proposal/${booking.id}`)}
              >
                Review &amp; Respond
              </Button>
            )}
            {booking.status === 'awaiting-payment' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push(`/proposal/${booking.id}`)}
              >
                Pay Now
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Session Details & Schedule */}
        <div className="lg:col-span-7 space-y-6">
          {/* Session Overview */}
          <section
            aria-labelledby="session-overview-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-5"
          >
            <h2
              id="session-overview-heading"
              className="font-heading text-xl font-medium text-pine"
            >
              Session Overview
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Profile
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-pine font-medium">
                  <span>{booking.profileLabel}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-surface-sunken text-accent-ink border border-mist/70">
                    {booking.profileType}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Psychologist
                </dt>
                <dd className="mt-1 text-pine font-medium">
                  {booking.psychologistCode || 'Pending assignment'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Duration
                </dt>
                <dd className="mt-1 font-mono text-xs text-pine tabular-nums">
                  {durationMinutesLabel}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Submitted
                </dt>
                <dd className="mt-1 font-mono text-xs text-pine tabular-nums">
                  {booking.submittedAt}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Session Fee
                </dt>
                <dd className="mt-1 flex items-center gap-2">
                  {booking.pricePhp != null ? (
                    <>
                      <span className="font-mono text-sm font-semibold text-pine tabular-nums">
                        ₱{booking.pricePhp.toLocaleString()}
                      </span>
                      {isPaid && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-surface-sunken text-accent-ink border border-mist/70">
                          Paid
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-pine/60">Set upon psychologist pickup</span>
                  )}
                </dd>
              </div>
            </dl>

            {booking.serviceGuardrail && (
              <div className="pt-4 border-t border-mist/60">
                <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Session Note
                </p>
                <p className="mt-1 text-sm text-accent-ink font-medium leading-relaxed">
                  {booking.serviceGuardrail}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-mist/60">
              <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Presenting Concerns
              </p>
              <p className="mt-1.5 text-sm text-pine/85 leading-relaxed max-w-prose">
                {booking.concernsSummary}
              </p>
            </div>
          </section>

          {/* Schedule Section */}
          <section
            aria-labelledby="schedule-section-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="schedule-section-heading"
                className="font-heading text-xl font-medium text-pine"
              >
                Schedule
              </h2>
              <span className="text-xs text-pine/60">Philippine Time (PHT, GMT+8)</span>
            </div>

            {chosenSlot &&
              (booking.status === 'awaiting-payment' ||
                booking.status === 'paid-confirmed' ||
                booking.status === 'completed' ||
                booking.status === 'reschedule-requested') && (
                <div className="rounded-xl border border-mist bg-parchment px-4 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
                    Agreed Schedule
                  </p>
                  <p className="text-sm font-semibold text-pine tabular-nums">
                    {chosenSlot.dateLabel}
                  </p>
                  <p className="text-xs font-mono text-accent-ink tabular-nums">
                    {chosenSlot.timeLabel}
                  </p>
                </div>
              )}

            {booking.status === 'awaiting-client' && counterSlot && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                  Alternative Time Offered
                </p>
                <p className="text-sm font-semibold text-pine tabular-nums">
                  {counterSlot.dateLabel}
                </p>
                <p className="text-xs font-mono text-amber-900 tabular-nums">
                  {counterSlot.timeLabel}
                </p>
              </div>
            )}

            {(booking.status === 'pending' ||
              booking.status === 'awaiting-review' ||
              booking.status === 'awaiting-client' ||
              (!chosenSlot && preferredSlots.length > 0)) && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Your Preferred Times
                </p>
                {preferredSlots.length === 0 ? (
                  <p className="text-xs text-pine/60">
                    No preferred times were saved for this request.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {preferredSlots.map((slot, index) => (
                      <div
                        key={slot.id}
                        className="rounded-xl border border-mist bg-parchment px-3.5 py-2.5"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-pine/55">
                          Option {index + 1}
                        </p>
                        <p className="text-xs font-medium text-pine mt-0.5 tabular-nums">
                          {slot.dateLabel}
                        </p>
                        <p className="text-[11px] font-mono text-pine/70 tabular-nums">
                          {slot.timeLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {booking.status === 'cancelled' && !chosenSlot && preferredSlots.length === 0 && (
              <p className="text-xs text-pine/65">
                All held or preferred schedule slots for this request have been released.
              </p>
            )}
          </section>
        </div>

        {/* Right: Status Guidance, Contact & Actions */}
        <aside className="lg:col-span-5 space-y-6">
          <section
            aria-labelledby="next-steps-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-4"
          >
            <h2
              id="next-steps-heading"
              className="font-heading text-xl font-medium text-pine"
            >
              Status
            </h2>

            {booking.status === 'pending' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Waiting for a psychologist</span>
                </div>
                <p className="text-sm text-pine/80 leading-relaxed">
                  Verified psychologists are reviewing your request and preferred times. You
                  won&apos;t be charged until you agree on a schedule together.
                </p>
              </div>
            )}

            {booking.status === 'awaiting-review' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-pine">
                  Assigned to {booking.psychologistCode}
                </p>
                <p className="text-sm text-pine/80 leading-relaxed">
                  Your psychologist is reviewing your preferred times. We&apos;ll notify you as
                  soon as they confirm a slot or suggest an alternative.
                </p>
              </div>
            )}

            {booking.status === 'awaiting-client' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-900">
                  Response needed on suggested time
                </p>
                <p className="text-sm text-pine/80 leading-relaxed">
                  Accept the psychologist&apos;s suggested schedule to proceed to payment, or
                  propose a fresh set of preferred times.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => router.push(`/proposal/${booking.id}`)}
                  className="w-full sm:w-auto"
                >
                  Review &amp; Respond
                </Button>
              </div>
            )}

            {booking.status === 'awaiting-payment' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-pine">
                  Agreed with {booking.psychologistCode}
                </p>
                {booking.paymentDeadline && (
                  <p className="text-xs text-pine/85 leading-relaxed">
                    Pay by{' '}
                    <strong className="font-semibold text-pine">
                      {formatManilaDateTime(booking.paymentDeadline)} PHT
                    </strong>{' '}
                    · {formatDeadlineCountdown(booking.paymentDeadline)}
                  </p>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => router.push(`/proposal/${booking.id}`)}
                  className="w-full sm:w-auto"
                >
                  Pay Now
                </Button>
              </div>
            )}

            {(booking.status === 'paid-confirmed' ||
              booking.status === 'completed' ||
              booking.status === 'reschedule-requested') && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-pine">
                  {booking.status === 'completed'
                    ? `Completed with ${booking.psychologistCode}`
                    : `Confirmed with ${booking.psychologistCode}`}
                </p>

                {booking.contactUnlocked && (
                  <div className="pt-3 border-t border-mist/60 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-pine/60">
                      How to reach your psychologist
                    </p>
                    <p className="text-xs text-pine/75 leading-relaxed">
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
              <div className="space-y-3">
                <p className="text-sm font-semibold text-red-900">Session Cancelled</p>
                <p className="text-sm text-red-800 leading-relaxed">
                  This session request has been cancelled. You can submit a new request whenever
                  you&apos;re ready.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/book')}
                >
                  Request a New Session
                </Button>
              </div>
            )}
          </section>

          {canCancel && (
            <section
              aria-labelledby="manage-booking-heading"
              className="rounded-2xl border border-mist bg-surface-raised p-5 flex items-center justify-between gap-4"
            >
              <div>
                <h2 id="manage-booking-heading" className="text-sm font-semibold text-pine">
                  Need to cancel?
                </h2>
                <p className="text-xs text-pine/65 mt-0.5">
                  Closes this request and releases preferred or held slots.
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setCancelError(null);
                  setCancelModalOpen(true);
                }}
                disabled={cancelMutation.isPending}
              >
                Cancel Request
              </Button>
            </section>
          )}
        </aside>
      </div>

      {/* Cancel Booking Confirmation Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => {
          if (!cancelMutation.isPending) {
            setCancelModalOpen(false);
            setCancelError(null);
          }
        }}
        title="Cancel this booking request?"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setCancelModalOpen(false);
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
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel Request'}
            </Button>
          </>
        }
      >
        {cancelError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
          >
            {cancelError}
          </div>
        )}
      </Modal>
    </div>
  );
}
