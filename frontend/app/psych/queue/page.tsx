'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  proposalFormSchema,
  ProposalFormValues,
} from '../../../lib/schemas';
import { useAppStore } from '../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import {
  BookingStatusTag,
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from '../../../components/ui/primitives';

export default function PsychologistQueuePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    activePsychologistId,
    setActivePsychologistId,
    setCognitoRole,
    publishFlowEvent,
  } = useAppStore();

  const [selectedBookingForProposal, setSelectedBookingForProposal] = useState<
    string | null
  >('BK-2026-101');
  const [recentProposedId, setRecentProposedId] = useState<string | null>(null);

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const activePsych =
    roster.find((r) => r.id === activePsychologistId) || roster[0];
  const isVerified = activePsych?.verificationStatus === 'verified';

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'psychologist', activePsychologistId],
    queryFn: () => api.getBookingsForRole('psychologist', activePsychologistId),
  });

  const pendingQueue = bookings.filter((b) => b.status === 'pending');
  const targetBooking =
    pendingQueue.find((b) => b.id === selectedBookingForProposal) ||
    pendingQueue[0] ||
    null;

  // React Hook Form + Zod for Flow C Step 3: Price + Exactly 3 Date/Time Slots
  const proposalForm = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      pricePhp: 2500,
      slot1DateTime: '2026-10-06T10:00',
      slot2DateTime: '2026-10-07T14:00',
      slot3DateTime: '2026-10-08T16:30',
      clinicalPrepNote:
        'Please join from a quiet, private space 5 minutes before the scheduled start time. Informed consent and scope guardrails will be reviewed at the start.',
    },
  });

  const proposeMutation = useMutation({
    mutationFn: (values: ProposalFormValues) => {
      if (!targetBooking) throw new Error('Select a pending booking first.');
      return api.pickUpAndProposeSlots({
        bookingId: targetBooking.id,
        psychologistId: activePsychologistId,
        pricePhp: values.pricePhp,
        slot1DateTime: values.slot1DateTime,
        slot2DateTime: values.slot2DateTime,
        slot3DateTime: values.slot3DateTime,
        clinicalPrepNote: values.clinicalPrepNote,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', updated.id] });
      setRecentProposedId(updated.id);
      publishFlowEvent(
        'Flow C Step 3 Complete — 3 Slots & Fee Proposed',
        `${activePsych?.anonymizedTitle} picked up ${updated.id}, set fee to ₱${updated.pricePhp?.toLocaleString()}, and proposed 3 schedule slots. Client alerted.`
      );
    },
  });

  return (
    <div className="space-y-10">
      {/* Header & Verification Identity Switcher */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Flow C Step 2 &amp; 3 of 5</span>
            <span aria-hidden="true">·</span>
            <span>Psychologist Pending Queue &amp; 3-Slot Proposal Creator</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-[#25372D]">
            Client Intake Pending Queue
          </h1>
          <p className="text-sm text-[#25372D]/80 max-w-2xl">
            PRC-verified psychologists review incoming persona intakes, pick up matching cases, set
            the session fee, and propose <strong>3 distinct date/time slots</strong>.
          </p>
        </div>

        {/* Switch between Verified (#RP-01) and Unverified (#RP-04) to demonstrate guardrail */}
        <div className="bg-white border border-[#C0D3C3] rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[#25372D]">Test Practitioner State:</span>
          {roster.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActivePsychologistId(r.id)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activePsychologistId === r.id
                  ? 'bg-[#25372D] text-white'
                  : 'bg-[#F1F6F2] text-[#25372D] hover:bg-[#E2ECE4]'
              }`}
            >
              {r.id} ({r.verificationStatus === 'verified' ? 'Verified' : 'Unverified'})
            </button>
          ))}
        </div>
      </header>

      {/* Unverified Psychologist Blocked State (Required Empty/Error State) */}
      {!isVerified && (
        <div
          role="alert"
          className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 text-amber-950 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-bold text-amber-950">
              Waiting Credential Approval — Unverified Psychologists Cannot Pick Up Requests
            </h2>
            <span className="font-mono text-xs font-semibold text-amber-900">
              {activePsych?.prcCredentialCode} · STATUS: WAITING_APPROVAL
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed max-w-3xl">
            Flow C Guardrail Enforced: You are viewing as{' '}
            <strong>{activePsych?.anonymizedTitle}</strong>. Until an Administrator approves your
            PRC credentials in the Verification Queue, intake pick-up and 3-slot proposal creation
            are disabled.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="dark"
              size="sm"
              onClick={() => setActivePsychologistId('RP-01')}
            >
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
              Approve #RP-04 in Admin Verifications →
            </Button>
          </div>
        </div>
      )}

      {/* Proposal Sent Banner */}
      {recentProposedId && (
        <div className="bg-[#D0E187]/50 border-2 border-[#5D8B69] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#25372D]">
              FLOW C STEP 3 COMPLETE · PROPOSAL SENT TO CLIENT
            </p>
            <p className="text-sm text-[#25372D]/90">
              Booking <strong>{recentProposedId}</strong> is now in{' '}
              <strong className="font-semibold">proposed</strong> status with 3 schedule slots.
              Switch to the Client role to select 1 slot and test payment finalization.
            </p>
          </div>
          <Button
            variant="dark"
            size="md"
            onClick={() => {
              setCognitoRole('client');
              router.push(`/proposal/${recentProposedId}`);
            }}
          >
            Open Client Proposal Picker ({recentProposedId}) →
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Pending Queue Table */}
        <Card className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between border-b border-[#C0D3C3] pb-3">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                Pending Intake Queue ({pendingQueue.length})
              </h2>
              <p className="text-xs text-[#25372D]/70">
                Incoming client/dependent requests awaiting verified psychologist pick-up
              </p>
            </div>
            <span className="text-xs font-mono text-[#5D8B69] font-semibold">
              Active: {activePsych?.anonymizedTitle}
            </span>
          </div>

          {isLoading ? (
            <div className="h-48 rounded-lg bg-[#F6F9F6] animate-pulse" />
          ) : pendingQueue.length === 0 ? (
            <div className="p-8 text-center bg-[#F6F9F6] rounded-xl border border-dashed border-[#8FBE8F] space-y-3">
              <p className="font-heading text-xl font-bold text-[#25372D]">
                Pending Queue is Clear
              </p>
              <p className="text-xs text-[#25372D]/75 max-w-md mx-auto">
                All submitted intake requests have been picked up. You can submit a fresh intake in
                the Client Persona form or review your active proposals in My Schedules.
              </p>
              <div className="flex justify-center gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCognitoRole('client');
                    router.push('/personas');
                  }}
                >
                  + Submit New Client Intake
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/psych/schedule')}
                >
                  Go to My Schedules
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#C0D3C3] text-[#25372D]/70 bg-[#F6F9F6]">
                    <th className="py-3 px-3 font-semibold">Booking ID &amp; Persona</th>
                    <th className="py-3 px-3 font-semibold">Service &amp; Duration</th>
                    <th className="py-3 px-3 font-semibold">Intake Summary</th>
                    <th className="py-3 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C0D3C3]/60">
                  {pendingQueue.map((item) => {
                    const isSelected = targetBooking?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={isSelected ? 'bg-[#EBF2EC]/80' : 'hover:bg-[#F6F9F6]'}
                      >
                        <td className="py-3.5 px-3 align-top space-y-1">
                          <p className="font-mono font-bold text-[#25372D] tabular-nums">
                            {item.id}
                          </p>
                          <p className="text-[#5D8B69] font-semibold">
                            {item.personaType.toUpperCase()}
                          </p>
                          <p className="text-[#25372D]/70">{item.personaLabel}</p>
                        </td>
                        <td className="py-3.5 px-3 align-top space-y-1">
                          <p className="font-semibold text-[#25372D]">{item.serviceTitle}</p>
                          <p className="font-mono text-[#5D8B69] tabular-nums">
                            {item.serviceDuration}
                          </p>
                          <BookingStatusTag status={item.status} />
                        </td>
                        <td className="py-3.5 px-3 align-top max-w-xs space-y-1">
                          <p className="text-[#25372D]/85 line-clamp-3 leading-relaxed">
                            {item.concernsSummary}
                          </p>
                          <p className="text-[11px] text-[#25372D]/60">
                            Needs: {item.specificNeeds}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 align-top text-right">
                          <Button
                            variant={isSelected ? 'dark' : 'primary'}
                            size="sm"
                            disabled={!isVerified}
                            onClick={() => setSelectedBookingForProposal(item.id)}
                          >
                            {!isVerified
                              ? 'Locked (Unverified)'
                              : isSelected
                              ? 'Selected for Proposal'
                              : 'Pick Up Request'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right: Flow C Proposal Creator (Price + 3 Date/Time Pickers) */}
        <Card className="lg:col-span-5 space-y-5 border-2 border-[#5D8B69]">
          <div className="border-b border-[#C0D3C3] pb-3">
            <p className="text-xs font-semibold text-[#5D8B69]">
              Flow C Step 3 · Proposal Creator
            </p>
            <h2 className="font-heading text-2xl font-bold text-[#25372D]">
              {targetBooking
                ? `Propose 3 Slots for ${targetBooking.id}`
                : 'Select a Pending Request to Pick Up'}
            </h2>
            {targetBooking && (
              <p className="text-xs text-[#25372D]/75 mt-0.5">
                {targetBooking.serviceTitle} ({targetBooking.serviceDuration}) ·{' '}
                {targetBooking.personaLabel}
              </p>
            )}
          </div>

          {targetBooking ? (
            <form
              onSubmit={proposalForm.handleSubmit((vals) => proposeMutation.mutate(vals))}
              className="space-y-4"
            >
              <div className="p-3 rounded-lg bg-[#F1F6F2] border border-[#C0D3C3] text-xs space-y-1">
                <p className="font-semibold text-[#25372D]">
                  Service Scope Guardrail Reminder:
                </p>
                <p className="text-[#25372D]/80">{targetBooking.serviceGuardrail}</p>
              </div>

              <div>
                <Label htmlFor="prop-price">Proposed Session Fee (PHP · ₱)</Label>
                <Input
                  id="prop-price"
                  type="number"
                  step={100}
                  disabled={!isVerified}
                  className="font-mono tabular-nums"
                  {...proposalForm.register('pricePhp', { valueAsNumber: true })}
                />
                {proposalForm.formState.errors.pricePhp && (
                  <p className="text-xs text-red-700 mt-1">
                    {proposalForm.formState.errors.pricePhp.message}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-[#25372D]">
                  Propose Exactly 3 Distinct Date/Time Slots (PST)
                </p>

                <div>
                  <Label htmlFor="slot-1">Proposed Slot 1 (Date &amp; Start Time)</Label>
                  <Input
                    id="slot-1"
                    type="datetime-local"
                    disabled={!isVerified}
                    className="font-mono tabular-nums"
                    {...proposalForm.register('slot1DateTime')}
                  />
                  {proposalForm.formState.errors.slot1DateTime && (
                    <p className="text-xs text-red-700 mt-1">
                      {proposalForm.formState.errors.slot1DateTime.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="slot-2">Proposed Slot 2 (Date &amp; Start Time)</Label>
                  <Input
                    id="slot-2"
                    type="datetime-local"
                    disabled={!isVerified}
                    className="font-mono tabular-nums"
                    {...proposalForm.register('slot2DateTime')}
                  />
                  {proposalForm.formState.errors.slot2DateTime && (
                    <p className="text-xs text-red-700 mt-1">
                      {proposalForm.formState.errors.slot2DateTime.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="slot-3">Proposed Slot 3 (Date &amp; Start Time)</Label>
                  <Input
                    id="slot-3"
                    type="datetime-local"
                    disabled={!isVerified}
                    className="font-mono tabular-nums"
                    {...proposalForm.register('slot3DateTime')}
                  />
                  {proposalForm.formState.errors.slot3DateTime && (
                    <p className="text-xs text-red-700 mt-1">
                      {proposalForm.formState.errors.slot3DateTime.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="prop-note">Clinical Preparation Note for Client</Label>
                <Textarea
                  id="prop-note"
                  rows={3}
                  disabled={!isVerified}
                  {...proposalForm.register('clinicalPrepNote')}
                />
                {proposalForm.formState.errors.clinicalPrepNote && (
                  <p className="text-xs text-red-700 mt-1">
                    {proposalForm.formState.errors.clinicalPrepNote.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!isVerified || proposeMutation.isPending}
              >
                {!isVerified
                  ? 'Pick-Up Locked — Verification Required'
                  : proposeMutation.isPending
                  ? 'Publishing 3-Slot Proposal...'
                  : `Pick Up ${targetBooking.id} & Send 3-Slot Proposal`}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-[#25372D]/70 py-6 text-center">
              No pending intake request selected.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
