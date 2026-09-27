'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  intakeFormSchema,
  IntakeFormValues,
  personaSchema,
  PersonaFormValues,
} from '../../lib/schemas';
import { useAppStore } from '../../stores/useAppStore';
import { useAppRouter } from '../../lib/navigation';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from '../../components/ui/primitives';

export default function PersonasAndIntakePage() {
  const queryClient = useQueryClient();
  const { navigate } = useAppRouter();
  const {
    cognitoRole,
    setCognitoRole,
    intakeDraft,
    updateIntakeDraft,
    resetIntakeDraft,
    publishFlowEvent,
  } = useAppStore();

  const [showNewPersonaForm, setShowNewPersonaForm] = useState(false);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);

  const { data: personas = [] } = useQuery({
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

  // React Hook Form for Flow C Step 1 Intake Form
  const intakeForm = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      personaId: intakeDraft.personaId || 'persona-self-01',
      serviceId: intakeDraft.serviceId || 'srv-individual',
      preferredLanguage: intakeDraft.preferredLanguage || 'English / Taglish',
      concernsSummary: intakeDraft.concernsSummary || '',
      specificNeeds: intakeDraft.specificNeeds || '',
      guardrailAcknowledged: false,
    },
  });

  // Keep form synced if user pre-selected a service from /services
  useEffect(() => {
    if (intakeDraft.serviceId) {
      intakeForm.setValue('serviceId', intakeDraft.serviceId);
    }
    if (intakeDraft.personaId) {
      intakeForm.setValue('personaId', intakeDraft.personaId);
    }
  }, [intakeDraft.serviceId, intakeDraft.personaId, intakeForm]);

  const selectedServiceId = intakeForm.watch('serviceId');
  const selectedPersonaId = intakeForm.watch('personaId');
  const activeService = services.find((s) => s.id === selectedServiceId) || services[0];

  const createPersonaMutation = useMutation({
    mutationFn: (values: PersonaFormValues) => api.createPersona(values),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      updateIntakeDraft({ personaId: created.id, preferredLanguage: created.preferredLanguage });
      intakeForm.setValue('personaId', created.id);
      intakeForm.setValue('preferredLanguage', created.preferredLanguage);
      personaForm.reset();
      setShowNewPersonaForm(false);
      publishFlowEvent(
        'Client Persona Created',
        `Added ${created.label} (${created.type.toUpperCase()}) and selected it for Flow C intake.`
      );
    },
  });

  const submitIntakeMutation = useMutation({
    mutationFn: (values: IntakeFormValues) =>
      api.submitIntakeRequest({
        personaId: values.personaId,
        serviceId: values.serviceId,
        preferredLanguage: values.preferredLanguage,
        concernsSummary: values.concernsSummary,
        specificNeeds: values.specificNeeds,
      }),
    onSuccess: (createdBooking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      resetIntakeDraft();
      intakeForm.reset({
        personaId: createdBooking.personaId,
        serviceId: createdBooking.serviceId,
        preferredLanguage: createdBooking.preferredLanguage,
        concernsSummary: '',
        specificNeeds: '',
        guardrailAcknowledged: false,
      });
      setSubmittedBookingId(createdBooking.id);
      publishFlowEvent(
        'Flow C Step 1 Complete — Intake Submitted',
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
            <span>Client Persona &amp; Clinical Intake</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-[#25372D]">
            Client Personas &amp; Clinical Intake Form
          </h1>
          <p className="text-sm text-[#25372D]/80 max-w-2xl">
            Select whether this session is for yourself or a dependent ward, review the mandatory
            service guardrail, and submit your intake to the verified psychologist queue.
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
                Intake Request #{submittedBookingId} Entered Pending Queue
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
              onClick={() => navigate('/bookings')}
            >
              View in My Bookings (Client)
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                setCognitoRole('psychologist');
                navigate('/psych/queue');
              }}
            >
              Switch to Psychologist Role &amp; Pick Up #{submittedBookingId} →
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Personas List (Self / Dependent) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#C0D3C3] pb-3">
              <div>
                <h2 className="font-heading text-2xl font-bold text-[#25372D]">
                  1. Select Client Persona
                </h2>
                <p className="text-xs text-[#25372D]/70">
                  Manage Self &amp; Dependent intake profiles (no personal names)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewPersonaForm(!showNewPersonaForm)}
              >
                {showNewPersonaForm ? 'Cancel' : '+ Add Persona'}
              </Button>
            </div>

            {/* Existing Personas */}
            <div className="space-y-3">
              {personas.map((persona) => {
                const isSelected = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => {
                      intakeForm.setValue('personaId', persona.id, { shouldValidate: true });
                      intakeForm.setValue('preferredLanguage', persona.preferredLanguage);
                      updateIntakeDraft({
                        personaId: persona.id,
                        preferredLanguage: persona.preferredLanguage,
                      });
                    }}
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
                  </button>
                );
              })}
            </div>

            {/* Add New Persona Form (RHF + Zod) */}
            {showNewPersonaForm && (
              <form
                onSubmit={personaForm.handleSubmit((vals) => createPersonaMutation.mutate(vals))}
                className="p-4 rounded-xl bg-[#F6F9F6] border border-[#8FBE8F] space-y-4"
              >
                <p className="font-heading text-lg font-bold text-[#25372D]">
                  Create New Anonymized Persona
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

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createPersonaMutation.isPending}
                >
                  {createPersonaMutation.isPending ? 'Saving Persona...' : 'Save Persona Profile'}
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* Right Column: Canonical Flow C Intake Form (RHF + Zod) */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="border-b border-[#C0D3C3] pb-4">
            <h2 className="font-heading text-2xl font-bold text-[#25372D]">
              2. Complete Clinical Intake Form
            </h2>
            <p className="text-xs text-[#25372D]/70">
              Validated with React Hook Form + Zod · Enters Pending Queue for Verified Psychologists
            </p>
          </div>

          <form
            onSubmit={intakeForm.handleSubmit((vals) => submitIntakeMutation.mutate(vals))}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="intake-service">Selected Service &amp; Duration</Label>
                <Select
                  id="intake-service"
                  {...intakeForm.register('serviceId', {
                    onChange: (e) => updateIntakeDraft({ serviceId: e.target.value }),
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
                <Label htmlFor="intake-language">Preferred Session Language</Label>
                <Select
                  id="intake-language"
                  {...intakeForm.register('preferredLanguage', {
                    onChange: (e) => updateIntakeDraft({ preferredLanguage: e.target.value }),
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
              <Label htmlFor="intake-concerns">
                Presenting Concerns, Context &amp; Goals (Min 20 chars)
              </Label>
              <Textarea
                id="intake-concerns"
                rows={4}
                placeholder="Describe primary concerns, goals for this service, and relevant context (do not include real full names)..."
                {...intakeForm.register('concernsSummary', {
                  onChange: (e) => updateIntakeDraft({ concernsSummary: e.target.value }),
                })}
              />
              {intakeForm.formState.errors.concernsSummary && (
                <p className="text-xs text-red-700 mt-1">
                  {intakeForm.formState.errors.concernsSummary.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="intake-needs">
                Scheduling Preferences, Breakout Setup &amp; Specific Needs
              </Label>
              <Textarea
                id="intake-needs"
                rows={2}
                placeholder="e.g., Prefer weekday evenings after 6 PM PST; separate devices ready if Couples 15-min breakout applies..."
                {...intakeForm.register('specificNeeds', {
                  onChange: (e) => updateIntakeDraft({ specificNeeds: e.target.value }),
                })}
              />
              {intakeForm.formState.errors.specificNeeds && (
                <p className="text-xs text-red-700 mt-1">
                  {intakeForm.formState.errors.specificNeeds.message}
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3] space-y-2">
              <label className="flex items-start gap-3 text-xs text-[#25372D] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                  {...intakeForm.register('guardrailAcknowledged')}
                />
                <span className="leading-relaxed">
                  I acknowledge the clinical guardrail for{' '}
                  <strong>{activeService?.title}</strong> ({activeService?.durationLabel}) and
                  understand that my request enters a pending queue until a verified psychologist
                  proposes 3 schedule slots and payment is completed.
                </span>
              </label>
              {intakeForm.formState.errors.guardrailAcknowledged && (
                <p className="text-xs text-red-700">
                  {intakeForm.formState.errors.guardrailAcknowledged.message}
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
                disabled={submitIntakeMutation.isPending}
              >
                {submitIntakeMutation.isPending
                  ? 'Submitting Intake to Queue...'
                  : 'Submit Intake Request (Status: Pending)'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
