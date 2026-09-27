'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { useAppRouter } from '../../lib/navigation';
import { BookingStatus } from '../../lib/types';
import {
  BookingStatusTag,
  Button,
  Card,
} from '../../components/ui/primitives';

export default function ClientBookingsPage() {
  const queryClient = useQueryClient();
  const { navigate } = useAppRouter();
  const { setCognitoRole, publishFlowEvent } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'client'],
    queryFn: () => api.getBookingsForRole('client'),
  });

  const lifecycleMutation = useMutation({
    mutationFn: (payload: {
      bookingId: string;
      action: 'cancel' | 'request-reschedule' | 'dispatch-reminders';
    }) => api.updateBookingLifecycleStatus(payload),
    onSuccess: (updated, vars) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (vars.action === 'dispatch-reminders') {
        publishFlowEvent(
          '24h & 1h Reminders Dispatched',
          `Automated reminders sent for confirmed booking ${updated.id}.`
        );
      } else if (vars.action === 'request-reschedule') {
        publishFlowEvent(
          'Real-Time Reschedule Requested',
          `Booking ${updated.id} status updated in real time across Client & Psychologist schedules.`
        );
      } else {
        publishFlowEvent(
          'Booking Cancelled',
          `Booking ${updated.id} has been marked as cancelled.`
        );
      }
    },
  });

  const proposedBookings = bookings.filter((b) => b.status === 'proposed');
  const filteredBookings =
    statusFilter === 'all'
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Client Role Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Tiered Access: Own History Only (Client #C-01)</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-[#25372D]">
            My Bookings &amp; Flow C Status Tracker
          </h1>
          <p className="text-sm text-[#25372D]/80 max-w-2xl">
            Track your submitted intake forms from <strong className="font-semibold">pending</strong>{' '}
            to <strong className="font-semibold">proposed</strong> (3 psychologist slots) and{' '}
            <strong className="font-semibold">paid-confirmed</strong> (contact unlocked + reminders).
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/personas')}
        >
          + New Persona Intake Request
        </Button>
      </header>

      {/* Flow C Step 4 Proposal Alert Banner */}
      {proposedBookings.length > 0 && (
        <div className="bg-[#D0E187]/45 border-2 border-[#5D8B69] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#25372D]">
              PROPOSAL ALERT · ACTION REQUIRED TO FINALIZE BOOKING
            </p>
            <p className="text-sm text-[#25372D]/90">
              You have <strong>{proposedBookings.length}</strong> booking request(s) where a
              PRC-verified psychologist has proposed a session fee and{' '}
              <strong>3 date/time slots</strong>. Select 1 slot and complete payment to finalize.
            </p>
          </div>
          <Button
            variant="dark"
            size="md"
            onClick={() => navigate(`/proposal/${proposedBookings[0].id}`)}
          >
            Review 3 Slots &amp; Pay ({proposedBookings[0].id}) →
          </Button>
        </div>
      )}

      {/* Interactive Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Filter bookings by Flow C status"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#EBF2EC] rounded-lg border border-[#C0D3C3]"
        >
          {(
            [
              { id: 'all', label: `All (${bookings.length})` },
              {
                id: 'pending',
                label: `pending (${bookings.filter((b) => b.status === 'pending').length})`,
              },
              {
                id: 'proposed',
                label: `proposed (${bookings.filter((b) => b.status === 'proposed').length})`,
              },
              {
                id: 'paid-confirmed',
                label: `paid-confirmed (${
                  bookings.filter((b) => b.status === 'paid-confirmed').length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-white text-[#25372D] font-semibold shadow-xs'
                  : 'text-[#25372D]/70 hover:text-[#25372D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#25372D]/65">
          Contact details unlock strictly upon <strong className="text-[#25372D]">paid-confirmed</strong> status.
        </span>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-44 rounded-xl bg-white border border-[#C0D3C3] p-6 animate-pulse"
            />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <p className="font-heading text-2xl font-bold text-[#25372D]">
            No Bookings Matching Selected Status
          </p>
          <p className="text-sm text-[#25372D]/75 max-w-md mx-auto">
            Start a new Flow C intake under a Self or Dependent persona, or switch the filter above
            to view all existing bookings.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
              Reset Filter
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/personas')}>
              Start Flow C Intake
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredBookings.map((booking) => {
            const chosenSlot = booking.proposedSlots.find(
              (s) => s.id === booking.selectedSlotId
            );

            return (
              <Card key={booking.id} className="space-y-5">
                {/* Top Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C0D3C3]/70 pb-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#25372D]/75">
                    <span className="font-mono font-bold text-[#25372D] tabular-nums">
                      {booking.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Persona: {booking.personaLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>Submitted {booking.submittedAt}</span>
                  </div>

                  <BookingStatusTag status={booking.status} />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                        {booking.serviceTitle}
                      </h2>
                      <span className="font-mono text-xs font-semibold text-[#5D8B69] tabular-nums shrink-0">
                        Duration: {booking.serviceDuration}
                      </span>
                    </div>

                    <p className="text-xs text-[#5D8B69] font-medium">
                      Guardrail: {booking.serviceGuardrail}
                    </p>

                    <p className="text-sm text-[#25372D]/85 leading-relaxed">
                      {booking.concernsSummary}
                    </p>

                    <p className="text-xs text-[#25372D]/65">
                      Preferences &amp; Needs: {booking.specificNeeds} · Language:{' '}
                      {booking.preferredLanguage}
                    </p>
                  </div>

                  {/* Right Status Panel: Empty Waiting State / Proposal Ready / Confirmed Contact Unlocked */}
                  <div className="lg:col-span-5">
                    {booking.status === 'pending' && (
                      <div className="p-4 rounded-xl bg-[#F6F9F6] border border-dashed border-[#8FBE8F] space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                          <svg
                            className="w-4 h-4 text-amber-700 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>No Pick-Up Yet · Waiting Psychologist Review</span>
                        </div>
                        <p className="text-xs text-[#25372D]/80 leading-relaxed">
                          Your intake is in the verified psychologist pending queue. No fee or date
                          slots are assigned yet, and direct contact remains locked.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCognitoRole('psychologist');
                            navigate('/psych/queue');
                          }}
                        >
                          Test Pick-Up as Verified Psychologist →
                        </Button>
                      </div>
                    )}

                    {booking.status === 'proposed' && (
                      <div className="p-4 rounded-xl bg-[#EBF2EC] border border-[#5D8B69] space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#25372D]">
                            Picked Up by {booking.psychologistCode}
                          </span>
                          <span className="font-mono font-bold text-[#25372D] tabular-nums">
                            Fee: ₱{booking.pricePhp?.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-[#25372D]/80">
                          {booking.proposedSlots.length} schedule slots proposed. Contact details
                          remain locked until you select 1 slot and payment succeeds.
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() => navigate(`/proposal/${booking.id}`)}
                        >
                          Review 3 Slots &amp; Complete Payment →
                        </Button>
                      </div>
                    )}

                    {(booking.status === 'paid-confirmed' ||
                      booking.status === 'reschedule-requested') && (
                      <div className="p-4 rounded-xl bg-[#F1F6F2] border border-[#5D8B69] space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#25372D]">
                            Confirmed with {booking.psychologistCode}
                          </span>
                          <span className="font-mono font-semibold text-[#5D8B69] tabular-nums">
                            Paid ₱{booking.pricePhp?.toLocaleString()}
                          </span>
                        </div>

                        {chosenSlot && (
                          <div className="p-2.5 rounded-lg bg-white border border-[#C0D3C3] text-xs">
                            <p className="font-semibold text-[#25372D]">
                              Selected Slot: {chosenSlot.dateLabel}
                            </p>
                            <p className="font-mono text-[#5D8B69] tabular-nums">
                              {chosenSlot.timeLabel}
                            </p>
                          </div>
                        )}

                        {booking.contactUnlocked && booking.unlockedContact && (
                          <div className="space-y-1 text-xs bg-white p-3 rounded-lg border border-[#8FBE8F]">
                            <p className="font-bold text-[#25372D]">
                              Unlocked Session Contact &amp; Room:
                            </p>
                            <p className="font-mono text-[11px] text-[#5D8B69] break-all">
                              {booking.unlockedContact.teletherapyUrl}
                            </p>
                            <p className="text-[11px] text-[#25372D]/75">
                              Ref: {booking.unlockedContact.sessionReferenceCode} · Coord:{' '}
                              {booking.unlockedContact.coordinationEmail}
                            </p>
                          </div>
                        )}

                        {/* 24h / 1h Reminders & Real-Time Cancel/Reschedule */}
                        <div className="pt-2 border-t border-[#C0D3C3] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="text-[#25372D]/80">
                            Reminders: 24h ({booking.reminders.reminder24h}) · 1h (
                            {booking.reminders.reminder1h})
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                lifecycleMutation.mutate({
                                  bookingId: booking.id,
                                  action: 'dispatch-reminders',
                                })
                              }
                              className="underline text-[#5D8B69] hover:text-[#25372D] font-semibold cursor-pointer"
                            >
                              Trigger 24h/1h Alert
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() =>
                                lifecycleMutation.mutate({
                                  bookingId: booking.id,
                                  action: 'request-reschedule',
                                })
                              }
                              className="underline text-[#25372D]/80 hover:text-[#25372D] cursor-pointer"
                            >
                              Reschedule
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() =>
                                lifecycleMutation.mutate({
                                  bookingId: booking.id,
                                  action: 'cancel',
                                })
                              }
                              className="underline text-red-700 hover:text-red-900 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.status === 'cancelled' && (
                      <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 text-xs text-red-900 space-y-1">
                        <p className="font-bold">Session Cancelled</p>
                        <p>Real-time cancellation synced across Client and Psychologist schedules.</p>
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
