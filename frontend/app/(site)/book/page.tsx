'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, Facebook, Mail, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { bookingFormSchema, BookingFormValues } from '@/lib/schemas';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/useAppStore';
import { useProfileWizardStore } from '@/stores/useProfileWizardStore';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

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

const EMPTY_SLOTS = [{ dateTime: '' }, { dateTime: '' }, { dateTime: '' }];

const CLINIC_EMAIL = 'psychaveph.info@gmail.com';
const FACEBOOK_URL = 'https://facebook.com/PsychAvenuePH';
const INQUIRY_TEMPLATE = `Subject: PsychAvenuePH Session Inquiry
Profile Type: [Self / Dependent]
Requested Service: [Consultation 45m / Individual 1hr / Couples 1.5hr / Family-Group 2hr / Life Coaching / Clinical Supervision / Academic Advisory]
Preferred Language: [English / Filipino / Taglish]
General Availability Window: [Days & Times]`;

function DirectChannelsAndSafety() {
  const [copiedField, setCopiedField] = useState<'email' | 'fb' | 'template' | null>(null);

  const handleCopy = (type: 'email' | 'fb' | 'template', text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 2500);
  };

  return (
    <div className="space-y-6 pt-2">
      <section className="space-y-2 border-t border-mist/80 pt-5">
        <p className="text-xs font-medium text-pine/70">Prefer to reach us directly?</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-pine/80">
          <button
            type="button"
            onClick={() => handleCopy('fb', FACEBOOK_URL)}
            className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-pine transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <Facebook className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
            Facebook page
          </button>
          <button
            type="button"
            onClick={() => handleCopy('email', CLINIC_EMAIL)}
            className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-pine transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <Mail className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
            {CLINIC_EMAIL}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('template', INQUIRY_TEMPLATE)}
            className="underline underline-offset-4 hover:text-pine transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Copy inquiry template
          </button>
        </div>
        <p aria-live="polite" className="min-h-4 text-xs text-accent-ink">
          {copiedField === 'fb' && 'Facebook page link copied.'}
          {copiedField === 'email' && 'Clinic email copied.'}
          {copiedField === 'template' && 'Inquiry template copied.'}
        </p>
      </section>

      <section className="bg-surface-sunken border border-mist rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-pine">Non-emergency platform</p>
          <p className="text-xs text-pine/75 leading-relaxed">
            For acute mental-health emergencies, contact the NCMH Crisis Hotline directly.
          </p>
        </div>
        <div className="text-xs font-semibold text-pine bg-surface-raised px-3 py-2 rounded-lg border border-mist shrink-0 tabular-nums">
          NCMH 24/7: 1553 / 0917-899-8727
        </div>
      </section>
    </div>
  );
}

