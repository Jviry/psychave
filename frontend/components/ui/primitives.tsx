'use client';

import React from 'react';
import { BookingStatus } from '../../lib/types';

/**
 * Shadcn-style Button primitive tailored to PsychAvenuePH palette:
 * #25372D (primary dark), #5D8B69 (primary), #8FBE8F / #C0D3C3 (soft surfaces), #D0E187 (accent)
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'dark' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D8B69] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'bg-[#5D8B69] text-white hover:bg-[#4c7557]',
      dark: 'bg-[#25372D] text-white hover:bg-[#1b2921]',
      accent: 'bg-[#D0E187] text-[#25372D] hover:bg-[#c3d673] font-semibold',
      outline:
        'border border-[#C0D3C3] bg-white text-[#25372D] hover:bg-[#F1F6F2] hover:border-[#8FBE8F]',
      ghost: 'text-[#25372D] hover:bg-[#E8F0EA]',
      danger: 'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
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

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white border border-[#C0D3C3]/80 rounded-xl p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({
  className = '',
  children,
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-semibold text-[#25372D] mb-1.5 ${className}`}
    >
      {children}
    </label>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full rounded-lg border border-[#C0D3C3] bg-white px-3.5 py-2 text-sm text-[#25372D] placeholder:text-[#25372D]/45 focus:border-[#5D8B69] focus:outline-none focus:ring-2 focus:ring-[#8FBE8F]/40 disabled:bg-[#F6F9F6] ${className}`}
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
    className={`w-full rounded-lg border border-[#C0D3C3] bg-white px-3.5 py-2.5 text-sm text-[#25372D] placeholder:text-[#25372D]/45 focus:border-[#5D8B69] focus:outline-none focus:ring-2 focus:ring-[#8FBE8F]/40 disabled:bg-[#F6F9F6] ${className}`}
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
    className={`w-full rounded-lg border border-[#C0D3C3] bg-white px-3.5 py-2 text-sm text-[#25372D] focus:border-[#5D8B69] focus:outline-none focus:ring-2 focus:ring-[#8FBE8F]/40 ${className}`}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

/**
 * Accessible Flow C Status Indicator (pairs semantic label + icon + high-contrast text)
 * Statuses: pending / proposed / paid-confirmed (+ reschedule-requested / cancelled)
 */
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
      textClass: 'text-[#25372D] font-semibold underline decoration-[#5D8B69] underline-offset-4',
      dotClass: 'bg-[#5D8B69]',
    },
    'paid-confirmed': {
      label: 'paid-confirmed · contact unlocked',
      textClass: 'text-[#25372D] font-semibold',
      dotClass: 'bg-[#5D8B69]',
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
