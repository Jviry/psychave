'use client';

import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { BookingRequest, ProposedSlot } from '@/lib/types';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Button, Label } from '@/components/ui/primitives';

interface SlotNegotiationPanelProps {
  booking: BookingRequest;
  counterSlot?: ProposedSlot;
  paymentQueryState: string | null;
  isAccepting: boolean;
  isSubmittingSlots: boolean;
  onAcceptCounter: (slotId: string) => void;
  onSubmitNewSlots: (slots: string[], onReset: () => void) => void;
}

export function SlotNegotiationPanel({
  booking,
  counterSlot,
  paymentQueryState,
  isAccepting,
  isSubmittingSlots,
  onAcceptCounter,
  onSubmitNewSlots,
}: SlotNegotiationPanelProps) {
  const [showProposeForm, setShowProposeForm] = useState(!counterSlot);
  const [newSlots, setNewSlots] = useState<string[]>(['', '', '']);

  const normalizedSlots = newSlots.map((slot) => slot.trim()).filter(Boolean);
  const slotsAreFuture = normalizedSlots.every((value) => {
    const normalized = value.length === 16 ? `${value}:00+08:00` : `${value}+08:00`;
    const parsed = new Date(normalized);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
  });
  const slotsAreDistinct =
    new Set(normalizedSlots.map((value) => value.slice(0, 16))).size ===
    normalizedSlots.length;
  const canSubmitSlots =
    normalizedSlots.length >= 3 && slotsAreFuture && slotsAreDistinct;

  const updateSlot = (index: number, value: string) => {
    setNewSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? value : slot))
    );
  };

  const removeSlot = (index: number) => {
    if (newSlots.length <= 3) return;
    setNewSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmitSlots) return;
    onSubmitNewSlots(normalizedSlots, () => {
      setNewSlots(['', '', '']);
      setShowProposeForm(false);
    });
  };

  return (
    <div className="space-y-4">
      {paymentQueryState === 'success' && booking.isSessionPaid && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-sage bg-parchment px-3.5 py-2.5 text-xs text-pine font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-sage shrink-0" aria-hidden="true" />
          <span>
            ₱600 reschedule fee confirmed. Submit 3 to 5 new preferred times below.
          </span>
        </div>
      )}

      {counterSlot ? (
        <div className="rounded-xl border border-sage/60 bg-surface-sunken p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
            Suggested Alternative Time
          </p>
          <div>
            <p className="font-heading text-xl font-medium text-pine tabular-nums">
              {counterSlot.dateLabel}
            </p>
            <p className="font-mono text-xs font-semibold text-accent-ink tabular-nums">
              {counterSlot.timeLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            disabled={isAccepting}
            onClick={() => onAcceptCounter(counterSlot.id)}
          >
            {isAccepting
              ? 'Accepting…'
              : booking.isSessionPaid
                ? 'Accept Time & Confirm Reschedule'
                : 'Accept Suggested Time'}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1">
          {booking.isSessionPaid ? (
            <>
              <p className="font-semibold">
                Rescheduling in progress · Session payment is on file
              </p>
              <p>
                Submit 3 to 5 new preferred times below. Once your psychologist accepts a slot,
                your session is confirmed with no additional session payment.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">The agreed slot was released.</p>
              <p>
                The payment deadline passed, so the held time is no longer reserved. Submit a fresh
                set of 3 to 5 preferred times to restart scheduling.
              </p>
            </>
          )}
        </div>
      )}

      {counterSlot && (
        <button
          type="button"
          onClick={() => setShowProposeForm((v) => !v)}
          aria-expanded={showProposeForm}
          className="w-full flex items-center justify-between rounded-xl border border-mist bg-parchment px-3.5 py-2.5 text-xs font-semibold text-pine hover:border-sage transition-colors cursor-pointer"
        >
          <span>Prefer different times? Propose 3–5 new slots</span>
          {showProposeForm ? (
            <ChevronUp className="w-4 h-4 text-pine/60 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-pine/60 shrink-0" aria-hidden="true" />
          )}
        </button>
      )}

      {(showProposeForm || !counterSlot) && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div>
            <Label>New preferred times (3 to 5 required)</Label>
            <p className="text-xs text-pine/65 mt-0.5">
              All times in Philippine Time (PHT, GMT+8).
            </p>
          </div>

          <div className="space-y-2">
            {newSlots.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-semibold text-pine/60 tabular-nums">
                  {index + 1}.
                </span>
                <DateTimePicker
                  value={value}
                  onChange={(nextValue) => updateSlot(index, nextValue)}
                  disabled={isSubmittingSlots}
                  aria-label={`Preferred schedule ${index + 1}`}
                />
                {newSlots.length > 3 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="p-2 rounded-md text-pine/50 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    aria-label={`Remove preferred schedule ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {newSlots.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewSlots((current) => [...current, ''])}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add another time
            </Button>
          )}

          {normalizedSlots.length > 0 && !canSubmitSlots && (
            <p className="text-xs text-red-700">
              Provide at least 3 distinct future times.
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={!canSubmitSlots || isSubmittingSlots}
          >
            {isSubmittingSlots ? 'Submitting…' : 'Submit New Preferred Times'}
          </Button>
        </form>
      )}
    </div>
  );
}
