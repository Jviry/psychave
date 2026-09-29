'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  FINAL_CONSENT_STATEMENT,
  INFORMED_CONSENT_TEXT,
  OVERSEAS_ACK_TEXT,
  SCOPE_ACK_TEXT,
  TYPING_STATEMENT,
  isFutureDob,
  isMinorDob,
  isValidPhone,
  normalizeName,
  parseApiFieldErrors,
  stepForField,
} from '../lib/consent';
import {
  personaWizardPayloadSchema,
  wizardStep1Schema,
  wizardStep2Schema,
  wizardStep3Schema,
  wizardStep4Schema,
} from '../lib/schemas';
import { useAppStore } from '../stores/useAppStore';
import { clearWizardDraftStorage, getConsentVersion, usePersonaWizardStore } from '../stores/usePersonaWizardStore';
import { Button, Input, Label, Select, Textarea } from './ui/primitives';

type Errors = Record<string, string>;

const STEP_TITLES = [
  'Informed consent & agreement',
  'Services & acknowledgements',
  'Demographics',
  'Confirmation & final consent',
] as const;

/** Pristine draft snapshot for dirty-checking the unsaved-progress confirm. */
const DEFAULT_DRAFT_SNAPSHOT = {
  whoFor: 'myself',
  relation_to_account_holder: 'self',
  terms_signer_name: '',
  terms_signer_relation: 'self',
  scope_acknowledged: false,
  is_overseas_or_foreign: false,
  overseas_acknowledged: false,
  persona_name: '',
  date_of_birth: '',
  occupation: '',
  nationality: '',
  permanent_address: '',
  present_address: '',
  sameAsPermanent: false,
  contact_number: '',
  socmed_platform: '',
  socmed_username: '',
  preferred_contact_mode: 'phone',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  emergency_contact_number: '',
  information_confirmed: false,
  consent_signer_name: '',
};

function validateStep(step: 1 | 2 | 3 | 4, d: ReturnType<typeof usePersonaWizardStore.getState>['draft']): Errors {
  const errs: Errors = {};
  if (step === 1) {
    const r = wizardStep1Schema.safeParse({
      whoFor: d.whoFor,
      relation_to_account_holder: d.relation_to_account_holder,
      terms_signer_name: d.terms_signer_name,
      terms_signer_relation: d.terms_signer_relation,
    });
    if (!r.success) r.error.issues.forEach((i) => errs[String(i.path[0])] = i.message);
    if (d.whoFor === 'myself' && d.terms_signer_relation !== 'self')
      errs['terms_signer_relation'] = 'For "Myself", signer relation must be "self".';
    if (d.date_of_birth && !isFutureDob(d.date_of_birth) && isMinorDob(d.date_of_birth) && d.terms_signer_relation === 'self')
      errs['terms_signer_relation'] = 'A minor persona cannot use signer relation "self".';
  }
  if (step === 2) {
    const r = wizardStep2Schema.safeParse({
      scope_acknowledged: d.scope_acknowledged,
      is_overseas_or_foreign: d.is_overseas_or_foreign,
      overseas_acknowledged: d.overseas_acknowledged,
    });
    if (!r.success) r.error.issues.forEach((i) => errs[String(i.path[0])] = i.message);
  }
  if (step === 3) {
    const r = wizardStep3Schema.safeParse({
      persona_name: d.persona_name,
      date_of_birth: d.date_of_birth,
      occupation: d.occupation,
      nationality: d.nationality,
      permanent_address: d.permanent_address,
      present_address: d.present_address,
      sameAsPermanent: d.sameAsPermanent,
      contact_number: d.contact_number,
      socmed_platform: d.socmed_platform,
      socmed_username: d.socmed_username,
      preferred_contact_mode: d.preferred_contact_mode,
      emergency_contact_name: d.emergency_contact_name,
      emergency_contact_relation: d.emergency_contact_relation,
      emergency_contact_number: d.emergency_contact_number,
    });
    if (!r.success) r.error.issues.forEach((i) => errs[String(i.path[0])] = i.message);
    if (!errs['contact_number'] && d.contact_number && !isValidPhone(d.contact_number, d.is_overseas_or_foreign))
      errs['contact_number'] = d.is_overseas_or_foreign
        ? 'Enter a valid international number.'
        : 'Enter a valid PH number (09XXXXXXXXX or +639XXXXXXXXX).';
    if (!errs['emergency_contact_number'] && d.emergency_contact_number && !isValidPhone(d.emergency_contact_number, d.is_overseas_or_foreign))
      errs['emergency_contact_number'] = 'Enter a valid emergency contact number.';
    if (d.socmed_username.trim() && !d.socmed_platform)
      errs['socmed_platform'] = 'Choose the platform for this username.';
  }
  if (step === 4) {
    const r = wizardStep4Schema.safeParse({
      information_confirmed: d.information_confirmed,
      consent_signer_name: d.consent_signer_name,
    });
    if (!r.success) r.error.issues.forEach((i) => errs[String(i.path[0])] = i.message);
    if (
      !errs['consent_signer_name'] &&
      normalizeName(d.terms_signer_name) &&
      normalizeName(d.consent_signer_name) &&
      normalizeName(d.terms_signer_name) !== normalizeName(d.consent_signer_name)
    )
      errs['consent_signer_name'] = 'Must match the page-1 signer name (case-insensitive).';
  }
  return errs;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-700 mt-1">
      {message}
    </p>
  );
}

