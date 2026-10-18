'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
  proposalFormSchema,
  ProposalFormValues,
} from '../../../../lib/schemas';
import { useAppStore } from '../../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import { Lock, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PractitionerSwitcher } from '../../../../components/dashboard/PractitionerSwitcher';
import { UnverifiedBanner } from '../../../../components/dashboard/UnverifiedBanner';
import {
  BookingStatusTag,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
  Textarea,
} from '../../../../components/ui/primitives';

export default function PsychologistQueuePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    activePsychologistId,
    setCognitoRole,
    publishFlowEvent,
  } = useAppStore();

  const [activeModalBookingId, setActiveModalBookingId] = useState<string | null>(null);
  const [recentProposedId, setRecentProposedId] = useState<string | null>(null);

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const activePsych =
    roster.find((r) => r.id === activePsychologistId) || roster[0];
  const isVerified = activePsych?.verificationStatus === 'verified';

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ['bookings', 'psychologist', activePsychologistId],
    queryFn: () => api.getBookingsForRole('psychologist', activePsychologistId),
  });

  const pendingQueue = bookings.filter((b) => b.status === 'pending');
  const targetBooking = pendingQueue.find((b) => b.id === activeModalBookingId) || null;

  // Format datetime for datetime-local input strictly in Philippine Standard Time (Asia/Manila)
  const formatForManilaInput = (d: Date) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hour = getPart('hour');
    if (hour === '24') hour = '00';
    const minute = getPart('minute');
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  const serializeManilaIso = (val: string) => {
    if (!val) return val;
    const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(val);
    if (hasTimezone) return val;
    return val.length === 16 ? `${val}:00+08:00` : `${val}+08:00`;
  };

  // Generate dynamic future default slots in Asia/Manila
  const defaultSlots = useMemo(() => {
    const now = new Date();
    const d1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const d2 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const d3 = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    return {
      slot1: formatForManilaInput(d1),
      slot2: formatForManilaInput(d2),
      slot3: formatForManilaInput(d3),
    };
  }, []);

  const minDateTime = useMemo(() => {
    return formatForManilaInput(new Date());
  }, []);

  // React Hook Form with Zod validation
  const proposalForm = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      pricePhp: 2500,
      slot1DateTime: defaultSlots.slot1,
      slot2DateTime: defaultSlots.slot2,
      slot3DateTime: defaultSlots.slot3,
      clinicalPrepNote:
        'Please join from a quiet, private space 5 minutes before our scheduled start. Informed consent and scope guardrails will be reviewed at the start.',
    },
  });

  const proposeMutation = useMutation({
    mutationFn: (values: ProposalFormValues) => {
      if (!targetBooking) throw new Error('No pending booking selected for proposal.');
      return api.pickUpAndProposeSlots({
        bookingId: targetBooking.id,
        psychologistId: activePsychologistId,
        pricePhp: values.pricePhp,
        slot1DateTime: serializeManilaIso(values.slot1DateTime),
        slot2DateTime: serializeManilaIso(values.slot2DateTime),
        slot3DateTime: serializeManilaIso(values.slot3DateTime),
        clinicalPrepNote: values.clinicalPrepNote,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', updated.id] });
      setRecentProposedId(updated.id);
      setActiveModalBookingId(null);
      publishFlowEvent(
        'Flow C Step 3 Complete — 3 Slots & Fee Proposed',
        `${activePsych?.anonymizedTitle} picked up ${updated.id}, set fee to ₱${updated.pricePhp?.toLocaleString()}, and proposed 3 schedule slots. Client alerted.`
      );
    },
  });

  const handleOpenPickupModal = (bookingId: string) => {
    if (!isVerified) return;
    setActiveModalBookingId(bookingId);
    proposeMutation.reset();
    proposalForm.reset({
      pricePhp: 2500,
      slot1DateTime: defaultSlots.slot1,
      slot2DateTime: defaultSlots.slot2,
      slot3DateTime: defaultSlots.slot3,
      clinicalPrepNote:
        'Please join from a quiet, private space 5 minutes before our scheduled start. Informed consent and scope guardrails will be reviewed at the start.',
    });
  };

  const handleCloseModal = () => {
    setActiveModalBookingId(null);
    proposeMutation.reset();
  };

  return (
    <div className="space-y-8">
      {/* Header & Verification Identity Switcher */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Psychologist Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Pending Requests Queue</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-pine">
            Pending Booking Requests
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Review incoming persona bookings, evaluate clinical fit, and claim requests by proposing{' '}
            <strong>session fee and 3 distinct schedule slots</strong>.
          </p>
        </div>

        {/* Practitioner State Switcher for Prototype Evaluation */}
        <PractitionerSwitcher />
      </header>

      {/* Non-Approved Psychologist Blocked Banner (Defense-in-depth) */}
      {!isVerified && (
        <UnverifiedBanner
          title="Pending Administrative Approval — Pick-Up Actions Disabled"
          note={`${activePsych?.prcCredentialCode} · STATUS: WAITING_APPROVAL`}
          body={
            <>
              You are logged in as <strong>{activePsych?.anonymizedTitle}</strong>. In accordance with
              clinical governance standards, psychologists cannot pick up client booking requests or propose
              session slots until their PRC license credentials are authenticated and approved by clinic administrators.
            </>
          }
        />
      )}

      {/* Success Notification if proposal was just submitted */}
      {recentProposedId && (
        <div className="bg-lime-soft/30 border border-sage/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sage text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-pine">
                Proposal Successfully Dispatched for {recentProposedId}
              </p>
              <p className="text-xs text-pine/80">
                The booking has transitioned to <strong>proposed</strong>. Client has been notified to select 1 slot and submit payment.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="dark"
              size="sm"
              onClick={() => router.push('/psych/schedule')}
            >
              View in My Schedule
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRecentProposedId(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Pending Requests List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl font-bold text-pine">
              Open Booking Queue
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sage/15 text-pine">
              {pendingQueue.length} {pendingQueue.length === 1 ? 'request' : 'requests'} pending
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            Refresh Queue
          </Button>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : pendingQueue.length === 0 ? (
          /* Empty State */
          <EmptyState
            icon={CheckCircle2}
            title="Pending Queue is All Clear"
            description="All submitted client booking requests have been claimed and scheduled. Switch to the Client role to submit a new booking form or manage confirmed appointments in My Schedule."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCognitoRole('client');
                    router.push('/personas');
                  }}
                >
                  Submit Test Booking (Client Role)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/psych/schedule')}
                >
                  Go to My Schedule
                </Button>
              </div>
            }
          />
        ) : (
          /* Pending Requests Cards */
          <div className="grid grid-cols-1 gap-5">
            {pendingQueue.map((item) => (
              <Card
                key={item.id}
                className="hover:border-sage transition-colors p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-mist/70 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-pine">
                        {item.id}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-sm font-semibold bg-surface-sunken text-accent-ink">
                        {item.personaType.toUpperCase()}
                      </span>
                      <BookingStatusTag status={item.status} />
                    </div>
                    <h3 className="font-heading text-xl font-bold text-pine">
                      {item.serviceTitle}
                    </h3>
                  </div>

                  {/* Pick Up Action Button: Hidden or disabled when unverified */}
                  <div>
                    {isVerified ? (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleOpenPickupModal(item.id)}
                      >
                        Pick Up &amp; Propose 3 Slots
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-sunken text-pine/50 border border-mist">
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                        Pick-Up Locked (Approval Pending)
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                  {/* Persona Info */}
                  <div className="p-3.5 rounded-lg bg-parchment border border-mist/60 space-y-1.5">
                    <p className="font-semibold text-accent-ink uppercase tracking-wide text-xs">
                      Client &amp; Persona Information
                    </p>
                    <p className="font-bold text-pine text-sm">{item.personaLabel}</p>
                    <p className="text-pine/75">
                      Language: <span className="font-medium text-pine">{item.preferredLanguage}</span>
                    </p>
                    <p className="text-xs text-pine/60 pt-1">
                      Submitted: {item.submittedAt}
                    </p>
                  </div>

                  {/* Service & Guardrail */}
                  <div className="p-3.5 rounded-lg bg-parchment border border-mist/60 space-y-1.5">
                    <p className="font-semibold text-accent-ink uppercase tracking-wide text-xs">
                      Service Duration &amp; Clinical Scope
                    </p>
                    <p className="font-semibold text-pine">
                      Duration: <span className="font-mono text-accent-ink font-bold">{item.serviceDuration}</span>
                    </p>
                    <p className="text-pine/80 leading-relaxed text-xs">
                      {item.serviceGuardrail}
                    </p>
                  </div>

                  {/* Booking Notes */}
                  <div className="p-3.5 rounded-lg bg-parchment border border-mist/60 space-y-1.5">
                    <p className="font-semibold text-accent-ink uppercase tracking-wide text-xs">
                      Presenting Concerns &amp; Needs
                    </p>
                    <p className="text-pine/90 line-clamp-3 leading-relaxed">
                      {item.concernsSummary}
                    </p>
                    {item.specificNeeds && (
                      <p className="text-xs text-pine/70 italic pt-1">
                        Specifics: {item.specificNeeds}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pick-Up Proposal Modal — shared base (Escape close, backdrop click, focus trap) */}
      {targetBooking && (
        <Modal
          open
          onClose={handleCloseModal}
          title={`Pick Up Booking #${targetBooking.id}`}
          description={`${targetBooking.serviceTitle} (${targetBooking.serviceDuration}) · ${targetBooking.personaLabel}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
              Flow C Step 3 · Claim &amp; Propose Slots
            </p>
            {/* Race Condition / Error Banner */}
            {proposeMutation.isError && (
              <div
                role="alert"
                className="bg-red-50 border-l-2 border-red-400 rounded-r-lg p-4 text-red-950 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                  <p className="font-heading text-base font-bold text-red-950">
                    Failed to Claim Request (Race Condition Detected)
                  </p>
                </div>
                <p className="text-xs text-red-900 leading-relaxed">
                  {proposeMutation.error?.message ||
                    'This request may have already been claimed by another psychologist. Please refresh the queue.'}
                </p>
                <div className="pt-1 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['bookings'] });
                      handleCloseModal();
                    }}
                  >
                    Refresh Queue &amp; Close
                  </Button>
                </div>
              </div>
            )}

            {/* Scope Guardrail Reminder */}
            <p className="text-xs text-pine/85 leading-relaxed">
              <span className="font-semibold text-pine">Clinical Scope Guardrail:</span>{' '}
              {targetBooking.serviceGuardrail}
            </p>

            {/* Proposal Form */}
            <form
              onSubmit={proposalForm.handleSubmit((values) => proposeMutation.mutate(values))}
              className="space-y-5"
            >
              {/* Fee Input */}
              <div>
                <Label htmlFor="pickup-price">
                  Proposed Session Fee (PHP · ₱) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="pickup-price"
                  type="number"
                  step={100}
                  className="font-mono tabular-nums text-base"
                  placeholder="2500"
                  {...proposalForm.register('pricePhp', { valueAsNumber: true })}
                />
                {proposalForm.formState.errors.pricePhp && (
                  <p className="text-xs text-red-700 mt-1 font-medium">
                    {proposalForm.formState.errors.pricePhp.message}
                  </p>
                )}
              </div>

              {/* Exactly 3 Slots Required with no past dates */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-pine uppercase tracking-wide">
                    Propose Exactly 3 Schedule Slots (PST) <span className="text-red-600">*</span>
                  </p>
                  <span className="text-xs text-accent-ink font-medium">
                    Must be distinct &amp; in the future
                  </span>
                </div>

                {/* Slot 1 */}
                <div>
                  <Label htmlFor="modal-slot-1">Slot 1 (Date &amp; Time)</Label>
                  <Input
                    id="modal-slot-1"
                    type="datetime-local"
                    min={minDateTime}
                    className="font-mono tabular-nums"
                    {...proposalForm.register('slot1DateTime')}
                  />
                  {proposalForm.formState.errors.slot1DateTime && (
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      {proposalForm.formState.errors.slot1DateTime.message}
                    </p>
                  )}
                </div>

                {/* Slot 2 */}
                <div>
                  <Label htmlFor="modal-slot-2">Slot 2 (Date &amp; Time)</Label>
                  <Input
                    id="modal-slot-2"
                    type="datetime-local"
                    min={minDateTime}
                    className="font-mono tabular-nums"
                    {...proposalForm.register('slot2DateTime')}
                  />
                  {proposalForm.formState.errors.slot2DateTime && (
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      {proposalForm.formState.errors.slot2DateTime.message}
                    </p>
                  )}
                </div>

                {/* Slot 3 */}
                <div>
                  <Label htmlFor="modal-slot-3">Slot 3 (Date &amp; Time)</Label>
                  <Input
                    id="modal-slot-3"
                    type="datetime-local"
                    min={minDateTime}
                    className="font-mono tabular-nums"
                    {...proposalForm.register('slot3DateTime')}
                  />
                  {proposalForm.formState.errors.slot3DateTime && (
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      {proposalForm.formState.errors.slot3DateTime.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Prep note */}
              <div>
                <Label htmlFor="modal-prep-note">
                  Clinical Preparation Note for Client <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="modal-prep-note"
                  rows={3}
                  placeholder="Instructions for the client prior to joining session..."
                  {...proposalForm.register('clinicalPrepNote')}
                />
                {proposalForm.formState.errors.clinicalPrepNote && (
                  <p className="text-xs text-red-700 mt-1 font-medium">
                    {proposalForm.formState.errors.clinicalPrepNote.message}
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-3 border-t border-mist">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleCloseModal}
                  disabled={proposeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={proposeMutation.isPending}
                >
                  {proposeMutation.isPending
                    ? 'Submitting Proposal...'
                    : 'Confirm Pick-Up & Send 3 Slots'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
