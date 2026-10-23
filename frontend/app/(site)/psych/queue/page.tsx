'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
  proposalFormSchema,
  ProposalFormValues,
} from '../../../../lib/schemas';
import { useAppStore } from '../../../../stores/useAppStore';
import { useActivePsychologist } from '../../../../hooks/useActivePsychologist';
import { useRouter } from 'next/navigation';
import { Lock, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PractitionerSwitcher } from '../../../../components/dashboard/PractitionerSwitcher';
import { UnverifiedBanner } from '../../../../components/dashboard/UnverifiedBanner';
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

export default function PsychologistQueuePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { publishFlowEvent } = useAppStore();
  const { activePsych, activePsychologistId, showSwitcher } = useActivePsychologist();

  const [activeModalBookingId, setActiveModalBookingId] = useState<string | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [recentProposedId, setRecentProposedId] = useState<string | null>(null);

  const isVerified = activePsych?.verificationStatus === 'verified';
  const hasSocialLinks = (activePsych?.socialMediaLinks?.length ?? 0) > 0;
  const canPickup = isVerified && hasSocialLinks;

  const { data: bookings = [], isLoading, refetch, error: bookingsError } = useQuery({
    queryKey: ['bookings', 'psychologist', activePsychologistId],
    queryFn: () => api.getBookingsForRole('psychologist', activePsychologistId),
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

  // Format datetime for datetime-local input strictly in Philippine Standard Time (Asia/Manila)
  const formatForManilaInput = (d: Date) => {
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
  };

  const serializeManilaIso = (val: string) => {
    if (!val) return val;
    const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(val);
    if (hasTimezone) return val;
    return val.length === 16 ? `${val}:00+08:00` : `${val}+08:00`;
  };

  // Generate dynamic future default slots in Asia/Manila
  const defaultSlots = useMemo(() => {
    const now = new Date();
    const d1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const d2 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const d3 = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    return {
      slot1: formatForManilaInput(d1),
      slot2: formatForManilaInput(d2),
      slot3: formatForManilaInput(d3),
    };
  }, []);

  const minDateTime = useMemo(() => {
    return formatForManilaInput(new Date());
  }, []);

  // React Hook Form with Zod validation
  const proposalForm = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      pricePhp: 2500,
      slot1DateTime: defaultSlots.slot1,
      slot2DateTime: defaultSlots.slot2,
      slot3DateTime: defaultSlots.slot3,
    },
  });

  const proposeMutation = useMutation({
    mutationFn: (values: ProposalFormValues) => {
      if (!targetBooking) throw new Error('No pending booking selected for proposal.');
      return api.pickUpAndProposeSlots({
        bookingId: targetBooking.id,
        psychologistId: activePsychologistId,
        pricePhp: values.pricePhp,
        slot1DateTime: serializeManilaIso(values.slot1DateTime),
        slot2DateTime: serializeManilaIso(values.slot2DateTime),
        slot3DateTime: serializeManilaIso(values.slot3DateTime),
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', updated.id] });
      setRecentProposedId(updated.id);
      setActiveModalBookingId(null);
      publishFlowEvent(
        '3 Slots & Fee Proposed',
        `${activePsych?.anonymizedTitle} picked up ${updated.id}, set fee to ₱${updated.pricePhp?.toLocaleString()}, and proposed 3 schedule slots. Client alerted.`
      );
    },
  });

  const handleOpenPickupModal = (bookingId: string) => {
    if (!canPickup) return;
    setActiveModalBookingId(bookingId);
    proposeMutation.reset();
    proposalForm.reset({
      pricePhp: 2500,
      slot1DateTime: defaultSlots.slot1,
      slot2DateTime: defaultSlots.slot2,
      slot3DateTime: defaultSlots.slot3,
    });
  };

  const handleCloseModal = () => {
    setActiveModalBookingId(null);
    proposeMutation.reset();
  };

  const handleOpenReview = (bookingId: string) => {
    setReviewBookingId(bookingId);
  };

  const handleCloseReview = () => {
    setReviewBookingId(null);
  };

  const handleReviewToProposal = () => {
    if (!reviewBooking) return;
    const bookingId = reviewBooking.id;
    setReviewBookingId(null);
    handleOpenPickupModal(bookingId);
  };

  const review = reviewQuery.data;

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
            Review incoming persona bookings, evaluate clinical fit, and claim requests by proposing{' '}
            <strong>session fee and 3 distinct schedule slots</strong>.
          </p>
        </div>

        {/* Practitioner State Switcher (mock mode only) */}
        {showSwitcher && <PractitionerSwitcher />}
      </header>

      {/* Non-Approved Psychologist Blocked Banner (Defense-in-depth) */}
      {!isVerified && activePsych && (
        <UnverifiedBanner
          title="Pending Administrative Approval — Pick-Up Actions Disabled"
          note={`${activePsych?.prcCredentialCode} · STATUS: WAITING_APPROVAL`}
          body={
            <>
              You are logged in as <strong>{activePsych?.anonymizedTitle}</strong>. In accordance with
              clinical governance standards, psychologists cannot pick up client booking requests or propose
              session slots until their PRC license credentials are authenticated and approved by clinic administrators.
            </>
          }
        />
      )}

      {isVerified && !hasSocialLinks && (
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

      {/* Success Notification if proposal was just submitted */}
      {recentProposedId && (
        <div className="bg-lime-soft/30 border border-sage/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sage text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-pine">
                Proposal Successfully Dispatched for {recentProposedId}
              </p>
              <p className="text-xs text-pine/80">
                The booking has transitioned to <strong>proposed</strong>. Client has been notified to select 1 slot and submit payment.
              </p>
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
              onClick={() => setRecentProposedId(null)}
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
            {pendingQueue.map((item) => (
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
                <Card
                  className="hover:border-sage transition-colors p-6 space-y-5 h-full"
                >
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

                  {/* Pick Up Action Button: Hidden or disabled when unverified */}
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
                        Pick Up &amp; Propose 3 Slots
                      </Button>
                    ) : !isVerified ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-sunken text-pine/50 border border-mist">
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                        Pick-Up Locked (Approval Pending)
                      </span>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs border-t border-mist/60 pt-4">
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
              </Card>
              </div>
            ))}
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
                <Button type="button" variant="primary" size="md" onClick={handleReviewToProposal}>
                  Pick Up &amp; Propose 3 Slots
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Pick-Up Proposal Modal — shared base (Escape close, backdrop click, focus trap) */}
      {targetBooking && (
        <Modal
          open
          onClose={handleCloseModal}
          title={`Pick Up Booking #${targetBooking.id}`}
          description={`${targetBooking.serviceTitle} (${targetBooking.serviceDuration}) · ${targetBooking.personaLabel}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
              Booking Step 3 · Claim &amp; Propose Slots
            </p>
            {/* Race Condition / Error Banner */}
            {proposeMutation.isError && (
              <div
                role="alert"
                className="bg-red-50 border-l-2 border-red-400 rounded-r-lg p-4 text-red-950 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                  <p className="font-heading text-base font-medium text-red-950">
                    Failed to Claim Request (Race Condition Detected)
                  </p>
                </div>
                <p className="text-xs text-red-900 leading-relaxed">
                  {proposeMutation.error?.message ||
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

            {/* Proposal Form */}
            <form
              onSubmit={proposalForm.handleSubmit((values) => proposeMutation.mutate(values))}
              className="space-y-5"
            >
              {/* Fee Input */}
              <div>
                <Label htmlFor="pickup-price">
                  Proposed Session Fee (PHP · ₱) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="pickup-price"
                  type="number"
                  step={100}
                  className="font-mono tabular-nums text-base"
                  placeholder="2500"
                  {...proposalForm.register('pricePhp', { valueAsNumber: true })}
                />
                {proposalForm.formState.errors.pricePhp && (
                  <p className="text-xs text-red-700 mt-1 font-medium">
                    {proposalForm.formState.errors.pricePhp.message}
                  </p>
                )}
              </div>

              {/* Exactly 3 Slots Required with no past dates */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Propose Exactly 3 Schedule Slots (PST) <span className="text-red-600">*</span>
                  </span>
                  <span className="text-xs text-accent-ink font-medium">
                    Must be distinct &amp; in the future
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Slot 1 */}
                  <div>
                    <Label htmlFor="modal-slot-1">Slot 1 (Date &amp; Time)</Label>
                    <Input
                      id="modal-slot-1"
                      type="datetime-local"
                      min={minDateTime}
                      className="font-mono tabular-nums text-xs"
                      {...proposalForm.register('slot1DateTime')}
                    />
                    {proposalForm.formState.errors.slot1DateTime && (
                      <p className="text-xs text-red-700 mt-1 font-medium">
                        {proposalForm.formState.errors.slot1DateTime.message}
                      </p>
                    )}
                  </div>

                  {/* Slot 2 */}
                  <div>
                    <Label htmlFor="modal-slot-2">Slot 2 (Date &amp; Time)</Label>
                    <Input
                      id="modal-slot-2"
                      type="datetime-local"
                      min={minDateTime}
                      className="font-mono tabular-nums text-xs"
                      {...proposalForm.register('slot2DateTime')}
                    />
                    {proposalForm.formState.errors.slot2DateTime && (
                      <p className="text-xs text-red-700 mt-1 font-medium">
                        {proposalForm.formState.errors.slot2DateTime.message}
                      </p>
                    )}
                  </div>

                  {/* Slot 3 */}
                  <div>
                    <Label htmlFor="modal-slot-3">Slot 3 (Date &amp; Time)</Label>
                    <Input
                      id="modal-slot-3"
                      type="datetime-local"
                      min={minDateTime}
                      className="font-mono tabular-nums text-xs"
                      {...proposalForm.register('slot3DateTime')}
                    />
                    {proposalForm.formState.errors.slot3DateTime && (
                      <p className="text-xs text-red-700 mt-1 font-medium">
                        {proposalForm.formState.errors.slot3DateTime.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-3 border-t border-mist">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleCloseModal}
                  disabled={proposeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={proposeMutation.isPending}
                >
                  {proposeMutation.isPending
                    ? 'Submitting Proposal...'
                    : 'Confirm Pick-Up & Send 3 Slots'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
