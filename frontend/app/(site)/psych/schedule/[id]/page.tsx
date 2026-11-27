'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import type { BookingRequest } from '@/lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
} from '@/lib/booking';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import {
  BookingStatusTag,
  Button,
  Checkbox,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
} from '@/components/ui/primitives';

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

function parseSlotDate(isoString?: string): Date | null {
  if (!isoString) return null;
  const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(isoString);
  const normalized = hasTimezone ? isoString : `${isoString}+08:00`;
  const slotDate = new Date(normalized);
  return Number.isNaN(slotDate.getTime()) ? null : slotDate;
}

function isValidMeetingLink(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export default function PsychologistScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const bookingId = decodeURIComponent(rawId);

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [completionOpen, setCompletionOpen] = useState(false);
  const [earlyCompletionAcknowledged, setEarlyCompletionAcknowledged] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    'no-show' | 'reschedule' | 'waive-fee' | null
  >(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleCounterDateTime, setRescheduleCounterDateTime] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [counterDateTime, setCounterDateTime] = useState('');
  const [meetingLinkInput, setMeetingLinkInput] = useState<string | null>(null);
  const [meetingLinkFeedback, setMeetingLinkFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const minDateTime = useMemo(() => formatForManilaInput(new Date()), []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  const directBookingQuery = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.getBookingById(bookingId),
    enabled: Boolean(bookingId),
  });

  const cachedFromSchedule = useMemo(
    () => bookingsQuery.data?.find((b) => b.id === bookingId) ?? null,
    [bookingsQuery.data, bookingId]
  );

  const session: BookingRequest | null = useMemo(() => {
    const direct = directBookingQuery.data ?? null;
    if (direct && cachedFromSchedule) {
      return {
        ...direct,
        conflictingSlotIds: direct.conflictingSlotIds?.length
          ? direct.conflictingSlotIds
          : cachedFromSchedule.conflictingSlotIds,
      };
    }
    return direct ?? cachedFromSchedule;
  }, [cachedFromSchedule, directBookingQuery.data]);

  const isLoadingSession =
    !session && (bookingsQuery.isLoading || directBookingQuery.isLoading);
  const loadError = !session ? directBookingQuery.error || bookingsQuery.error : null;

  const invalidateSession = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
  };

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeAppointment(id),
    onSuccess: () => {
      invalidateSession();
      setCompletionOpen(false);
      setEarlyCompletionAcknowledged(false);
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => api.markNoShow(id),
    onSuccess: () => {
      setActionError(null);
      setConfirmAction(null);
      invalidateSession();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const waiveFeeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.waiveRescheduleFee(id, reason),
    onSuccess: () => {
      setActionError(null);
      setConfirmAction(null);
      setWaiverReason('');
      invalidateSession();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({
      id,
      reason,
      counterDateTime: nextCounter,
    }: {
      id: string;
      reason?: string;
      counterDateTime: string;
    }) => api.requestReschedule(id, { reason, counterDateTime: nextCounter }),
    onSuccess: () => {
      setActionError(null);
      setConfirmAction(null);
      setRescheduleReason('');
      setRescheduleCounterDateTime('');
      invalidateSession();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const meetingLinkMutation = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      api.updateMeetingLink(id, url),
    onSuccess: () => {
      invalidateSession();
      setMeetingLinkFeedback({
        type: 'success',
        message: 'Meeting link saved and emailed to client.',
      });
    },
    onError: (err: Error) => {
      const isInvalidLink =
        (err instanceof ApiError && err.status === 422) ||
        /meeting_link|valid https:\/\/ url/i.test(err.message);
      setMeetingLinkFeedback({
        type: 'error',
        message: isInvalidLink
          ? 'Invalid link. Please enter a valid https:// URL.'
          : getFriendlyErrorMessage(err, 'Could not save meeting link. Please try again.'),
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (values: {
      id: string;
      slotId?: string;
      counterDateTime?: string;
    }) => {
      if (values.slotId) {
        return await api.acceptPreferredSlot({
          bookingId: values.id,
          slotId: values.slotId,
        });
      }
      if (values.counterDateTime) {
        return await api.counterOffer({
          bookingId: values.id,
          dateTime: values.counterDateTime,
        });
      }
      throw new Error('Choose a preferred schedule or offer an alternative.');
    },
    onSuccess: () => {
      invalidateSession();
      setReviewOpen(false);
      setSelectedSlotId(null);
      setCounterDateTime('');
    },
  });

  if (isLoadingSession) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-12 w-2/3" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <Skeleton className="h-44" />
            <Skeleton className="h-48" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <Link
          href="/psych/schedule"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to My Schedule
        </Link>

        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-6 text-xs text-red-900 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-950">
                Could not load session details.
              </p>
              <p className="mt-1 text-red-800">
                {getFriendlyErrorMessage(
                  loadError,
                  'Please refresh or return to your schedule.'
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
              onClick={() => router.push('/psych/schedule')}
            >
              Return to Schedule
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <Link
          href="/psych/schedule"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to My Schedule
        </Link>

        <div className="rounded-2xl border border-mist bg-surface-raised">
          <EmptyState
            icon={CalendarDays}
            title="Session Not Found"
            description="We could not locate this scheduled session. It may have been removed or reassigned."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push('/psych/schedule')}
              >
                Return to My Schedule
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const confirmedSlot = agreedSlot(session);
  const preferredSlots = clientPreferredSlots(session);
  const counterSlot = psychologistCounterSlot(session);
  const conflictIds = new Set(session.conflictingSlotIds ?? []);

  const isCompleted = session.status === 'completed';
  const isConfirmed = session.status === 'paid-confirmed' || isCompleted;
  const isAwaitingPayment = session.status === 'awaiting-payment';
  const isNegotiating =
    session.status === 'awaiting-review' || session.status === 'awaiting-client';

  const isSlotPast = (isoString?: string) => {
    const slotDate = parseSlotDate(isoString);
    return slotDate !== null && slotDate.getTime() < currentTime;
  };

  const selectedSlot = session.proposedSlots.find((s) => s.id === session.selectedSlotId);
  const slotStartMs = parseSlotDate(selectedSlot?.isoDateTime)?.getTime() ?? null;
  const isEarlyCompletion = slotStartMs !== null && currentTime < slotStartMs;

  const durationMinutesLabel =
    typeof session.serviceDurationMinutes === 'number' &&
    session.serviceDurationMinutes > 0
      ? `${session.serviceDurationMinutes} mins`
      : session.serviceDuration;

  const currentMeetingLinkValue = meetingLinkInput ?? session.meetingLink ?? '';

  const openReviewModal = () => {
    reviewMutation.reset();
    setCounterDateTime('');
    const firstAvailable = preferredSlots.find((slot) => !conflictIds.has(slot.id));
    setSelectedSlotId(firstAvailable?.id ?? null);
    setReviewOpen(true);
  };

  const closeReviewModal = () => {
    if (reviewMutation.isPending) return;
    reviewMutation.reset();
    setReviewOpen(false);
    setSelectedSlotId(null);
    setCounterDateTime('');
  };

  const closeCompletionModal = () => {
    if (completeMutation.isPending) return;
    completeMutation.reset();
    setCompletionOpen(false);
    setEarlyCompletionAcknowledged(false);
  };

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/psych/schedule"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to My Schedule
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b border-mist pb-5">
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
          {session.serviceTitle}
        </h1>
      </header>

      {actionError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Overview, Schedule & Client Contact */}
        <div className="lg:col-span-7 space-y-6">
          {/* Session Overview */}
          <section
            aria-labelledby="psych-session-overview-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-5"
          >
            <h2
              id="psych-session-overview-heading"
              className="font-heading text-xl font-medium text-pine"
            >
              Session Overview
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Client Profile
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-pine font-medium">
                  <span>{session.profileLabel}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-surface-sunken text-accent-ink border border-mist/70">
                    {session.profileType}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Session Fee
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-pine tabular-nums">
                  {session.pricePhp != null ? `₱${session.pricePhp.toLocaleString()}` : '—'}
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
                  {session.submittedAt}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Payment Status
                </dt>
                <dd className="mt-1 text-xs font-medium text-pine">
                  {isCompleted
                    ? `Completed (Paid ₱${session.pricePhp?.toLocaleString()})`
                    : isConfirmed
                      ? `Paid (₱${session.pricePhp?.toLocaleString()})`
                      : isAwaitingPayment
                        ? 'Agreed · Awaiting Client Payment'
                        : 'Scheduling in progress'}
                </dd>
              </div>

              {session.paidAt && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Payment Timestamp
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-pine tabular-nums">
                    {session.paidAt}
                  </dd>
                </div>
              )}

              {session.rescheduleWaiverReason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Fee Waiver Reason
                  </dt>
                  <dd className="mt-1 text-xs text-pine">{session.rescheduleWaiverReason}</dd>
                </div>
              )}

              {session.refundAmountCentavos != null && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Refunded Amount
                  </dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-pine">
                    ₱{(session.refundAmountCentavos / 100).toLocaleString()}
                  </dd>
                </div>
              )}

              {session.refundReason && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Refund Reason
                  </dt>
                  <dd className="mt-1 text-xs text-pine">{session.refundReason}</dd>
                </div>
              )}
            </dl>

            {session.serviceGuardrail && (
              <div className="pt-4 border-t border-mist/60">
                <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Clinical Scope
                </p>
                <p className="mt-1 text-sm text-accent-ink font-medium leading-relaxed">
                  {session.serviceGuardrail}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-mist/60">
              <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Presenting Concerns
              </p>
              <p className="mt-1.5 text-sm text-pine/85 leading-relaxed max-w-prose whitespace-pre-wrap">
                {session.concernsSummary}
              </p>
            </div>
          </section>

          {/* Schedule & Meeting Link */}
          <section
            aria-labelledby="psych-schedule-slot-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="psych-schedule-slot-heading"
                className="font-heading text-xl font-medium text-pine"
              >
                Schedule
              </h2>
              <span className="text-xs text-pine/60">Philippine Time (PHT, GMT+8)</span>
            </div>

            {isConfirmed && confirmedSlot ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-parchment border border-mist flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-accent-ink uppercase tracking-wide text-[11px]">
                      Confirmed Session Appointment
                    </p>
                    <p className="font-semibold text-pine text-sm tabular-nums">
                      {confirmedSlot.dateLabel}
                    </p>
                    <p className="font-mono text-accent-ink font-medium tabular-nums">
                      {confirmedSlot.timeLabel}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-surface-raised rounded-md font-mono text-xs font-semibold text-pine border border-mist">
                    Slot 0{confirmedSlot.slotNumber} Selected
                  </span>
                </div>

                {session.status === 'paid-confirmed' && (
                  <div className="p-4 rounded-xl bg-parchment border border-mist space-y-2 text-xs">
                    <Label htmlFor="psych-detail-meeting-link">
                      Session Meeting Link (https://)
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        id="psych-detail-meeting-link"
                        type="url"
                        placeholder="https://meet.google.com/..."
                        value={currentMeetingLinkValue}
                        onChange={(e) => {
                          setMeetingLinkInput(e.target.value);
                          if (meetingLinkFeedback) setMeetingLinkFeedback(null);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={meetingLinkMutation.isPending}
                        onClick={() => {
                          if (!isValidMeetingLink(currentMeetingLinkValue)) {
                            setMeetingLinkFeedback({
                              type: 'error',
                              message: 'Invalid link. Please enter a valid https:// URL.',
                            });
                            return;
                          }
                          setMeetingLinkFeedback(null);
                          meetingLinkMutation.mutate({
                            id: session.id,
                            url: currentMeetingLinkValue,
                          });
                        }}
                      >
                        {session.meetingLink ? 'Update Link' : 'Save Link'}
                      </Button>
                    </div>
                    {meetingLinkFeedback && (
                      <p
                        role={meetingLinkFeedback.type === 'error' ? 'alert' : 'status'}
                        className={`text-xs font-medium ${
                          meetingLinkFeedback.type === 'error'
                            ? 'text-red-700'
                            : 'text-accent-ink'
                        }`}
                      >
                        {meetingLinkFeedback.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : isAwaitingPayment && confirmedSlot ? (
              <div className="p-4 rounded-xl bg-parchment border border-mist text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-accent-ink uppercase tracking-wide text-[11px]">
                      Agreed Schedule · Awaiting Client Payment
                    </p>
                    <p className="font-semibold text-pine text-sm tabular-nums">
                      {confirmedSlot.dateLabel}
                    </p>
                    <p className="font-mono text-accent-ink font-medium tabular-nums">
                      {confirmedSlot.timeLabel}
                    </p>
                  </div>
                  {session.paymentDeadline && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200">
                      {formatDeadlineCountdown(session.paymentDeadline)}
                    </span>
                  )}
                </div>
                {session.paymentDeadline && (
                  <p className="text-pine/65">
                    Deadline: {formatManilaDateTime(session.paymentDeadline)}
                  </p>
                )}
              </div>
            ) : session.status === 'reschedule-requested' || session.status === 'no-show' ? (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                <p className="font-semibold uppercase tracking-wide">
                  {session.status === 'no-show'
                    ? 'Marked No-Show · ₱600 Reschedule Fee Pending'
                    : 'Late Reschedule Requested · ₱600 Fee Pending'}
                </p>
                <p className="text-pine/85">
                  The client must pay the ₱600 reschedule fee before proposing new times, or you
                  can waive the fee to reopen schedule negotiation immediately.
                </p>
                {session.rescheduleReason && (
                  <p className="text-pine/75">Reason: {session.rescheduleReason}</p>
                )}
              </div>
            ) : isNegotiating ? (
              <div className="space-y-3 text-xs">
                <p className="font-semibold text-pine">
                  {session.status === 'awaiting-review'
                    ? preferredSlots.length > 0
                      ? 'Client Preferred Schedules — Awaiting Your Review'
                      : 'Client Requested Reschedule — Offer an Alternative Time'
                    : counterSlot
                      ? 'Your Alternative Schedule — Awaiting Client Response'
                      : 'Awaiting Client’s New Preferred Schedules'}
                </p>
                {session.status === 'awaiting-review' && preferredSlots.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {preferredSlots.map((slot, index) => (
                      <div
                        key={slot.id}
                        className="p-3 bg-parchment rounded-xl border border-mist/70"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-pine/55">
                          Option {index + 1}
                        </p>
                        <p className="text-pine font-medium text-xs mt-0.5 tabular-nums">
                          {slot.dateLabel}
                        </p>
                        <p className="font-mono text-[11px] text-accent-ink tabular-nums">
                          {slot.timeLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : counterSlot ? (
                  <div className="p-3 bg-parchment rounded-xl border border-mist/70 max-w-xs">
                    <p className="text-pine font-medium text-xs tabular-nums">
                      {counterSlot.dateLabel}
                    </p>
                    <p className="font-mono text-[11px] text-accent-ink tabular-nums">
                      {counterSlot.timeLabel}
                    </p>
                  </div>
                ) : (
                  <p className="text-pine/65">
                    {session.status === 'awaiting-review'
                      ? 'Use Review Preferred Schedules to offer an alternative time.'
                      : 'Waiting for the client to submit 3 to 5 new preferred schedules.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-pine/65">No active schedule slot for this session.</p>
            )}
          </section>

          {/* Client Contact & Coordination */}
          <section
            aria-labelledby="psych-client-contact-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-3"
          >
            <h2
              id="psych-client-contact-heading"
              className="font-heading text-xl font-medium text-pine"
            >
              Client Contact &amp; Coordination
            </h2>

            {session.clientSocialMedia ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    Client&apos;s Preferred Social Media
                  </span>
                  <p className="text-sm font-medium text-pine mt-0.5">
                    {session.clientSocialMedia.platform || 'Social media'}
                    {session.clientSocialMedia.username
                      ? ` · ${session.clientSocialMedia.username}`
                      : ''}
                  </p>
                </div>
                <p className="text-pine/75 leading-relaxed">
                  Coordinate the session directly through the client&apos;s preferred channel.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-sunken border border-dashed border-mist space-y-1.5 text-xs">
                <p className="font-semibold text-pine/80">No Client Social Media Provided</p>
                <p className="text-pine/75 leading-relaxed">
                  The client did not provide social media contact details.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right: Status & Actions */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <section
            aria-labelledby="psych-session-status-heading"
            className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-5"
          >
            <div className="space-y-2 border-b border-mist/70 pb-4">
              <h2
                id="psych-session-status-heading"
                className="font-heading text-xl font-medium text-pine"
              >
                Status
              </h2>
              <div>
                <BookingStatusTag status={session.status} perspective="psychologist" />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {session.status === 'awaiting-review' && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={openReviewModal}
                >
                  Review Preferred Schedules
                </Button>
              )}

              {session.status === 'paid-confirmed' && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      completeMutation.reset();
                      setEarlyCompletionAcknowledged(false);
                      setCompletionOpen(true);
                    }}
                  >
                    Mark Session Completed
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-full"
                    disabled={rescheduleMutation.isPending}
                    onClick={() => {
                      rescheduleMutation.reset();
                      setActionError(null);
                      setRescheduleReason('');
                      setRescheduleCounterDateTime('');
                      setConfirmAction('reschedule');
                    }}
                  >
                    Request Reschedule
                  </Button>
                  {confirmedSlot && isSlotPast(confirmedSlot.isoDateTime) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="w-full text-amber-900 border-amber-300 hover:bg-amber-50"
                      disabled={noShowMutation.isPending}
                      onClick={() => {
                        noShowMutation.reset();
                        setActionError(null);
                        setConfirmAction('no-show');
                      }}
                    >
                      Mark No-Show
                    </Button>
                  )}
                </>
              )}

              {(session.status === 'reschedule-requested' ||
                session.status === 'no-show') && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={waiveFeeMutation.isPending}
                  onClick={() => {
                    waiveFeeMutation.reset();
                    setActionError(null);
                    setWaiverReason('');
                    setConfirmAction('waive-fee');
                  }}
                >
                  Waive ₱600 Reschedule Fee
                </Button>
              )}

              {isCompleted && (
                <p className="text-xs font-medium text-pine/70">Session marked completed.</p>
              )}

              {session.status === 'awaiting-client' && (
                <p className="text-xs text-pine/75 leading-relaxed">
                  Waiting for the client to respond to your offered schedule or propose new times.
                </p>
              )}

              {session.status === 'awaiting-payment' && (
                <p className="text-xs text-pine/75 leading-relaxed">
                  The agreed slot is reserved while awaiting client payment.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Confirm No-Show / Waive Fee / Reschedule Modal */}
      <Modal
        open={confirmAction !== null}
        onClose={() => {
          if (
            noShowMutation.isPending ||
            waiveFeeMutation.isPending ||
            rescheduleMutation.isPending
          )
            return;
          setConfirmAction(null);
          setRescheduleReason('');
          setRescheduleCounterDateTime('');
          setWaiverReason('');
        }}
        title={
          confirmAction === 'no-show'
            ? 'Mark Session as No-Show?'
            : confirmAction === 'waive-fee'
              ? 'Waive ₱600 Reschedule Fee?'
              : 'Request Session Reschedule?'
        }
        description={
          confirmAction === 'reschedule'
            ? undefined
            : `${session.profileLabel} · ${session.serviceTitle}`
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={
                noShowMutation.isPending ||
                waiveFeeMutation.isPending ||
                rescheduleMutation.isPending
              }
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'no-show' ? 'danger' : 'primary'}
              size="sm"
              disabled={
                noShowMutation.isPending ||
                waiveFeeMutation.isPending ||
                rescheduleMutation.isPending ||
                (confirmAction === 'waive-fee' && !waiverReason.trim()) ||
                (confirmAction === 'reschedule' && !rescheduleCounterDateTime)
              }
              onClick={() => {
                if (confirmAction === 'no-show') {
                  noShowMutation.mutate(session.id);
                } else if (confirmAction === 'waive-fee') {
                  waiveFeeMutation.mutate({ id: session.id, reason: waiverReason });
                } else if (confirmAction === 'reschedule') {
                  rescheduleMutation.mutate({
                    id: session.id,
                    reason: rescheduleReason,
                    counterDateTime: rescheduleCounterDateTime,
                  });
                }
              }}
            >
              {noShowMutation.isPending ||
              waiveFeeMutation.isPending ||
              rescheduleMutation.isPending
                ? 'Processing…'
                : confirmAction === 'no-show'
                  ? 'Confirm No-Show'
                  : confirmAction === 'waive-fee'
                    ? 'Confirm Waiver & Reopen Scheduling'
                    : 'Confirm Reschedule Request'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-pine/85">
          {confirmAction === 'no-show' && (
            <p>
              Marking this session as a no-show releases the scheduled slot and requires the client
              to pay a ₱600 reschedule fee unless you waive it.
            </p>
          )}
          {confirmAction === 'waive-fee' && (
            <div className="space-y-2">
              <p>
                Waiving the ₱600 reschedule fee lets the client submit new preferred schedules
                immediately at no extra charge (internal RPsy prerogative for valid reasons).
              </p>
              <div className="space-y-1">
                <Label htmlFor="psych-waiver-reason">Valid reason for waiving fee</Label>
                <Input
                  id="psych-waiver-reason"
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  placeholder="Document the valid reason for waiving the ₱600 fee"
                />
              </div>
            </div>
          )}
          {confirmAction === 'reschedule' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="psych-reschedule-slot">
                  Earliest Available Schedule (Required)
                </Label>
                <Input
                  id="psych-reschedule-slot"
                  type="datetime-local"
                  min={minDateTime}
                  value={rescheduleCounterDateTime}
                  onChange={(e) => setRescheduleCounterDateTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="psych-reschedule-reason">Reason (optional)</Label>
                <Input
                  id="psych-reschedule-reason"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Share a brief reason with the client"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Completion Confirmation Modal */}
      <Modal
        open={completionOpen}
        onClose={closeCompletionModal}
        title={
          isEarlyCompletion ? 'Complete this session early?' : 'Mark this session as completed?'
        }
        description="This closes the appointment and moves it to the Past tab."
        maxWidth="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeCompletionModal}
              disabled={completeMutation.isPending}
            >
              Keep Open
            </Button>
            <Button
              variant={isEarlyCompletion ? 'danger' : 'primary'}
              size="sm"
              onClick={() => completeMutation.mutate(session.id)}
              disabled={
                completeMutation.isPending ||
                (isEarlyCompletion && !earlyCompletionAcknowledged)
              }
            >
              {completeMutation.isPending
                ? 'Completing…'
                : isEarlyCompletion
                  ? 'Confirm Early Completion'
                  : 'Mark Completed'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-pine/85">
          <div className="rounded-lg border border-mist bg-surface-raised p-3 text-xs">
            <p className="font-semibold text-pine">
              {session.profileLabel} · {session.serviceTitle}
            </p>
            {selectedSlot && (
              <p className="mt-1 text-pine/75">
                {selectedSlot.dateLabel} · {selectedSlot.timeLabel}
              </p>
            )}
          </div>

          {isEarlyCompletion ? (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1.5">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  This session has not started yet.
                </p>
                <p>
                  It is scheduled for{' '}
                  <strong>
                    {selectedSlot
                      ? `${selectedSlot.dateLabel} · ${selectedSlot.timeLabel}`
                      : 'a future time'}
                  </strong>
                  . Completing it now will close the session before its start time.
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-pine/85 cursor-pointer">
                <Checkbox
                  checked={earlyCompletionAcknowledged}
                  onChange={(event) => setEarlyCompletionAcknowledged(event.target.checked)}
                />
                <span>
                  I understand this session has not started yet and want to mark it as completed
                  now.
                </span>
              </label>
            </>
          ) : (
            <p className="text-xs text-pine/75">
              Confirm only if the appointment took place and is ready to be archived.
            </p>
          )}

          {completeMutation.error && (
            <p role="alert" className="text-xs text-red-700">
              {getFriendlyErrorMessage(
                completeMutation.error,
                'Could not mark this session complete. Please try again.'
              )}
            </p>
          )}
        </div>
      </Modal>

      {/* Review Preferred Schedules Modal */}
      {reviewOpen && session.status === 'awaiting-review' && (
        <Modal
          open
          onClose={closeReviewModal}
          title="Review Preferred Schedules"
          description={`${session.serviceTitle} (${durationMinutesLabel}) · ${session.profileLabel} · Fee: ₱${session.pricePhp?.toLocaleString() ?? '—'}`}
          maxWidth="2xl"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              reviewMutation.mutate({
                id: session.id,
                slotId: selectedSlotId ?? undefined,
                counterDateTime: counterDateTime || undefined,
              });
            }}
            className="space-y-5"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
              Round {session.schedulingRound} · Respond to Client&apos;s Preferred Schedules
            </p>

            {reviewMutation.isError && (
              <div
                role="alert"
                className="bg-red-50 border-l-2 border-red-400 rounded-r-lg p-4 text-red-950 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                  <p className="font-heading text-sm font-medium text-red-950">
                    Could Not Save Schedule Decision
                  </p>
                </div>
                <p className="text-xs text-red-900 leading-relaxed">
                  {getFriendlyErrorMessage(
                    reviewMutation.error,
                    'Unable to update schedule right now. Please try again.'
                  )}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Accept One of the Client&apos;s Preferred Schedules
                </span>
                <div className="flex items-center gap-3">
                  {selectedSlotId && (
                    <button
                      type="button"
                      onClick={() => setSelectedSlotId(null)}
                      disabled={reviewMutation.isPending}
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

              {preferredSlots.length === 0 ? (
                <p className="rounded-lg border border-mist bg-surface-sunken/40 p-3 text-xs text-pine/70">
                  No open preferred schedules found in this round. Offer the nearest available
                  alternative below.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {preferredSlots.map((slot, index) => {
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
                          name="review-preferred-schedule"
                          className="mt-0.5 h-4 w-4 accent-sage"
                          checked={isSelected}
                          disabled={hasConflict || reviewMutation.isPending}
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

            <div className="space-y-2 rounded-lg border border-mist bg-surface-sunken/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pine/60" aria-hidden="true" />
                  <Label htmlFor="schedule-counter-datetime" className="mb-0">
                    None of these work? Offer the nearest available alternative
                  </Label>
                </div>
                {counterDateTime && (
                  <button
                    type="button"
                    onClick={() => setCounterDateTime('')}
                    disabled={reviewMutation.isPending}
                    className="text-xs font-semibold text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <DateTimePicker
                id="schedule-counter-datetime"
                min={minDateTime}
                value={counterDateTime}
                onChange={(nextValue) => {
                  setCounterDateTime(nextValue);
                  if (nextValue) setSelectedSlotId(null);
                }}
                disabled={reviewMutation.isPending}
              />
              <p className="text-[11px] text-pine/55">
                You can offer exactly one alternative time. Click a selected slot again or
                &ldquo;Clear selection&rdquo; above to unselect it.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-3 border-t border-mist">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={closeReviewModal}
                disabled={reviewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={reviewMutation.isPending || (!selectedSlotId && !counterDateTime)}
              >
                {reviewMutation.isPending
                  ? 'Saving…'
                  : selectedSlotId
                    ? 'Accept Selected Schedule'
                    : 'Offer Alternative'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