export function PersonaWizardModal({ onCreated }: { onCreated?: (personaId: string) => void }) {
  const queryClient = useQueryClient();
  const { isOpen, currentStep, draft, returnTo } = usePersonaWizardStore();
  const { updateDraft, setStep, closeWizard, resetDraft, setLastUsedPersonaId } =
    usePersonaWizardStore.getState();
  const { updateIntakeDraft, publishFlowEvent } = useAppStore.getState();

  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  /**
   * When true, the next step change is a programmatic jump to a validation
   * error (not user Back/Next) — keep attempted errors + server message and
   * let focusFirstError() own focus instead of the first-field autofocus.
   */
  const keepAttemptedRef = useRef(false);

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    enabled: isOpen,
  });

  const liveErrors = useMemo(
    () => (isOpen ? validateStep(currentStep, draft) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, currentStep, JSON.stringify(draft)]
  );
  const shownErrors: Errors = attempted ? liveErrors : {};

  /**
   * Move keyboard focus to the first invalid field so the blocker is always
   * visible. Next/Submit stay clickable (validate-on-attempt) instead of
   * disabled-while-invalid, so errors can never be unreachable.
   */
  function focusFirstError() {
    window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        target.focus({ preventScroll: true });
      }
    }, 80);
  }

  function requestClose() {
    const dirty = JSON.stringify(draft) !== JSON.stringify(DEFAULT_DRAFT_SNAPSHOT);
    if (dirty) {
      const ok = window.confirm('Leave the wizard? Your progress is saved and will restore on reopen.');
      if (!ok) return;
    }
    closeWizard();
  }

  function goNext() {
    setAttempted(true);
    const errs = validateStep(currentStep, draft);
    if (Object.keys(errs).length > 0) {
      focusFirstError();
      return;
    }
    setStep((currentStep + 1) as 1 | 2 | 3 | 4);
  }

  // Focus first field on user-driven step change; Esc to attempt close.
  useEffect(() => {
    if (!isOpen) return;
    const jumpedToErrors = keepAttemptedRef.current;
    keepAttemptedRef.current = false;
    if (jumpedToErrors) return undefined;
    setAttempted(false);
    setServerError(null);
    setVersionMismatch(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draft]);

  // Preserve draft across accidental refresh (store already persists to sessionStorage).
  useEffect(() => {
    if (!isOpen) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createPersonaWithConsent({
        persona: {
          relation_to_account_holder: draft.relation_to_account_holder,
          persona_name: draft.persona_name.trim(),
          date_of_birth: draft.date_of_birth,
          occupation: draft.occupation.trim() ? draft.occupation.trim() : null,
          nationality: draft.nationality.trim(),
          permanent_address: draft.permanent_address.trim(),
          present_address: draft.present_address.trim(),
          contact_number: draft.contact_number.trim(),
          socmed_platform: draft.socmed_platform ? draft.socmed_platform : null,
          socmed_username: draft.socmed_username.trim() ? draft.socmed_username.trim() : null,
          preferred_contact_mode: draft.preferred_contact_mode,
          emergency_contact_name: draft.emergency_contact_name.trim(),
          emergency_contact_relation: draft.emergency_contact_relation.trim(),
          emergency_contact_number: draft.emergency_contact_number.trim(),
        },
        consent: {
          consent_version: getConsentVersion(),
          terms_signer_name: draft.terms_signer_name.trim(),
          terms_signer_relation: draft.terms_signer_relation,
          scope_acknowledged: draft.scope_acknowledged,
          is_overseas_or_foreign: draft.is_overseas_or_foreign,
          overseas_acknowledged: draft.is_overseas_or_foreign ? draft.overseas_acknowledged : false,
          information_confirmed: draft.information_confirmed,
          consent_signer_name: draft.consent_signer_name.trim(),
        },
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setLastUsedPersonaId(created.id);
      updateIntakeDraft({ personaId: created.id });
      publishFlowEvent(
        'Persona Created (Wizard)',
        `${created.label} created with signed consent ${getConsentVersion()}${returnTo === 'booking' ? ' and preselected for booking.' : '.'}`
      );
      resetDraft();
      clearWizardDraftStorage();
      closeWizard();
      onCreated?.(created.id);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/consent version mismatch/i.test(msg)) {
        setVersionMismatch(true);
        setServerError(msg);
        return;
      }
      const fields = parseApiFieldErrors(err);
      if (fields._form && Object.keys(fields).length === 1) {
        setServerError(fields._form);
        return;
      }
      const mapped: Errors = {};
      Object.entries(fields).forEach(([k, v]) => {
        if (k !== '_form') mapped[k.split('.').pop() || k] = v;
      });
      if (Object.keys(mapped).length > 0) {
        setAttempted(true);
        const firstField = Object.keys(fields).find((k) => k !== '_form');
        if (firstField) {
          keepAttemptedRef.current = true;
          setStep(stepForField(firstField));
        }
        setServerError('Please fix the highlighted fields.');
        focusFirstError();
      } else {
        setServerError(msg);
      }
    },
  });

  function handleSubmit() {
    setAttempted(true);
    setServerError(null);
    // Final client-side mirror of backend validation before the single POST.
    const payload = {
      persona: {
        relation_to_account_holder: draft.relation_to_account_holder,
        persona_name: draft.persona_name.trim(),
        date_of_birth: draft.date_of_birth,
        occupation: draft.occupation.trim() ? draft.occupation.trim() : null,
        nationality: draft.nationality.trim(),
        permanent_address: draft.permanent_address.trim(),
        present_address: draft.present_address.trim(),
        contact_number: draft.contact_number.trim(),
        socmed_platform: draft.socmed_platform ? draft.socmed_platform : null,
        socmed_username: draft.socmed_username.trim() ? draft.socmed_username.trim() : null,
        preferred_contact_mode: draft.preferred_contact_mode,
        emergency_contact_name: draft.emergency_contact_name.trim(),
        emergency_contact_relation: draft.emergency_contact_relation.trim(),
        emergency_contact_number: draft.emergency_contact_number.trim(),
      },
      consent: {
        consent_version: getConsentVersion(),
        terms_signer_name: draft.terms_signer_name.trim(),
        terms_signer_relation: draft.terms_signer_relation,
        scope_acknowledged: draft.scope_acknowledged,
        is_overseas_or_foreign: draft.is_overseas_or_foreign,
        overseas_acknowledged: draft.is_overseas_or_foreign ? draft.overseas_acknowledged : false,
        information_confirmed: draft.information_confirmed,
        consent_signer_name: draft.consent_signer_name.trim(),
      },
    };
    const full = personaWizardPayloadSchema.safeParse(payload);
    if (!full.success) {
      const mapped: Errors = {};
      full.error.issues.forEach((i) => {
        const leaf = String(i.path[i.path.length - 1]);
        mapped[leaf] = i.message;
      });
      const first = full.error.issues[0];
      const dotted = first.path.join('.');
      keepAttemptedRef.current = true;
      setStep(stepForField(dotted));
      setServerError('Please fix the highlighted fields.');
      focusFirstError();
      return;
    }
    if (!isValidPhone(draft.contact_number, draft.is_overseas_or_foreign)) {
      keepAttemptedRef.current = true;
      setStep(3);
      setServerError('Enter a valid contact number.');
      focusFirstError();
      return;
    }
    mutation.mutate();
  }

  const errId = (f: string) => `wiz-${currentStep}-${f}-error`;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-wizard-title"
    >
      <button
        aria-label="Close wizard (unsaved progress is kept)"
        onClick={requestClose}
        className="absolute inset-0 bg-[#25372D]/60 cursor-pointer"
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white border border-[#C0D3C3] rounded-xl shadow-xl"
      >
        {/* Header — consistent with page headers */}
        <div className="sticky top-0 bg-white border-b border-[#C0D3C3] px-5 sm:px-7 pt-5 pb-4 rounded-t-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-[#5D8B69] font-semibold">
                New Persona · Step {currentStep} of 4 · Consent {getConsentVersion()}
              </p>
              <h2 id="persona-wizard-title" className="font-heading text-2xl font-bold text-[#25372D]">
                {STEP_TITLES[currentStep - 1]}
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={requestClose} aria-label="Close wizard">
              ✕
            </Button>
          </div>
          <ol className="flex items-center gap-2 mt-3" aria-label="Wizard progress">
            {([1, 2, 3, 4] as const).map((s) => (
              <li key={s} className="flex-1">
                <div
                  className={`h-1.5 rounded-full ${s <= currentStep ? 'bg-[#5D8B69]' : 'bg-[#C0D3C3]/60'}`}
                  aria-hidden="true"
                />
                <span className="sr-only">Step {s}{s === currentStep ? ' (current)' : ''}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-5 sm:px-7 py-6 space-y-5">
          {serverError && (
            <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-300 text-sm text-red-900 space-y-2">
              <p className="font-semibold">{serverError}</p>
              {versionMismatch && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setVersionMismatch(false); setServerError(null); setStep(1); }}>
                    Reload latest terms (go to Step 1)
                  </Button>
                </div>
              )}
              {mutation.isError && !versionMismatch && (
                <Button variant="outline" size="sm" onClick={() => mutation.reset()}>
                  Dismiss &amp; retry
                </Button>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <section className="space-y-5" aria-label="Informed consent and agreement">
              <div>
                <Label htmlFor="wiz-consent-text">Informed consent text ({getConsentVersion()}) — scroll to read</Label>
                <div
                  id="wiz-consent-text"
                  tabIndex={0}
                  className="mt-1.5 max-h-48 overflow-y-auto p-4 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3] text-xs text-[#25372D]/90 leading-relaxed whitespace-pre-wrap"
                >
                  {INFORMED_CONSENT_TEXT}
                </div>
              </div>
              <div>
                <Label htmlFor="wiz-whofor">Who is this persona for?</Label>
                <Select
                  id="wiz-whofor"
                  value={draft.whoFor}
                  onChange={(e) => updateDraft({ whoFor: e.target.value as 'myself' | 'someone_else' })}
                >
                  <option value="myself">Myself</option>
                  <option value="someone_else">Someone else</option>
                </Select>
              </div>
              {draft.whoFor === 'someone_else' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wiz-relation">Relation to account holder</Label>
                    <Select
                      id="wiz-relation"
                      value={draft.relation_to_account_holder}
                      onChange={(e) => updateDraft({ relation_to_account_holder: e.target.value as typeof draft.relation_to_account_holder })}
                      aria-invalid={!!shownErrors['relation_to_account_holder']}
                      aria-describedby={shownErrors['relation_to_account_holder'] ? errId('relation') : undefined}
                    >
                      <option value="child">Child</option>
                      <option value="spouse">Spouse</option>
                      <option value="parent">Parent</option>
                      <option value="sibling">Sibling</option>
                      <option value="other">Other</option>
                    </Select>
                    <FieldError id={errId('relation')} message={shownErrors['relation_to_account_holder']} />
                  </div>
                  <div>
                    <Label htmlFor="wiz-signer-relation">Signer&apos;s relation to the client</Label>
                    <Select
                      id="wiz-signer-relation"
                      value={draft.terms_signer_relation}
                      onChange={(e) => updateDraft({ terms_signer_relation: e.target.value as typeof draft.terms_signer_relation })}
                      aria-invalid={!!shownErrors['terms_signer_relation']}
                      aria-describedby={shownErrors['terms_signer_relation'] ? errId('signer-relation') : undefined}
                    >
                      <option value="parent">Parent</option>
                      <option value="legal guardian">Legal guardian</option>
                      <option value="spouse">Spouse</option>
                      <option value="other">Other</option>
                    </Select>
                    <FieldError id={errId('signer-relation')} message={shownErrors['terms_signer_relation']} />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="wiz-signer-name">Signer full name (typed signature)</Label>
                <Input
                  id="wiz-signer-name"
                  ref={firstFieldRef}
                  value={draft.terms_signer_name}
                  onChange={(e) => updateDraft({ terms_signer_name: e.target.value })}
                  placeholder="Type full name"
                  autoComplete="off"
                  aria-invalid={!!shownErrors['terms_signer_name']}
                  aria-describedby={shownErrors['terms_signer_name'] ? errId('signer-name') : undefined}
                />
                <FieldError id={errId('signer-name')} message={shownErrors['terms_signer_name']} />
                <p className="text-xs text-[#25372D]/70 mt-1.5 leading-relaxed">{TYPING_STATEMENT}</p>
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section className="space-y-5" aria-label="Services offered and acknowledgements">
              <div className="space-y-3">
                <h3 className="font-heading text-lg font-bold text-[#25372D]">Services offered (read-only)</h3>
                <ul className="space-y-2">
                  {(services.length > 0 ? services : []).map((s) => (
                    <li key={s.id} className="p-3.5 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3]">
                      <p className="text-sm font-semibold text-[#25372D]">
                        {s.title} <span className="font-mono font-normal text-[#5D8B69]">· {s.durationLabel}</span>
                      </p>
                      <p className="text-xs text-[#25372D]/75 mt-0.5">{s.guardrailNotice}</p>
                    </li>
                  ))}
                  {services.length === 0 && (
                    <li className="p-3.5 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3] text-xs text-[#25372D]/75">
                      Service list unavailable offline — scope acknowledgement below still applies to all 7 canonical services.
                    </li>
                  )}
                </ul>
              </div>
              <label className="flex items-start gap-3 text-sm text-[#25372D] cursor-pointer p-4 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                  checked={draft.scope_acknowledged}
                  onChange={(e) => updateDraft({ scope_acknowledged: e.target.checked })}
                  aria-invalid={!!shownErrors['scope_acknowledged']}
                  aria-describedby={shownErrors['scope_acknowledged'] ? errId('scope') : undefined}
                />
                <span className="leading-relaxed text-xs">{SCOPE_ACK_TEXT}</span>
              </label>
              <FieldError id={errId('scope')} message={shownErrors['scope_acknowledged']} />
              <label className="flex items-start gap-3 text-sm text-[#25372D] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                  checked={draft.is_overseas_or_foreign}
                  onChange={(e) =>
                    updateDraft({
                      is_overseas_or_foreign: e.target.checked,
                      overseas_acknowledged: e.target.checked ? draft.overseas_acknowledged : false,
                    })
                  }
                />
                <span className="leading-relaxed text-xs">I am an overseas client or foreign national</span>
              </label>
              {draft.is_overseas_or_foreign && (
                <label className="flex items-start gap-3 text-sm text-[#25372D] cursor-pointer p-4 rounded-lg bg-[#EBF2EC] border-l-4 border-[#5D8B69]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                    checked={draft.overseas_acknowledged}
                    onChange={(e) => updateDraft({ overseas_acknowledged: e.target.checked })}
                    aria-invalid={!!shownErrors['overseas_acknowledged']}
                    aria-describedby={shownErrors['overseas_acknowledged'] ? errId('overseas') : undefined}
                  />
                  <span className="leading-relaxed text-xs">{OVERSEAS_ACK_TEXT}</span>
                </label>
              )}
              <FieldError id={errId('overseas')} message={shownErrors['overseas_acknowledged']} />
            </section>
          )}

          {currentStep === 3 && (
            <section className="space-y-4" aria-label="Demographics">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="wiz-persona-name">Full name (persona_name)</Label>
                  <Input
                    id="wiz-persona-name"
                    ref={firstFieldRef}
                    value={draft.persona_name}
                    onChange={(e) => updateDraft({ persona_name: e.target.value })}
                    autoComplete="off"
                    aria-invalid={!!shownErrors['persona_name']}
                    aria-describedby={shownErrors['persona_name'] ? errId('persona_name') : undefined}
                  />
                  <FieldError id={errId('persona_name')} message={shownErrors['persona_name']} />
                </div>
                <div>
                  <Label htmlFor="wiz-dob">Date of birth (we store DOB, never age)</Label>
                  <Input
                    id="wiz-dob"
                    type="date"
                    value={draft.date_of_birth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => updateDraft({ date_of_birth: e.target.value })}
                    aria-invalid={!!shownErrors['date_of_birth']}
                    aria-describedby={shownErrors['date_of_birth'] ? errId('dob') : undefined}
                  />
                  <FieldError id={errId('dob')} message={shownErrors['date_of_birth']} />
                </div>
                <div>
                  <Label htmlFor="wiz-occupation">Occupation (optional)</Label>
                  <Input
                    id="wiz-occupation"
                    value={draft.occupation}
                    onChange={(e) => updateDraft({ occupation: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="wiz-nationality">Nationality</Label>
                  <Input
                    id="wiz-nationality"
                    value={draft.nationality}
                    onChange={(e) => updateDraft({ nationality: e.target.value })}
                    placeholder="e.g. Filipino"
                    autoComplete="off"
                    aria-invalid={!!shownErrors['nationality']}
                    aria-describedby={shownErrors['nationality'] ? errId('nationality') : undefined}
                  />
                  <FieldError id={errId('nationality')} message={shownErrors['nationality']} />
                </div>
                <div>
                  <Label htmlFor="wiz-contact">Contact number</Label>
                  <Input
                    id="wiz-contact"
                    type="tel"
                    value={draft.contact_number}
                    onChange={(e) => updateDraft({ contact_number: e.target.value })}
                    placeholder={draft.is_overseas_or_foreign ? '+1 555 000 1234' : '09XXXXXXXXX'}
                    autoComplete="off"
                    aria-invalid={!!shownErrors['contact_number']}
                    aria-describedby={shownErrors['contact_number'] ? errId('contact') : undefined}
                  />
                  <FieldError id={errId('contact')} message={shownErrors['contact_number']} />
                </div>
              </div>
              <div>
                <Label htmlFor="wiz-perm">Permanent address</Label>
                <Textarea
                  id="wiz-perm"
                  rows={2}
                  value={draft.permanent_address}
                  onChange={(e) => updateDraft({ permanent_address: e.target.value })}
                  autoComplete="off"
                  aria-invalid={!!shownErrors['permanent_address']}
                  aria-describedby={shownErrors['permanent_address'] ? errId('perm') : undefined}
                />
                <FieldError id={errId('perm')} message={shownErrors['permanent_address']} />
              </div>
              <label className="flex items-center gap-2.5 text-xs text-[#25372D] cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                  checked={draft.sameAsPermanent}
                  onChange={(e) => updateDraft({ sameAsPermanent: e.target.checked })}
                />
                Present address same as permanent
              </label>
              <div>
                <Label htmlFor="wiz-present">Present address</Label>
                <Textarea
                  id="wiz-present"
                  rows={2}
                  value={draft.present_address}
                  disabled={draft.sameAsPermanent}
                  onChange={(e) => updateDraft({ present_address: e.target.value })}
                  autoComplete="off"
                  aria-invalid={!!shownErrors['present_address']}
                  aria-describedby={shownErrors['present_address'] ? errId('present') : undefined}
                />
                <FieldError id={errId('present')} message={shownErrors['present_address']} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="wiz-socmed-p">Social media platform (optional)</Label>
                  <Select
                    id="wiz-socmed-p"
                    value={draft.socmed_platform}
                    onChange={(e) => updateDraft({ socmed_platform: e.target.value })}
                    aria-invalid={!!shownErrors['socmed_platform']}
                    aria-describedby={shownErrors['socmed_platform'] ? errId('socmed-p') : undefined}
                  >
                    <option value="">None</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="messenger">Messenger</option>
                    <option value="tiktok">TikTok</option>
                    <option value="x">X</option>
                    <option value="other">Other</option>
                  </Select>
                  <FieldError id={errId('socmed-p')} message={shownErrors['socmed_platform']} />
                </div>
                <div>
                  <Label htmlFor="wiz-socmed-u">Username (optional)</Label>
                  <Input
                    id="wiz-socmed-u"
                    value={draft.socmed_username}
                    onChange={(e) => updateDraft({ socmed_username: e.target.value })}
                    placeholder="@username"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="wiz-pref">Preferred contact mode</Label>
                  <Select
                    id="wiz-pref"
                    value={draft.preferred_contact_mode}
                    onChange={(e) => updateDraft({ preferred_contact_mode: e.target.value as typeof draft.preferred_contact_mode })}
                  >
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="messenger">Messenger</option>
                    <option value="instagram">Instagram</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F6F9F6] border border-[#C0D3C3]">
                <div>
                  <Label htmlFor="wiz-em-name">Emergency contact name</Label>
                  <Input
                    id="wiz-em-name"
                    value={draft.emergency_contact_name}
                    onChange={(e) => updateDraft({ emergency_contact_name: e.target.value })}
                    autoComplete="off"
                    aria-invalid={!!shownErrors['emergency_contact_name']}
                    aria-describedby={shownErrors['emergency_contact_name'] ? errId('em-name') : undefined}
                  />
                  <FieldError id={errId('em-name')} message={shownErrors['emergency_contact_name']} />
                </div>
                <div>
                  <Label htmlFor="wiz-em-rel">Emergency contact relation</Label>
                  <Input
                    id="wiz-em-rel"
                    value={draft.emergency_contact_relation}
                    onChange={(e) => updateDraft({ emergency_contact_relation: e.target.value })}
                    placeholder="e.g. Mother"
                    autoComplete="off"
                    aria-invalid={!!shownErrors['emergency_contact_relation']}
                    aria-describedby={shownErrors['emergency_contact_relation'] ? errId('em-rel') : undefined}
                  />
                  <FieldError id={errId('em-rel')} message={shownErrors['emergency_contact_relation']} />
                </div>
                <div>
                  <Label htmlFor="wiz-em-num">Emergency contact number</Label>
                  <Input
                    id="wiz-em-num"
                    type="tel"
                    value={draft.emergency_contact_number}
                    onChange={(e) => updateDraft({ emergency_contact_number: e.target.value })}
                    autoComplete="off"
                    aria-invalid={!!shownErrors['emergency_contact_number']}
                    aria-describedby={shownErrors['emergency_contact_number'] ? errId('em-num') : undefined}
                  />
                  <FieldError id={errId('em-num')} message={shownErrors['emergency_contact_number']} />
                </div>
              </div>
              <p className="text-xs text-[#25372D]/65">
                Presenting concern is not collected here — it belongs to the booking step.
              </p>
            </section>
          )}

          {currentStep === 4 && (
            <section className="space-y-5" aria-label="Confirmation and final consent">
              <div className="rounded-xl border border-[#C0D3C3] overflow-hidden">
                {[
                  { title: 'Consent & agreement', step: 1 as const, rows: [
                    ['Who for', draft.whoFor === 'myself' ? 'Myself' : 'Someone else'],
                    ['Relation to account holder', draft.relation_to_account_holder],
                    ['Signer name', draft.terms_signer_name || '—'],
                    ['Signer relation', draft.terms_signer_relation],
                  ]},
                  { title: 'Services & acknowledgements', step: 2 as const, rows: [
                    ['Scope acknowledged', draft.scope_acknowledged ? 'Yes' : 'No'],
                    ['Overseas / foreign national', draft.is_overseas_or_foreign ? 'Yes' : 'No'],
                    ...(draft.is_overseas_or_foreign ? [['Overseas acknowledged', draft.overseas_acknowledged ? 'Yes' : 'No'] as [string, string]] : []),
                  ]},
                  { title: 'Demographics', step: 3 as const, rows: [
                    ['Full name', draft.persona_name || '—'],
                    ['Date of birth', draft.date_of_birth || '—'],
                    ['Contact', draft.contact_number || '—'],
                    ['Nationality', draft.nationality || '—'],
                    ['Preferred contact', draft.preferred_contact_mode],
                    ['Emergency contact', draft.emergency_contact_name ? `${draft.emergency_contact_name} (${draft.emergency_contact_relation}) · ${draft.emergency_contact_number}` : '—'],
                  ]},
                ].map((group) => (
                  <div key={group.title} className="border-b border-[#C0D3C3] last:border-b-0">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#F6F9F6]">
                      <p className="text-xs font-bold text-[#25372D]">{group.title}</p>
                      <button
                        type="button"
                        onClick={() => setStep(group.step)}
                        className="text-xs font-semibold text-[#5D8B69] hover:text-[#25372D] underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <dl className="px-4 py-2 space-y-1">
                      {group.rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 text-xs">
                          <dt className="text-[#25372D]/65">{k}</dt>
                          <dd className="font-medium text-[#25372D] text-right break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-3 text-xs text-[#25372D] cursor-pointer p-4 rounded-lg bg-[#F6F9F6] border border-[#C0D3C3]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#5D8B69] text-[#5D8B69] focus:ring-[#5D8B69]"
                  checked={draft.information_confirmed}
                  onChange={(e) => updateDraft({ information_confirmed: e.target.checked })}
                  aria-invalid={!!shownErrors['information_confirmed']}
                  aria-describedby={shownErrors['information_confirmed'] ? errId('confirm') : undefined}
                />
                <span className="leading-relaxed">
                  I confirm that the information I have provided is accurate and complete. {FINAL_CONSENT_STATEMENT}
                </span>
              </label>
              <FieldError id={errId('confirm')} message={shownErrors['information_confirmed']} />
              <div>
                <Label htmlFor="wiz-final-signer">Final consent — type full name to sign</Label>
                <Input
                  id="wiz-final-signer"
                  ref={firstFieldRef}
                  value={draft.consent_signer_name}
                  onChange={(e) => updateDraft({ consent_signer_name: e.target.value })}
                  placeholder="Must match page-1 signer name"
                  autoComplete="off"
                  aria-invalid={!!shownErrors['consent_signer_name']}
                  aria-describedby={shownErrors['consent_signer_name'] ? errId('final-signer') : undefined}
                />
                <FieldError id={errId('final-signer')} message={shownErrors['consent_signer_name']} />
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[#C0D3C3] px-5 sm:px-7 py-4 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#25372D]/65">
            {currentStep < 4 ? 'Nothing is sent until final submit.' : `Single POST /personas · consent ${getConsentVersion()}`}
          </span>
          <div className="flex items-center gap-2.5">
            {currentStep > 1 && (
              <Button variant="outline" size="md" onClick={() => setStep((currentStep - 1) as 1 | 2 | 3 | 4)} disabled={mutation.isPending}>
                Back
              </Button>
            )}
            {currentStep < 4 ? (
              <Button variant="primary" size="md" onClick={goNext} disabled={mutation.isPending}>
                Next
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={handleSubmit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Submitting…' : 'Submit persona & consent'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
