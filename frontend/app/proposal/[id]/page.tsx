'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  slotSelectionPaymentSchema,
  SlotSelectionPaymentValues,
} from '../../../lib/schemas';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '../../../stores/useAppStore';
import {
  BookingStatusTag,
  Button,
  Card,
} from '../../../components/ui/primitives';

export default function ProposalPickerPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const bookingId = routeParams.id || 'BK-2026-102';

  const {
    simulatePaymentFailure,
    setSimulatePaymentFailure,
    publishFlowEvent,
  } = useAppStore();

  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.getBookingById(bookingId, 'client'),
  });

  const form = useForm<SlotSelectionPaymentValues>({
    resolver: zodResolver(slotSelectionPaymentSchema),
    defaultValues: {
      selectedSlotId: '',
      paymentMethodLabel: 'card_visa_4242',
      acknowledgeFinalizationRule: false,
    },
  });

  const selectedSlotId = form.watch('selectedSlotId');

  const payMutation = useMutation({
    mutationFn: (values: SlotSelectionPaymentValues) =>
      api.confirmSlotAndPay({
        bookingId,
        selectedSlotId: values.selectedSlotId,
        simulateFailure: simulatePaymentFailure,
      }),
    onSuccess: (updated) => {
      setPaymentErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      publishFlowEvent(
        'Payment confirmed — contact unlocked',
        `Booking ${updated.id} is confirmed. Your video link is unlocked and reminders are scheduled.`
      );
    },
    onError: (err: Error) => {
      setPaymentErrorMsg(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="h-64 rounded-xl bg-white border border-[#C0D3C3] p-8 animate-pulse" />
    );
  }

  if (!booking) {
    return (
      <Card className="space-y-4 text-center py-12">
        <h1 className="font-heading text-3xl font-bold text-[#25372D]">
          Proposal Record Not Found
        </h1>
        <p className="text-sm text-[#25372D]/75">
          Could not locate booking proposal #{bookingId}.
        </p>
        <Button variant="primary" onClick={() => router.push('/bookings')}>
          Return to My Bookings
        </Button>
      </Card>
    );
  }

  const confirmedSlot = booking.proposedSlots.find(
    (s) => s.id === booking.selectedSlotId
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Step 2 of 3</span>
            <span aria-hidden="true">·</span>
            <span>Choose a time &amp; confirm</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-[#25372D]">
            Choose your session time
          </h1>
          <p className="text-sm text-[#25372D]/80 max-w-2xl">
            Your psychologist proposed 3 times. Choose the one that works for you and pay to
            confirm — contact details unlock after payment.
          </p>
        </div>

        <BookingStatusTag status={booking.status} />
      </header>

      {/* Payment Success State (Flow C Step 5 Finalized) */}
      {booking.status === 'paid-confirmed' && (
        <Card className="border-2 border-[#5D8B69] bg-[#F1F6F2] space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C0D3C3] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#5D8B69]">
                CONFIRMED · PAYMENT SUCCEEDED ({booking.paidAt})
              </p>
              <h2 className="font-heading text-3xl font-bold text-[#25372D]">
                Session confirmed &amp; contact unlocked
              </h2>
            </div>
            <span className="font-mono text-xl font-bold text-[#25372D] tabular-nums">
              Paid: ₱{booking.pricePhp?.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white border border-[#C0D3C3] space-y-1">
              <p className="text-[#25372D]/65">Confirmed Date &amp; Time Slot</p>
              <p className="font-heading text-lg font-bold text-[#25372D]">
                {confirmedSlot?.dateLabel}
              </p>
              <p className="font-mono text-[#5D8B69] font-semibold tabular-nums">
                {confirmedSlot?.timeLabel}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#C0D3C3] space-y-1">
              <p className="text-[#25372D]/65">Your video link &amp; contact</p>
              <p className="font-mono text-[#5D8B69] font-semibold break-all">
                {booking.unlockedContact?.teletherapyUrl}
              </p>
              <p className="text-[#25372D]/80">
                Coord: {booking.unlockedContact?.coordinationEmail}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#C0D3C3] space-y-1">
              <p className="text-[#25372D]/65">Reminders</p>
              <p className="font-semibold text-[#25372D]">
                24h Reminder: {booking.reminders.reminder24h.toUpperCase()}
              </p>
              <p className="font-semibold text-[#25372D]">
                1h Reminder: {booking.reminders.reminder1h.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => router.push('/bookings')}>
              View All Client Bookings
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/psych/schedule')}
            >
              Inspect Psychologist Schedule View →
            </Button>
          </div>
        </Card>
      )}

      {/* Payment Error State (When Simulate Payment Failure is active) */}
      {paymentErrorMsg && (
        <div
          role="alert"
          className="bg-red-50 border-2 border-red-300 rounded-xl p-5 text-red-950 space-y-2"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="font-heading text-xl font-bold text-red-900">
              Payment Failed — Booking Not Finalized
            </p>
            <span className="text-xs font-mono font-semibold text-red-800">
              CONTACT REMAINS LOCKED
            </span>
          </div>
          <p className="text-xs text-red-900/90 leading-relaxed">{paymentErrorMsg}</p>
          <div className="pt-1 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSimulatePaymentFailure(false);
                setPaymentErrorMsg(null);
              }}
            >
              Switch to &quot;Payment Succeeds&quot; &amp; retry
            </Button>
          </div>
        </div>
      )}

      {/* Proposal Details + 3-Slot Picker Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Booking & Psychologist Proposal Metadata */}
        <Card className="lg:col-span-5 space-y-5">
          <div className="border-b border-[#C0D3C3] pb-3">
            <p className="text-xs font-semibold text-[#5D8B69]">
              Your psychologist
            </p>
            <h2 className="font-heading text-2xl font-bold text-[#25372D]">
              {booking.psychologistCode || 'Waiting for a psychologist to reply'}
            </h2>
            <p className="text-xs text-[#25372D]/75 mt-0.5">
              {booking.psychologistSpecialization}
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#C0D3C3]/50">
              <span className="text-[#25372D]/70">Booked for</span>
              <span className="font-semibold text-[#25372D]">{booking.personaLabel}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#C0D3C3]/50">
              <span className="text-[#25372D]/70">Service</span>
              <span className="font-semibold text-[#25372D]">{booking.serviceTitle}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#C0D3C3]/50">
              <span className="text-[#25372D]/70">Session length</span>
              <span className="font-mono font-semibold text-[#5D8B69] tabular-nums">
                {booking.serviceDuration}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#C0D3C3]/50">
              <span className="text-[#25372D]/70">Session fee</span>
              <span className="font-mono text-base font-bold text-[#25372D] tabular-nums">
                {booking.pricePhp ? `₱${booking.pricePhp.toLocaleString()}` : 'Pending Proposal'}
              </span>
            </div>
          </div>

          {booking.clinicalPrepNote && (
            <div className="p-3.5 rounded-lg bg-[#F1F6F2] border border-[#C0D3C3] space-y-1 text-xs">
              <p className="font-semibold text-[#25372D]">
                A note from your psychologist:
              </p>
              <p className="text-[#25372D]/80 leading-relaxed">
                {booking.clinicalPrepNote}
              </p>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3] text-xs text-[#25372D]/75 flex items-start gap-2.5">
            <svg
              className="w-4 h-4 text-[#5D8B69] shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>
              <strong>Why contact unlocks after payment:</strong> the video link and contact
              details unlock after you choose 1 of the 3 proposed times and payment succeeds.
            </span>
          </div>
        </Card>

        {/* Right: 3 Radio Slots + Payment Form */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between border-b border-[#C0D3C3] pb-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                Choose 1 of 3 proposed times
              </h2>
              <p className="text-xs text-[#25372D]/70">
                All times shown in Philippine Standard Time (PST · UTC+8)
              </p>
            </div>
            <span className="font-mono text-lg font-bold text-[#5D8B69] tabular-nums">
              {booking.pricePhp ? `₱${booking.pricePhp.toLocaleString()}` : ''}
            </span>
          </div>

          {booking.proposedSlots.length === 0 ? (
            <div className="p-8 text-center bg-[#F6F9F6] rounded-xl border border-dashed border-[#8FBE8F] space-y-3">
              <p className="font-heading text-xl font-bold text-[#25372D]">
                No times proposed yet
              </p>
              <p className="text-xs text-[#25372D]/75 max-w-md mx-auto">
                A verified psychologist hasn&apos;t replied yet — check back soon.
              </p>
            </div>
          ) : (
            <form
              onSubmit={form.handleSubmit((vals) => payMutation.mutate(vals))}
              className="space-y-6"
            >
              {/* 3 Radio Slots */}
              <div className="space-y-3" role="radiogroup" aria-label="Proposed Date and Time Slots">
                {booking.proposedSlots.map((slot) => {
                  const isChecked = selectedSlotId === slot.id;
                  return (
                    <label
                      key={slot.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${
                        isChecked
                          ? 'border-2 border-[#5D8B69] bg-[#F1F6F2]'
                          : 'border-[#C0D3C3] bg-white hover:bg-[#F6F9F6]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <input
                          type="radio"
                          value={slot.id}
                          disabled={booking.status === 'paid-confirmed'}
                          className="h-4 w-4 text-[#5D8B69] focus:ring-[#5D8B69]"
                          {...form.register('selectedSlotId')}
                        />
                        <div>
                          <p className="text-xs font-semibold text-[#5D8B69]">
                            Option 0{slot.slotNumber}
                          </p>
                          <p className="font-heading text-xl font-bold text-[#25372D]">
                            {slot.dateLabel}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#25372D] tabular-nums">
                        {slot.timeLabel}
                      </span>
                    </label>
                  );
                })}
                {form.formState.errors.selectedSlotId && (
                  <p className="text-xs text-red-700">
                    {form.formState.errors.selectedSlotId.message}
                  </p>
                )}
              </div>

              {/* Payment Method & Prototype Error State Simulator */}
              <div className="p-4 rounded-xl bg-[#F6F9F6] border border-[#C0D3C3] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#25372D]">
                    Payment method (test mode)
                  </p>
                  <label className="inline-flex items-center gap-2 text-xs text-[#25372D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulatePaymentFailure}
                      onChange={(e) => setSimulatePaymentFailure(e.target.checked)}
                      className="rounded border-[#C0D3C3] text-red-600"
                    />
                    <span>Simulate a failed payment</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {[
                    { id: 'card_visa_4242', label: 'Credit/Debit •••• 4242' },
                    { id: 'gcash_paymongo_mock', label: 'GCash (Stripe PH)' },
                    { id: 'maya_stripe_mock', label: 'Maya Wallet' },
                  ].map((pm) => (
                    <label
                      key={pm.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#C0D3C3] cursor-pointer"
                    >
                      <input
                        type="radio"
                        value={pm.id}
                        disabled={booking.status === 'paid-confirmed'}
                        {...form.register('paymentMethodLabel')}
                      />
                      <span className="font-medium text-[#25372D]">{pm.label}</span>
                    </label>
                  ))}
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[#25372D]/85 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    disabled={booking.status === 'paid-confirmed'}
                    className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69]"
                    {...form.register('acknowledgeFinalizationRule')}
                  />
                  <span>
                    I confirm my chosen time. I understand contact details unlock once payment
                    succeeds.
                  </span>
                </label>
                {form.formState.errors.acknowledgeFinalizationRule && (
                  <p className="text-xs text-red-700">
                    {form.formState.errors.acknowledgeFinalizationRule.message}
                  </p>
                )}
              </div>

              {booking.status !== 'paid-confirmed' && (
                <Button
                  type="submit"
                  variant={simulatePaymentFailure ? 'danger' : 'primary'}
                  size="lg"
                  className="w-full"
                  disabled={payMutation.isPending}
                >
                  {payMutation.isPending
                    ? 'Processing Payment...'
                    : simulatePaymentFailure
                    ? `Try a failed payment (₱${booking.pricePhp?.toLocaleString()})`
                    : `Pay ₱${booking.pricePhp?.toLocaleString()} & confirm booking`}
                </Button>
              )}
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
