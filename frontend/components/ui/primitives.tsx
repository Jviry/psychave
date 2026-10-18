'use client';

import React, { useEffect, useId, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { BookingStatus } from '../../lib/types';

/**
 * PsychAvenuePH UI kit (de-vibe-coding foundation).
 *
 * Rules baked in here — never override with raw hex or inline styles:
 *  - Colors come from @theme tokens in app/globals.css only.
 *  - Motion standard: crisp ease-out transitions ≤200ms (no springs/bounce).
 *    Directional hover moves only: −2px lift + shadow-lift, arrow slide.
 *  - Focus recipes: form fields use a focus-visible ring (2px sage + offset-1,
 *    border-sage); chrome (buttons, controls) uses the same 2px sage outline.
 *  - Form fields rest on shadow-field: whisper elevation + crisp 1px border,
 *    no drop shadow. Invalid fields come from `aria-invalid` (red border/ring).
 *  - Labels: two-tier — field labels are muted micro-caps (Label default);
 *    long document/consent scroller labels use <Label variant="doc">.
 *  - Radii: rounded-full for buttons/controls, rounded-2xl for cards, rounded-xl for modals.
 *  - Typography carries hierarchy; cards stay quiet (1px border or a solid tint).
 */

/* ─── Button ─────────────────────────────────────────────────────────── */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'dark' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer group/btn';

    // Directional hover lift shared by filled/outline variants (ghost stays flat).
    const lift = 'motion-safe:hover:-translate-y-0.5 hover:shadow-lift';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: `bg-sage text-white hover:bg-accent-ink ${lift}`,
      dark: `bg-pine text-white hover:bg-pine/90 ${lift}`,
      accent: `bg-lime-soft text-pine hover:bg-lime-soft/90 font-semibold ${lift}`,
      outline: `border border-mist bg-surface-raised text-pine hover:bg-surface-sunken hover:border-mint ${lift}`,
      ghost: 'text-pine hover:bg-surface-sunken',
      danger: `border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 ${lift}`,
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-3.5 py-1.5 text-xs',
      md: 'px-5 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

/* ─── Native checkbox / radio (no @tailwindcss/forms in this repo) ────── */

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 shrink-0 rounded border-mist cursor-pointer accent-sage focus-visible:outline-2 focus-visible:outline-sage ${className}`}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';

export const Radio = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      type="radio"
      className={`h-4 w-4 shrink-0 cursor-pointer accent-sage focus-visible:outline-2 focus-visible:outline-sage ${className}`}
      {...props}
    />
  )
);
Radio.displayName = 'Radio';

/* ─── Card / Label / Inputs ───────────────────────────────────────────── */

export function Card({
  className = '',
  tint,
  children,
}: {
  className?: string;
  /** Optional solid bento tint; replaces the default raised-white surface. */
  tint?: 'sage' | 'mint' | 'lime' | 'sand' | 'pine';
  children: React.ReactNode;
}) {
  const surface = tint
    ? {
        sage: 'bg-sage-tint border-transparent',
        mint: 'bg-mint-tint border-transparent',
        lime: 'bg-lime-tint border-transparent',
        sand: 'bg-sand-tint border-transparent',
        pine: 'bg-pine border-transparent',
      }[tint]
    : 'bg-surface-raised border-mist';
  return (
    <div className={`border rounded-2xl p-6 ${surface} ${className}`}>
      {children}
    </div>
  );
}

/* ─── CircleArrow (editorial affordance — expects a `group` parent) ───── */

export function CircleArrow({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-mint text-pine transition-colors duration-200 group-hover:border-sage group-hover:bg-surface-sunken ${className}`}
    >
      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
    </span>
  );
}

export function Label({
  className = '',
  children,
  htmlFor,
  variant = 'field',
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
  /**
   * 'field' — muted micro-caps for form field labels.
   * 'doc'   — sentence case for long document/consent scroller labels,
   *           where micro-caps would read noisy.
   */
  variant?: 'field' | 'doc';
}) {
  const styles =
    variant === 'doc'
      ? 'block text-sm font-medium text-pine mb-1.5'
      : 'block text-xs font-medium uppercase tracking-wider text-pine/60 mb-1.5';
  return (
    <label htmlFor={htmlFor} className={`${styles} ${className}`}>
      {children}
    </label>
  );
}

