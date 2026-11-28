'use client';

import React, { useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Button, Checkbox, Input, Label } from '@/components/ui/primitives';

interface ReschedulePanelProps {
  isWithin2Hours: boolean;
  isPending: boolean;
  onSubmitReschedule: (
    payload: { reason?: string; preferredSlots: string[] },
    onReset: () => void
  ) => void;
}

export function ReschedulePanel({
  isWithin2Hours,
  isPending,
  onSubmitReschedule,
}: ReschedulePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const [reason, setReason] = useState('');
  const [feeAck, setFeeAck] = useState(false);

  const filledSlots = slots.map((s) => s.trim()).filter(Boolean);
  const slotsAreFuture = filledSlots.every((value) => {
    const normalized = value.length === 16 ? `${value}:00+08:00` : `${value}+08:00`;
    const parsed = new Date(normalized);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
  });
  const slotsAreDistinct =
    new Set(filledSlots.map((value) => value.slice(0, 16))).size === filledSlots.length;
  const slotsValid = filledSlots.length >= 3 && slotsAreFuture && slotsAreDistinct;
  const canSubmit = !isPending && slotsValid && (!isWithin2Hours || feeAck);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmitReschedule(
      { reason: reason.trim() || undefined, preferredSlots: filledSlots },
      () => {
        setSlots(['', '', '']);
        setReason('');
        setFeeAck(false);
        setExpanded(false);
      }
    );
  };

  return (
    <section
      aria-labelledby="reschedule-booking-heading"
      className="rounded-2xl border border-mist bg-surface-raised p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="reschedule-booking-heading"
            className="text-sm font-semibold text-pine flex items-center gap-1.5"
          >
            <CalendarClock className="w-4 h-4 text-accent-ink shrink-0" aria-hidden="true" />
            <span>Need to reschedule?</span>
          </h2>
          <p className="text-xs text-pine/65 mt-0.5">
            {isWithin2Hours
              ? 'Less than 2 hours before session — ₱600 fee applies unless waived.'
              : 'Free when requested at least 2 hours before your session.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0"
        >
          <span>{expanded ? 'Close' : 'Reschedule'}</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {expanded && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-mist/60 pt-4">
          <p className="text-xs text-pine/75 leading-relaxed">
            {isWithin2Hours
              ? 'Your session starts in less than 2 hours, so a ₱600 rescheduling fee applies. If you have a valid reason, message your psychologist — they can waive the fee.'
              : 'Confirmed sessions are non-refundable, but you can propose 3 to 5 new preferred times at no extra charge.'}
          </p>

          <div className="space-y-2">
            <div>
              <Label>New preferred times (3 to 5 required)</Label>
              <p className="text-xs text-pine/65 mt-0.5">
                All times in Philippine Time (PHT, GMT+8).
              </p>
            </div>
            {slots.map((slotValue, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-semibold text-pine/60 tabular-nums">
                  {index + 1}.
                </span>
                <DateTimePicker
                  value={slotValue}
                  onChange={(nextVal) =>
                    setSlots((prev) => prev.map((s, i) => (i === index ? nextVal : s)))
                  }
                  disabled={isPending}
                  aria-label={`Reschedule preferred time ${index + 1}`}
                />
                {slots.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}
                    className="p-2 rounded-md text-pine/50 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    aria-label={`Remove reschedule time ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}

            {slots.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSlots((prev) => [...prev, ''])}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add another time
              </Button>
            )}

            {filledSlots.length > 0 && !slotsValid && (
              <p className="text-xs text-red-700">
                Provide at least 3 distinct future times.
              </p>
            )}
          </div>

          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason for rescheduling"
          />

          {isWithin2Hours && (
            <label className="flex items-start gap-2 text-xs text-amber-900 cursor-pointer">
              <Checkbox checked={feeAck} onChange={(e) => setFeeAck(e.target.checked)} />
              <span>
                I understand a ₱600 rescheduling fee applies unless waived by my psychologist.
              </span>
            </label>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={!canSubmit}
          >
            {isPending
              ? 'Requesting…'
              : isWithin2Hours
                ? 'Request Reschedule (₱600 fee)'
                : 'Request Reschedule'}
          </Button>
        </form>
      )}
    </section>
  );
}
