'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { clientPreferredSlots } from '../../../../lib/booking';
import { useAppStore } from '../../../../stores/useAppStore';
import { useActivePsychologist } from '../../../../hooks/useActivePsychologist';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  BookingStatusTag,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
} from '../../../../components/ui/primitives';

function formatReviewDate(value: string | null, includeTime = false): string {
  if (!value) return '—';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00+08:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'Asia/Manila',
  }).format(date);
}

function reviewAge(dateOfBirth: string): string {
  const dob = new Date(`${dateOfBirth}T00:00:00+08:00`);
  if (Number.isNaN(dob.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return `${Math.max(age, 0)} yrs`;
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : '—';
}

function formatForManilaInput(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const minute = getPart('minute');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function ReviewField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-pine/60">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-pine break-words">{value}</dd>
    </div>
  );
}

type ScheduleAction = {
  bookingId: string;
  pricePhp: number;
  slotId?: string;
  counterDateTime?: string;
};

export default function PsychologistQueuePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { publishFlowEvent } = useAppStore();
  const { activePsych } = useActivePsychologist();

  const [activeModalBookingId, setActiveModalBookingId] = useState<string | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [recentAction, setRecentAction] = useState<{ id: string; message: string } | null>(null);
  const [pickupPrice, setPickupPrice] = useState('2500');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [counterDateTime, setCounterDateTime] = useState('');

  const hasSocialLinks = (activePsych?.socialMediaLinks?.length ?? 0) > 0;
  const canPickup = hasSocialLinks;
  const minDateTime = useMemo(() => formatForManilaInput(new Date()), []);

  const { data: bookings = [], isLoading, refetch, error: bookingsError } = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  const pendingQueue = bookings.filter((b) => b.status === 'pending');
  const targetBooking = pendingQueue.find((b) => b.id === activeModalBookingId) || null;
  const reviewBooking = pendingQueue.find((b) => b.id === reviewBookingId) || null;

  const reviewQuery = useQuery({
    queryKey: ['persona-review', reviewBooking?.personaId],
    queryFn: () => {
      if (!reviewBooking) throw new Error('No booking selected for review.');
      return api.getPersonaReview(reviewBooking.personaId);
    },
    enabled: Boolean(reviewBooking?.personaId),
    retry: false,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (values: ScheduleAction) => {
      return await api.pickUpBooking({
        bookingId: values.bookingId,
        pricePhp: values.pricePhp,
        slotId: values.slotId,
        counterDateTime: values.counterDateTime,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', updated.id] });
      setRecentAction({
        id: updated.id,
        message:
          updated.status === 'awaiting-payment'
            ? 'Client preferred schedule accepted. The client has been notified and the payment window is running.'
            : 'Alternative schedule offered. The client can accept it or propose new times.',
      });
      publishFlowEvent(
        updated.status === 'awaiting-payment'
          ? 'Preferred Schedule Accepted'
          : 'Alternative Schedule Offered',
        `${activePsych?.anonymizedTitle ?? 'Psychologist'} picked up ${updated.id} and ${
          updated.status === 'awaiting-payment'
            ? 'accepted one of the client’s preferred schedules.'
            : 'offered the nearest available alternative.'
        }`
      );
      setActiveModalBookingId(null);
      setSelectedSlotId(null);
      setCounterDateTime('');
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const preferredForTarget = targetBooking ? clientPreferredSlots(targetBooking) : [];
  const conflictIds = new Set(targetBooking?.conflictingSlotIds ?? []);

  const handleOpenPickupModal = (bookingId: string) => {
    if (!canPickup) return;
    setActiveModalBookingId(bookingId);
    scheduleMutation.reset();
    setPickupPrice('2500');
    setCounterDateTime('');

    const booking = pendingQueue.find((b) => b.id === bookingId);
    const conflicts = new Set(booking?.conflictingSlotIds ?? []);
    const firstAvailable =
      booking?.status === 'pending'
        ? clientPreferredSlots(booking).find((slot) => !conflicts.has(slot.id))
        : undefined;
    setSelectedSlotId(firstAvailable?.id ?? null);
  };

  const handleCloseModal = () => {
    setActiveModalBookingId(null);
    setSelectedSlotId(null);
    setCounterDateTime('');
    scheduleMutation.reset();
  };

  const handleOpenReview = (bookingId: string) => {
    setReviewBookingId(bookingId);
  };

  const handleCloseReview = () => {
    setReviewBookingId(null);
  };

  const handleReviewToScheduling = () => {
    if (!reviewBooking) return;
    const bookingId = reviewBooking.id;
    setReviewBookingId(null);
    handleOpenPickupModal(bookingId);
  };

  const handleScheduleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetBooking) return;

    const price = Number(pickupPrice);
    if (!Number.isFinite(price) || price < 500 || price > 25000) {
      return;
    }

    scheduleMutation.mutate({
      bookingId: targetBooking.id,
      pricePhp: price,
      slotId: selectedSlotId ?? undefined,
      counterDateTime: counterDateTime || undefined,
    });
  };

  const review = reviewQuery.data;
  const priceInvalid =
    !Number.isFinite(Number(pickupPrice)) ||
    Number(pickupPrice) < 500 ||
    Number(pickupPrice) > 25000;

  return (
    <div className="space-y-8">
      {/* Header & Verification Identity Switcher */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Psychologist Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Pending Requests Queue</span>
          </div>
          <h1 className="font-heading text-4xl font-medium text-pine">
            Pending Booking Requests
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Review each client&apos;s preferred schedules, then claim the request and accept one
            time or offer the nearest available alternative.
          </p>
        </div>
      </header>

      {!hasSocialLinks && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-950 space-y-2">
          <p className="font-semibold">Add a social media link before accepting a booking.</p>
          <p>
            Confirmed clients receive your social media links as their contact channel. Add at
            least one link to your practitioner profile to unlock pick-up.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/psych/profile')}
          >
            Add Social Media Link
          </Button>
        </div>
      )}

      {bookingsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-900">
          <p className="font-semibold">Could not load pending bookings.</p>
          <p className="mt-1 break-words">{(bookingsError as Error).message}</p>
        </div>
      )}

      {/* Success Notification if a schedule action was just submitted */}
      {recentAction && (
        <div className="bg-lime-soft/30 border border-sage/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sage text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-pine">
                Schedule Action Sent for {recentAction.id}
              </p>
              <p className="text-xs text-pine/80">{recentAction.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="dark"
              size="sm"
              onClick={() => router.push('/psych/schedule')}
            >
              View in My Schedule
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRecentAction(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Pending Requests List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Open Booking Queue
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sage/15 text-pine">
              {pendingQueue.length} {pendingQueue.length === 1 ? 'request' : 'requests'} pending
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            Refresh Queue
          </Button>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : pendingQueue.length === 0 ? (
          /* Empty State */
          <EmptyState
            icon={CheckCircle2}
            title="Pending Queue is All Clear"
            description="All submitted client booking requests have been claimed and scheduled. View confirmed appointments in My Schedule."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/psych/schedule')}
              >
                Go to My Schedule
              </Button>
            }
          />
        ) : (
          /* Pending Requests Cards */
          <div className="grid grid-cols-1 gap-5">
            {pendingQueue.map((item) => {
              const preferredSlots = clientPreferredSlots(item);
              const conflicts = new Set(item.conflictingSlotIds ?? []);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View persona and consent details for booking ${item.id}`}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest('button, a, input, select, textarea')) return;
                    handleOpenReview(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenReview(item.id);
                    }
                  }}
                  className="rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                >
                  <Card className="hover:border-sage transition-colors p-6 space-y-5 h-full">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-mist/70 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium text-pine">
                            {item.id}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-sm font-semibold bg-surface-sunken text-accent-ink">
                            {item.personaType.toUpperCase()}
                          </span>
                          <BookingStatusTag status={item.status} />
                        </div>
                        <h3 className="font-heading text-xl font-medium text-pine">
                          {item.serviceTitle}
                        </h3>
                      </div>

                      {/* Pick Up Action Button: requires a contact link */}
                      <div>
                        {canPickup ? (
                          <Button
                            variant="primary"
                            size="md"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenPickupModal(item.id);
                            }}
                          >
                            Pick Up &amp; Review Schedules
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="md"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push('/psych/profile');
                            }}
                          >
                            Add Social Media to Accept
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                      {/* Persona Info */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          Client &amp; Persona Information
                        </span>
                        <p className="font-heading text-lg font-medium text-pine">{item.personaLabel}</p>
                        <p className="text-xs text-pine/60">
                          Submitted: {item.submittedAt}
                        </p>
                        <p className="text-[11px] font-medium text-accent-ink">
                          Click card to view persona &amp; consent form
                        </p>
                      </div>

                      {/* Service & Guardrail */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          Service Duration &amp; Clinical Scope
                        </span>
                        <p className="font-semibold text-pine">
                          Duration: <span className="font-mono text-accent-ink font-medium">{item.serviceDuration}</span>
                        </p>
                        <p className="text-pine/80 leading-relaxed text-xs">
                          {item.serviceGuardrail}
                        </p>
                      </div>

                      {/* Booking Notes */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          Presenting Concerns
                        </span>
                        <p className="text-pine/90 line-clamp-3 leading-relaxed">
                          {item.concernsSummary}
                        </p>
                      </div>
                    </div>

                    {/* Client preferred schedules */}
                    <div className="border-t border-mist/60 pt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          Client&apos;s Preferred Schedules
                        </span>
                        <span className="text-[11px] text-pine/50">
                          {preferredSlots.length} offered
                        </span>
                      </div>
                      {preferredSlots.length === 0 ? (
                        <p className="text-xs text-pine/60">
                          This request has no preferred schedules. You can still offer an
                          alternative after pickup.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {preferredSlots.map((slot, index) => {
                            const hasConflict = conflicts.has(slot.id);
                            return (
                              <div
                                key={slot.id}
                                className={`rounded-lg border p-2.5 ${
                                  hasConflict
                                    ? 'border-amber-300 bg-amber-50'
                                    : 'border-mist bg-surface-sunken/40'
                                }`}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-pine/50">
                                  Option {index + 1}
                                </p>
                                <p className="text-xs font-medium text-pine">{slot.dateLabel}</p>
                                <p className="text-xs text-pine/70">{slot.timeLabel}</p>
                                {hasConflict && (
                                  <p className="mt-1 text-[10px] font-semibold text-amber-800">
                                    Conflicts with your schedule
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Persona & Consent Review Modal */}
      {reviewBooking && (
        <Modal
          open
          onClose={handleCloseReview}
          title={`Persona & Consent Review — ${reviewBooking.id}`}
          description={`${reviewBooking.serviceTitle} · ${reviewBooking.personaLabel}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <div className="rounded-lg border border-mist bg-surface-sunken/40 p-4 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
                Booking Request
              </p>
              <p className="text-sm text-pine leading-relaxed">
                {reviewBooking.concernsSummary}
              </p>
              <p className="text-xs text-pine/60">
                Submitted {reviewBooking.submittedAt} · {reviewBooking.serviceDuration}
              </p>
              {reviewBooking.serviceGuardrail && (
                <p className="text-xs text-pine/70 leading-relaxed">
                  {reviewBooking.serviceGuardrail}
                </p>
              )}
            </div>

            {reviewQuery.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-40" />
              </div>
            )}

            {reviewQuery.isError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-900 space-y-2"
              >
                <p className="font-semibold">Could not load persona review.</p>
                <p className="break-words">{(reviewQuery.error as Error).message}</p>
                <Button variant="outline" size="sm" onClick={() => reviewQuery.refetch()}>
                  Retry
                </Button>
              </div>
            )}

            {review && (
              <>
                <section className="rounded-lg border border-mist overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-mist bg-surface-sunken/40">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-pine/60">
                      Persona Details
                    </h3>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4">
                    <ReviewField label="Full name" value={displayValue(review.persona.name)} />
                    <ReviewField
                      label="Relation to account holder"
                      value={displayValue(review.persona.relationToAccountHolder)}
                    />
                    <ReviewField
                      label="Date of birth"
                      value={`${formatReviewDate(review.persona.dateOfBirth)} (${reviewAge(review.persona.dateOfBirth)})`}
                    />
                    <ReviewField label="Occupation" value={displayValue(review.persona.occupation)} />
                    <ReviewField label="Nationality" value={displayValue(review.persona.nationality)} />
                    <ReviewField
                      label="Preferred contact"
                      value={displayValue(review.persona.preferredContactMode)}
                    />
                    <ReviewField
                      label="Permanent address"
                      value={displayValue(review.persona.permanentAddress)}
                      fullWidth
                    />
                    <ReviewField
                      label="Present address"
                      value={displayValue(review.persona.presentAddress)}
                      fullWidth
                    />
                    <ReviewField
                      label="Contact number"
                      value={displayValue(review.persona.contactNumber)}
                    />
                    <ReviewField
                      label="Social media"
                      value={
                        [review.persona.socmedPlatform, review.persona.socmedUsername]
                          .filter(Boolean)
                          .join(' · ') || '—'
                      }
                    />
                    <ReviewField
                      label="Emergency contact"
                      value={`${displayValue(review.persona.emergencyContactName)} (${displayValue(
                        review.persona.emergencyContactRelation
                      )}) · ${displayValue(review.persona.emergencyContactNumber)}`}
                      fullWidth
                    />
                  </dl>
                </section>

                <section className="rounded-lg border border-mist overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-mist bg-surface-sunken/40">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-pine/60">
                      Consent &amp; Forms
                    </h3>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4">
                    <ReviewField
                      label="Consent version"
                      value={displayValue(review.consent.version)}
                    />
                    <ReviewField
                      label="Signed at"
                      value={formatReviewDate(review.consent.signedAt, true)}
                    />
                    <ReviewField
                      label="Terms signer"
                      value={`${displayValue(review.consent.termsSignerName)} (${displayValue(
                        review.consent.termsSignerRelation
                      )})`}
                    />
                    <ReviewField
                      label="Consent signer"
                      value={displayValue(review.consent.consentSignerName)}
                    />
                    <ReviewField
                      label="Scope acknowledged"
                      value={yesNo(review.consent.scopeAcknowledged)}
                    />
                    <ReviewField
                      label="Information confirmed"
                      value={yesNo(review.consent.informationConfirmed)}
                    />
                    <ReviewField
                      label="Overseas / foreign national"
                      value={yesNo(review.consent.isOverseasOrForeign)}
                    />
                    {review.consent.isOverseasOrForeign && (
                      <ReviewField
                        label="Overseas acknowledged"
                        value={yesNo(review.consent.overseasAcknowledged)}
                      />
                    )}
                  </dl>
                </section>
              </>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-3 border-t border-mist">
              <Button type="button" variant="outline" size="md" onClick={handleCloseReview}>
                Close
              </Button>
              {canPickup && (
                <Button type="button" variant="primary" size="md" onClick={handleReviewToScheduling}>
                  Pick Up &amp; Review Schedules
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Pick-Up & Scheduling Modal */}
      {targetBooking && (
        <Modal
          open
          onClose={handleCloseModal}
          title={`Pick Up Booking #${targetBooking.id}`}
          description={`${targetBooking.serviceTitle} (${targetBooking.serviceDuration}) · ${targetBooking.personaLabel}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleScheduleSubmit} className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
              Booking Step 3 · Claim &amp; Agree a Schedule
            </p>

            {/* Race Condition / Error Banner */}
            {scheduleMutation.isError && (
              <div
                role="alert"
                className="bg-red-50 border-l-2 border-red-400 rounded-r-lg p-4 text-red-950 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                  <p className="font-heading text-base font-medium text-red-950">
                    Could Not Complete the Schedule Action
                  </p>
                </div>
                <p className="text-xs text-red-900 leading-relaxed">
                  {scheduleMutation.error?.message ||
                    'This request may have already been claimed by another psychologist. Please refresh the queue.'}
                </p>
                <div className="pt-1 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['bookings'] });
                      handleCloseModal();
                    }}
                  >
                    Refresh Queue &amp; Close
                  </Button>
                </div>
              </div>
            )}

            {/* Scope Guardrail Reminder */}
            <p className="text-xs text-pine/85 leading-relaxed">
              <span className="font-semibold text-pine">Clinical Scope Guardrail:</span>{' '}
              {targetBooking.serviceGuardrail}
            </p>

            {/* Fee Input */}
            <div>
              <Label htmlFor="pickup-price">
                Proposed Session Fee (PHP · ₱) <span className="text-red-600">*</span>
              </Label>
              <Input
                id="pickup-price"
                type="number"
                min={500}
                max={25000}
                step={100}
                className="font-mono tabular-nums text-base"
                placeholder="2500"
                value={pickupPrice}
                onChange={(event) => setPickupPrice(event.target.value)}
              />
              {priceInvalid && (
                <p className="text-xs text-red-700 mt-1 font-medium">
                  Session fee must be between ₱500 and ₱25,000.
                </p>
              )}
            </div>

            {/* Client preferred schedules */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Accept One of the Client&apos;s Preferred Schedules
                </span>
                <div className="flex items-center gap-3">
                  {selectedSlotId && (
                    <button
                      type="button"
                      onClick={() => setSelectedSlotId(null)}
                      disabled={scheduleMutation.isPending}
                      className="text-xs font-semibold text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                    >
                      Clear selection
                    </button>
                  )}
                  <span className="text-xs text-accent-ink font-medium">
                    Conflicts are disabled
                  </span>
                </div>
              </div>

              {preferredForTarget.length === 0 ? (
                <p className="rounded-lg border border-mist bg-surface-sunken/40 p-3 text-xs text-pine/70">
                  This request has no preferred schedules. Offer the nearest available
                  alternative below.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {preferredForTarget.map((slot, index) => {
                    const hasConflict = conflictIds.has(slot.id);
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <label
                        key={slot.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          hasConflict
                            ? 'border-amber-200 bg-amber-50/60 cursor-not-allowed'
                            : isSelected
                              ? 'border-sage bg-surface-sunken cursor-pointer'
                              : 'border-mist bg-surface-raised hover:bg-parchment cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="preferred-schedule"
                          className="mt-0.5 h-4 w-4 accent-sage"
                          checked={isSelected}
                          disabled={hasConflict || scheduleMutation.isPending}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSlotId(null);
                            }
                          }}
                          onChange={() => {
                            setSelectedSlotId(slot.id);
                            setCounterDateTime('');
                          }}
                        />
                        <span className="space-y-0.5">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-pine/50">
                            Option {index + 1}
                          </span>
                          <span className="block text-sm font-medium text-pine">
                            {slot.dateLabel}
                          </span>
                          <span className="block text-xs text-pine/70">{slot.timeLabel}</span>
                          {hasConflict && (
                            <span className="block text-[11px] font-semibold text-amber-800">
                              Conflicts with your scheduled session
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Counter-offer */}
            <div className="space-y-2 rounded-lg border border-mist bg-surface-sunken/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pine/60" aria-hidden="true" />
                  <Label htmlFor="counter-datetime" className="mb-0">
                    None of these work? Offer the nearest available alternative
                  </Label>
                </div>
                {counterDateTime && (
                  <button
                    type="button"
                    onClick={() => setCounterDateTime('')}
                    disabled={scheduleMutation.isPending}
                    className="text-xs font-semibold text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <Input
                id="counter-datetime"
                type="datetime-local"
                min={minDateTime}
                className="font-mono tabular-nums text-sm"
                value={counterDateTime}
                onChange={(event) => {
                  setCounterDateTime(event.target.value);
                  if (event.target.value) setSelectedSlotId(null);
                }}
                disabled={scheduleMutation.isPending}
              />
              <p className="text-[11px] text-pine/55">
                You can offer exactly one alternative time. Click a selected slot again or
                &ldquo;Clear selection&rdquo; above to unselect it.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-3 border-t border-mist">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleCloseModal}
                disabled={scheduleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={
                  scheduleMutation.isPending ||
                  priceInvalid ||
                  (!selectedSlotId && !counterDateTime)
                }
              >
                {scheduleMutation.isPending
                  ? 'Claiming & Sending…'
                  : selectedSlotId
                    ? 'Claim & Accept Selected Schedule'
                    : 'Claim & Offer Alternative'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
