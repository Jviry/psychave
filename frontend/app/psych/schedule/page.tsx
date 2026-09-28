'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import {
  BookingStatusTag,
  Button,
  Card,
  Textarea,
} from '../../../components/ui/primitives';

type ScheduleTab = 'upcoming' | 'past' | 'proposed' | 'all';

export default function PsychologistSchedulePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    activePsychologistId,
    setActivePsychologistId,
    setCognitoRole,
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

  // Determine if a session slot is upcoming or past
  const isSlotPast = (isoString?: string) => {
    if (!isoString) return false;
    const slotDate = new Date(isoString);
    return !isNaN(slotDate.getTime()) && slotDate.getTime() < Date.now();
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
      } else if (session.status === 'reschedule-requested' || session.status === 'cancelled') {
        past.push(session);
      }
    });

    return { upcoming, past, proposed, all: myAssignedSessions };
  }, [myAssignedSessions]);

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
        `Saved encrypted note on ${updated.id} (Visible to ${activePsychologistId} only; redacted from Admin & Client).`
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
          <div className="flex items-center gap-2 text-xs text-sage font-semibold">
            <span>Psychologist Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>My Schedule &amp; Clinical Management</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-pine">
            My Practice Schedule
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Track confirmed appointments separated into upcoming and past sessions, review client intake details,
            and manage confidential clinical notes.
          </p>
        </div>

        {/* Practitioner State Switcher */}
        <div className="bg-white border border-mist rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs shadow-xs">
          <span className="font-semibold text-pine">Viewing Practitioner:</span>
          {roster.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActivePsychologistId(r.id)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activePsychologistId === r.id
                  ? 'bg-pine text-white'
                  : 'bg-[#F1F6F2] text-pine hover:bg-[#E2ECE4]'
              }`}
            >
              {r.id} ({r.verificationStatus === 'verified' ? 'Verified' : 'Unverified'})
            </button>
          ))}
        </div>
      </header>

      {/* Non-Approved Psychologist Banner */}
      {!isVerified && (
        <div
          role="alert"
          className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 text-amber-950 space-y-3 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-700" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="font-heading text-xl font-bold text-amber-950">
                Pending Approval Notice
              </h2>
            </div>
            <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-amber-200/70 text-amber-900 rounded-md">
              {activePsych?.prcCredentialCode} · WAITING_APPROVAL
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed max-w-3xl">
            You are currently operating in unverified status. You cannot accept new bookings or claim requests
            until your clinical credentials are fully approved by clinic administration.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="dark"
              size="sm"
              onClick={() => setActivePsychologistId('RP-01')}
            >
              Switch to Verified Resident #RP-01
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCognitoRole('admin');
                router.push('/admin/verifications');
              }}
            >
              Approve Credentials in Admin →
            </Button>
          </div>
        </div>
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
                : 'bg-white border border-mist text-pine hover:bg-[#F1F6F2]'
            }`}
          >
            <span>Upcoming Confirmed</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'upcoming'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#EBF2EC] text-sage'
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
                : 'bg-white border border-mist text-pine hover:bg-[#F1F6F2]'
            }`}
          >
            <span>Past Confirmed</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'past'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#EBF2EC] text-sage'
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
                : 'bg-white border border-mist text-pine hover:bg-[#F1F6F2]'
            }`}
          >
            <span>Proposals Awaiting Payment</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'proposed'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#EBF2EC] text-sage'
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
                : 'bg-white border border-mist text-pine hover:bg-[#F1F6F2]'
            }`}
          >
            All Assigned ({categorizedSessions.all.length})
          </button>
        </div>

        <div className="text-xs text-pine/70">
          Psychologist Roster ID: <span className="font-mono font-bold text-sage">{activePsychologistId}</span>
        </div>
      </div>

      {/* Main Schedule Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-white border border-mist animate-pulse p-6 space-y-4"
            >
              <div className="h-4 bg-[#EBF2EC] rounded-sm w-1/4" />
              <div className="h-6 bg-[#EBF2EC] rounded-sm w-1/2" />
              <div className="h-4 bg-[#EBF2EC] rounded-sm w-3/4" />
            </div>
          ))}
        </div>
      ) : displayedSessions.length === 0 ? (
        /* Empty State */
        <Card className="text-center py-16 space-y-4 border-dashed border-2 border-mint">
          <div className="w-12 h-12 rounded-full bg-[#EBF2EC] text-sage flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="font-heading text-xl font-bold text-pine">
              {activeTab === 'upcoming' && 'No Upcoming Confirmed Sessions'}
              {activeTab === 'past' && 'No Past Sessions Recorded'}
              {activeTab === 'proposed' && 'No Active Proposals Pending Payment'}
              {activeTab === 'all' && 'No Sessions Assigned to this Account Yet'}
            </h3>
            <p className="text-xs text-pine/75 max-w-md mx-auto">
              {activeTab === 'upcoming' &&
                'When clients accept one of your 3 proposed slots and finalize payment, confirmed sessions appear here.'}
              {activeTab === 'past' &&
                'Completed or past appointments will be cataloged in this archive view.'}
              {activeTab === 'proposed' &&
                'You have no proposed slot packages currently waiting for client slot selection.'}
              {activeTab === 'all' &&
                'Visit the Pending Requests queue to pick up new intakes and schedule appointments.'}
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/psych/queue')}
            >
              Open Pending Requests Queue →
            </Button>
          </div>
        </Card>
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
                    <span className="font-semibold text-sage">
                      {session.personaLabel} ({session.personaType})
                    </span>
                    <span className="text-mist">·</span>
                    <span className="text-pine/70 font-mono">
                      Fee: ₱{session.pricePhp?.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Payment status badge */}
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Paid &amp; Finalized
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        Awaiting Payment
                      </span>
                    )}

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
                      <div className="p-3.5 rounded-xl bg-[#EBF2EC] border border-sage flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-sage uppercase tracking-wide text-[10px]">
                            Confirmed Session Appointment
                          </p>
                          <p className="font-bold text-pine text-sm">
                            {confirmedSlot.dateLabel}
                          </p>
                          <p className="font-mono text-sage font-medium">
                            {confirmedSlot.timeLabel}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 bg-white rounded-md font-mono text-[11px] font-semibold text-pine border border-mist">
                          Slot 0{confirmedSlot.slotNumber} Selected
                        </span>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-parchment border border-mist text-xs space-y-2">
                        <p className="font-semibold text-pine">
                          3 Proposed Slots (Client Has Not Finalized Payment Yet):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {session.proposedSlots.map((s) => (
                            <div key={s.id} className="p-2 bg-white rounded-md border border-mist/70">
                              <p className="font-semibold text-[11px] text-pine">Slot 0{s.slotNumber}</p>
                              <p className="text-pine/80 text-[11px]">{s.dateLabel}</p>
                              <p className="font-mono text-[10px] text-sage">{s.timeLabel}</p>
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
                      {isExpanded ? 'Hide Appointment Details ▲' : 'View Appointment Details ▼'}
                    </Button>

                    {isConfirmed && session.unlockedContact && (
                      <div className="w-full text-right text-xs">
                        <a
                          href={session.unlockedContact.teletherapyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage text-white rounded-lg font-semibold hover:bg-[#4c7557] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
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
                      <div className="space-y-4 p-4 rounded-xl bg-parchment border border-mist">
                        <h3 className="font-heading text-lg font-bold text-pine">
                          Client &amp; Persona Profile
                        </h3>

                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-mist/50 pb-1.5">
                            <span className="text-pine/70">Persona Label:</span>
                            <span className="font-semibold text-pine">{session.personaLabel}</span>
                          </div>
                          <div className="flex justify-between border-b border-mist/50 pb-1.5">
                            <span className="text-pine/70">Intake Type:</span>
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
                          <p className="p-2.5 rounded-lg bg-white border border-mist/70 text-pine/85 leading-relaxed">
                            {session.concernsSummary}
                          </p>
                        </div>

                        {session.specificNeeds && (
                          <div>
                            <p className="font-semibold text-pine mb-1">Specific Needs / Scheduling Preferences:</p>
                            <p className="p-2.5 rounded-lg bg-white border border-mist/70 text-pine/80 italic">
                              {session.specificNeeds}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Sub-card: Unlocked Teletherapy & Lifecycle Actions */}
                      <div className="space-y-4 p-4 rounded-xl bg-parchment border border-mist">
                        <h3 className="font-heading text-lg font-bold text-pine">
                          Session Channel &amp; Coordination
                        </h3>

                        {isConfirmed && session.unlockedContact ? (
                          <div className="space-y-3">
                            <div className="p-3 bg-white rounded-lg border border-sage space-y-1">
                              <p className="font-semibold text-pine">Direct Teletherapy URL:</p>
                              <a
                                href={session.unlockedContact.teletherapyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-sage hover:underline break-all block"
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
                              <p className="font-mono font-bold text-sage">
                                {session.unlockedContact.sessionReferenceCode}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-mist/60 text-[11px]">
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
                                  className="underline text-sage font-semibold cursor-pointer"
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
                          <div className="p-4 rounded-lg bg-white border border-dashed border-mist space-y-2">
                            <p className="font-semibold text-amber-900">
                              Direct Teletherapy Link Locked
                            </p>
                            <p className="text-pine/75 leading-relaxed">
                              This booking has not yet been paid by the client. The encrypted video link,
                              coordination email, and automated reminders unlock automatically upon payment confirmation.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Private Clinical Session Notes (Confidential: Hidden from Admin & Client) */}
                    <div className="p-4 rounded-xl bg-white border-2 border-sage/30 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-pine">
                          <svg className="w-4 h-4 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span className="font-heading text-base">Private Clinical Notes (Psychologist Only)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-sm bg-[#EBF2EC] text-sage font-semibold text-[10px]">
                          Encrypted · Hidden from Admin &amp; Client
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
                          <p className="p-3 rounded-lg bg-parchment border border-mist text-pine/90 leading-relaxed font-mono text-[11px]">
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
