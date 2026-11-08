'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
} from '../../../../lib/booking';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '../../../../stores/useAppStore';
import { AlertCircle, Clock, Lock, Plus, Trash2 } from 'lucide-react';
import { SocialLinksList } from '../../../../components/SocialLinksList';
import {
  BookingStatusTag,
  Button,
  Card,
  Input,
  Label,
  Skeleton,
} from '../../../../components/ui/primitives';

function DeadlineNotice({ deadline }: { deadline: string }) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 space-y-0.5">
      <p className="font-semibold">Payment deadline: {formatManilaDateTime(deadline)}</p>
      <p>{formatDeadlineCountdown(deadline)} · the agreed slot is held until then.</p>
    </div>
  );
}

export default function ScheduleAgreementPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const bookingId = routeParams.id || '';

  const { publishFlowEvent } = useAppStore();
  const [actionError, setActionError] = useState<string | null>(null);
  const [newSlots, setNewSlots] = useState<string[]>(['', '', '']);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.getBookingById(bookingId),
  });

  const acceptCounterMutation = useMutation({
    mutationFn: (slotId: string) =>
      api.acceptCounterSlot({ bookingId, slotId }),
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      publishFlowEvent(
        'Counter-Offer Accepted',
        `Booking ${updated.id} is now awaiting payment for the agreed schedule.`
      );
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const replaceSlotsMutation = useMutation({
    mutationFn: (slots: string[]) =>
      api.replacePreferredSlots({ bookingId, preferredSlots: slots }),
    onSuccess: (updated) => {
      setActionError(null);
      setNewSlots(['', '', '']);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      publishFlowEvent(
        'New Preferred Schedules Submitted',
        `Booking ${updated.id} returned to the psychologist with a fresh set of preferred schedules.`
      );
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const payMutation = useMutation({
    mutationFn: () => api.payBooking(bookingId),
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      publishFlowEvent(
        'Payment Confirmed & Contact Unlocked',
        `Booking ${updated.id} is now paid-confirmed. Psychologist contact details unlocked and reminders scheduled.`
      );
    },
    onError: (err: Error) => setActionError(err.message),
  });

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!booking) {
    return (
      <Card className="space-y-4 text-center py-12">
        <h1 className="font-heading text-3xl font-medium text-pine">
          Booking Record Not Found
        </h1>
        <p className="text-sm text-pine/75">
          Could not locate booking #{bookingId}.
        </p>
        <Button variant="primary" onClick={() => router.push('/bookings')}>
          Return to My Bookings
        </Button>
      </Card>
    );
  }

  const chosenSlot = agreedSlot(booking);
  const preferredSlots = clientPreferredSlots(booking);
  const counterSlot = psychologistCounterSlot(booking);
  const isFinalized =
    booking.status === 'paid-confirmed' || booking.status === 'completed';
  const needsClientAction = booking.status === 'awaiting-client';
  const needsPayment = booking.status === 'awaiting-payment';
  const isWaiting = booking.status === 'pending' || booking.status === 'awaiting-review';

  const normalizedSlots = newSlots.map((slot) => slot.trim()).filter(Boolean);
  const slotsAreFuture = normalizedSlots.every((value) => {
    const normalized = value.length === 16 ? `${value}:00+08:00` : `${value}+08:00`;
    const parsed = new Date(normalized);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
  });
  const slotsAreDistinct =
    new Set(normalizedSlots.map((value) => value.slice(0, 16))).size ===
    normalizedSlots.length;
  const canSubmitSlots =
    normalizedSlots.length >= 3 && slotsAreFuture && slotsAreDistinct;

  const updateSlot = (index: number, value: string) => {
    setNewSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? value : slot))
    );
  };

  const removeSlot = (index: number) => {
    if (newSlots.length <= 3) return;
    setNewSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  };

  const handleSubmitSlots = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmitSlots) return;
    replaceSlotsMutation.mutate(normalizedSlots);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Booking Step 4 of 5</span>
            <span aria-hidden="true">·</span>
            <span>Schedule Agreement &amp; Payment-Gated Finalization</span>
          </div>
          <h1 className="font-heading text-4xl font-medium text-pine">
            Agree a Schedule &amp; Pay ({booking.id})
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            You and{' '}
            <strong className="font-semibold">
              {booking.psychologistCode || 'your psychologist'}
            </strong>{' '}
            must agree on one schedule. Contact details unlock only after payment succeeds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <BookingStatusTag status={booking.status} />
        </div>
      </header>

      {/* Action error banner */}
      {actionError && (
        <div
          role="alert"
          className="bg-red-50 border-l-2 border-red-400 rounded-r-lg p-5 text-red-950 space-y-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            <p className="font-heading text-xl font-medium text-red-900">
              The action could not be completed
            </p>
          </div>
          <p className="text-xs text-red-900/90 leading-relaxed">{actionError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActionError(null);
              queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
            }}
          >
            Refresh booking
          </Button>
        </div>
      )}

      {/* Payment success state */}
      {isFinalized && (
        <Card className="bg-surface-sunken space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-mist pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-accent-ink">
                Payment confirmed · Psychologist contact unlocked
              </p>
              <h2 className="font-heading text-3xl font-medium text-pine">
                Session Confirmed &amp; Psychologist Contact Unlocked
              </h2>
            </div>
            <span className="font-mono text-xl font-medium text-pine tabular-nums">
              Paid: ₱{booking.pricePhp?.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Agreed Date &amp; Time
              </span>
              <p className="font-heading text-lg font-medium text-pine">
                {chosenSlot?.dateLabel}
              </p>
              <p className="font-mono text-accent-ink font-semibold tabular-nums">
                {chosenSlot?.timeLabel}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Psychologist Social Media
              </span>
              <SocialLinksList
                links={booking.psychologistSocialLinks}
                emptyMessage="Your psychologist has not added social media links yet."
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Automated Reminders &amp; Sync
              </span>
              <p className="font-semibold text-pine">
                24h Reminder: {booking.reminders.reminder24h.toUpperCase()}
              </p>
              <p className="font-semibold text-pine">
                1h Reminder: {booking.reminders.reminder1h.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => router.push('/bookings')}>
              View All Client Bookings
            </Button>
          </div>
        </Card>
      )}

      {booking.status === 'cancelled' && (
        <Card className="bg-red-50/60 border-red-200 space-y-2">
          <h2 className="font-heading text-2xl font-medium text-red-900">
            This booking was cancelled
          </h2>
          <p className="text-sm text-red-900/80">
            Start a new request when you are ready to book again.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push('/personas')}>
            Start a new booking
          </Button>
        </Card>
      )}

      {booking.status !== 'cancelled' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: booking metadata */}
          <Card className="lg:col-span-5 space-y-5">
            <div className="border-b border-mist pb-3">
              <p className="text-xs font-semibold text-accent-ink">
                Assigned Verified Practitioner
              </p>
              <h2 className="font-heading text-2xl font-medium text-pine">
                {booking.psychologistCode || 'Awaiting Psychologist Pick-Up'}
              </h2>
              <p className="text-xs text-pine/75 mt-0.5">
                {booking.psychologistSpecialization}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-mist/50">
                <span className="text-pine/70">Persona</span>
                <span className="font-semibold text-pine">{booking.personaLabel}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-mist/50">
                <span className="text-pine/70">Service</span>
                <span className="font-semibold text-pine">{booking.serviceTitle}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-mist/50">
                <span className="text-pine/70">Standard Duration</span>
                <span className="font-mono font-semibold text-accent-ink tabular-nums">
                  {booking.serviceDuration}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-mist/50">
                <span className="text-pine/70">Session Fee</span>
                <span className="font-mono text-base font-medium text-pine tabular-nums">
                  {booking.pricePhp ? `₱${booking.pricePhp.toLocaleString()}` : 'Pending pick-up'}
                </span>
              </div>
            </div>

            <div className="text-xs text-pine/75 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-pine">Contact Lock Guardrail:</strong>{' '}
                The psychologist&apos;s social media links stay locked until the agreed schedule
                is paid.
              </span>
            </div>
          </Card>

          {/* Right: agreement / payment panel */}
          <Card className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between border-b border-mist pb-4">
              <div>
                <h2 className="font-heading text-2xl font-medium text-pine">
                  {needsPayment
                    ? 'Agreed Schedule & Payment'
                    : needsClientAction
                      ? 'Respond to the Proposed Schedule'
                      : isWaiting
                        ? 'Schedule Review in Progress'
                        : 'Agreed Schedule'}
                </h2>
                <p className="text-xs text-pine/70">
                  All times shown in Philippine Standard Time (PST · UTC+8)
                </p>
              </div>
              <span className="font-mono text-lg font-medium text-accent-ink tabular-nums">
                {booking.pricePhp ? `₱${booking.pricePhp.toLocaleString()}` : ''}
              </span>
            </div>

            {/* Pending / awaiting review */}
            {isWaiting && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-parchment border border-dashed border-mint/50 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-900">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    <span>
                      {booking.status === 'pending'
                        ? 'Waiting for a psychologist to pick up your request'
                        : 'A psychologist is reviewing your preferred schedules'}
                    </span>
                  </div>
                  <p className="text-xs text-pine/75">
                    You will be notified when they accept one of your times or offer the nearest
                    available alternative.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Your Preferred Schedules
                  </p>
                  {preferredSlots.length === 0 ? (
                    <p className="text-xs text-pine/60">
                      No preferred schedules were attached to this legacy request.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {preferredSlots.map((slot, index) => (
                        <div
                          key={slot.id}
                          className="rounded-lg border border-mist bg-surface-sunken/40 p-2.5"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-pine/50">
                            Option {index + 1}
                          </p>
                          <p className="text-xs font-medium text-pine">{slot.dateLabel}</p>
                          <p className="text-xs text-pine/70">{slot.timeLabel}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Counter-offer / re-propose */}
            {needsClientAction && (
              <div className="space-y-5">
                {counterSlot && (
                  <div className="rounded-xl border border-sage bg-surface-sunken p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">
                      Psychologist&apos;s Alternative Time
                    </p>
                    <div>
                      <p className="font-heading text-2xl font-medium text-pine">
                        {counterSlot.dateLabel}
                      </p>
                      <p className="font-mono text-sm font-semibold text-accent-ink tabular-nums">
                        {counterSlot.timeLabel}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={acceptCounterMutation.isPending}
                      onClick={() => acceptCounterMutation.mutate(counterSlot.id)}
                    >
                      {acceptCounterMutation.isPending
                        ? 'Accepting…'
                        : 'Accept This Time & Continue to Payment'}
                    </Button>
                  </div>
                )}

                {!counterSlot && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-1">
                    <p className="font-semibold">The agreed slot was released.</p>
                    <p>
                      The payment deadline passed, so the held time is no longer reserved. Submit
                      a fresh set of preferred schedules to restart scheduling.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmitSlots} className="space-y-3 border-t border-mist pt-4">
                  <div>
                    <Label>Propose new preferred schedules</Label>
                    <p className="text-xs text-pine/60 mt-1">
                      Give 3 to 5 future times. The psychologist will accept one or offer the
                      nearest alternative.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {newSlots.map((value, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-xs font-semibold text-pine/60 tabular-nums">
                          {index + 1}.
                        </span>
                        <Input
                          type="datetime-local"
                          value={value}
                          onChange={(event) => updateSlot(index, event.target.value)}
                          disabled={replaceSlotsMutation.isPending}
                        />
                        {newSlots.length > 3 && (
                          <button
                            type="button"
                            onClick={() => removeSlot(index)}
                            className="p-2 rounded-md text-pine/50 hover:text-red-700 hover:bg-red-50"
                            aria-label={`Remove preferred schedule ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {newSlots.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewSlots((current) => [...current, ''])}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add another time
                    </Button>
                  )}

                  {normalizedSlots.length > 0 && !canSubmitSlots && (
                    <p className="text-xs text-red-700">
                      Provide at least 3 distinct future times.
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full"
                    disabled={!canSubmitSlots || replaceSlotsMutation.isPending}
                  >
                    {replaceSlotsMutation.isPending
                      ? 'Submitting…'
                      : 'Submit New Preferred Schedules'}
                  </Button>
                </form>
              </div>
            )}

            {/* Agreed, awaiting payment */}
            {needsPayment && (
              <div className="space-y-4">
                {chosenSlot ? (
                  <div className="rounded-xl border border-sage bg-surface-sunken p-4 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">
                      Agreed Schedule
                    </p>
                    <p className="font-heading text-2xl font-medium text-pine">
                      {chosenSlot.dateLabel}
                    </p>
                    <p className="font-mono text-sm font-semibold text-accent-ink tabular-nums">
                      {chosenSlot.timeLabel}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-pine/75">
                    The agreed schedule could not be loaded. Refresh the booking.
                  </p>
                )}

                {booking.paymentDeadline && (
                  <DeadlineNotice deadline={booking.paymentDeadline} />
                )}

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={payMutation.isPending}
                  onClick={() => payMutation.mutate()}
                >
                  {payMutation.isPending
                    ? 'Processing Payment…'
                    : `Pay ₱${booking.pricePhp?.toLocaleString()} & Finalize Booking`}
                </Button>
                <p className="text-xs text-pine/60">
                  Payment holds the agreed slot. If the deadline passes, the slot is released and
                  scheduling restarts from your preferred schedules.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
