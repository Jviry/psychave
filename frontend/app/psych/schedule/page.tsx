'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../stores/useAppStore';
import { useAppRouter } from '../../../lib/navigation';
import {
  BookingStatusTag,
  Button,
  Card,
  Textarea,
} from '../../../components/ui/primitives';

export default function PsychologistSchedulePage() {
  const queryClient = useQueryClient();
  const { navigate } = useAppRouter();
  const { activePsychologistId, setActivePsychologistId, publishFlowEvent } =
    useAppStore();

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'psychologist', activePsychologistId],
    queryFn: () => api.getBookingsForRole('psychologist', activePsychologistId),
  });

  // Strictly filter to sessions booked/picked-up under the active psychologist
  const myAssignedSessions = bookings.filter(
    (b) => b.psychologistId === activePsychologistId
  );

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
    <div className="space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Psychologist Role Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Tiered Access: Sessions Booked Under #{activePsychologistId} Only</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-[#25372D]">
            My Schedules &amp; Confidential Clinical Workspace
          </h1>
          <p className="text-sm text-[#25372D]/80 max-w-2xl">
            Manage 3-slot proposals awaiting client payment and confirmed sessions with unlocked
            teletherapy rooms. Private clinical notes here are strictly hidden from Administrators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {roster
            .filter((r) => r.verificationStatus === 'verified')
            .map((r) => (
              <Button
                key={r.id}
                variant={activePsychologistId === r.id ? 'dark' : 'outline'}
                size="sm"
                onClick={() => setActivePsychologistId(r.id)}
              >
                View {r.id} Schedule
              </Button>
            ))}
        </div>
      </header>

      {isLoading ? (
        <div className="h-56 rounded-xl bg-white border border-[#C0D3C3] animate-pulse" />
      ) : myAssignedSessions.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <h2 className="font-heading text-2xl font-bold text-[#25372D]">
            No Sessions Assigned Under #{activePsychologistId} Yet
          </h2>
          <p className="text-xs text-[#25372D]/75 max-w-md mx-auto">
            Tiered access restricts this view strictly to bookings picked up by{' '}
            <strong>#{activePsychologistId}</strong>. Visit the Pending Queue to pick up an intake
            request and propose 3 slots.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/psych/queue')}>
            Open Pending Queue →
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {myAssignedSessions.map((session) => {
            const confirmedSlot = session.proposedSlots.find(
              (s) => s.id === session.selectedSlotId
            );

            return (
              <Card key={session.id} className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C0D3C3] pb-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#25372D]/75">
                    <span className="font-mono font-bold text-[#25372D] tabular-nums">
                      {session.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Assigned to: {session.psychologistCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>Persona: {session.personaLabel}</span>
                  </div>

                  <BookingStatusTag status={session.status} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Clinical Session & Slot Details */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                        {session.serviceTitle} ({session.serviceDuration})
                      </h2>
                      <span className="font-mono font-bold text-[#5D8B69] tabular-nums">
                        Fee: ₱{session.pricePhp?.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-[#25372D]/80 leading-relaxed">
                      <strong>Intake Summary:</strong> {session.concernsSummary}
                    </p>

                    {/* Proposed 3 Slots vs Selected Paid Slot */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#25372D]">
                        {session.status === 'paid-confirmed'
                          ? 'Client-Selected & Paid Schedule Slot:'
                          : '3 Proposed Schedule Holds (Awaiting Client Selection & Payment):'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        {session.proposedSlots.map((slot) => {
                          const isWinner = slot.id === session.selectedSlotId;
                          return (
                            <div
                              key={slot.id}
                              className={`p-3 rounded-lg border ${
                                isWinner
                                  ? 'border-2 border-[#5D8B69] bg-[#EBF2EC]'
                                  : 'border-[#C0D3C3] bg-[#F6F9F6]'
                              }`}
                            >
                              <p className="font-semibold text-[#25372D]">
                                Slot 0{slot.slotNumber}{' '}
                                {isWinner ? '· CONFIRMED' : ''}
                              </p>
                              <p className="text-[#25372D]/85 mt-0.5">{slot.dateLabel}</p>
                              <p className="font-mono text-[11px] text-[#5D8B69] tabular-nums">
                                {slot.timeLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Contact Lock vs Unlock Status */}
                    {session.contactUnlocked && session.unlockedContact ? (
                      <div className="p-3.5 rounded-lg bg-[#F1F6F2] border border-[#5D8B69] text-xs space-y-1">
                        <p className="font-bold text-[#25372D]">
                          Payment Verified — Direct Session Channel Unlocked:
                        </p>
                        <p className="font-mono text-[#5D8B69] break-all">
                          {session.unlockedContact.teletherapyUrl}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#25372D]/75">
                          <span>
                            24h Reminder: {session.reminders.reminder24h} · 1h Reminder:{' '}
                            {session.reminders.reminder1h}
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
                              className="underline text-[#5D8B69] font-semibold cursor-pointer"
                            >
                              Send 24h/1h Reminder
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
                              className="underline text-[#25372D] cursor-pointer"
                            >
                              Reschedule
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-lg bg-[#F6F9F6] border border-dashed border-[#C0D3C3] text-xs text-[#25372D]/75">
                        <strong>Contact Locked:</strong> Client has not finalized payment yet. Direct
                        session room and contact unlock automatically upon payment confirmation.
                      </div>
                    )}
                  </div>

                  {/* Right: Psychologist-Only Private Clinical Notes (Hidden from Admin) */}
                  <div className="lg:col-span-5 bg-[#F6F9F6] border border-[#C0D3C3] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#25372D]">
                        <svg
                          className="w-4 h-4 text-[#5D8B69]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>Private Clinical Session Notes</span>
                      </div>
                      <span className="text-[11px] text-[#5D8B69] font-semibold">
                        Hidden from Admin Tier
                      </span>
                    </div>

                    {editingNoteId === session.id ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={4}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              noteMutation.mutate({
                                bookingId: session.id,
                                privateClinicalNote: noteDraft,
                              })
                            }
                          >
                            Save Private Note
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
                        <p className="text-xs text-[#25372D]/85 bg-white p-3 rounded-lg border border-[#C0D3C3] leading-relaxed">
                          {session.privateClinicalNote ||
                            'No private clinical notes recorded yet.'}
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
