'use client';

/**
 * Honesty tag rendered on cards backed by the clearly-labeled demo seed
 * bookings in lib/api.ts (INITIAL_BOOKINGS entries flagged `demoSeed: true`).
 * UI-only: never sent to, or stored by, the backend (contract §2).
 */
export function DemoDataTag() {
  return (
    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-parchment border border-mist text-pine/65 shrink-0">
      Demo data
    </span>
  );
}
