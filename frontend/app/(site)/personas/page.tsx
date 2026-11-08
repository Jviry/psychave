'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { ArrowLeft, ArrowRight, Clock, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from '../../../components/ui/primitives';

function manilaInputMin(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(Date.now() + 60 * 60 * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

const EMPTY_SLOTS = [
  { dateTime: '' },
  { dateTime: '' },
  { dateTime: '' },
];

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
  const minDateTime = useRef(manilaInputMin());

  // Three-step booking form inside one card: 1. Session -> 2. Clinical
  // context -> 3. Preferred schedules.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepFocus = useRef(false);

  const { data: personas = [], isLoading: personasLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.getPersonas(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const bookingForm = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      // Backend UUIDs only: ids are bound to the live personas/services
      // lists by the effects below.
      personaId: bookingDraft.personaId,
      serviceId: bookingDraft.serviceId,
      concernsSummary: bookingDraft.concernsSummary || '',
      guardrailAcknowledged: false,
      preferredSlots: EMPTY_SLOTS.map((slot) => ({ ...slot })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: bookingForm.control,
    name: 'preferredSlots',
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
    if (step === 3) document.getElementById('booking-slot-0')?.focus();
    else if (step === 2) document.getElementById('booking-concerns')?.focus();
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
  const preferredSlotErrors = bookingForm.formState.errors.preferredSlots;

  const selectPersona = (personaId: string) => {
    bookingForm.setValue('personaId', personaId, { shouldValidate: true });
    updateBookingDraft({ personaId });
    setLastUsedPersonaId(personaId);
  };

  // Bind the booking form to real backend rows. The store starts empty, so
  // without this the persona/service fields would stay blank or hold ids that
  // `submitBookingRequest` rejects as non-UUIDs.
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

  // Step navigation: validate the visible fields before advancing.
  const goToStep = async (next: 1 | 2 | 3) => {
    if (next === 2) {
      const valid = await bookingForm.trigger(['serviceId']);
      if (!valid) return;
    }
    if (next === 3) {
      const valid = await bookingForm.trigger([
        'concernsSummary',
        'guardrailAcknowledged',
      ]);
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
        preferredSlots: values.preferredSlots.map((slot) => slot.dateTime),
      }),
    onSuccess: (createdBooking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      resetBookingDraft();
      bookingForm.reset({
        personaId: createdBooking.personaId,
        serviceId: createdBooking.serviceId,
        concernsSummary: '',
        guardrailAcknowledged: false,
        preferredSlots: EMPTY_SLOTS.map((slot) => ({ ...slot })),
      });
      setSubmittedBookingId(createdBooking.id);
      setStep(1);
      publishFlowEvent(
        'Booking Submitted',
        `Request ${createdBooking.id} (${createdBooking.serviceTitle}) entered the Pending Queue with ${createdBooking.proposedSlots.length} preferred schedules.`
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
            Three short steps — choose three or more preferred schedules. A verified
            psychologist accepts one of your times or offers the nearest available alternative.
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
              A verified psychologist reviews your preferred schedules and accepts one or offers
              the nearest available alternative. Your contact details unlock after payment.
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

        {/* Right column: booking details — three short steps in one card */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="border-b border-mist pb-4">
            <h2 className="font-heading text-2xl font-medium text-pine">Booking details</h2>
          </div>

          <form
            onSubmit={bookingForm.handleSubmit((vals) => submitBookingMutation.mutate(vals))}
            className="space-y-5"
          >
            {/* Segmented progress across the three steps */}
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
                <span
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-150 ${
                    step >= 3 ? 'bg-sage' : 'bg-mist'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className={step === 1 ? 'text-pine' : 'text-pine/55'}>1. Session</span>
                <span className={step === 2 ? 'text-pine' : 'text-pine/55'}>
                  2. Clinical context
                </span>
                <span className={step === 3 ? 'text-pine' : 'text-pine/55'}>
                  3. Preferred schedules
                </span>
              </div>
              <p className="sr-only" aria-live="polite">
                Step {step} of 3:{' '}
                {step === 1
                  ? 'Session'
                  : step === 2
                    ? 'Clinical context'
                    : 'Preferred schedules'}
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
                      I understand {activeService?.title} follows its clinical scope guardrail,
                      and this request stays pending until a verified psychologist accepts one of
                      my preferred schedules (or offers an alternative) and payment is completed.
                    </span>
                  </label>
                  {bookingForm.formState.errors.guardrailAcknowledged && (
                    <p className="text-xs text-red-700">
                      {bookingForm.formState.errors.guardrailAcknowledged.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    Back
                  </Button>
                  <Button type="button" variant="primary" onClick={() => goToStep(3)}>
                    Continue
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-3">
                  <div>
                    <Label>Preferred schedules</Label>
                    <p className="text-xs text-pine/60 mt-1">
                      Give at least 3 dates and times that work for you. The psychologist either
                      accepts one or offers the nearest available alternative.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => {
                      const fieldError = preferredSlotErrors?.[index]?.dateTime;
                      return (
                        <div key={field.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-7 shrink-0 text-xs font-semibold text-pine/60 tabular-nums">
                              {index + 1}.
                            </span>
                            <div className="relative flex-1">
                              <Clock
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/40"
                                aria-hidden="true"
                              />
                              <Input
                                id={`booking-slot-${index}`}
                                type="datetime-local"
                                min={minDateTime.current}
                                className="pl-9"
                                aria-invalid={fieldError ? true : undefined}
                                {...bookingForm.register(`preferredSlots.${index}.dateTime`)}
                              />
                            </div>
                            {fields.length > 3 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-2 rounded-md text-pine/50 hover:text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-sage"
                                aria-label={`Remove preferred schedule ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          {fieldError && (
                            <p className="text-xs text-red-700 pl-9">{fieldError.message}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {fields.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ dateTime: '' })}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add another time
                    </Button>
                  )}

                  {preferredSlotErrors?.message && (
                    <p className="text-xs text-red-700">{preferredSlotErrors.message}</p>
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
                  <Button type="button" variant="ghost" onClick={() => setStep(2)}>
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
                  A verified psychologist reviews your preferred schedules. You will agree on one
                  time before payment is due.
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
