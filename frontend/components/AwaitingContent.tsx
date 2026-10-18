'use client';

import { Info } from 'lucide-react';

/**
 * Quiet "awaiting copy" panel for CMS-driven public sections (Vision, Mission,
 * Clinic Overview, Impact). Shown instead of hiding the section when the Admin
 * CMS block is empty, so pages stay honest about copy the backend has not
 * delivered yet (GET/PATCH /api/v1/cms are contract build-order endpoints).
 */
export function AwaitingContent({ label }: { label?: string }) {
  return (
    <div className="p-4 rounded-lg bg-parchment border border-dashed border-mint/50 flex items-start gap-3 text-left">
      <Info className="w-4 h-4 text-pine/50 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-pine/75">
          {label ? `${label}: awaiting clinic copy` : 'Awaiting clinic copy'}
        </p>
        <p className="text-xs text-pine/60 leading-relaxed">
          Editable in Admin CMS — syncs via PATCH /api/v1/cms when the backend endpoint lands.
        </p>
      </div>
    </div>
  );
}
