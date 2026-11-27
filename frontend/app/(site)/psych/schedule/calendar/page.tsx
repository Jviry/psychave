'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { useActivePsychologist } from '@/hooks/useActivePsychologist';
import type { BookingRequest, BookingStatus } from '@/lib/types';
import { agreedSlot, psychologistCounterSlot } from '@/lib/booking';
import {
  BookingStatusTag,
  Button,
  Skeleton,
} from '@/components/ui/primitives';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarEvent {
  session: BookingRequest;
  dateKey: string; // YYYY-MM-DD in Asia/Manila
  startTimeLabel: string;
  fullTimeLabel: string;
  dateLabel: string;
  sortKey: number;
}

function toManilaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseSlotIso(iso?: string): Date | null {
  if (!iso) return null;
  const hasTz = /[zZ]|([+-]\d{2}:?\d{2})$/.test(iso);
  const normalized = hasTz ? iso : `${iso}+08:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatManilaTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function eventChipTone(status: BookingStatus): string {
  if (status === 'paid-confirmed') {
    return 'bg-sage/15 border-sage/40 text-pine hover:bg-sage/25';
  }
  if (status === 'awaiting-payment' || status === 'awaiting-client') {
    return 'bg-amber-50 border-amber-200 text-amber-950 hover:bg-amber-100';
  }
  if (status === 'completed') {
    return 'bg-surface-sunken border-mist text-pine/75 hover:bg-mist/40';
  }
  return 'bg-parchment border-mist text-pine/80 hover:bg-surface-sunken';
}

function eventDotTone(status: BookingStatus): string {
  if (status === 'paid-confirmed') return 'bg-sage';
  if (status === 'awaiting-payment' || status === 'awaiting-client') return 'bg-amber-500';
  if (status === 'completed') return 'bg-pine/45';
  return 'bg-mint';
}

function buildMonthGrid(year: number, monthIndex: number): {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const cells: { dateKey: string; dayNumber: number; inCurrentMonth: boolean }[] = [];

  const pad = (n: number) => String(n).padStart(2, '0');

  // Leading days from previous month
  const prevMonthDate = new Date(year, monthIndex - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    cells.push({
      dateKey: `${prevYear}-${pad(prevMonth)}-${pad(day)}`,
      dayNumber: day,
      inCurrentMonth: false,
    });
  }

  // Current month days
  const curMonth = monthIndex + 1;
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: `${year}-${pad(curMonth)}-${pad(day)}`,
      dayNumber: day,
      inCurrentMonth: true,
    });
  }

  // Trailing days from next month to fill full weeks
  const nextMonthDate = new Date(year, monthIndex + 1, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      dateKey: `${nextYear}-${pad(nextMonth)}-${pad(nextDay)}`,
      dayNumber: nextDay,
      inCurrentMonth: false,
    });
    nextDay += 1;
  }

  return cells;
}

function formatSelectedDateHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PsychologistScheduleCalendarPage() {
  const router = useRouter();
  const { activePsych } = useActivePsychologist();

  const todayKey = useMemo(() => toManilaDateKey(new Date()), []);
  const [todayYear, todayMonth] = useMemo(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return [y, (m || 1) - 1];
  }, [todayKey]);

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const {
    data: bookings = [],
    isLoading,
    error: bookingsError,
    refetch: refetchBookings,
    isFetching: isRefetchingBookings,
  } = useQuery({
    queryKey: ['bookings', 'psychologist'],
    queryFn: () => api.getBookingsForRole('psychologist'),
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const assigned = bookings.filter(
      (b) => b.psychologistId && b.status !== 'cancelled' && b.status !== 'refunded'
    );

    assigned.forEach((session) => {
      const slot =
        agreedSlot(session) ??
        (session.status === 'awaiting-client' ? psychologistCounterSlot(session) : undefined);
      if (!slot) return;

      const parsed = parseSlotIso(slot.isoDateTime);
      if (!parsed) return;

      const dateKey = toManilaDateKey(parsed);
      const event: CalendarEvent = {
        session,
        dateKey,
        startTimeLabel: formatManilaTime(parsed),
        fullTimeLabel: slot.timeLabel,
        dateLabel: slot.dateLabel,
        sortKey: parsed.getTime(),
      };
      const existing = map.get(dateKey) ?? [];
      existing.push(event);
      map.set(dateKey, existing);
    });

    map.forEach((list) => list.sort((a, b) => a.sortKey - b.sortKey));
    return map;
  }, [bookings]);

  const monthCells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthHeading = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  const selectedDayEvents = eventsByDate.get(selectedDateKey) ?? [];

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(todayYear);
    setViewMonth(todayMonth);
    setSelectedDateKey(todayKey);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-mist pb-5">
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine tracking-tight">
          My Practice Schedule
        </h1>

        <nav
          aria-label="Schedule views"
          className="inline-flex items-center rounded-full border border-mist bg-surface-sunken p-1 self-start sm:self-auto"
        >
          <Link
            href="/psych/schedule"
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors"
          >
            <List className="w-3.5 h-3.5" aria-hidden="true" />
            Sessions
          </Link>
          <Link
            href="/psych/schedule/calendar"
            aria-current="page"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-pine shadow-field"
          >
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            Calendar
          </Link>
        </nav>
      </header>

      {bookingsError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Could not load your calendar.</p>
              <p className="mt-1 break-words text-red-800">
                {getFriendlyErrorMessage(
                  bookingsError,
                  'Something went wrong while loading your schedule. Please try again.'
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchBookings()}
            disabled={isRefetchingBookings}
            className="shrink-0"
          >
            {isRefetchingBookings ? 'Retrying…' : 'Try Again'}
          </Button>
        </div>
      )}

      {/* Toolbar: Month Controls + Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrevMonth}
            aria-label="Previous month"
            className="px-2.5"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <h2 className="font-heading text-xl font-medium text-pine min-w-[168px] text-center">
            {monthHeading}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNextMonth}
            aria-label="Next month"
            className="px-2.5"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="ml-1"
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-pine/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sage" aria-hidden="true" />
            Confirmed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
            Pending Payment / Offer
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pine/45" aria-hidden="true" />
            Completed
          </span>
          {activePsych?.anonymizedTitle && (
            <span className="hidden lg:inline font-mono text-pine/60">
              · {activePsych.anonymizedTitle}
            </span>
          )}
        </div>
      </div>

      {/* Calendar + Selected Day Agenda */}
      {isLoading ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Month Grid */}
          <div className="lg:col-span-8 rounded-2xl border border-mist bg-surface-raised overflow-hidden">
            <div className="grid grid-cols-7 border-b border-mist bg-parchment">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-pine/65"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-mist/60">
              {monthCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateKey) ?? [];
                const isToday = cell.dateKey === todayKey;
                const isSelected = cell.dateKey === selectedDateKey;

                return (
                  <div
                    key={cell.dateKey}
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatSelectedDateHeading(cell.dateKey)}, ${dayEvents.length} ${dayEvents.length === 1 ? 'session' : 'sessions'}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDateKey(cell.dateKey);
                      }
                    }}
                    className={`min-h-[82px] sm:min-h-[108px] p-1.5 sm:p-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage ${
                      isSelected
                        ? 'bg-surface-sunken/80'
                        : cell.inCurrentMonth
                          ? 'bg-surface-raised hover:bg-parchment'
                          : 'bg-parchment/50 text-pine/40 hover:bg-parchment'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs tabular-nums ${
                          isToday
                            ? 'bg-pine text-white font-semibold'
                            : cell.inCurrentMonth
                              ? 'text-pine font-medium'
                              : 'text-pine/40'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="sm:hidden inline-flex items-center gap-0.5">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <span
                              key={ev.session.id}
                              className={`w-1.5 h-1.5 rounded-full ${eventDotTone(ev.session.status)}`}
                              aria-hidden="true"
                            />
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Desktop event pills */}
                    <div className="hidden sm:flex flex-col gap-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <button
                          key={ev.session.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/psych/schedule/${encodeURIComponent(ev.session.id)}`
                            );
                          }}
                          className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] leading-tight truncate transition-colors cursor-pointer ${eventChipTone(
                            ev.session.status
                          )}`}
                          title={`${ev.startTimeLabel} · ${ev.session.profileLabel} (${ev.session.serviceTitle})`}
                        >
                          <span className="font-mono font-semibold">{ev.startTimeLabel}</span>{' '}
                          <span>{ev.session.profileLabel}</span>
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[10px] font-medium text-pine/65 px-1">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda */}
          <aside
            aria-labelledby="selected-day-heading"
            className="lg:col-span-4 rounded-2xl border border-mist bg-surface-raised p-5 space-y-4"
          >
            <div className="border-b border-mist/70 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pine/55">
                Selected Day · PHT
              </p>
              <h3
                id="selected-day-heading"
                className="font-heading text-xl font-medium text-pine mt-0.5"
              >
                {formatSelectedDateHeading(selectedDateKey)}
              </h3>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-pine/65 py-6 text-center">
                No sessions scheduled on this date.
              </p>
            ) : (
              <ul className="divide-y divide-mist/60">
                {selectedDayEvents.map((ev) => {
                  const detailHref = `/psych/schedule/${encodeURIComponent(ev.session.id)}`;
                  return (
                    <li key={ev.session.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={detailHref}
                        className="group block rounded-xl p-2.5 -mx-2.5 hover:bg-parchment transition-colors focus-visible:outline-2 focus-visible:outline-sage"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <p className="font-mono text-xs font-semibold text-accent-ink tabular-nums">
                              {ev.fullTimeLabel}
                            </p>
                            <p className="text-sm font-medium text-pine group-hover:text-accent-ink transition-colors truncate">
                              {ev.session.serviceTitle}
                            </p>
                            <p className="text-xs text-pine/70 truncate">
                              {ev.session.profileLabel} ({ev.session.profileType})
                            </p>
                          </div>
                          <ChevronRight
                            className="w-4 h-4 text-pine/40 group-hover:text-accent-ink shrink-0 mt-1 transition-colors"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="mt-2">
                          <BookingStatusTag
                            status={ev.session.status}
                            perspective="psychologist"
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
