'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/primitives';

/**
 * Blocked-state alert shown while the active resident psychologist is NOT yet
 * PRC-verified (was duplicated x3 with divergent copy). Structure and actions
 * are shared — pages pass their own title / note chip / body copy. Renders
 * nothing once the active resident is verified.
 */
export function UnverifiedBanner({
  title,
  note,
  body,
}: {
  title: string;
  note: string;
  body: React.ReactNode;
}) {
  const router = useRouter();
  const { activePsychologistId, setActivePsychologistId, setCognitoRole } = useAppStore();

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const activePsych = roster.find((r) => r.id === activePsychologistId) || roster[0];

  if (activePsych?.verificationStatus === 'verified') return null;

  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-300 rounded-lg p-6 text-amber-950 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TriangleAlert className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
          <h2 className="font-heading text-xl font-medium text-amber-950">{title}</h2>
        </div>
        <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-amber-200/70 text-amber-900 rounded-md">
          {note}
        </span>
      </div>
      <p className="text-xs text-amber-900/90 leading-relaxed max-w-3xl">{body}</p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button variant="dark" size="sm" onClick={() => setActivePsychologistId('RP-01')}>
          Switch to Verified Resident #RP-01
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCognitoRole('admin');
            router.push('/admin/verifications');
          }}
        >
          Approve in Admin Portal
        </Button>
      </div>
    </div>
  );
}