function ClientBookingFlow() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const bookingDraft = useAppStore((s) => s.bookingDraft);
  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const resetBookingDraft = useAppStore((s) => s.resetBookingDraft);
  const publishFlowEvent = useAppStore((s) => s.publishFlowEvent);
  const lastUsedProfileId = useProfileWizardStore((s) => s.lastUsedProfileId);
  const setLastUsedProfileId = useProfileWizardStore((s) => s.setLastUsedProfileId);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const stepFocus = useRef(false);
  const minDateTime = useRef(manilaInputMin());

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const bookingForm = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      profileId: bookingDraft.profileId,
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

  useEffect(() => {
    if (bookingDraft.serviceId) {
      bookingForm.setValue('serviceId', bookingDraft.serviceId);
    }
    if (bookingDraft.profileId) {
      bookingForm.setValue('profileId', bookingDraft.profileId);
    }
  }, [bookingDraft.serviceId, bookingDraft.profileId, bookingForm]);

  useEffect(() => {
    if (!stepFocus.current) {
      stepFocus.current = true;
      return;
    }
    if (step === 3) document.getElementById('booking-slot-0')?.focus();
    else if (step === 2) document.getElementById('booking-concerns')?.focus();
    else document.getElementById('booking-service')?.focus();
  }, [step]);

  useEffect(() => {
    if (profilesLoading || profiles.length === 0) return;
    const current = bookingForm.getValues('profileId');
    if (profiles.some((p) => p.id === current)) return;

    const fallback =
      profiles.find((p) => p.id === lastUsedProfileId) ??
      profiles.find((p) => p.type === 'self') ??
      profiles[0];
    bookingForm.setValue('profileId', fallback.id, { shouldValidate: true });
    updateBookingDraft({ profileId: fallback.id });
  }, [profiles, profilesLoading, lastUsedProfileId, bookingForm, updateBookingDraft]);

  useEffect(() => {
    if (services.length === 0) return;
    const current = bookingForm.getValues('serviceId');
    if (services.some((s) => s.id === current)) return;

    const fallback = services.find((s) => s.id === bookingDraft.serviceId) ?? services[0];
    bookingForm.setValue('serviceId', fallback.id, { shouldValidate: true });
    updateBookingDraft({ serviceId: fallback.id });
  }, [services, bookingDraft.serviceId, bookingForm, updateBookingDraft]);

  const selectedServiceId = bookingForm.watch('serviceId');
  const selectedProfileId = bookingForm.watch('profileId');
  const activeService = services.find((s) => s.id === selectedServiceId) || services[0];
  const preferredSlotErrors = bookingForm.formState.errors.preferredSlots;

  const selectProfile = (profileId: string) => {
    bookingForm.setValue('profileId', profileId, { shouldValidate: true });
    updateBookingDraft({ profileId });
    setLastUsedProfileId(profileId);
  };

  const goToStep = async (next: 1 | 2 | 3) => {
    if (next === 2) {
      const valid = await bookingForm.trigger(['profileId', 'serviceId']);
      if (!valid) return;
    }
    if (next === 3) {
      const valid = await bookingForm.trigger(['concernsSummary', 'guardrailAcknowledged']);
      if (!valid) return;
    }
    setStep(next);
  };

  const submitBookingMutation = useMutation({
    mutationFn: (values: BookingFormValues) =>
      api.submitBookingRequest({
        profileId: values.profileId,
        serviceId: values.serviceId,
        concernsSummary: values.concernsSummary,
        preferredSlots: values.preferredSlots.map((slot) => slot.dateTime),
      }),
    onSuccess: (createdBooking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setLastUsedProfileId(createdBooking.profileId);
      resetBookingDraft();
      bookingForm.reset({
        profileId: createdBooking.profileId,
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

  if (submittedBookingId) {
    return (
      <Card className="p-6 sm:p-8 space-y-5 bg-surface-sunken border-sage/50">
        <div className="space-y-1.5">
          <h2 className="font-heading text-2xl font-medium text-pine">
            Request #{submittedBookingId} is pending
          </h2>
          <p className="text-sm text-pine/80 leading-relaxed">
            A verified psychologist will review your preferred schedules and accept one or offer the
            nearest available alternative. Your contact details unlock after payment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button variant="primary" onClick={() => router.push('/bookings')}>
            View my bookings
          </Button>
          <Button variant="outline" onClick={() => setSubmittedBookingId(null)}>
            Book another session
          </Button>
        </div>
      </Card>
    );
  }

  if (profilesLoading) {
    return (
      <Card className="p-6 sm:p-8 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="p-6 sm:p-8 space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-heading text-2xl font-medium text-pine">
            Create a client profile first
          </h2>
          <p className="text-sm text-pine/75 leading-relaxed">
            Every booking needs a profile with signed informed consent for yourself or a dependent.
          </p>
        </div>
        <div>
          <Button
            variant="primary"
            onClick={() => router.push('/profiles/new?returnTo=/book')}
          >
            Create a profile
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8 space-y-6">
      {/* Slim 3-step progress */}
      <div className="space-y-2">
        <div className="flex items-center gap-2" aria-hidden="true">
          {[1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors duration-150 ${
                step >= idx ? 'bg-sage' : 'bg-mist'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs font-medium">
          <span className={step === 1 ? 'text-pine' : 'text-pine/55'}>1. Session</span>
          <span className={step === 2 ? 'text-pine' : 'text-pine/55'}>2. Concerns</span>
          <span className={step === 3 ? 'text-pine' : 'text-pine/55'}>3. Schedules</span>
        </div>
        <p className="sr-only" aria-live="polite">
          Step {step} of 3: {step === 1 ? 'Session' : step === 2 ? 'Concerns' : 'Schedules'}
        </p>
      </div>

      <form
        onSubmit={bookingForm.handleSubmit((vals) => submitBookingMutation.mutate(vals))}
        className="space-y-5"
      >
        {step === 1 && (
          <>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <Label className="mb-0">Booking for</Label>
                <Link
                  href="/profiles?returnTo=/book"
                  className="text-xs font-medium text-accent-ink underline underline-offset-4 hover:text-pine transition-colors"
                >
                  + Add / manage profiles
                </Link>
              </div>
              <div role="radiogroup" aria-label="Booking for" className="space-y-2">
                {[...profiles]
                  .sort((a, b) => (a.type === 'self' ? -1 : b.type === 'self' ? 1 : 0))
                  .map((profile) => {
                  const isSelected = selectedProfileId === profile.id;
                  const isLastUsed = lastUsedProfileId === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => selectProfile(profile.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
                        isSelected
                          ? 'border-sage bg-surface-sunken'
                          : 'border-mist bg-surface-raised hover:bg-parchment'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm text-pine">{profile.label}</span>
                        <span className="text-xs text-pine/65 tabular-nums">{profile.ageGroup}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-pine/65 mt-0.5">
                        <span className="font-medium text-accent-ink">
                          {profile.type === 'self' ? 'Self (Primary)' : 'Dependent'}
                        </span>
                        {profile.type !== 'self' && profile.relationshipToClient && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{profile.relationshipToClient}</span>
                          </>
                        )}
                        {isLastUsed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-accent-ink font-medium">Last used</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {bookingForm.formState.errors.profileId && (
                <p className="text-xs text-red-700">
                  {bookingForm.formState.errors.profileId.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="booking-service">Service &amp; duration</Label>
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
              {activeService && (
                <p className="text-xs text-pine/65 leading-relaxed mt-2">
                  {activeService.guardrailNotice}
                </p>
              )}
            </div>

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

            <div className="space-y-1.5">
              <label className="flex items-start gap-3 text-xs text-pine cursor-pointer">
                <Checkbox className="mt-0.5" {...bookingForm.register('guardrailAcknowledged')} />
                <span className="leading-relaxed">
                  I understand {activeService?.title} follows its clinical scope guardrail, and this
                  request stays pending until a verified psychologist accepts a schedule and payment
                  is completed.
                </span>
              </label>
              {bookingForm.formState.errors.guardrailAcknowledged && (
                <p className="text-xs text-red-700">
                  {bookingForm.formState.errors.guardrailAcknowledged.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
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
                <p className="text-xs text-pine/65 mt-0.5">
                  Propose at least 3 times that work for you. A psychologist accepts one or offers
                  the nearest alternative.
                </p>
              </div>

              <div className="space-y-2.5">
                {fields.map((field, index) => {
                  const fieldError = preferredSlotErrors?.[index]?.dateTime;
                  return (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-xs font-semibold text-pine/60 tabular-nums">
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
                            className="p-2 rounded-md text-pine/50 hover:text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-sage cursor-pointer"
                            aria-label={`Remove preferred schedule ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {fieldError && (
                        <p className="text-xs text-red-700 pl-8">{fieldError.message}</p>
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
                {submitBookingMutation.isPending ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
            <p className="text-xs text-pine/60">
              Payment is only due after you and your psychologist agree on a schedule.
            </p>
          </>
        )}
      </form>
    </Card>
  );
}

export default function BookPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const getDashboardPath = useAuthStore((s) => s.getDashboardPath);
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated?.() ?? false
  );

  useEffect(() => {
    const persistApi = useAuthStore.persist;
    if (!persistApi) {
      setHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <header className="space-y-2 border-b border-mist pb-5">
        <h1 className="font-heading text-4xl font-medium text-pine">Book a session</h1>
        <p className="text-sm text-pine/75">
          Three short steps — pick who it&apos;s for, share your goals, and propose three times.
        </p>
      </header>

      {!hydrated ? (
        <Card className="p-6 sm:p-8 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      ) : !isAuthenticated || !user ? (
        <Card className="p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Sign in to book online
            </h2>
            <p className="text-sm text-pine/75 leading-relaxed">
              Use a client account to manage informed consent, propose schedules, and track your
              session status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => router.push('/login')}>
              Log in
            </Button>
            <Button variant="outline" onClick={() => router.push('/register')}>
              Create account
            </Button>
          </div>
        </Card>
      ) : user.role !== 'client' ? (
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Client account required
            </h2>
            <p className="text-sm text-pine/75">
              You are signed in as {user.role}. Switch to a client account to submit a booking
              request.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push(getDashboardPath())}>
            Go to my dashboard
          </Button>
        </Card>
      ) : (
        <ClientBookingFlow />
      )}

      <DirectChannelsAndSafety />
    </div>
  );
}
