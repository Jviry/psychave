'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';

export interface DateTimePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const TIME_SLOTS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, idx) => {
  const hour24 = Math.floor(idx / 2);
  const minute = idx % 2 === 0 ? 0 : 30;
  const hh = String(hour24).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    value: `${hh}:${mm}`,
    label: `${hour12}:${mm} ${period}`,
  };
});

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDateTimeValue(raw?: string): { date: string; time: string } | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!match) return null;
  return { date: match[1], time: match[2] };
}

function parseYMD(ymd: string): { year: number; month: number; day: number } | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function formatDisplayValue(raw?: string): string | null {
  const parsed = parseDateTimeValue(raw);
  if (!parsed) return null;
  const ymd = parseYMD(parsed.date);
  if (!ymd) return null;
  const [hhStr, mmStr] = parsed.time.split(':');
  const hour24 = Number(hhStr);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const dt = new Date(ymd.year, ymd.month, ymd.day);
  const weekday = WEEKDAYS[dt.getDay()];
  return `${weekday}, ${SHORT_MONTHS[ymd.month]} ${ymd.day}, ${ymd.year} · ${hour12}:${mmStr} ${period}`;
}

function getManilaTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export const DateTimePicker = React.forwardRef<HTMLButtonElement, DateTimePickerProps>(
  (
    {
      id,
      value = '',
      onChange,
      onBlur,
      min,
      disabled = false,
      placeholder = 'Select date & time',
      className = '',
      'aria-invalid': ariaInvalid,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const timeListRef = useRef<HTMLDivElement | null>(null);

    const [open, setOpen] = useState(false);
    const [popoverPos, setPopoverPos] = useState<{
      top: number;
      left: number;
      placement: 'bottom' | 'top';
    } | null>(null);

    const parsedValue = useMemo(() => parseDateTimeValue(value), [value]);
    const parsedMin = useMemo(() => parseDateTimeValue(min), [min]);
    const todayYMD = useMemo(() => getManilaTodayYMD(), []);

    const initialView = useMemo(() => {
      const target = parsedValue?.date ?? parsedMin?.date ?? todayYMD;
      const ymd = parseYMD(target);
      return ymd ? { year: ymd.year, month: ymd.month } : { year: 2026, month: 0 };
    }, [parsedValue?.date, parsedMin?.date, todayYMD]);

    const [viewYear, setViewYear] = useState(initialView.year);
    const [viewMonth, setViewMonth] = useState(initialView.month);

    // Sync calendar month when opening to match current value or min
    useEffect(() => {
      if (!open) return;
      setViewYear(initialView.year);
      setViewMonth(initialView.month);
    }, [open, initialView.year, initialView.month]);

    // Position the floating panel relative to the trigger button
    useEffect(() => {
      if (!open) return;

      const updatePosition = () => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const panelWidth = Math.min(460, window.innerWidth - 24);
        const estimatedHeight = 368;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

        const left = Math.max(
          12,
          Math.min(rect.left, window.innerWidth - panelWidth - 12)
        );
        const top = openAbove
          ? Math.max(12, rect.top - estimatedHeight - 6)
          : Math.min(window.innerHeight - estimatedHeight - 12, rect.bottom + 6);

        setPopoverPos({
          top,
          left,
          placement: openAbove ? 'top' : 'bottom',
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }, [open]);

    // Auto-scroll time list to selected time (or 09:00) on open
    useEffect(() => {
      if (!open) return;
      const list = timeListRef.current;
      if (!list) return;
      const targetTime = parsedValue?.time ?? '09:00';
      const targetEl = list.querySelector<HTMLElement>(`[data-time="${targetTime}"]`);
      if (targetEl) {
        list.scrollTop = Math.max(0, targetEl.offsetTop - list.clientHeight / 3);
      }
    }, [open, parsedValue?.time]);

    // Close on outside click or Escape
    useEffect(() => {
      if (!open) return;

      const handlePointerDown = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
          onBlur?.();
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
          onBlur?.();
        }
      };

      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown, true);
      return () => {
        document.removeEventListener('mousedown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }, [open, onBlur]);

    const calendarCells = useMemo(() => {
      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startDay = firstOfMonth.getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

      const cells: { ymd: string; day: number; inMonth: boolean }[] = [];

      for (let i = startDay - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
        cells.push({ ymd: formatYMD(prevYear, prevMonth, d), day: d, inMonth: false });
      }

      for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ ymd: formatYMD(viewYear, viewMonth, d), day: d, inMonth: true });
      }

      const remaining = 42 - cells.length;
      for (let d = 1; d <= remaining; d++) {
        const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
        cells.push({ ymd: formatYMD(nextYear, nextMonth, d), day: d, inMonth: false });
      }

      return cells;
    }, [viewYear, viewMonth]);

    const isDateDisabled = (ymd: string) => {
      if (!parsedMin) return false;
      return ymd < parsedMin.date;
    };

    const isTimeDisabled = (time: string) => {
      if (!parsedMin) return false;
      const activeDate = parsedValue?.date ?? parsedMin.date;
      if (activeDate > parsedMin.date) return false;
      if (activeDate < parsedMin.date) return true;
      return time < parsedMin.time;
    };

    const handleSelectDate = (ymd: string) => {
      if (isDateDisabled(ymd)) return;
      let nextTime = parsedValue?.time ?? '09:00';
      if (parsedMin && ymd === parsedMin.date && nextTime < parsedMin.time) {
        const firstValid = TIME_SLOTS.find((s) => s.value >= parsedMin.time);
        nextTime = firstValid?.value ?? parsedMin.time;
      }
      onChange(`${ymd}T${nextTime}`);

      const clicked = parseYMD(ymd);
      if (clicked && (clicked.year !== viewYear || clicked.month !== viewMonth)) {
        setViewYear(clicked.year);
        setViewMonth(clicked.month);
      }
    };

    const handleSelectTime = (time: string) => {
      if (isTimeDisabled(time)) return;
      const nextDate = parsedValue?.date ?? parsedMin?.date ?? todayYMD;
      onChange(`${nextDate}T${time}`);
    };

    const goToPrevMonth = () => {
      if (viewMonth === 0) {
        setViewYear((y) => y - 1);
        setViewMonth(11);
      } else {
        setViewMonth((m) => m - 1);
      }
    };

    const goToNextMonth = () => {
      if (viewMonth === 11) {
        setViewYear((y) => y + 1);
        setViewMonth(0);
      } else {
        setViewMonth((m) => m + 1);
      }
    };

    const canGoPrevMonth = useMemo(() => {
      if (!parsedMin) return true;
      const minYMD = parseYMD(parsedMin.date);
      if (!minYMD) return true;
      return viewYear > minYMD.year || (viewYear === minYMD.year && viewMonth > minYMD.month);
    }, [parsedMin, viewYear, viewMonth]);

    const displayLabel = formatDisplayValue(value);

    const assignTriggerRef = (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div ref={containerRef} className="relative w-full">
        <div className="relative flex items-center">
          <button
            ref={assignTriggerRef}
            id={id}
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            onClick={() => {
              if (!disabled) setOpen((prev) => !prev);
            }}
            className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-surface-raised px-3.5 py-2 text-left text-sm shadow-field transition-colors duration-150 focus:border-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sage disabled:bg-surface-sunken disabled:cursor-not-allowed cursor-pointer ${
              ariaInvalid
                ? 'border-red-400 focus-visible:ring-red-200'
                : open
                  ? 'border-sage ring-2 ring-sage/20'
                  : 'border-mist hover:border-sage/60'
            } ${className}`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <CalendarDays
                className={`h-4 w-4 shrink-0 ${
                  displayLabel ? 'text-accent-ink' : 'text-pine/45'
                }`}
                aria-hidden="true"
              />
              <span
                className={`truncate tabular-nums ${
                  displayLabel ? 'text-pine font-medium' : 'text-pine/45'
                }`}
              >
                {displayLabel ?? placeholder}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-pine/45 transition-transform duration-150 ${
                open ? 'rotate-180 text-pine' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {open && popoverPos && (
          <div
            role="dialog"
            aria-label="Choose date and time"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            className="fixed z-50 w-[min(460px,calc(100vw-24px))] rounded-2xl border border-mist bg-surface-raised shadow-lift animate-modal-in overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row">
              {/* Calendar Grid */}
              <div className="flex-1 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading text-lg font-medium text-pine tracking-tight">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={goToPrevMonth}
                      disabled={!canGoPrevMonth}
                      aria-label="Previous month"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-pine/70 hover:bg-surface-sunken hover:text-pine disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      aria-label="Next month"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-pine/70 hover:bg-surface-sunken hover:text-pine transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((day) => (
                    <span
                      key={day}
                      className="text-[11px] font-semibold uppercase tracking-wider text-pine/50 py-1"
                    >
                      {day}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell) => {
                    const isSelected = parsedValue?.date === cell.ymd;
                    const isToday = todayYMD === cell.ymd;
                    const isDisabled = isDateDisabled(cell.ymd);

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectDate(cell.ymd)}
                        aria-label={cell.ymd}
                        aria-pressed={isSelected}
                        className={`h-8 w-full rounded-lg text-xs tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sage ${
                          isSelected
                            ? 'bg-pine text-white font-semibold shadow-field cursor-pointer'
                            : isDisabled
                              ? 'text-pine/20 cursor-not-allowed'
                              : cell.inMonth
                                ? isToday
                                  ? 'ring-1 ring-sage/60 bg-surface-sunken font-semibold text-accent-ink hover:bg-sage/15 cursor-pointer'
                                  : 'text-pine hover:bg-surface-sunken font-medium cursor-pointer'
                                : 'text-pine/35 hover:bg-surface-sunken/70 cursor-pointer'
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div className="sm:w-44 border-t sm:border-t-0 sm:border-l border-mist bg-surface-sunken/40 flex flex-col">
                <div className="px-3.5 py-2.5 border-b border-mist/80 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-accent-ink" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-pine/65">
                    Time (Manila)
                  </span>
                </div>
                <div
                  ref={timeListRef}
                  className="max-h-44 sm:max-h-[252px] overflow-y-auto p-2 space-y-1"
                >
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = parsedValue?.time === slot.value;
                    const slotDisabled = isTimeDisabled(slot.value);

                    return (
                      <button
                        key={slot.value}
                        type="button"
                        data-time={slot.value}
                        disabled={slotDisabled}
                        onClick={() => handleSelectTime(slot.value)}
                        aria-pressed={isSelected}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs text-left tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sage ${
                          isSelected
                            ? 'bg-pine text-white font-semibold cursor-pointer'
                            : slotDisabled
                              ? 'text-pine/25 cursor-not-allowed'
                              : 'text-pine/85 hover:bg-surface-raised hover:text-pine font-medium cursor-pointer'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-mist bg-surface-sunken/60">
              <span className="text-xs text-pine/70 tabular-nums truncate">
                {displayLabel ? `${displayLabel} PHT` : 'Pick a date and time'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-pine/70 hover:text-pine hover:bg-surface-raised transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                    onBlur?.();
                  }}
                  className="px-3.5 py-1 rounded-full bg-pine text-white text-xs font-medium hover:bg-pine/90 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
DateTimePicker.displayName = 'DateTimePicker';
