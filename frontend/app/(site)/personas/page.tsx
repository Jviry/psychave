'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  bookingFormSchema,
  BookingFormValues,
} from '../../../lib/schemas';
import { useAppStore } from '../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import { usePersonaWizardStore } from '../../../stores/usePersonaWizardStore';
import { PersonaWizardModal } from '../../../components/PersonaWizardModal';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Button,
  Card,
  Label,
  Select,
  Textarea,
} from '../../../components/ui/primitives';

export default function PersonasAndBookingPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    bookingDraft,
    updateBookingDraft,
    resetBookingDraft,
    publishFlowEvent,
  } = useAppStore();
  const openWizard = usePersonaWizardStore((s) => s.openWizard);
  const wizardOpen = usePersonaWizardStore((s) => s.isOpen);
  const lastUsedPersonaId = usePersonaWizardStore((s) => s.lastUsedPersonaId);
  const setLastUsedPersonaId = usePersonaWizardStore((s) => s.setLastUsedPersonaId);

  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const autoOpenedWizard = useRef(false);

  // Two-step booking form inside one card: 1. Session -> 2. Clinical context
  const [step, setStep] = useState<1 | 2>(1);
  const stepFocus = useRef(false);

  const { data: personas = [], isLoading: personasLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.getPersonas(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  // Booking request form — two steps: Session -> Clinical context
  const bookingForm = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      // No mock fallbacks: real mode needs backend UUIDs, and ids are bound
      // to the live personas/services lists by the effects below.
      personaId: bookingDraft.personaId,
      serviceId: bookingDraft.serviceId,
      concernsSummary: bookingDraft.concernsSummary || '',
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

  // Move focus to the first field of the active step (skip the first mount)
  useEffect(() => {
    if (!stepFocus.current) {
      stepFocus.current = true;
      return;
    }
    if (step === 2) document.getElementById('booking-concerns')?.focus();
    else document.getElementById('booking-service')?.focus();
  }, [step]);

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

  const selectPersona = (personaId: string) => {
    bookingForm.setValue('personaId', personaId, { shouldValidate: true });
    updateBookingDraft({ personaId });
    setLastUsedPersonaId(personaId);
  };

  // Bind the booking form to real backend rows. The store starts empty, so
  // without this the persona/service fields would stay blank (or, before the
  // defaults were cleared, hold mock ids that `submitBookingRequest` rejects).
  useEffect(() => {
    if (personasLoading || personas.length === 0) return;
    const current = bookingForm.getValues('personaId');
    if (personas.some((p) => p.id === current)) return;

    const fallback = personas.find((p) => p.id === lastUsedPersonaId) ?? personas[0];
    bookingForm.setValue('personaId', fallback.id, { shouldValidate: true });
    updateBookingDraft({ personaId: fallback.id });
  }, [personas, personasLoading, lastUsedPersonaId, bookingForm, updateBookingDraft]);

  useEffect(() => {
    if (services.length === 0) return;
    const current = bookingForm.getValues('serviceId');
    if (services.some((s) => s.id === current)) return;

    // Prefer a service chosen earlier in the flow if it is still valid.
    const fallback =
      services.find((s) => s.id === bookingDraft.serviceId) ?? services[0];
    bookingForm.setValue('serviceId', fallback.id, { shouldValidate: true });
    updateBookingDraft({ serviceId: fallback.id });
  }, [services, bookingDraft.serviceId, bookingForm, updateBookingDraft]);

  // Step navigation: validate the visible Step 1 fields before advancing
  const goToStep = async (next: 1 | 2) => {
    if (next === 2) {
      const valid = await bookingForm.trigger(['serviceId']);
      if (!valid) return;
    }
    setStep(next);
  };

  const submitBookingMutation = useMutation({
    mutationFn: (values: BookingFormValues) =>
      api.submitBookingRequest({
        personaId: values.personaId,
        serviceId: values.serviceId,
        concernsSummary: values.concernsSummary,
      }),
    onSuccess: (createdBooking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      resetBookingDraft();
      bookingForm.reset({
        personaId: createdBooking.personaId,
        serviceId: createdBooking.serviceId,
        concernsSummary: '',
        guardrailAcknowledged: false,
      });
      setSubmittedBookingId(createdBooking.id);
      setStep(1);
      publishFlowEvent(
        'Booking Submitted',
        `Request ${createdBooking.id} (${createdBooking.serviceTitle}) entered the Pending Queue. Verified psychologists notified.`
      );
    },
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Booking Step 1 of 5</span>
            <span aria-hidden="true">·</span>
            <span>Persona &amp; booking</span>
          </div>
          <h1 className="font-heading text-4xl font-medium text-pine">Book a session</h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Two short steps — then a verified psychologist reviews your request and proposes three
            time slots.
          </p>
        </div>
      </header>

      {/* Submission confirmation — the request is now pending */}
      {submittedBookingId && (
        <div className="bg-surface-sunken border border-sage/50 rounded-lg p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-accent-ink">Booking submitted · Pending</p>
            <h2 className="font-heading text-2xl font-medium text-pine">
              Request #{submittedBookingId} is pending
            </h2>
            <p className="text-sm text-pine/80">
              A verified psychologist reviews your request and proposes 3 time slots, with the
              session fee. Your contact details unlock after payment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/bookings')}
            >
              View my bookings
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: who the session is for */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="space-y-5">
            <div className="flex items-center justify-between border-b border-mist pb-3">
              <div>
                <h2 className="font-heading text-2xl font-medium text-pine">
                  Who is this for?
                </h2>
                <p className="text-xs text-pine/70">Personas include signed consent.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openWizard('manage')}
              >
                New persona
              </Button>
            </div>

            {/* Booking-for indicator (single persona preselected) */}
            {selectedPersona && personas.length === 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-pine">
                  Booking for: <strong className="font-semibold">{selectedPersona.label}</strong>
                </p>
                <Button variant="outline" size="sm" onClick={() => openWizard('manage')}>
                  Change or add someone else
                </Button>
              </div>
            )}

            {/* Existing Personas picker */}
            <div className="space-y-3">
              {personasLoading && (
                <p className="text-xs text-pine/70">Loading personas…</p>
              )}
              {!personasLoading && personas.length === 0 && (
                <div className="p-4 rounded-lg bg-parchment border border-mint/50 space-y-3">
                  <p className="text-sm text-pine">
                    No personas yet. Create one with signed consent to start booking.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => openWizard('manage')}>
                    Create a persona
                  </Button>
                </div>
              )}
              {personas.map((persona) => {
                const isSelected = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => selectPersona(persona.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? 'border-sage bg-surface-sunken'
                        : 'border-mist bg-surface-raised hover:bg-parchment'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-pine/70 mb-1">
                      <span className="font-semibold text-accent-ink">
                        Persona Type: {persona.type === 'self' ? 'Self (Primary)' : 'Dependent'}
                      </span>
                      <span className="tabular-nums">{persona.ageGroup}</span>
                    </div>
                    <p className="font-heading text-lg font-medium text-pine">
                      {persona.label}
                    </p>
                    <p className="text-xs text-pine/70 mt-1">
                      Relationship: {persona.relationshipToClient}
                    </p>
                    {lastUsedPersonaId === persona.id && (
                      <p className="text-xs text-accent-ink font-semibold mt-1">Last used</p>
                    )}
                  </button>
                );
              })}
            </div>

            {personas.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => openWizard('manage')}>
                Add someone else
              </Button>
            )}
          </Card>
        </div>

        {/* Right column: booking details — two short steps in one card */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="border-b border-mist pb-4">
            <h2 className="font-heading text-2xl font-medium text-pine">Booking details</h2>
          </div>

          <form
            onSubmit={bookingForm.handleSubmit((vals) => submitBookingMutation.mutate(vals))}
            className="space-y-5"
          >
            {/* Segmented progress across the two steps */}
            <div className="space-y-2">
              <div className="flex items-center gap-2" aria-hidden="true">
                <span
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-150 ${
                    step >= 1 ? 'bg-sage' : 'bg-mist'
                  }`}
                />
                <span
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-150 ${
                    step >= 2 ? 'bg-sage' : 'bg-mist'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className={step === 1 ? 'text-pine' : 'text-pine/55'}>1. Session</span>
                <span className={step === 2 ? 'text-pine' : 'text-pine/55'}>
                  2. Clinical context
                </span>
              </div>
              <p className="sr-only" aria-live="polite">
                Step {step} of 2: {step === 1 ? 'Session' : 'Clinical context'}
              </p>
            </div>

            {step === 1 && (
              <>
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

                {activeService && (
                  <p className="text-xs text-pine/60 leading-relaxed">
                    {activeService.guardrailNotice}
                  </p>
                )}

                <div className="flex items-center justify-end pt-2">
                  <Button type="button" variant="primary" onClick={() => goToStep(2)}>
                    Continue
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="booking-concerns">Presenting concerns &amp; goals</Label>
                  <Textarea
                    id="booking-concerns"
                    rows={4}
                    placeholder="What's going on, and what you hope to get from the session — please avoid full real names."
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

                <div className="space-y-2">
                  <label className="flex items-start gap-3 text-xs text-pine cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-mist accent-sage cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                      {...bookingForm.register('guardrailAcknowledged')}
                    />
                    <span className="leading-relaxed">
                      I understand {activeService?.title} follows its clinical scope guardrail, and
                      this request stays pending until a verified psychologist proposes 3 time
                      slots and payment is completed.
                    </span>
                  </label>
                  {bookingForm.formState.errors.guardrailAcknowledged && (
                    <p className="text-xs text-red-700">
                      {bookingForm.formState.errors.guardrailAcknowledged.message}
                    </p>
                  )}
                </div>

                {submitBookingMutation.isError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
                  >
                    <p className="mb-1 font-medium">Booking request failed</p>
                    <p>
                      {submitBookingMutation.error instanceof Error
                        ? submitBookingMutation.error.message
                        : 'Please try again.'}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <Button type="button" variant="ghost" onClick={() => goToStep(1)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={submitBookingMutation.isPending}
                  >
                    {submitBookingMutation.isPending ? 'Submitting…' : 'Submit booking request'}
                  </Button>
                </div>
                <p className="text-xs text-pine/60">
                  A verified psychologist reviews your request and proposes 3 time slots.
                </p>
              </>
            )}
          </form>
        </Card>
      </div>

      <PersonaWizardModal
        onCreated={(id) => {
          selectPersona(id);
        }}
      />
    </div>
  );
}
