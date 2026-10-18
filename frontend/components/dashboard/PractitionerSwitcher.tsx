'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

/**
 * Shared RP-01/RP-04 simulator switcher for the psychologist dashboard pages
 * (was duplicated x3 with divergent leading labels). Reads the admin roster
 * and swaps the active resident — including the unverified state.
 */
export function PractitionerSwitcher() {
  const { activePsychologistId, setActivePsychologistId } = useAppStore();

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  return (
    <div className="bg-surface-raised border border-mist rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-pine">Practitioner:</span>
      {roster.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => setActivePsychologistId(r.id)}
          className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2 ${
            activePsychologistId === r.id
              ? 'bg-pine text-white'
              : 'bg-surface-sunken text-pine hover:bg-mint/25'
          }`}
        >
          {r.id} ({r.verificationStatus === 'verified' ? 'Verified' : 'Unverified'})
        </button>
      ))}
    </div>
  );
}
