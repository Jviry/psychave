'use client';

import { Info } from 'lucide-react';

/**
 * Quiet "awaiting copy" notice for CMS-driven public sections (Vision, Mission,
 * Clinic Overview, Impact). Renders as plain text inside its parent card —
 * no nested background panel (in-card band rule) — and supports a dark tone
 * for deep-pine surfaces. Shown instead of hiding the section when the Admin
 * CMS block is empty, so pages stay honest about copy the backend has not
 * delivered yet (GET/PATCH /api/v1/cms are contract build-order endpoints).
 */
export function AwaitingContent({
  label,
  tone = 'light',
}: {
  label?: string;
  /** 'dark' for deep-pine surfaces. */
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <div className="flex items-start gap-2.5 text-left">
      <Info
        className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-lime-soft/80' : 'text-pine/50'}`}
        aria-hidden="true"
      />
      <div className="space-y-0.5">
        <p
          className={`text-xs font-semibold ${dark ? 'text-white/80' : 'text-pine/75'}`}
        >
          {label ? `${label}: awaiting clinic copy` : 'Awaiting clinic copy'}
        </p>
        <p
          className={`text-xs leading-relaxed ${dark ? 'text-white/60' : 'text-pine/60'}`}
        >
          Editable in Admin CMS — syncs via PATCH /api/v1/cms when the backend endpoint lands.
        </p>
      </div>
    </div>
  );
}
