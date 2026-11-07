'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import { BookingStatus } from '../../../lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
} from '../../../lib/booking';
import { Clock } from 'lucide-react';
import { SocialLinksList } from '../../../components/SocialLinksList';
import {
  BookingStatusTag,
  Button,
  Card,
  Skeleton,
} from '../../../components/ui/primitives';

const FILTER_TABS: { id: 'all' | BookingStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'pending' },
  { id: 'awaiting-review', label: 'in review' },
  { id: 'awaiting-client', label: 'action needed' },
  { id: 'awaiting-payment', label: 'payment due' },
  { id: 'paid-confirmed', label: 'paid-confirmed' },
  { id: 'completed', label: 'completed' },
  { id: 'cancelled', label: 'cancelled' },
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
  const { publishFlowEvent } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'client'],
    queryFn: () => api.getBookingsForRole('client'),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => api.cancelBooking(bookingId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      publishFlowEvent(
        'Booking Cancelled',
        `Booking ${updated.id} has been marked as cancelled.`
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
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Client Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Tiered Access: Own History Only (Client #C-01)</span>
          </div>
          <h1 className="font-heading text-4xl font-medium text-pine">
            My Bookings
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Track your request from <strong className="font-semibold">pending</strong> to{' '}
            <strong className="font-semibold">schedule agreement</strong> and{' '}
            <strong className="font-semibold">paid-confirmed</strong> (contact unlocked), then{' '}
            <strong className="font-semibold">completed</strong> once the session is done.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/personas')}
        >
          + New Persona Booking Request
        </Button>
      </header>

      {/* Action banner */}
      {firstAction && (
        <div className="bg-lime-soft/25 border border-lime-soft/60 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-pine">
              {firstAction.status === 'awaiting-payment'
                ? 'PAYMENT DUE · YOUR AGREED SLOT IS HELD'
                : 'ACTION REQUIRED · RESPOND TO THE COUNTER-OFFER'}
            </p>
            <p className="text-sm text-pine/90">
              You have <strong>{actionNeeded.length}</strong> booking request(s) waiting on you.
              {firstAction.status === 'awaiting-payment' && firstAction.paymentDeadline
                ? ` Pay before ${formatManilaDateTime(firstAction.paymentDeadline)} (${formatDeadlineCountdown(firstAction.paymentDeadline)}).`
                : ' Accept the psychologist’s alternative time or propose a fresh set of preferred schedules.'}
            </p>
          </div>
          <Button
            variant="dark"
            size="md"
            onClick={() => router.push(`/proposal/${firstAction.id}`)}
          >
            {firstAction.status === 'awaiting-payment' ? 'Pay Now' : 'Review Counter-Offer'} (
            {firstAction.id})
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
          Contact details unlock strictly upon <strong className="text-pine">paid-confirmed</strong> status
          and remain available after the session is marked <strong className="text-pine">completed</strong>.
        </span>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-44" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <p className="font-heading text-2xl font-medium text-pine">
            No Bookings Matching Selected Status
          </p>
          <p className="text-sm text-pine/75 max-w-md mx-auto">
            Start a new booking under a Self or Dependent persona, or switch the filter above
            to view all existing bookings.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
              Reset Filter
            </Button>
            <Button variant="primary" size="sm" onClick={() => router.push('/personas')}>
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
                    <span>Persona: {booking.personaLabel}</span>
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
                      Guardrail: {booking.serviceGuardrail}
                    </p>

                    <p className="text-sm text-pine/85 leading-relaxed">
                      {booking.concernsSummary}
                    </p>

                    {(booking.status === 'pending' ||
                      booking.status === 'awaiting-review') && (
                      <div className="space-y-2 border-t border-mist/60 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          Your preferred schedules
                        </p>
                        <PreferredScheduleList
                          slots={preferred}
                          emptyMessage="No preferred schedules were attached to this legacy request."
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
                          <span>No Pick-Up Yet · Waiting Psychologist Review</span>
                        </div>
                        <p className="text-xs text-pine/80 leading-relaxed">
                          Your request and preferred schedules are visible to verified
                          psychologists. No fee or agreed time is assigned yet, and direct contact
                          remains locked.
                        </p>
                      </div>
                    )}

                    {booking.status === 'awaiting-review' && (
                      <div className="p-4 rounded-lg bg-surface-raised border border-mist space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-pine">
                            Claimed by {booking.psychologistCode}
                          </span>
                          <span className="font-mono font-medium text-pine tabular-nums">
                            Fee: ₱{booking.pricePhp?.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-pine/80">
                          Your preferred schedules are being reviewed. You will be notified when
                          the psychologist accepts one or offers an alternative.
                        </p>
                        <PreferredScheduleList
                          slots={preferred}
                          emptyMessage="No preferred schedules were attached to this legacy request."
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
                              {formatManilaDateTime(booking.paymentDeadline)}
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
                              Psychologist Social Media:
                            </p>
                            <SocialLinksList
                              links={booking.psychologistSocialLinks}
                              emptyMessage="Your psychologist has not added social media links yet."
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {booking.status === 'cancelled' && (
                      <div className="p-4 rounded-lg bg-red-50/60 border border-red-200 text-xs text-red-900 space-y-1">
                        <p className="font-bold">Session Cancelled</p>
                        <p>Real-time cancellation synced across Client and Psychologist schedules.</p>
                      </div>
                    )}

                    {canCancel && (
                      <div className="pt-2 mt-2 border-t border-mist flex items-center justify-end text-xs">
                        <button
                          type="button"
                          onClick={() => cancelMutation.mutate(booking.id)}
                          disabled={cancelMutation.isPending}
                          className="underline text-red-700 hover:text-red-900 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                        >
                          {cancelMutation.isPending ? 'Cancelling…' : 'Cancel request'}
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
    </div>
  );
}
