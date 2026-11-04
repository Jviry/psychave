import type { BookingRequest, ProposedSlot } from './types';

export function currentRoundSlots(booking: BookingRequest): ProposedSlot[] {
  return booking.proposedSlots.filter(
    (slot) => slot.round === booking.schedulingRound
  );
}

export function clientPreferredSlots(booking: BookingRequest): ProposedSlot[] {
  return currentRoundSlots(booking).filter(
    (slot) => slot.proposedBy === 'client' && slot.status === 'proposed'
  );
}

export function psychologistCounterSlot(
  booking: BookingRequest
): ProposedSlot | undefined {
  return currentRoundSlots(booking).find(
    (slot) => slot.proposedBy === 'psychologist' && slot.status === 'proposed'
  );
}

export function agreedSlot(booking: BookingRequest): ProposedSlot | undefined {
  return booking.proposedSlots.find((slot) => slot.id === booking.selectedSlotId);
}

/** Treat a timezone-less backend deadline as Manila wall-clock time. */
export function parseManilaDateTime(value: string): Date {
  const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}+08:00`);
}

export function formatManilaDateTime(value: string): string {
  const parsed = parseManilaDateTime(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

export function formatDeadlineCountdown(value: string, nowMs = Date.now()): string {
  const deadline = parseManilaDateTime(value).getTime();
  if (Number.isNaN(deadline)) return value;
  const remaining = deadline - nowMs;
  if (remaining <= 0) return 'deadline passed';
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h left` : `${hours}h ${rest}m left`;
}
