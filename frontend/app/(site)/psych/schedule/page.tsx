'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { useActivePsychologist } from '../../../../hooks/useActivePsychologist';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, CalendarDays } from 'lucide-react';
import { PractitionerSwitcher } from '../../../../components/dashboard/PractitionerSwitcher';
import { UnverifiedBanner } from '../../../../components/dashboard/UnverifiedBanner';
import { DemoDataTag } from '../../../../components/DemoDataTag';
import type { BookingRequest } from '../../../../lib/types';
import {
  BookingStatusTag,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Modal,
  Skeleton,
} from '../../../../components/ui/primitives';

type ScheduleTab = 'upcoming' | 'past' | 'proposed' | 'all';

export default function PsychologistSchedulePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activePsych, activePsychologistId, showSwitcher } = useActivePsychologist();

  const [activeTab, setActiveTab] = useState<ScheduleTab>('upcoming');
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});
  const [completionTarget, setCompletionTarget] = useState<BookingRequest | null>(null);
  const [earlyCompletionAcknowledged, setEarlyCompletionAcknowledged] = useState(false);

  const isVerified = activePsych?.verificationStatus === 'verified';

  const { data: bookings = [], isLoading, error: bookingsError } = useQuery({
    queryKey: ['bookings', 'psychologist', activePsychologistId],
    queryFn: () => api.getBookingsForRole('psychologist', activePsychologistId),
  });

  const completeMutation = useMutation({
    mutationFn: (bookingId: string) => api.completeAppointment(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCompletionTarget(null);
      setEarlyCompletionAcknowledged(false);
    },
  });

  const myAssignedSessions = bookings;

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

  // Categorize sessions into upcoming, past, and proposed
  const categorizedSessions = useMemo(() => {
    const upcoming: typeof myAssignedSessions = [];
    const past: typeof myAssignedSessions = [];
    const proposed: typeof myAssignedSessions = [];

    myAssignedSessions.forEach((session) => {
      if (session.status === 'completed') {
        past.push(session);
      } else if (session.status === 'paid-confirmed') {
        const confirmedSlot = session.proposedSlots.find(
          (s) => s.id === session.selectedSlotId
        );
        if (confirmedSlot && isSlotPast(confirmedSlot.isoDateTime)) {
          past.push(session);
        } else {
          upcoming.push(session);
        }
      } else if (session.status === 'proposed') {
        proposed.push(session);
      }
      // Note: reschedule-requested and cancelled sessions are kept out of Past Confirmed
      // and remain cataloged under 'all' (All Assigned).
    });

    return { upcoming, past, proposed, all: myAssignedSessions };
  }, [myAssignedSessions, currentTime]);

  const displayedSessions = categorizedSessions[activeTab];

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
            Track confirmed appointments separated into upcoming and past sessions, and review client booking details.
          </p>
        </div>

        {/* Practitioner State Switcher (mock mode only) */}
        {showSwitcher && <PractitionerSwitcher />}
      </header>

      {/* Non-Approved Psychologist Banner */}
      {!isVerified && activePsych && (
        <UnverifiedBanner
          title="Pending Approval Notice"
          note={`${activePsych?.prcCredentialCode} · WAITING_APPROVAL`}
          body="You are currently operating in unverified status. You cannot accept new bookings or claim requests until your clinical credentials are fully approved by clinic administration."
        />
      )}

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
              { id: 'past', label: 'Past Confirmed', count: categorizedSessions.past.length },
              { id: 'proposed', label: 'Proposals Awaiting Payment', count: categorizedSessions.proposed.length },
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
          Psychologist: <span className="font-semibold text-accent-ink">{activePsych?.anonymizedTitle ?? activePsychologistId}</span>
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
            || activeTab === 'proposed' && 'No Active Proposals Pending Payment'
            || 'No Sessions Assigned to this Account Yet'
          }
          description={
            activeTab === 'upcoming' &&
              'When clients accept one of your 3 proposed slots and finalize payment, confirmed sessions appear here.'
            || activeTab === 'past' &&
              'Completed or past appointments will be cataloged in this archive view.'
            || activeTab === 'proposed' &&
              'You have no proposed slot packages currently waiting for client slot selection.'
            || 'Visit the Pending Requests queue to pick up new bookings and schedule appointments.'
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
            const confirmedSlot = session.proposedSlots.find(
              (s) => s.id === session.selectedSlotId
            );
            const isCompleted = session.status === 'completed';
            const isConfirmed =
              session.status === 'paid-confirmed' || isCompleted;

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
                    {session.demoSeed && <DemoDataTag />}
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

                    {/* Selected Slot or Proposed Slots Preview */}
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
                    ) : (
                      <div className="p-3.5 rounded-lg bg-surface-raised border border-mist text-xs space-y-2">
                        <p className="font-semibold text-pine">
                          3 Proposed Slots (Client Has Not Finalized Payment Yet):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {session.proposedSlots.map((s) => (
                            <div key={s.id} className="p-2 bg-surface-raised rounded-md border border-mist/70">
                              <p className="font-semibold text-xs text-pine">Slot 0{s.slotNumber}</p>
                              <p className="text-pine/80 text-xs">{s.dateLabel}</p>
                              <p className="font-mono text-xs text-accent-ink">{s.timeLabel}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Expand Details Button */}
                  <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between gap-3 h-full">
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
                                : 'Pending Client Payment'}
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
    </div>
  );
}
