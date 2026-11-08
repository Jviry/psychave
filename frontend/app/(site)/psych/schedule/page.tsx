'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { useActivePsychologist } from '../../../../hooks/useActivePsychologist';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, ChevronDown, CalendarDays, Clock } from 'lucide-react';
import type { BookingRequest } from '../../../../lib/types';
import {
  agreedSlot,
  clientPreferredSlots,
  formatDeadlineCountdown,
  formatManilaDateTime,
  psychologistCounterSlot,
} from '../../../../lib/booking';
import {
  BookingStatusTag,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
} from '../../../../components/ui/primitives';

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

type ScheduleTab =
  | 'upcoming'
  | 'past'
  | 'negotiating'
  | 'awaiting-payment'
  | 'all';

export default function PsychologistSchedulePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activePsych } = useActivePsychologist();

  const [activeTab, setActiveTab] = useState<ScheduleTab>('upcoming');
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});
  const [completionTarget, setCompletionTarget] = useState<BookingRequest | null>(null);
  const [earlyCompletionAcknowledged, setEarlyCompletionAcknowledged] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [counterDateTime, setCounterDateTime] = useState('');

  const minDateTime = useMemo(() => formatForManilaInput(new Date()), []);

  const { data: bookings = [], isLoading, error: bookingsError } = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  const completeMutation = useMutation({
    mutationFn: (bookingId: string) => api.completeAppointment(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCompletionTarget(null);
      setEarlyCompletionAcknowledged(false);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (values: {
      bookingId: string;
      slotId?: string;
      counterDateTime?: string;
    }) => {
      if (values.slotId) {
        return await api.acceptPreferredSlot({
          bookingId: values.bookingId,
          slotId: values.slotId,
        });
      }
      if (values.counterDateTime) {
        return await api.counterOffer({
          bookingId: values.bookingId,
          dateTime: values.counterDateTime,
        });
      }
      throw new Error('Choose a preferred schedule or offer an alternative.');
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', updated.id] });
      setReviewTargetId(null);
      setSelectedSlotId(null);
      setCounterDateTime('');
    },
  });

  // getBookingsForRole('psychologist') also returns the open pending queue.
  // This page only owns requests already claimed by this psychologist.
  const myAssignedSessions = bookings.filter((session) => session.psychologistId);
  const reviewTarget =
    myAssignedSessions.find(
      (session) =>
        session.id === reviewTargetId && session.status === 'awaiting-review'
    ) ?? null;
  const reviewPreferredSlots = reviewTarget
    ? clientPreferredSlots(reviewTarget)
    : [];
  const reviewConflictIds = new Set(reviewTarget?.conflictingSlotIds ?? []);

  const openReviewModal = (session: BookingRequest) => {
    reviewMutation.reset();
    setReviewTargetId(session.id);
    setCounterDateTime('');
    const conflicts = new Set(session.conflictingSlotIds ?? []);
    const firstAvailable = clientPreferredSlots(session).find(
      (slot) => !conflicts.has(slot.id)
    );
    setSelectedSlotId(firstAvailable?.id ?? null);
  };

  const closeReviewModal = () => {
    if (reviewMutation.isPending) return;
    reviewMutation.reset();
    setReviewTargetId(null);
    setSelectedSlotId(null);
    setCounterDateTime('');
  };

  const handleReviewSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reviewTarget) return;
    reviewMutation.mutate({
      bookingId: reviewTarget.id,
      slotId: selectedSlotId ?? undefined,
      counterDateTime: counterDateTime || undefined,
    });
  };

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Periodically refresh current time (every 30s) so session categorization dynamically updates without full refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const parseSlotDate = (isoString?: string) => {
    if (!isoString) return null;
    const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(isoString);
    const normalized = hasTimezone ? isoString : `${isoString}+08:00`;
    const slotDate = new Date(normalized);
    return Number.isNaN(slotDate.getTime()) ? null : slotDate;
  };

  // Determine if a session slot is upcoming or past based on current clock (Asia/Manila)
  const isSlotPast = (isoString?: string) => {
    const slotDate = parseSlotDate(isoString);
    return slotDate !== null && slotDate.getTime() < currentTime;
  };

  const selectedSlotFor = (session: BookingRequest) =>
    session.proposedSlots.find((slot) => slot.id === session.selectedSlotId);

  const slotEndTime = (session: BookingRequest) => {
    const slot = selectedSlotFor(session);
    if (!slot) return null;
    const exactEnd = parseSlotDate(slot.endIsoDateTime);
    if (exactEnd) return exactEnd.getTime();
    const start = parseSlotDate(slot.isoDateTime);
    if (!start) return null;
    return start.getTime() + session.serviceDurationMinutes * 60_000;
  };

  // Categorize sessions into upcoming, past, negotiating, and awaiting payment.
  const categorizedSessions = useMemo(() => {
    const upcoming: typeof myAssignedSessions = [];
    const past: typeof myAssignedSessions = [];
    const negotiating: typeof myAssignedSessions = [];
    const awaitingPayment: typeof myAssignedSessions = [];

    myAssignedSessions.forEach((session) => {
      if (session.status === 'completed') {
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
        session.status === 'awaiting-client'
      ) {
        negotiating.push(session);
      }
      // Note: cancelled sessions remain cataloged under 'all' (All Assigned).
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

  const completionSlot = completionTarget
    ? selectedSlotFor(completionTarget)
    : undefined;
  const completionEndsAt = completionTarget ? slotEndTime(completionTarget) : null;
  const isEarlyCompletion =
    completionEndsAt !== null && completionEndsAt > currentTime;

  const closeCompletionModal = () => {
    if (completeMutation.isPending) return;
    completeMutation.reset();
    setCompletionTarget(null);
    setEarlyCompletionAcknowledged(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedBookingIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Psychologist Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>My Schedule &amp; Clinical Management</span>
          </div>
          <h1 className="font-heading text-4xl font-medium text-pine">
            My Practice Schedule
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Track schedule negotiations, agreed sessions awaiting payment, and confirmed
            appointments separated into upcoming and past sessions.
          </p>
        </div>

      </header>

      {bookingsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-900">
          <p className="font-semibold">Could not load your schedule.</p>
          <p className="mt-1 break-words">{(bookingsError as Error).message}</p>
        </div>
      )}

      {/* Tabs Navigation for Schedule Separation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-mist pb-3">
        <div
          role="group"
          aria-label="Filter schedule sessions"
          className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist"
        >
          {(
            [
              { id: 'upcoming', label: 'Upcoming Confirmed', count: categorizedSessions.upcoming.length },
              { id: 'negotiating', label: 'In Negotiation', count: categorizedSessions.negotiating.length },
              { id: 'awaiting-payment', label: 'Awaiting Client Payment', count: categorizedSessions.awaitingPayment.length },
              { id: 'past', label: 'Past Confirmed', count: categorizedSessions.past.length },
              { id: 'all', label: `All Assigned (${categorizedSessions.all.length})`, count: null },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ScheduleTab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                  : 'text-pine/70 hover:text-pine'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-sage/15 text-pine font-semibold'
                      : 'bg-surface-raised text-pine/60'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs text-pine/70 font-mono">
          Psychologist: <span className="font-semibold text-accent-ink">{activePsych?.anonymizedTitle ?? 'Authenticated psychologist'}</span>
        </div>
      </div>

      {/* Main Schedule Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : displayedSessions.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={CalendarDays}
          title={
            activeTab === 'upcoming' && 'No Upcoming Confirmed Sessions'
            || activeTab === 'past' && 'No Past Sessions Recorded'
            || activeTab === 'negotiating' && 'No Active Schedule Negotiations'
            || activeTab === 'awaiting-payment' && 'No Agreed Sessions Awaiting Payment'
            || 'No Sessions Assigned to this Account Yet'
          }
          description={
            activeTab === 'upcoming' &&
              'When a client pays for an agreed schedule, the confirmed session appears here.'
            || activeTab === 'past' &&
              'Completed or past appointments will be cataloged in this archive view.'
            || activeTab === 'negotiating' &&
              'Requests waiting on your review or the client’s response appear here.'
            || activeTab === 'awaiting-payment' &&
              'Agreed schedules stay here until the client pays or the payment deadline releases the slot.'
            || 'Visit the Pending Requests queue to pick up new bookings and agree on schedules.'
          }
          action={
            <Button variant="primary" size="sm" onClick={() => router.push('/psych/queue')}>
              Open Pending Requests Queue
            </Button>
          }
        />
      ) : (
        /* Sessions List */
        <div className="space-y-6">
          {displayedSessions.map((session) => {
            const isExpanded = !!expandedBookingIds[session.id];
            const confirmedSlot = agreedSlot(session);
            const isCompleted = session.status === 'completed';
            const isConfirmed =
              session.status === 'paid-confirmed' || isCompleted;
            const isAwaitingPayment = session.status === 'awaiting-payment';
            const isNegotiating =
              session.status === 'awaiting-review' ||
              session.status === 'awaiting-client';
            const preferredSlots = clientPreferredSlots(session);
            const counterSlot = psychologistCounterSlot(session);

            return (
              <Card
                key={session.id}
                className="hover:border-sage transition-all space-y-5 p-6"
              >
                {/* Card Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-mist/70 pb-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-medium text-pine text-sm">
                      {session.id}
                    </span>
                    <span className="text-mist">·</span>
                    <span className="font-semibold text-accent-ink">
                      {session.personaLabel} ({session.personaType})
                    </span>
                    <span className="text-mist">·</span>
                    <span className="text-pine/70 font-mono">
                      Fee: ₱{session.pricePhp?.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Payment status — single label source (BookingStatusTag only) */}
                    <BookingStatusTag status={session.status} />
                  </div>
                </div>

                {/* Primary Overview: Service & Slot Info */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-8 space-y-3">
                    <div>
                      <h2 className="font-heading text-2xl font-medium text-pine">
                        {session.serviceTitle} ({session.serviceDuration})
                      </h2>
                      <p className="text-xs text-pine/70 mt-0.5">
                        Clinical Guardrail: {session.serviceGuardrail}
                      </p>
                    </div>

                    {/* Selected Slot, Agreed Slot, or Negotiation Preview */}
                    {isConfirmed && confirmedSlot ? (
                      <div className="p-3.5 rounded-lg bg-surface-raised border border-mist flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-accent-ink uppercase tracking-wide text-xs">
                            Confirmed Session Appointment
                          </p>
                          <p className="font-medium text-pine text-sm">
                            {confirmedSlot.dateLabel}
                          </p>
                          <p className="font-mono text-accent-ink font-medium">
                            {confirmedSlot.timeLabel}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 bg-surface-raised rounded-md font-mono text-xs font-semibold text-pine border border-mist">
                          Slot 0{confirmedSlot.slotNumber} Selected
                        </span>
                      </div>
                    ) : isAwaitingPayment && confirmedSlot ? (
                      <div className="p-3.5 rounded-lg bg-surface-raised border border-mist text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-accent-ink uppercase tracking-wide text-xs">
                              Agreed Schedule · Awaiting Client Payment
                            </p>
                            <p className="font-medium text-pine text-sm">
                              {confirmedSlot.dateLabel}
                            </p>
                            <p className="font-mono text-accent-ink font-medium">
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
                    ) : isNegotiating ? (
                      <div className="p-3.5 rounded-lg bg-surface-raised border border-mist text-xs space-y-2">
                        <p className="font-semibold text-pine">
                          {session.status === 'awaiting-review'
                            ? 'Client Preferred Schedules — Awaiting Your Review'
                            : 'Your Alternative Schedule — Awaiting Client Response'}
                        </p>
                        {session.status === 'awaiting-review' &&
                        preferredSlots.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {preferredSlots.map((slot, index) => (
                              <div
                                key={slot.id}
                                className="p-2 bg-surface-raised rounded-md border border-mist/70"
                              >
                                <p className="font-semibold text-xs text-pine">
                                  Option {index + 1}
                                </p>
                                <p className="text-pine/80 text-xs">{slot.dateLabel}</p>
                                <p className="font-mono text-xs text-accent-ink">
                                  {slot.timeLabel}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : counterSlot ? (
                          <div className="p-2 bg-surface-raised rounded-md border border-mist/70 max-w-xs">
                            <p className="text-pine/80 text-xs">{counterSlot.dateLabel}</p>
                            <p className="font-mono text-xs text-accent-ink">
                              {counterSlot.timeLabel}
                            </p>
                          </div>
                        ) : (
                          <p className="text-pine/65">
                            Waiting for the other party to submit a new schedule.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions & Expand Details Button */}
                  <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between gap-3 h-full">
                    {session.status === 'awaiting-review' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => openReviewModal(session)}
                      >
                        Review Preferred Schedules
                      </Button>
                    )}
                    {session.status === 'paid-confirmed' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          completeMutation.reset();
                          setEarlyCompletionAcknowledged(false);
                          setCompletionTarget(session);
                        }}
                      >
                        Mark Session Completed
                      </Button>
                    )}
                    {isCompleted && (
                      <span className="text-xs font-medium text-pine/70">
                        Session marked completed
                      </span>
                    )}
                    <Button
                      variant={isExpanded ? 'dark' : 'outline'}
                      size="sm"
                      onClick={() => toggleExpand(session.id)}
                      className="w-full sm:w-auto"
                    >
                      {isExpanded ? 'Hide Appointment Details' : 'View Appointment Details'}
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>

                {/* Expandable Appointment Detail View */}
                {isExpanded && (
                  <div className="border-t border-mist pt-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                      {/* Left Column: Client / Persona & Payment Status */}
                      <div className="space-y-4">
                        <h3 className="font-heading text-lg font-medium text-pine border-b border-mist pb-2">
                          Client &amp; Persona Profile
                        </h3>

                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-mist/50 pb-1.5">
                            <span className="text-pine/70">Persona Label:</span>
                            <span className="font-semibold text-pine">{session.personaLabel}</span>
                          </div>
                          <div className="flex justify-between border-b border-mist/50 pb-1.5">
                            <span className="text-pine/70">Booking Type:</span>
                            <span className="font-semibold text-pine uppercase">{session.personaType}</span>
                          </div>
                          <div className="flex justify-between border-b border-mist/50 pb-1.5">
                            <span className="text-pine/70">Payment Status:</span>
                            <span className="font-semibold text-pine">
                              {isCompleted
                                ? `Completed (Paid ₱${session.pricePhp?.toLocaleString()})`
                                : isConfirmed
                                  ? `Paid (₱${session.pricePhp?.toLocaleString()})`
                                  : isAwaitingPayment
                                    ? 'Agreed · Awaiting Client Payment'
                                    : 'Scheduling in progress'}
                            </span>
                          </div>
                          {session.paidAt && (
                            <div className="flex justify-between border-b border-mist/50 pb-1.5">
                              <span className="text-pine/70">Payment Timestamp:</span>
                              <span className="font-mono text-pine">{session.paidAt}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                            Presenting Concerns
                          </span>
                          <p className="text-pine/85 leading-relaxed pt-0.5">
                            {session.concernsSummary}
                          </p>
                        </div>
                      </div>

                      {/* Right Column: Client Contact & Coordination */}
                      <div className="space-y-4">
                        <h3 className="font-heading text-lg font-medium text-pine border-b border-mist pb-2">
                          Client Contact &amp; Coordination
                        </h3>

                        {session.clientSocialMedia ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                                Client&apos;s Preferred Social Media
                              </span>
                              <p className="text-sm font-medium text-pine">
                                {session.clientSocialMedia.platform || 'Social media'}
                                {session.clientSocialMedia.username
                                  ? ` · ${session.clientSocialMedia.username}`
                                  : ''}
                              </p>
                            </div>
                            <p className="text-pine/75 leading-relaxed">
                              Coordinate the session directly through the client&apos;s preferred
                              channel.
                            </p>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-surface-sunken border border-dashed border-mist space-y-2">
                            <p className="font-semibold text-pine/80">
                              No Client Social Media Provided
                            </p>
                            <p className="text-pine/75 leading-relaxed">
                              The client did not provide social media contact details.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={completionTarget !== null}
        onClose={closeCompletionModal}
        title={
          isEarlyCompletion
            ? 'Complete this session early?'
            : 'Mark this session as completed?'
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
              onClick={() => {
                if (!completionTarget) return;
                completeMutation.mutate(completionTarget.id);
              }}
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
        {completionTarget && (
          <div className="space-y-4 text-sm text-pine/85">
            <div className="rounded-lg border border-mist bg-surface-raised p-3 text-xs">
              <p className="font-semibold text-pine">
                {completionTarget.personaLabel} · {completionTarget.serviceTitle}
              </p>
              {completionSlot && (
                <p className="mt-1 text-pine/75">
                  {completionSlot.dateLabel} · {completionSlot.timeLabel}
                </p>
              )}
            </div>

            {isEarlyCompletion ? (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    This session has not ended yet.
                  </p>
                  <p>
                    It is scheduled to run through{' '}
                    <strong>{completionSlot?.timeLabel ?? 'the proposed end time'}</strong>.
                    Completing it now will close the session early.
                  </p>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-pine/85 cursor-pointer">
                  <Checkbox
                    checked={earlyCompletionAcknowledged}
                    onChange={(event) =>
                      setEarlyCompletionAcknowledged(event.target.checked)
                    }
                  />
                  <span>
                    I understand this session is still in progress and want to mark it as
                    completed now.
                  </span>
                </label>
              </>
            ) : (
              <p className="text-xs text-pine/75">
                The session slot has ended. Confirm only if the appointment took place and is
                ready to be archived.
              </p>
            )}

            {completeMutation.error && (
              <p className="text-xs text-red-700">
                {(completeMutation.error as Error).message}
              </p>
            )}
          </div>
        )}
      </Modal>

      {reviewTarget && (
        <Modal
          open
          onClose={closeReviewModal}
          title={`Review Schedules — #${reviewTarget.id}`}
          description={`${reviewTarget.serviceTitle} (${reviewTarget.serviceDuration}) · ${reviewTarget.personaLabel} · Fee: ₱${reviewTarget.pricePhp?.toLocaleString() ?? '—'}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleReviewSubmit} className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
              Round {reviewTarget.schedulingRound} · Respond to Client&apos;s Preferred Schedules
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
                  {(reviewMutation.error as Error)?.message ||
                    'Unable to update schedule right now. Please try again.'}
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

              {reviewPreferredSlots.length === 0 ? (
                <p className="rounded-lg border border-mist bg-surface-sunken/40 p-3 text-xs text-pine/70">
                  No open preferred schedules found in this round. Offer the nearest available
                  alternative below.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reviewPreferredSlots.map((slot, index) => {
                    const hasConflict = reviewConflictIds.has(slot.id);
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
              <Input
                id="schedule-counter-datetime"
                type="datetime-local"
                min={minDateTime}
                className="font-mono tabular-nums text-sm"
                value={counterDateTime}
                onChange={(event) => {
                  setCounterDateTime(event.target.value);
                  if (event.target.value) setSelectedSlotId(null);
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
                disabled={
                  reviewMutation.isPending || (!selectedSlotId && !counterDateTime)
                }
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
