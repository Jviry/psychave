'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  bookingFormSchema,
  BookingFormValues,
  personaSchema,
  PersonaFormValues,
} from '../../lib/schemas';
import { useAppStore } from '../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import { usePersonaWizardStore } from '../../stores/usePersonaWizardStore';
import { PersonaWizardModal } from '../../components/PersonaWizardModal';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from '../../components/ui/primitives';

export default function PersonasAndBookingPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    cognitoRole,
    setCognitoRole,
    bookingDraft,
    updateBookingDraft,
    resetBookingDraft,
    publishFlowEvent,
  } = useAppStore();
  const openWizard = usePersonaWizardStore((s) => s.openWizard);
  const wizardOpen = usePersonaWizardStore((s) => s.isOpen);
  const lastUsedPersonaId = usePersonaWizardStore((s) => s.lastUsedPersonaId);
  const setLastUsedPersonaId = usePersonaWizardStore((s) => s.setLastUsedPersonaId);

  const [showLegacyPersonaForm, setShowLegacyPersonaForm] = useState(false);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const autoOpenedWizard = useRef(false);

  const { data: personas = [], isLoading: personasLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.getPersonas(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  // React Hook Form for creating a new Persona (Self / Dependent)
  const personaForm = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      type: 'dependent',
      label: '',
      ageGroup: 'Adolescent (13–17)',
      relationshipToClient: 'Parent / Legal Guardian',
      preferredLanguage: 'English / Taglish',
    },
  });

  // React Hook Form for Flow C Step 1 Booking Form
  const bookingForm = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      personaId: bookingDraft.personaId || 'persona-self-01',
      serviceId: bookingDraft.serviceId || 'srv-individual',
      preferredLanguage: bookingDraft.preferredLanguage || 'English / Taglish',
      concernsSummary: bookingDraft.concernsSummary || '',
      specificNeeds: bookingDraft.specificNeeds || '',
      guardrailAcknowledged: false,
    },
  });

  // Keep form synced if user pre-selected a service from /services
  useEffect(() => {
    if (bookingDraft.serviceId) {
      bookingForm.setValue('serviceId', bookingDraft.serviceId);
    }
    if (bookingDraft.personaId) {
      bookingForm.setValue('personaId', bookingDraft.personaId);
    }
  }, [bookingDraft.serviceId, bookingDraft.personaId, bookingForm]);

  // Booking-flow persona step: no personas -> launch wizard once data loads.
  useEffect(() => {
    if (!personasLoading && personas.length === 0 && !autoOpenedWizard.current && !wizardOpen) {
      autoOpenedWizard.current = true;
      openWizard('manage');
    }
  }, [personasLoading, personas.length, wizardOpen, openWizard]);

  const selectedServiceId = bookingForm.watch('serviceId');
  const selectedPersonaId = bookingForm.watch('personaId');
  const activeService = services.find((s) => s.id === selectedServiceId) || services[0];
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId) || null;

  const selectPersona = (personaId: string, preferredLanguage?: string) => {
    bookingForm.setValue('personaId', personaId, { shouldValidate: true });
    if (preferredLanguage) bookingForm.setValue('preferredLanguage', preferredLanguage);
    updateBookingDraft({ personaId, ...(preferredLanguage ? { preferredLanguage } : {}) });
    setLastUsedPersonaId(personaId);
  };

  const createPersonaMutation = useMutation({
    mutationFn: (values: PersonaFormValues) => api.createPersona(values),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      updateBookingDraft({ personaId: created.id, preferredLanguage: created.preferredLanguage });
      bookingForm.setValue('personaId', created.id);
      bookingForm.setValue('preferredLanguage', created.preferredLanguage);
      setLastUsedPersonaId(created.id);
      personaForm.reset();
      setShowLegacyPersonaForm(false);
      publishFlowEvent(
        'Client Persona Created',
        `Added ${created.label} (${created.type.toUpperCase()}) and selected it for Flow C booking.`
      );
    },
  });

  const submitBookingMutation = useMutation({
    mutationFn: (values: BookingFormValues) =>
      api.submitBookingRequest({
        personaId: values.personaId,
        serviceId: values.serviceId,
        preferredLanguage: values.preferredLanguage,
        concernsSummary: values.concernsSummary,
        specificNeeds: values.specificNeeds,
      }),
    onSuccess: (createdBooking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      resetBookingDraft();
      bookingForm.reset({
        personaId: createdBooking.personaId,
        serviceId: createdBooking.serviceId,
        preferredLanguage: createdBooking.preferredLanguage,
        concernsSummary: '',
        specificNeeds: '',
        guardrailAcknowledged: false,
      });
      setSubmittedBookingId(createdBooking.id);
      publishFlowEvent(
        'Flow C Step 1 Complete — Booking Submitted',
        `Request ${createdBooking.id} (${createdBooking.serviceTitle}) entered the Pending Queue. Verified psychologists notified.`
      );
    },
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C0D3C3] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
            <span>Flow C Step 1 of 5</span>
            <span aria-hidden="true">·</span>
            <span>Client Persona &amp; Clinical Booking</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-[#25372D]">
            Client Personas &amp; Clinical Booking Form
          </h1>
          <p className="text-sm text-[#25372D]/80 max-w-2xl">
            Create a persona with signed consent through the 4-step wizard, pick who the booking is
            for, then submit booking to the verified psychologist queue.
          </p>
        </div>

        {cognitoRole !== 'client' && (
          <div className="bg-[#D0E187]/45 border border-[#8FBE8F] px-4 py-2.5 rounded-lg text-xs text-[#25372D] flex items-center gap-3">
            <span>Currently viewing as {cognitoRole.toUpperCase()}.</span>
            <Button
              variant="dark"
              size="sm"
              onClick={() => setCognitoRole('client')}
            >
              Switch to Client Role
            </Button>
          </div>
        )}
      </header>

      {/* Submission Confirmation Banner (Flow C Step 1 -> Step 2 transition) */}
      {submittedBookingId && (
        <div className="bg-[#EBF2EC] border-2 border-[#5D8B69] rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#5D8B69]">
                FLOW C STEP 1 SUBMITTED · STATUS: PENDING
              </p>
              <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                Booking Request #{submittedBookingId} Entered Pending Queue
              </h2>
              <p className="text-sm text-[#25372D]/80">
                PRC-verified psychologists have been notified. Your booking will move to{' '}
                <strong className="font-semibold">proposed</strong> once a verified psychologist
                picks up your request, sets the session fee, and proposes 3 schedule slots.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/bookings')}
            >
              View in My Bookings (Client)
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                setCognitoRole('psychologist');
                router.push('/psych/queue');
              }}
            >
              Switch to Psychologist Role &amp; Pick Up #{submittedBookingId} →
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Manage Personas + wizard launcher */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#C0D3C3] pb-3">
              <div>
                <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                  1. Manage Personas
                </h2>
                <p className="text-xs text-[#25372D]/70">
                  Who is the session for? Personas include signed consent.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openWizard('manage')}
              >
                + New Persona
              </Button>
            </div>

            {/* Booking-for indicator (single persona preselected) */}
            {selectedPersona && personas.length === 1 && (
              <div className="p-4 rounded-xl bg-[#EBF2EC] border-l-4 border-[#5D8B69] flex items-center justify-between gap-3">
                <p className="text-sm text-[#25372D]">
                  Booking for: <strong className="font-semibold">{selectedPersona.label}</strong>
                </p>
                <Button variant="outline" size="sm" onClick={() => openWizard('manage')}>
                  Change / Add someone else
                </Button>
              </div>
            )}

            {/* Existing Personas picker */}
            <div className="space-y-3">
              {personasLoading && (
                <p className="text-xs text-[#25372D]/70">Loading personas…</p>
              )}
              {!personasLoading && personas.length === 0 && (
                <div className="p-4 rounded-xl bg-[#F6F9F6] border border-[#8FBE8F] space-y-3">
                  <p className="text-sm text-[#25372D]">
                    No personas yet. Create one with signed consent to start booking.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => openWizard('manage')}>
                    Launch Persona Wizard
                  </Button>
                </div>
              )}
              {personas.map((persona) => {
                const isSelected = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => selectPersona(persona.id, persona.preferredLanguage)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#5D8B69] bg-[#F1F6F2]'
                        : 'border-[#C0D3C3] bg-white hover:bg-[#F6F9F6]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-[#25372D]/70 mb-1">
                      <span className="font-semibold text-[#5D8B69]">
                        Persona Type: {persona.type === 'self' ? 'Self (Primary)' : 'Dependent Ward'}
                      </span>
                      <span className="font-mono tabular-nums">{persona.ageGroup}</span>
                    </div>
                    <p className="font-heading text-lg font-bold text-[#25372D]">
                      {persona.label}
                    </p>
                    <p className="text-xs text-[#25372D]/70 mt-1">
                      Relationship: {persona.relationshipToClient} · Language: {persona.preferredLanguage}
                    </p>
                    {lastUsedPersonaId === persona.id && (
                      <p className="text-[11px] text-[#5D8B69] font-semibold mt-1">Last used</p>
                    )}
                  </button>
                );
              })}
            </div>

            {personas.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => openWizard('manage')}>
                + Add someone else
              </Button>
            )}

            {/* Legacy quick-add (temporary) — deprecated once POST /personas is real */}
            <details className="rounded-xl bg-[#F6F9F6] border border-[#C0D3C3]">
              <summary className="px-4 py-3 text-xs font-semibold text-[#25372D]/75 cursor-pointer list-none">
                Legacy quick-add (temporary) — old label/age-group form, kept until backend POST
                /personas supports persona + consent
              </summary>
              <div className="px-4 pb-4">
                {!showLegacyPersonaForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLegacyPersonaForm(true)}
                  >
                    Show legacy form
                  </Button>
                ) : (
                <form
                  onSubmit={personaForm.handleSubmit((vals) => createPersonaMutation.mutate(vals))}
                  className="p-4 rounded-xl bg-white border border-[#8FBE8F] space-y-4"
                >
                  <p className="font-heading text-lg font-bold text-[#25372D]">
                    Create New Anonymized Persona (Legacy)
                  </p>

                  <div>
                    <Label htmlFor="persona-type">Persona Classification</Label>
                    <Select id="persona-type" {...personaForm.register('type')}>
                      <option value="self">Self (Primary Account)</option>
                      <option value="dependent">Dependent (Child / Adolescent / Ward)</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="persona-label">Anonymized Profile Label (No Real Names)</Label>
                    <Input
                      id="persona-label"
                      placeholder="e.g., Dependent Ward #D-02 (Young Adult)"
                      {...personaForm.register('label')}
                    />
                    {personaForm.formState.errors.label && (
                      <p className="text-xs text-red-700 mt-1">
                        {personaForm.formState.errors.label.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="persona-age">Age Bracket</Label>
                      <Select id="persona-age" {...personaForm.register('ageGroup')}>
                        <option value="Child (7–12)">Child (7–12)</option>
                        <option value="Adolescent (13–17)">Adolescent (13–17)</option>
                        <option value="Young Adult (18–24)">Young Adult (18–24)</option>
                        <option value="Adult (25–34)">Adult (25–34)</option>
                        <option value="Adult (35–49)">Adult (35–49)</option>
                        <option value="Senior (50+)">Senior (50+)</option>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="persona-lang">Preferred Language</Label>
                      <Select id="persona-lang" {...personaForm.register('preferredLanguage')}>
                        <option value="English / Taglish">English / Taglish</option>
                        <option value="Filipino / Taglish">Filipino / Taglish</option>
                        <option value="English">English</option>
                        <option value="Cebuano / English">Cebuano / English</option>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="persona-rel">Relationship / Legal Authority</Label>
                    <Input
                      id="persona-rel"
                      placeholder="e.g., Legal Guardian / Parent"
                      {...personaForm.register('relationshipToClient')}
                    />
                    {personaForm.formState.errors.relationshipToClient && (
                      <p className="text-xs text-red-700 mt-1">
                        {personaForm.formState.errors.relationshipToClient.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={createPersonaMutation.isPending}
                    >
                      {createPersonaMutation.isPending ? 'Saving Persona...' : 'Save Persona Profile'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLegacyPersonaForm(false)}
                    >
                      Hide
                    </Button>
                  </div>
                </form>
                )}
              </div>
            </details>
          </Card>
        </div>

        {/* Right Column: Canonical Flow C Booking Form (RHF + Zod) */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="border-b border-[#C0D3C3] pb-4">
            <h2 className="font-heading text-2xl font-bold text-[#25372D]">
              2. Complete Clinical Booking Form
            </h2>
            <p className="text-xs text-[#25372D]/70">
              Validated with React Hook Form + Zod · Enters Pending Queue for Verified Psychologists
            </p>
          </div>

          <form
            onSubmit={bookingForm.handleSubmit((vals) => submitBookingMutation.mutate(vals))}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="booking-service">Selected Service &amp; Duration</Label>
                <Select
                  id="booking-service"
                  {...bookingForm.register('serviceId', {
                    onChange: (e) => updateBookingDraft({ serviceId: e.target.value }),
                  })}
                >
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.title} ({srv.durationLabel})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="booking-language">Preferred Session Language</Label>
                <Select
                  id="booking-language"
                  {...bookingForm.register('preferredLanguage', {
                    onChange: (e) => updateBookingDraft({ preferredLanguage: e.target.value }),
                  })}
                >
                  <option value="English / Taglish">English / Taglish</option>
                  <option value="Filipino / Taglish">Filipino / Taglish</option>
                  <option value="English">English</option>
                  <option value="Cebuano / English">Cebuano / English</option>
                </Select>
              </div>
            </div>

            {/* Dynamic Service Duration & Scope Guardrail Notice */}
            {activeService && (
              <div className="p-4 rounded-xl bg-[#EBF2EC] border-l-4 border-[#5D8B69] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#25372D]">
                  <span>Active Guardrail: {activeService.guardrailTitle}</span>
                  <span className="font-mono tabular-nums text-[#5D8B69]">
                    Duration: {activeService.durationLabel}
                  </span>
                </div>
                <p className="text-xs text-[#25372D]/85 leading-relaxed">
                  {activeService.guardrailNotice}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="booking-concerns">
                Presenting Concerns, Context &amp; Goals (Min 20 chars)
              </Label>
              <Textarea
                id="booking-concerns"
                rows={4}
                placeholder="Describe primary concerns, goals for this service, and relevant context (do not include real full names)..."
                {...bookingForm.register('concernsSummary', {
                  onChange: (e) => updateBookingDraft({ concernsSummary: e.target.value }),
                })}
              />
              {bookingForm.formState.errors.concernsSummary && (
                <p className="text-xs text-red-700 mt-1">
                  {bookingForm.formState.errors.concernsSummary.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="booking-needs">
                Scheduling Preferences, Breakout Setup &amp; Specific Needs
              </Label>
              <Textarea
                id="booking-needs"
                rows={2}
                placeholder="e.g., Prefer weekday evenings after 6 PM PST; separate devices ready if Couples 15-min breakout applies..."
                {...bookingForm.register('specificNeeds', {
                  onChange: (e) => updateBookingDraft({ specificNeeds: e.target.value }),
                })}
              />
              {bookingForm.formState.errors.specificNeeds && (
                <p className="text-xs text-red-700 mt-1">
                  {bookingForm.formState.errors.specificNeeds.message}
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3] space-y-2">
              <label className="flex items-start gap-3 text-xs text-[#25372D] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                  {...bookingForm.register('guardrailAcknowledged')}
                />
                <span className="leading-relaxed">
                  I acknowledge the clinical guardrail for{' '}
                  <strong>{activeService?.title}</strong> ({activeService?.durationLabel}) and
                  understand that my request enters a pending queue until a verified psychologist
                  proposes 3 schedule slots and payment is completed.
                </span>
              </label>
              {bookingForm.formState.errors.guardrailAcknowledged && (
                <p className="text-xs text-red-700">
                  {bookingForm.formState.errors.guardrailAcknowledged.message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <span className="text-xs text-[#25372D]/65">
                Next Step: Enters Pending Queue → Verified Psychologist Proposes 3 Slots
              </span>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitBookingMutation.isPending}
              >
                {submitBookingMutation.isPending
                  ? 'Submitting Booking to Queue...'
                  : 'Submit Booking Request (Status: Pending)'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <PersonaWizardModal
        onCreated={(id) => {
          const created = personas.find((p) => p.id === id);
          selectPersona(id, created?.preferredLanguage);
        }}
      />
    </div>
  );
}
