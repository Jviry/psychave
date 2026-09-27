'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../stores/useAppStore';
import {
  BookingStatusTag,
  Button,
  Card,
} from '../../../components/ui/primitives';

export default function AdminVerificationsPage() {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const { data: adminBookings = [] } = useQuery({
    queryKey: ['bookings', 'admin'],
    queryFn: () => api.getBookingsForRole('admin'),
  });

  const verificationMutation = useMutation({
    mutationFn: (payload: {
      psychId: string;
      verificationStatus?: 'verified' | 'waiting_approval';
      visibleOnPublicRoster?: boolean;
    }) =>
      api.updatePsychologistVerification(payload.psychId, {
        ...(payload.verificationStatus !== undefined
          ? { verificationStatus: payload.verificationStatus }
          : {}),
        ...(payload.visibleOnPublicRoster !== undefined
          ? { visibleOnPublicRoster: payload.visibleOnPublicRoster }
          : {}),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      publishFlowEvent(
        'Admin Credential & Roster Updated',
        `Updated verification/roster visibility for practitioner #${vars.psychId}.`
      );
    },
  });

  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="space-y-2 border-b border-[#C0D3C3] pb-6">
        <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
          <span>Admin Role Dashboard</span>
          <span aria-hidden="true">·</span>
          <span>Credential Verification Queue &amp; Tiered Privacy Enforcement</span>
        </div>
        <h1 className="font-heading text-4xl font-bold text-[#25372D]">
          Psychologist Credential Verifications &amp; Roster Control
        </h1>
        <p className="text-sm text-[#25372D]/80 max-w-3xl">
          Approve PRC credentials so psychologists can pick up Flow C intake requests, toggle
          anonymized public roster visibility on <code>/about</code>, and audit preliminary queue
          statuses without access to private clinical session notes.
        </p>
      </header>

      {/* Section 1: Credential Verification Queue */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-[#25372D]">
              1. Resident Psychologist Credential Verification Queue
            </h2>
            <p className="text-xs text-[#25372D]/70">
              Only verified psychologists can pick up pending requests in Flow C Step 3.
            </p>
          </div>
          <span className="text-xs font-mono text-[#5D8B69] font-semibold tabular-nums">
            {roster.filter((r) => r.verificationStatus === 'verified').length} / {roster.length}{' '}
            Verified
          </span>
        </div>

        {rosterLoading ? (
          <div className="h-44 rounded-lg bg-[#F6F9F6] animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#C0D3C3] text-[#25372D]/70 bg-[#F6F9F6]">
                  <th className="py-3 px-4 font-semibold">Anonymized ID &amp; PRC License</th>
                  <th className="py-3 px-4 font-semibold">Clinical Specialization</th>
                  <th className="py-3 px-4 font-semibold">Verification State</th>
                  <th className="py-3 px-4 font-semibold">Public Roster (/about)</th>
                  <th className="py-3 px-4 font-semibold text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C0D3C3]/60">
                {roster.map((psych) => {
                  const isVerified = psych.verificationStatus === 'verified';
                  return (
                    <tr key={psych.id} className="hover:bg-[#F6F9F6]">
                      <td className="py-3.5 px-4 align-top space-y-1">
                        <p className="font-heading text-base font-bold text-[#25372D]">
                          {psych.anonymizedTitle}
                        </p>
                        <p className="font-mono text-[#5D8B69] tabular-nums">
                          {psych.prcCredentialCode}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-xs space-y-1">
                        <p className="text-[#25372D]/85 leading-relaxed">
                          {psych.specialization}
                        </p>
                        <p className="text-[11px] text-[#25372D]/60">
                          {psych.yearsPractice} · {psych.languages.join(', ')}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        {isVerified ? (
                          <span className="font-semibold text-[#25372D]">
                            Verified · Can Pick Up Queue
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-800">
                            Waiting Approval · Queue Locked
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <span className="text-[#25372D]/80">
                          {psych.visibleOnPublicRoster ? 'Visible on /about' : 'Hidden from /about'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Button
                            variant={isVerified ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() =>
                              verificationMutation.mutate({
                                psychId: psych.id,
                                verificationStatus: isVerified
                                  ? 'waiting_approval'
                                  : 'verified',
                              })
                            }
                          >
                            {isVerified ? 'Set Unverified' : 'Approve Credentials'}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              verificationMutation.mutate({
                                psychId: psych.id,
                                visibleOnPublicRoster: !psych.visibleOnPublicRoster,
                              })
                            }
                          >
                            {psych.visibleOnPublicRoster ? 'Hide Roster' : 'Show Roster'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section 2: Admin Preliminary Intake View (With Strict Redaction of Session Notes) */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#C0D3C3] pb-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-[#25372D]">
              2. Preliminary Intake Queue Audit (No Session Notes Visible)
            </h2>
            <p className="text-xs text-[#25372D]/70">
              Tiered Cognito Access Guardrail: Admins inspect operational queue progress only;
              private psychologist clinical notes are stripped at the API client boundary.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5D8B69]">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Session Notes Redacted</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#C0D3C3] text-[#25372D]/70 bg-[#F6F9F6]">
                <th className="py-3 px-4 font-semibold">Booking ID</th>
                <th className="py-3 px-4 font-semibold">Persona &amp; Service</th>
                <th className="py-3 px-4 font-semibold">Flow C Status</th>
                <th className="py-3 px-4 font-semibold">Assigned Practitioner</th>
                <th className="py-3 px-4 font-semibold">Private Clinical Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C0D3C3]/60">
              {adminBookings.map((b) => (
                <tr key={b.id} className="hover:bg-[#F6F9F6]">
                  <td className="py-3 px-4 font-mono font-bold text-[#25372D] tabular-nums">
                    {b.id}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#25372D]">{b.serviceTitle}</p>
                    <p className="text-[#25372D]/70">
                      {b.personaLabel} ({b.serviceDuration})
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <BookingStatusTag status={b.status} />
                  </td>
                  <td className="py-3 px-4 text-[#25372D]/80">
                    {b.psychologistCode || 'Unassigned (In Pending Queue)'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] text-[#25372D]/60">
                      [REDACTED · PSYCHOLOGIST-ONLY ACCESS]
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
