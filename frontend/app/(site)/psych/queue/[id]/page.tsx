'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { clientPreferredSlots } from '@/lib/booking';
import { useAppStore } from '@/stores/useAppStore';
import { useActivePsychologist } from '@/hooks/useActivePsychologist';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  FileText,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  Label,
  Skeleton,
} from '@/components/ui/primitives';

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

export default function PsychologistPendingBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const publishFlowEvent = useAppStore((s) => s.publishFlowEvent);
  const { activePsych } = useActivePsychologist();

  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const bookingId = decodeURIComponent(rawId);

  const [pickupPrice, setPickupPrice] = useState('2500');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotInitialized, setSlotInitialized] = useState(false);
  const [counterDateTime, setCounterDateTime] = useState('');
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const hasSocialLinks = (activePsych?.socialMediaLinks?.length ?? 0) > 0;
  const minDateTime = useMemo(() => formatForManilaInput(new Date()), []);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  const directBookingQuery = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.getBookingById(bookingId),
    enabled: Boolean(bookingId),
  });

  const cachedFromQueue = useMemo(
    () => bookingsQuery.data?.find((b) => b.id === bookingId) ?? null,
    [bookingsQuery.data, bookingId]
  );

  // Prefer the queue entry when available because /appointments/pending includes
  // conflict annotations against the psychologist's existing schedule.
  const booking = useMemo(() => {
    const direct = directBookingQuery.data ?? null;
    if (direct && cachedFromQueue) {
      return {
        ...direct,
        conflictingSlotIds:
          direct.conflictingSlotIds?.length
            ? direct.conflictingSlotIds
            : cachedFromQueue.conflictingSlotIds,
      };
    }
    return cachedFromQueue ?? direct;
  }, [cachedFromQueue, directBookingQuery.data]);

  const isLoadingBooking =
    !booking && (bookingsQuery.isLoading || directBookingQuery.isLoading);
  const bookingLoadError = !booking
    ? directBookingQuery.error || bookingsQuery.error
    : null;

  const preferredSlots = useMemo(
    () => (booking ? clientPreferredSlots(booking) : []),
    [booking]
  );
  const conflictIds = useMemo(
    () => new Set(booking?.conflictingSlotIds ?? []),
    [booking?.conflictingSlotIds]
  );

  useEffect(() => {
    if (!booking || slotInitialized) return;
    if (booking.status === 'pending') {
      const firstAvailable = preferredSlots.find((slot) => !conflictIds.has(slot.id));
      setSelectedSlotId(firstAvailable?.id ?? null);
    }
    setSlotInitialized(true);
  }, [booking, preferredSlots, conflictIds, slotInitialized]);

  const reviewQuery = useQuery({
    queryKey: ['profile-review', booking?.profileId],
    queryFn: () => {
      if (!booking?.profileId) throw new Error('No profile attached to this booking.');
      return api.getProfileReview(booking.profileId);
    },
    enabled: Boolean(booking?.profileId),
    retry: false,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (values: ScheduleAction) =>
      api.pickUpBooking({
        bookingId: values.bookingId,
        pricePhp: values.pricePhp,
        slotId: values.slotId,
        counterDateTime: values.counterDateTime,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', updated.id] });
      const msg =
        updated.status === 'awaiting-payment'
          ? 'Client preferred schedule accepted. The client has been notified and the payment window is now active.'
          : 'Alternative schedule offered. The client can accept it or propose new times.';
      setClaimSuccess(msg);
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
      setSelectedSlotId(null);
      setCounterDateTime('');
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
  });

  const priceInvalid =
    pickupPrice.trim() === '' ||
    !Number.isFinite(Number(pickupPrice)) ||
    Number(pickupPrice) <= 0;

  const handleScheduleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!booking || booking.status !== 'pending' || !hasSocialLinks) return;
    const price = Number(pickupPrice);
    if (pickupPrice.trim() === '' || !Number.isFinite(price) || price <= 0) return;
    if (!selectedSlotId && !counterDateTime) return;

    scheduleMutation.mutate({
      bookingId: booking.id,
      pricePhp: price,
      slotId: selectedSlotId ?? undefined,
      counterDateTime: counterDateTime || undefined,
    });
  };

  if (isLoadingBooking) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-14 w-2/3" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <Skeleton className="h-44" />
            <Skeleton className="h-64" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (bookingLoadError) {
    return (
      <div className="space-y-6">
        <Link
          href="/psych/queue"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Pending Bookings
        </Link>

        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-6 text-xs text-red-900 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-950">
                Could not load booking details.
              </p>
              <p className="mt-1 text-red-800">
                {getFriendlyErrorMessage(
                  bookingLoadError,
                  'Please refresh or return to the pending bookings queue.'
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                directBookingQuery.refetch();
                bookingsQuery.refetch();
              }}
            >
              Try Again
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.push('/psych/queue')}
            >
              Return to Queue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <Link
          href="/psych/queue"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Pending Bookings
        </Link>

        <div className="rounded-2xl border border-mist bg-surface-raised">
          <EmptyState
            icon={FileText}
            title="Booking Request Not Found"
            description="This booking request may have been cancelled or claimed by another psychologist."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push('/psych/queue')}
              >
                Return to Pending Bookings
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const review = reviewQuery.data;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/psych/queue"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to Pending Bookings
      </Link>

      {/* Page Header */}
      <header className="border-b border-mist pb-5">
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
          {booking.serviceTitle}
        </h1>
      </header>

      {/* Claim confirmation banner */}
      {claimSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="bg-lime-soft/30 border border-sage/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sage text-white flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold text-pine">Schedule Action Sent</p>
              <p className="text-xs text-pine/80 mt-0.5">{claimSuccess}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="dark"
              size="sm"
              onClick={() => router.push('/psych/schedule')}
            >
              View in Schedule
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push('/psych/queue')}
            >
              Back to Queue
            </Button>
          </div>
        </div>
      )}

      {/* Two-Column Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Request Details, Intake Profile & Consent */}
        <div className="lg:col-span-7 space-y-6">
          {/* Presenting Concerns & Clinical Scope */}
          <section className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-4">
            <h2 className="font-heading text-xl font-medium text-pine">
              Presenting Concerns
            </h2>
            <p className="text-sm text-pine leading-relaxed whitespace-pre-wrap max-w-prose">
              {displayValue(booking.concernsSummary)}
            </p>
            {booking.serviceGuardrail && (
              <div className="rounded-xl bg-surface-sunken/60 border border-mist/70 px-4 py-3 text-xs text-pine/80 leading-relaxed">
                <span className="font-semibold text-pine">Clinical scope: </span>
                {booking.serviceGuardrail}
              </div>
            )}
            <div className="pt-3 border-t border-mist/60 flex items-center justify-between text-xs text-pine/65">
              <span className="uppercase tracking-wider font-medium">Submitted</span>
              <span className="font-mono tabular-nums text-pine font-medium">
                {booking.submittedAt}
              </span>
            </div>
          </section>

          {/* Profile & Consent Review */}
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-medium text-pine">
              Client Intake Profile &amp; Consent
            </h2>

            {reviewQuery.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-44" />
              </div>
            )}

            {reviewQuery.isError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-2xl p-5 text-xs text-red-900 space-y-2"
              >
                <p className="font-semibold">Could not load client intake profile.</p>
                <p className="break-words text-red-800">
                  {getFriendlyErrorMessage(
                    reviewQuery.error,
                    'Unable to load the client intake profile right now.'
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => reviewQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {review && (
              <div className="space-y-4">
                {review.reviewSections && review.reviewSections.length > 0 ? (
                  <>
                    <section className="rounded-2xl border border-mist bg-surface-raised overflow-hidden">
                      <div className="px-5 py-3 border-b border-mist bg-parchment">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-pine/65">
                          Profile &amp; Consent Metadata
                        </h3>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 px-5 py-4">
                        <ReviewField label="Full name" value={displayValue(review.profile.name)} />
                        <ReviewField
                          label="Relation to account holder"
                          value={displayValue(review.profile.relationToAccountHolder)}
                        />
                        <ReviewField
                          label="Consent version"
                          value={displayValue(review.consent.version)}
                        />
                        <ReviewField
                          label="Signed at"
                          value={formatReviewDate(review.consent.signedAt, true)}
                        />
                      </dl>
                    </section>

                    {review.reviewSections.map((sec) => (
                      <section
                        key={sec.pageId}
                        className="rounded-2xl border border-mist bg-surface-raised overflow-hidden"
                      >
                        <div className="px-5 py-3 border-b border-mist bg-parchment">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-pine/65">
                            {sec.title}
                          </h3>
                        </div>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 px-5 py-4">
                          {sec.fields.map((field) => {
                            const formatted =
                              typeof field.value === 'boolean'
                                ? yesNo(field.value)
                                : field.type === 'date' && typeof field.value === 'string'
                                  ? `${formatReviewDate(field.value)}${
                                      field.fieldKey === 'date_of_birth'
                                        ? ` (${reviewAge(field.value)})`
                                        : ''
                                    }`
                                  : displayValue(field.value as string | null | undefined);
                            return (
                              <ReviewField
                                key={`${sec.pageId}-${field.fieldKey}`}
                                label={field.label}
                                value={formatted}
                                fullWidth={field.type === 'textarea'}
                              />
                            );
                          })}
                        </dl>
                      </section>
                    ))}
                  </>
                ) : (
                  <>
                    <section className="rounded-2xl border border-mist bg-surface-raised overflow-hidden">
                      <div className="px-5 py-3 border-b border-mist bg-parchment">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-pine/65">
                          Profile Details
                        </h3>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 px-5 py-4">
                        <ReviewField label="Full name" value={displayValue(review.profile.name)} />
                        <ReviewField
                          label="Relation to account holder"
                          value={displayValue(review.profile.relationToAccountHolder)}
                        />
                        <ReviewField
                          label="Date of birth"
                          value={`${formatReviewDate(review.profile.dateOfBirth)} (${reviewAge(
                            review.profile.dateOfBirth
                          )})`}
                        />
                        <ReviewField
                          label="Occupation"
                          value={displayValue(review.profile.occupation)}
                        />
                        <ReviewField
                          label="Nationality"
                          value={displayValue(review.profile.nationality)}
                        />
                        <ReviewField
                          label="Preferred contact"
                          value={displayValue(review.profile.preferredContactMode)}
                        />
                        <ReviewField
                          label="Permanent address"
                          value={displayValue(review.profile.permanentAddress)}
                          fullWidth
                        />
                        <ReviewField
                          label="Present address"
                          value={displayValue(review.profile.presentAddress)}
                          fullWidth
                        />
                        <ReviewField
                          label="Contact number"
                          value={displayValue(review.profile.contactNumber)}
                        />
                        <ReviewField
                          label="Social media"
                          value={
                            [review.profile.socmedPlatform, review.profile.socmedUsername]
                              .filter(Boolean)
                              .join(' · ') || '—'
                          }
                        />
                        <ReviewField
                          label="Emergency contact"
                          value={`${displayValue(
                            review.profile.emergencyContactName
                          )} (${displayValue(
                            review.profile.emergencyContactRelation
                          )}) · ${displayValue(review.profile.emergencyContactNumber)}`}
                          fullWidth
                        />
                      </dl>
                    </section>

                    <section className="rounded-2xl border border-mist bg-surface-raised overflow-hidden">
                      <div className="px-5 py-3 border-b border-mist bg-parchment">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-pine/65">
                          Consent &amp; Forms
                        </h3>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 px-5 py-4">
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
              </div>
            )}
          </div>
        </div>

        {/* Right: Claim & Schedule Workbench */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 border-b border-mist/70 pb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                <h2 className="font-heading text-xl font-medium text-pine">
                  Claim &amp; Schedule
                </h2>
              </div>
              <span className="text-xs font-mono text-pine/60 tabular-nums">
                {preferredSlots.length} {preferredSlots.length === 1 ? 'option' : 'options'}
              </span>
            </div>

            {booking.status !== 'pending' ? (
              <div className="space-y-4">
                <p className="text-sm text-pine/80 leading-relaxed">
                  This request is no longer in the pending queue. You can track its scheduling
                  and payment progress from your schedule.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="dark"
                    size="md"
                    onClick={() => router.push('/psych/schedule')}
                  >
                    Go to Schedule
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => router.push('/psych/queue')}
                  >
                    Back to Pending Bookings
                  </Button>
                </div>
              </div>
            ) : !hasSocialLinks ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 space-y-1.5">
                  <p className="font-semibold">Social media link required to claim</p>
                  <p className="text-amber-900/90 leading-relaxed">
                    Add at least one social media link to your practitioner profile so confirmed
                    clients know where to reach you after payment.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => router.push('/psych/profile')}
                >
                  Add Social Media Link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleScheduleSubmit} className="space-y-5">
                {scheduleMutation.isError && (
                  <div
                    role="alert"
                    className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-semibold text-red-950">
                          Could not complete the schedule action
                        </p>
                        <p className="mt-0.5 text-red-800 leading-relaxed">
                          {getFriendlyErrorMessage(
                            scheduleMutation.error,
                            'This request may have already been claimed by another psychologist.'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Session Fee */}
                <div>
                  <Label htmlFor="pickup-price">
                    Proposed Session Fee (PHP · ₱) <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="pickup-price"
                    type="number"
                    step="any"
                    className="font-mono tabular-nums text-base"
                    placeholder="2500"
                    value={pickupPrice}
                    onChange={(event) => setPickupPrice(event.target.value)}
                    disabled={scheduleMutation.isPending}
                  />
                  {priceInvalid && (
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      Session fee must be greater than ₱0.
                    </p>
                  )}
                </div>

                {/* Preferred Schedules */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                      Client&apos;s Preferred Schedules
                    </span>
                    {selectedSlotId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedSlotId(null)}
                        disabled={scheduleMutation.isPending}
                        className="text-xs font-semibold text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                      >
                        Clear selection
                      </button>
                    ) : (
                      <span className="text-[11px] text-pine/55">Conflicts disabled</span>
                    )}
                  </div>

                  {preferredSlots.length === 0 ? (
                    <p className="rounded-xl border border-mist bg-surface-sunken/40 p-3 text-xs text-pine/70">
                      This request has no preferred schedules. Offer the nearest available
                      alternative below.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {preferredSlots.map((slot, index) => {
                        const hasConflict = conflictIds.has(slot.id);
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <label
                            key={slot.id}
                            className={`flex items-start gap-3 rounded-xl border p-3 transition-colors duration-150 ${
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
                              <span className="block text-sm font-medium text-pine tabular-nums">
                                {slot.dateLabel}
                              </span>
                              <span className="block text-xs text-pine/70 tabular-nums">
                                {slot.timeLabel}
                              </span>
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
                <div className="space-y-2 rounded-xl border border-mist bg-surface-sunken/35 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-pine/60" aria-hidden="true" />
                      <Label htmlFor="counter-datetime" className="mb-0">
                        Or offer an alternative time
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
                  <p className="text-[11px] text-pine/60 leading-relaxed">
                    Offer one nearest available time if none of the client&apos;s options fit.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
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
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