const fieldClass =
  'w-full rounded-lg border border-mist bg-surface-raised px-3.5 py-2 text-sm text-pine shadow-field placeholder:text-pine/45 transition-colors duration-150 focus:border-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sage disabled:bg-surface-sunken aria-invalid:border-red-400 aria-invalid:focus-visible:ring-red-200';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`${fieldClass} ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`${fieldClass} py-2.5 ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`${fieldClass} ${className}`}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

/* ─── Skeleton ────────────────────────────────────────────────────────── */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-surface-sunken rounded-lg ${className}`}
    />
  );
}

/* ─── SectionHeading ──────────────────────────────────────────────────── */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={align === 'center' ? `text-center mx-auto max-w-2xl ${className}` : className}>
      {eyebrow ? (
        <span className="inline-flex items-center rounded-full border border-mint px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent-ink">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-heading text-2xl sm:text-3xl font-medium text-pine mt-3">
        {title}
      </h2>
      {description ? (
        <p className="text-sm sm:text-base text-pine/60 leading-relaxed mt-2">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ─── EmptyState ──────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-surface-sunken border border-mist flex items-center justify-center">
        <Icon className="w-5 h-5 text-pine/70" aria-hidden="true" />
      </div>
      <p className="font-heading text-lg font-medium text-pine mt-4">{title}</p>
      {description ? (
        <p className="text-sm text-pine/60 leading-relaxed mt-1 max-w-sm">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ─── Modal (shared base: Escape, backdrop, focus trap + restore) ─────── */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const modalMaxWidth: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  maxWidth = 'md',
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Mount-on-open: remember focus, focus the panel, lock body scroll.
  // Runs ONLY on open/close transitions — NOT on every re-render of content
  // (dialogs may re-render per keystroke; re-running this would steal focus).
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Key handling: Escape closes; Tab cycles inside the dialog (focus trap).
  // Re-subscribing per render is intentional and cheap — it keeps `onClose`
  // fresh for stateful callers (e.g. dirty-check close confirmations).
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Simple focus trap: cycle Tab within the dialog.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      // Functional overlay backdrop (blur here is the allowed use case).
      className="fixed inset-0 z-50 overflow-y-auto bg-pine/50 backdrop-blur-sm p-4 sm:p-6 flex items-start sm:items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`w-full ${modalMaxWidth[maxWidth]} my-8 bg-surface-raised border border-mist rounded-xl shadow-lg animate-modal-in outline-none`}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div>
            <p id={titleId} className="font-heading text-base font-medium text-pine">
              {title}
            </p>
            {description ? (
              <p id={descriptionId} className="text-xs text-pine/60 leading-relaxed mt-1">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 -m-1.5 text-pine/50 hover:text-pine hover:bg-surface-sunken transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sage shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
        {footer ? (
          <div className="border-t border-mist px-6 py-4 flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── BookingStatusTag (single source of status labels — rule 6) ──────── */

export function BookingStatusTag({ status }: { status: BookingStatus }) {
  const config: Record<
    BookingStatus,
    { label: string; textClass: string; dotClass: string }
  > = {
    pending: {
      label: 'pending · awaiting psychologist pick-up',
      textClass: 'text-amber-900 font-semibold',
      dotClass: 'bg-amber-600',
    },
    proposed: {
      label: 'proposed · 3 slots ready for selection',
      textClass: 'text-pine font-semibold underline decoration-sage underline-offset-4',
      dotClass: 'bg-sage',
    },
    'paid-confirmed': {
      label: 'paid-confirmed · contact unlocked',
      textClass: 'text-pine font-semibold',
      dotClass: 'bg-sage',
    },
    'reschedule-requested': {
      label: 'reschedule-requested · under review',
      textClass: 'text-amber-800 font-semibold',
      dotClass: 'bg-amber-500',
    },
    cancelled: {
      label: 'cancelled · archived',
      textClass: 'text-red-800 font-medium',
      dotClass: 'bg-red-600',
    },
  };

  const item = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-2 text-xs ${item.textClass}`}>
      <span className={`w-2 h-2 rounded-full ${item.dotClass}`} aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}
