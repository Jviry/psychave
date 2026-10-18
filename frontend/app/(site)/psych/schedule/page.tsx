'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { useAppStore } from '../../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import { ChevronDown, Video, ShieldCheck, CalendarDays } from 'lucide-react';
import { PractitionerSwitcher } from '../../../../components/dashboard/PractitionerSwitcher';
import { UnverifiedBanner } from '../../../../components/dashboard/UnverifiedBanner';
import {
  BookingStatusTag,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Textarea,
} from '../../../../components/ui/primitives';

type ScheduleTab = 'upcoming' | 'past' | 'proposed' | 'all';

export default function PsychologistSchedulePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    activePsychologistId,
    publishFlowEvent,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<ScheduleTab>('upcoming');
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const activePsych =
    roster.find((r) => r.id === activePsychologistId) || roster[0];
  const isVerified = activePsych?.verificationStatus === 'verified';

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'psychologist', activePsychologistId],
    queryFn: () => api.getBookingsForRole('psychologist', activePsychologistId),
  });

  // Strictly filter to sessions booked/picked-up under the active psychologist
  const myAssignedSessions = useMemo(() => {
    return bookings.filter((b) => b.psychologistId === activePsychologistId);
  }, [bookings, activePsychologistId]);

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Periodically refresh current time (every 30s) so session categorization dynamically updates without full refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Determine if a session slot is upcoming or past based on current clock (Asia/Manila)
  const isSlotPast = (isoString?: string) => {
    if (!isoString) return false;
    const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(isoString);
    const normalized = hasTimezone ? isoString : `${isoString}+08:00`;
    const slotDate = new Date(normalized);
    return !isNaN(slotDate.getTime()) && slotDate.getTime() < currentTime;
  };

  // Categorize sessions into upcoming, past, and proposed
  const categorizedSessions = useMemo(() => {
    const upcoming: typeof myAssignedSessions = [];
    const past: typeof myAssignedSessions = [];
    const proposed: typeof myAssignedSessions = [];

    myAssignedSessions.forEach((session) => {
      if (session.status === 'paid-confirmed') {
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

  const toggleExpand = (id: string) => {
    setExpandedBookingIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const noteMutation = useMutation({
    mutationFn: (payload: { bookingId: string; privateClinicalNote: string }) =>
      api.updatePrivatePsychNote(payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditingNoteId(null);
      publishFlowEvent(
        'Private Clinical Note Updated',
        `Saved confidential note on ${updated.id} (Visible to ${activePsychologistId} only; redacted from Admin & Client).`
      );
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: (payload: {
      bookingId: string;
      action: 'cancel' | 'request-reschedule' | 'dispatch-reminders';
    }) => api.updateBookingLifecycleStatus(payload),
    onSuccess: (updated, vars) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      publishFlowEvent(
        'Psychologist Schedule Updated',
        `Booking ${updated.id} lifecycle action (${vars.action}) synced in real time.`
      );
    },
  });

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
          <h1 className="font-heading text-4xl font-bold text-pine">
            My Practice Schedule
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Track confirmed appointments separated into upcoming and past sessions, review client booking details,
            and manage confidential clinical notes.
          </p>
        </div>

        {/* Practitioner State Switcher */}
        <PractitionerSwitcher />
      </header>

      {/* Non-Approved Psychologist Banner */}
      {!isVerified && (
        <UnverifiedBanner
          title="Pending Approval Notice"
          note={`${activePsych?.prcCredentialCode} · WAITING_APPROVAL`}
          body="You are currently operating in unverified status. You cannot accept new bookings or claim requests until your clinical credentials are fully approved by clinic administration."
        />
      )}

      {/* Tabs Navigation for Schedule Separation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-mist pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'bg-pine text-white shadow-xs'
                : 'bg-surface-raised border border-mist text-pine hover:bg-surface-sunken'
            }`}
          >
            <span>Upcoming Confirmed</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'upcoming'
                  ? 'bg-surface-raised/20 text-white'
                  : 'bg-surface-sunken text-accent-ink'
              }`}
            >
              {categorizedSessions.upcoming.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'past'
                ? 'bg-pine text-white shadow-xs'
                : 'bg-surface-raised border border-mist text-pine hover:bg-surface-sunken'
            }`}
          >
            <span>Past Confirmed</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'past'
                  ? 'bg-surface-raised/20 text-white'
                  : 'bg-surface-sunken text-accent-ink'
              }`}
            >
              {categorizedSessions.past.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proposed')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'proposed'
                ? 'bg-pine text-white shadow-xs'
                : 'bg-surface-raised border border-mist text-pine hover:bg-surface-sunken'
            }`}
          >
            <span>Proposals Awaiting Payment</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'proposed'
                  ? 'bg-surface-raised/20 text-white'
                  : 'bg-surface-sunken text-accent-ink'
              }`}
            >
              {categorizedSessions.proposed.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-pine text-white shadow-xs'
                : 'bg-surface-raised border border-mist text-pine hover:bg-surface-sunken'
            }`}
          >
            All Assigned ({categorizedSessions.all.length})
          </button>
        </div>

        <div className="text-xs text-pine/70">
          Psychologist Roster ID: <span className="font-mono font-bold text-accent-ink">{activePsychologistId}</span>
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
            const isConfirmed = session.status === 'paid-confirmed';

            return (
              <Card
                key={session.id}
                className="hover:border-sage transition-all space-y-5 p-6"
              >
                {/* Card Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-mist/70 pb-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-pine text-sm">
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
                      <h2 className="font-heading text-2xl font-bold text-pine">
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
                          <p className="font-bold text-pine text-sm">
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

                    {isConfirmed && session.unlockedContact && (
                      <div className="w-full text-right text-xs">
                        <a
                          href={session.unlockedContact.teletherapyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage text-white rounded-lg font-semibold hover:bg-accent-ink transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2"
                        >
                          <Video className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          Open Teletherapy Room
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable Appointment Detail View */}
                {isExpanded && (
                  <div className="border-t border-mist pt-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      {/* Left Sub-card: Client / Persona & Payment Status */}
                      <div className="space-y-4 p-4 rounded-lg bg-parchment border border-mist">
                        <h3 className="font-heading text-lg font-bold text-pine">
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
                            <span className="text-pine/70">Session Language:</span>
                            <span className="font-semibold text-pine">{session.preferredLanguage}</span>
                          </div>
                          <div className="flex justify-between border-b border-mist/50 pb-1.5">
                            <span className="text-pine/70">Payment Status:</span>
                            <span className="font-semibold text-pine">
                              {isConfirmed ? `Paid (₱${session.pricePhp?.toLocaleString()})` : 'Pending Client Payment'}
                            </span>
                          </div>
                          {session.paidAt && (
                            <div className="flex justify-between border-b border-mist/50 pb-1.5">
                              <span className="text-pine/70">Payment Timestamp:</span>
                              <span className="font-mono text-pine">{session.paidAt}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-pine mb-1">Presenting Concerns:</p>
                          <p className="p-2.5 rounded-lg bg-surface-raised border border-mist/70 text-pine/85 leading-relaxed">
                            {session.concernsSummary}
                          </p>
                        </div>

                        {session.specificNeeds && (
                          <div>
                            <p className="font-semibold text-pine mb-1">Specific Needs / Scheduling Preferences:</p>
                            <p className="p-2.5 rounded-lg bg-surface-raised border border-mist/70 text-pine/80 italic">
                              {session.specificNeeds}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Sub-card: Unlocked Teletherapy & Lifecycle Actions */}
                      <div className="space-y-4 p-4 rounded-lg bg-parchment border border-mist">
                        <h3 className="font-heading text-lg font-bold text-pine">
                          Session Channel &amp; Coordination
                        </h3>

                        {isConfirmed && session.unlockedContact ? (
                          <div className="space-y-3">
                            <div className="p-3 bg-surface-raised rounded-lg border border-sage space-y-1">
                              <p className="font-semibold text-pine">Direct Teletherapy URL:</p>
                              <a
                                href={session.unlockedContact.teletherapyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-accent-ink hover:underline break-all block"
                              >
                                {session.unlockedContact.teletherapyUrl}
                              </a>
                            </div>

                            <div className="space-y-1">
                              <p className="text-pine/70">Clinic Coordination Email:</p>
                              <p className="font-medium text-pine">
                                {session.unlockedContact.coordinationEmail}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-pine/70">Session Reference Code:</p>
                              <p className="font-mono font-bold text-accent-ink">
                                {session.unlockedContact.sessionReferenceCode}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-mist/60 text-xs">
                              <span>
                                24h Reminder: <strong>{session.reminders.reminder24h}</strong> · 1h Reminder:{' '}
                                <strong>{session.reminders.reminder1h}</strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    lifecycleMutation.mutate({
                                      bookingId: session.id,
                                      action: 'dispatch-reminders',
                                    })
                                  }
                                  className="underline text-accent-ink font-semibold cursor-pointer"
                                >
                                  Dispatch Reminders
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    lifecycleMutation.mutate({
                                      bookingId: session.id,
                                      action: 'request-reschedule',
                                    })
                                  }
                                  className="underline text-pine cursor-pointer"
                                >
                                  Request Reschedule
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-surface-raised border border-dashed border-mist space-y-2">
                            <p className="font-semibold text-amber-900">
                              Direct Teletherapy Link Locked
                            </p>
                            <p className="text-pine/75 leading-relaxed">
                              This booking has not yet been paid by the client. The direct teletherapy video link,
                              coordination email, and automated reminders unlock automatically upon payment confirmation.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Private Clinical Session Notes (Confidential: Hidden from Admin & Client) */}
                    <div className="p-4 rounded-lg bg-surface-raised border border-sage/40 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-pine">
                          <ShieldCheck className="w-4 h-4 text-accent-ink shrink-0" aria-hidden="true" />
                          <span className="font-heading text-base">Private Clinical Notes (Psychologist Only)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-sm bg-surface-sunken text-accent-ink font-semibold text-xs">
                          Confidential · Hidden from Admin &amp; Client
                        </span>
                      </div>

                      {editingNoteId === session.id ? (
                        <div className="space-y-2">
                          <Textarea
                            rows={4}
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Enter confidential clinical observations, therapeutic formulations, or prep notes..."
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={noteMutation.isPending}
                              onClick={() =>
                                noteMutation.mutate({
                                  bookingId: session.id,
                                  privateClinicalNote: noteDraft,
                                  })
                              }
                            >
                              {noteMutation.isPending ? 'Saving...' : 'Save Private Note'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingNoteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="p-3 rounded-lg bg-parchment border border-mist text-pine/90 leading-relaxed font-mono text-xs">
                            {session.privateClinicalNote ||
                              'No confidential clinical notes recorded for this case yet.'}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingNoteId(session.id);
                              setNoteDraft(session.privateClinicalNote || '');
                            }}
                          >
                            Edit Confidential Note
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
