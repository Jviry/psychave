'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import {
  CONSENT_VERSION,
  DEFAULT_WIZARD_PAGES,
  isFutureDob,
  isMinorDob,
  isValidPhone,
  isWizardBlockVisible,
  normalizeName,
  parseApiFieldErrors,
  stepForField,
} from '../lib/consent';
import type { Profile, WizardBlock, WizardPage } from '../lib/types';
import { useAppStore } from '../stores/useAppStore';
import {
  clearWizardDraftStorage,
  DEFAULT_WIZARD_DRAFT,
  getDraftFieldValue,
  getDraftLookupMap,
  useProfileWizardStore,
  type ProfileWizardDraft,
  type WizardReturnTo,
} from '../stores/useProfileWizardStore';
import { Button, Card, Checkbox, Input, Label, Select, Textarea } from './ui/primitives';

type Errors = Record<string, string>;

const INPUT_TYPES = new Set([
  'text',
  'textarea',
  'date',
  'phone',
  'select',
  'checkbox',
]);

function isConsentOrResignPage(page: WizardPage): boolean {
  return page.blocks.some(
    (b) =>
      b.target === 'consent' ||
      b.target === 'custom' ||
      b.type === 'scrollable_doc' ||
      b.type === 'review_summary' ||
      b.blockId === 'final_consent_doc'
  );
}

function validateDynamicPage(
  page: WizardPage,
  allPages: WizardPage[],
  d: ProfileWizardDraft,
  mode: 'create' | 'resign'
): Errors {
  const errs: Errors = {};
  const isSelf = d.relation_to_account_holder === 'self';
  const lookup = getDraftLookupMap(d);

  for (const block of page.blocks) {
    if (!INPUT_TYPES.has(block.type) || !block.fieldKey) continue;
    if (mode === 'resign' && block.target === 'profile') {
      continue;
    }
    if (!isWizardBlockVisible(block, isSelf, lookup)) continue;

    const key = block.fieldKey;
    const val = getDraftFieldValue(d, key);

    if (block.type === 'checkbox') {
      if (block.required && val !== true) {
        errs[key] = `${block.label} is required.`;
      }
      continue;
    }

    const strVal = val == null ? '' : String(val).trim();
    if (block.required && strVal.length === 0) {
      errs[key] =
        key === 'terms_signer_name'
          ? 'Type the full name of the person signing consent.'
          : `${block.label} is required.`;
      continue;
    }
    if (strVal.length === 0) continue;

    if (block.type === 'date' || key === 'date_of_birth') {
      if (Number.isNaN(new Date(strVal).getTime())) {
        errs[key] = 'Enter a valid date.';
      } else if (key === 'date_of_birth' && isFutureDob(strVal)) {
        errs[key] = 'Date of birth cannot be in the future.';
      }
    } else if (block.type === 'phone') {
      const isOverseas = Boolean(lookup.is_overseas_or_foreign);
      if (!isValidPhone(strVal, isOverseas)) {
        errs[key] = isOverseas
          ? 'Enter a valid international number.'
          : 'Enter a valid PH number (09XXXXXXXXX or +639XXXXXXXXX).';
      }
    } else if (
      (block.type === 'text' || block.type === 'textarea') &&
      block.required &&
      strVal.length < 2
    ) {
      errs[key] =
        key === 'terms_signer_name'
          ? 'Type the full name of the person signing consent.'
          : `${block.label} must be at least 2 characters.`;
    }

    if (key === 'terms_signer_relation') {
      if (d.relation_to_account_holder === 'self' && strVal !== 'self') {
        errs[key] = 'For "Self", signer relation must be "self".';
      } else if (
        d.date_of_birth &&
        !isFutureDob(d.date_of_birth) &&
        isMinorDob(d.date_of_birth) &&
        strVal === 'self'
      ) {
        errs[key] = 'A minor profile cannot use signer relation "self".';
      }
    }

    if (key === 'consent_signer_name') {
      const hasTermsSigner = allPages.some((p) =>
        p.blocks.some(
          (b) =>
            b.fieldKey === 'terms_signer_name' &&
            isWizardBlockVisible(b, isSelf, lookup)
        )
      );
      if (
        hasTermsSigner &&
        normalizeName(d.terms_signer_name) &&
        normalizeName(strVal) &&
        normalizeName(d.terms_signer_name) !== normalizeName(strVal)
      ) {
        errs[key] = 'Must match the page-1 signer name (case-insensitive).';
      }
    }
  }

  const hasSocmedUserOnPage = page.blocks.some(
    (b) => b.fieldKey === 'socmed_username'
  );
  if (
    mode === 'create' &&
    hasSocmedUserOnPage &&
    d.socmed_username.trim() &&
    !d.socmed_platform
  ) {
    errs['socmed_platform'] = 'Choose the platform for this username.';
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

export function ProfileWizard({
  returnTo: propReturnTo,
  resignProfile: propResignProfile,
  onCreated,
  onCancel,
}: {
  returnTo?: WizardReturnTo;
  resignProfile?: Profile | null;
  onCreated?: (profileId: string) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    mode: storeMode,
    resignProfile: storeResignProfile,
    currentStep,
    draft,
    returnTo: storeReturnTo,
  } = useProfileWizardStore();
  const {
    updateDraft: storeUpdateDraft,
    setFieldValue: storeSetFieldValue,
    openResignWizard,
    setStep,
    resetDraft,
    setLastUsedProfileId,
  } = useProfileWizardStore.getState();
  const { updateBookingDraft, publishFlowEvent } = useAppStore.getState();

  const returnTo = propReturnTo ?? storeReturnTo;
  const resignProfile = propResignProfile ?? storeResignProfile;
  const mode = resignProfile ? 'resign' : storeMode;

  useEffect(() => {
    if (propResignProfile && storeResignProfile?.id !== propResignProfile.id) {
      openResignWizard(propResignProfile, propReturnTo ?? null);
    }
  }, [propResignProfile, storeResignProfile?.id, propReturnTo, openResignWizard]);

  const [attempted, setAttempted] = useState(false);
  const [extraErrors, setExtraErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const keepAttemptedRef = useRef(false);

  const updateDraft = (partial: Partial<ProfileWizardDraft>) => {
    storeUpdateDraft(partial);
    const keys = Object.keys(partial);
    if (keys.length > 0) {
      setExtraErrors((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        const next = { ...prev };
        let changed = false;
        for (const k of keys) {
          if (k in next) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  };

  const setFieldValue = (fieldKey: string, value: unknown) => {
    storeSetFieldValue(fieldKey, value);
    setExtraErrors((prev) => {
      if (!(fieldKey in prev)) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const { data: activeForm } = useQuery({
    queryKey: ['consentForm', 'active'],
    queryFn: () => api.getActiveConsentForm(),
    retry: false,
  });

  const activeConsentVersion = activeForm?.consentVersion || CONSENT_VERSION;
  const allWizardPages = useMemo(() => {
    const rawPages = activeForm?.wizardPages;
    return Array.isArray(rawPages) && rawPages.length > 0
      ? rawPages
      : DEFAULT_WIZARD_PAGES;
  }, [activeForm]);

  const activePages = useMemo(() => {
    if (mode === 'resign') {
      const filtered = allWizardPages.filter(isConsentOrResignPage);
      return filtered.length > 0 ? filtered : allWizardPages;
    }
    return allWizardPages;
  }, [allWizardPages, mode]);

  const totalSteps = activePages.length;
  const safeStep = Math.min(Math.max(1, currentStep), totalSteps);
  const currentPage = activePages[safeStep - 1] || activePages[0];

  const isSelf = draft.relation_to_account_holder === 'self';
  const lookupMap = useMemo(() => getDraftLookupMap(draft), [draft]);

  const liveErrors = useMemo(
    () =>
      currentPage
        ? validateDynamicPage(currentPage, activePages, draft, mode)
        : {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeStep, mode, currentPage, activePages, JSON.stringify(draft)]
  );
  const shownErrors: Errors = attempted ? { ...extraErrors, ...liveErrors } : {};

  function focusFirstError() {
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        '[data-wizard-panel] [aria-invalid="true"]'
      );
      if (target) {
        target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        target.focus({ preventScroll: true });
      }
    }, 80);
  }

  function requestLeave() {
    const dirty =
      mode === 'create' &&
      JSON.stringify(draft) !== JSON.stringify(DEFAULT_WIZARD_DRAFT);
    if (dirty) {
      setConfirmingLeave(true);
      return;
    }
    if (mode === 'resign') {
      resetDraft();
    }
    onCancel?.();
  }

  function goNext() {
    setAttempted(true);
    setExtraErrors({});
    setServerError(null);
    const errs = validateDynamicPage(currentPage, activePages, draft, mode);
    if (Object.keys(errs).length > 0) {
      focusFirstError();
      return;
    }
    setStep(Math.min(totalSteps, safeStep + 1));
  }

  useEffect(() => {
    const jumpedToErrors = keepAttemptedRef.current;
    keepAttemptedRef.current = false;
    if (jumpedToErrors) return undefined;
    setAttempted(false);
    setExtraErrors({});
    setServerError(null);
    setVersionMismatch(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [safeStep]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  function buildSubmissionPayloads() {
    const details: Record<string, unknown> = {};
    const responses: Record<string, unknown> = {};

    for (const page of allWizardPages) {
      for (const block of page.blocks) {
        if (!INPUT_TYPES.has(block.type) || !block.fieldKey) continue;
        if (block.target === 'ui') continue;
        if (!isWizardBlockVisible(block, isSelf, lookupMap)) continue;

        const key = block.fieldKey;
        const rawVal = getDraftFieldValue(draft, key);
        const val = typeof rawVal === 'string' ? rawVal.trim() : rawVal ?? null;

        if (block.target === 'profile') {
          if (
            ![
              'relation_to_account_holder',
              'profile_name',
              'date_of_birth',
              'socmed_platform',
              'socmed_username',
            ].includes(key)
          ) {
            details[key] = val === '' && !block.required ? null : val;
          }
        } else {
          responses[key] = val;
        }
      }
    }

    const profilePayload = {
      relation_to_account_holder: draft.relation_to_account_holder,
      profile_name: draft.profile_name.trim(),
      date_of_birth: draft.date_of_birth,
      occupation: draft.occupation.trim() ? draft.occupation.trim() : null,
      nationality: draft.nationality.trim(),
      permanent_address: draft.permanent_address.trim(),
      present_address: draft.present_address.trim(),
      contact_number: draft.contact_number.trim(),
      socmed_platform: draft.socmed_platform ? draft.socmed_platform : null,
      socmed_username: draft.socmed_username.trim()
        ? draft.socmed_username.trim()
        : null,
      preferred_contact_mode: draft.preferred_contact_mode,
      emergency_contact_name: draft.emergency_contact_name.trim(),
      emergency_contact_relation: draft.emergency_contact_relation.trim(),
      emergency_contact_number: draft.emergency_contact_number.trim(),
      details,
    };

    const consentPayload = {
      consent_version: activeConsentVersion,
      terms_signer_name: draft.terms_signer_name.trim(),
      terms_signer_relation: draft.terms_signer_relation,
      scope_acknowledged: draft.scope_acknowledged,
      is_overseas_or_foreign: draft.is_overseas_or_foreign,
      overseas_acknowledged: draft.is_overseas_or_foreign
        ? draft.overseas_acknowledged
        : false,
      information_confirmed: draft.information_confirmed,
      consent_signer_name: draft.consent_signer_name.trim(),
      responses,
    };

    return { profile: profilePayload, consent: consentPayload };
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payloads = buildSubmissionPayloads();
      if (mode === 'resign' && resignProfile) {
        return api.resignProfileConsent(resignProfile.id, payloads.consent);
      }
      return api.createProfileWithConsent(payloads);
    },
    onSuccess: (resultProfile) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setLastUsedProfileId(resultProfile.id);
      updateBookingDraft({ profileId: resultProfile.id });
      publishFlowEvent(
        mode === 'resign' ? 'Consent Re-Signed' : 'Profile Created (Wizard)',
        mode === 'resign'
          ? `${resultProfile.label} re-signed updated consent ${activeConsentVersion}.`
          : `${resultProfile.label} created with signed consent ${activeConsentVersion}${
              returnTo === 'booking' ? ' and preselected for booking.' : '.'
            }`
      );
      resetDraft();
      clearWizardDraftStorage();
      onCreated?.(resultProfile.id);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/consent form is outdated|consent version mismatch/i.test(msg)) {
        setVersionMismatch(true);
        setServerError(msg);
        queryClient.invalidateQueries({ queryKey: ['consentForm', 'active'] });
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
        setExtraErrors(mapped);
        const firstField = Object.keys(fields).find((k) => k !== '_form');
        if (firstField) {
          const targetStep = stepForField(firstField, activePages);
          if (targetStep !== safeStep) {
            keepAttemptedRef.current = true;
            setStep(targetStep);
          }
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
    setExtraErrors({});
    setServerError(null);

    for (let idx = 0; idx < activePages.length; idx += 1) {
      const pageErrs = validateDynamicPage(
        activePages[idx],
        activePages,
        draft,
        mode
      );
      if (Object.keys(pageErrs).length > 0) {
        keepAttemptedRef.current = true;
        setStep(idx + 1);
        setServerError('Please fix the highlighted fields.');
        focusFirstError();
        return;
      }
    }

    mutation.mutate();
  }

  const errId = (f: string) => `wiz-${safeStep}-${f}-error`;
  const backLabel = returnTo === 'booking' ? 'Back to booking' : 'Back to profiles';

  let assignedFirstRef = false;

  const renderInputBlock = (block: WizardBlock) => {
    const key = block.fieldKey || block.blockId;
    if (mode === 'resign' && block.target === 'profile') {
      return null;
    }

    const inputId = `wiz-field-${block.blockId}`;
    const errMessage = shownErrors[key];
    const val = getDraftFieldValue(draft, key);
    const attachRef = !assignedFirstRef;
    if (attachRef && block.type !== 'checkbox' && block.type !== 'select') {
      assignedFirstRef = true;
    }

    if (block.type === 'checkbox') {
      const isChecked = Boolean(val);
      return (
        <div key={block.blockId} className="space-y-1">
          <label
            htmlFor={inputId}
            className="flex items-start gap-3 text-sm text-pine cursor-pointer p-3.5 rounded-xl border border-mist hover:border-mint transition-colors"
          >
            <Checkbox
              id={inputId}
              className="mt-0.5"
              checked={isChecked}
              onChange={(e) => setFieldValue(key, e.target.checked)}
              aria-invalid={!!errMessage}
              aria-describedby={errMessage ? errId(key) : undefined}
            />
            <span className="leading-relaxed text-xs">{block.label}</span>
          </label>
          {block.helperText && (
            <p className="text-xs text-pine/65 pl-1">{block.helperText}</p>
          )}
          <FieldError id={errId(key)} message={errMessage} />
        </div>
      );
    }

    if (block.type === 'select') {
      const strVal = val == null ? '' : String(val);
      return (
        <div key={block.blockId}>
          <Label htmlFor={inputId}>
            {block.label}
            {block.required ? ' *' : ''}
          </Label>
          <Select
            id={inputId}
            value={strVal}
            onChange={(e) => setFieldValue(key, e.target.value)}
            aria-invalid={!!errMessage}
            aria-describedby={errMessage ? errId(key) : undefined}
          >
            {!block.options.some((o) => o.value === strVal) && strVal === '' && (
              <option value="">Select an option…</option>
            )}
            {block.options.map((opt) => (
              <option key={`${block.blockId}-${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {block.helperText && (
            <p className="text-xs text-pine/70 mt-1 leading-relaxed">
              {block.helperText}
            </p>
          )}
          <FieldError id={errId(key)} message={errMessage} />
        </div>
      );
    }

    if (block.type === 'textarea') {
      const strVal = val == null ? '' : String(val);
      const isPresentAddress = key === 'present_address';
      const hasPermanentOnPage = currentPage.blocks.some(
        (b) => b.fieldKey === 'permanent_address'
      );
      return (
        <div key={block.blockId} className="space-y-2">
          {isPresentAddress && hasPermanentOnPage && (
            <label className="flex items-center gap-2.5 text-xs text-pine cursor-pointer">
              <Checkbox
                checked={draft.sameAsPermanent}
                onChange={(e) =>
                  updateDraft({ sameAsPermanent: e.target.checked })
                }
              />
              Present address same as permanent
            </label>
          )}
          <div>
            <Label htmlFor={inputId}>
              {block.label}
              {block.required ? ' *' : ''}
            </Label>
            <Textarea
              id={inputId}
              rows={2}
              value={strVal}
              disabled={isPresentAddress && draft.sameAsPermanent}
              placeholder={block.placeholder || undefined}
              onChange={(e) => setFieldValue(key, e.target.value)}
              autoComplete="off"
              aria-invalid={!!errMessage}
              aria-describedby={errMessage ? errId(key) : undefined}
            />
            {block.helperText && (
              <p className="text-xs text-pine/70 mt-1 leading-relaxed">
                {block.helperText}
              </p>
            )}
            <FieldError id={errId(key)} message={errMessage} />
          </div>
        </div>
      );
    }

    const strVal = val == null ? '' : String(val);
    const htmlType =
      block.type === 'date' ? 'date' : block.type === 'phone' ? 'tel' : 'text';

    return (
      <div key={block.blockId}>
        <Label htmlFor={inputId}>
          {block.label}
          {block.required ? ' *' : ''}
        </Label>
        <Input
          id={inputId}
          ref={attachRef ? firstFieldRef : undefined}
          type={htmlType}
          value={strVal}
          max={
            block.type === 'date' && key === 'date_of_birth'
              ? new Date().toISOString().slice(0, 10)
              : undefined
          }
          placeholder={block.placeholder || undefined}
          onChange={(e) => setFieldValue(key, e.target.value)}
          autoComplete="off"
          aria-invalid={!!errMessage}
          aria-describedby={errMessage ? errId(key) : undefined}
        />
        {block.helperText && (
          <p className="text-xs text-pine/70 mt-1.5 leading-relaxed">
            {block.helperText}
          </p>
        )}
        <FieldError id={errId(key)} message={errMessage} />
      </div>
    );
  };

  const renderReviewSummaryBlock = (block: WizardBlock) => {
    const groups = activePages
      .map((page, pageIdx) => {
        const rows: [string, string][] = [];
        for (const b of page.blocks) {
          if (!INPUT_TYPES.has(b.type) || !b.fieldKey) continue;
          if (!isWizardBlockVisible(b, isSelf, lookupMap)) continue;
          if (mode === 'resign' && b.target === 'profile') continue;
          if (page.pageId === currentPage.pageId) continue;

          const raw = getDraftFieldValue(draft, b.fieldKey);
          let formatted = '—';
          if (b.type === 'checkbox') {
            formatted = raw ? 'Yes' : 'No';
          } else if (b.type === 'select') {
            const match = b.options.find((o) => o.value === String(raw ?? ''));
            formatted = match ? match.label : String(raw || '—');
          } else if (raw != null && String(raw).trim() !== '') {
            formatted = String(raw);
          }
          rows.push([b.label, formatted]);
        }
        return { title: page.title, step: pageIdx + 1, rows };
      })
      .filter((g) => g.rows.length > 0);

    return (
      <div key={block.blockId} className="rounded-lg border border-mist overflow-hidden">
        {groups.map((group) => (
          <div
            key={`${group.title}-${group.step}`}
            className="border-b border-mist last:border-b-0"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-mist">
              <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                {group.title}
              </p>
              <button
                type="button"
                onClick={() => setStep(group.step)}
                className="text-xs font-medium text-sage hover:text-pine transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded"
              >
                Edit
              </button>
            </div>
            <dl className="px-4 py-2 space-y-1">
              {group.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-xs">
                  <dt className="text-pine/65">{k}</dt>
                  <dd className="font-medium text-pine text-right break-words">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  };

  const renderBlock = (block: WizardBlock) => {
    if (block.blockId === 'who_for') return null;
    if (!isWizardBlockVisible(block, isSelf, lookupMap)) return null;

    if (block.type === 'scrollable_doc') {
      const docId = `wiz-doc-${block.blockId}`;
      return (
        <div key={block.blockId}>
          <Label htmlFor={docId} variant="doc">
            {block.label} ({activeConsentVersion})
          </Label>
          <div
            id={docId}
            tabIndex={0}
            className="mt-1.5 max-h-48 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap"
          >
            {block.content}
          </div>
        </div>
      );
    }

    if (block.type === 'services_list') {
      return (
        <div key={block.blockId} className="space-y-3">
          <h3 className="font-heading text-lg font-medium text-pine">
            {block.label}
          </h3>
          <ul className="space-y-2">
            {services.map((s) => (
              <li
                key={s.id}
                className="p-3.5 rounded-lg bg-parchment border border-mist"
              >
                <p className="text-sm font-semibold text-pine">
                  {s.title}{' '}
                  <span className="font-normal text-accent-ink">
                    · {s.durationLabel}
                  </span>
                </p>
                {s.guardrailNotice && (
                  <p className="text-xs text-pine/75 mt-0.5">
                    {s.guardrailNotice}
                  </p>
                )}
              </li>
            ))}
            {services.length === 0 && (
              <li className="p-3.5 rounded-lg bg-parchment border border-mist text-xs text-pine/75">
                Service list unavailable offline — scope acknowledgement below
                still applies to all active services.
              </li>
            )}
          </ul>
        </div>
      );
    }

    if (block.type === 'section_heading') {
      return (
        <div
          key={block.blockId}
          className="border-t border-mist/70 pt-4 space-y-1"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
            {block.label}
          </span>
          {block.content && (
            <p className="text-xs text-pine/70">{block.content}</p>
          )}
        </div>
      );
    }

    if (block.type === 'info_text') {
      return (
        <div
          key={block.blockId}
          className="p-3.5 rounded-lg bg-surface-sunken border border-mist text-xs text-pine/85 leading-relaxed"
        >
          {block.content || block.label}
        </div>
      );
    }

    if (block.type === 'review_summary') {
      return renderReviewSummaryBlock(block);
    }

    return renderInputBlock(block);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={requestLeave}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          {backLabel}
        </button>
        <div className="space-y-1">
          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine">
            {currentPage?.title || 'Profile & Consent'}
          </h1>
          <p className="text-sm text-pine/70">
            {mode === 'resign' && resignProfile
              ? `Re-sign Consent (${resignProfile.label}) · Step ${safeStep} of ${totalSteps} · Consent ${activeConsentVersion}`
              : `New Profile · Step ${safeStep} of ${totalSteps} · Consent ${activeConsentVersion}`}
          </p>
        </div>
      </header>

      <Card className="p-6 sm:p-8 space-y-6">
        <div data-wizard-panel className="space-y-5">
          {/* Wizard progress */}
          <ol className="flex items-center gap-2" aria-label="Wizard progress">
            {activePages.map((page, idx) => {
              const s = idx + 1;
              return (
                <li key={page.pageId} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full ${s <= safeStep ? 'bg-sage' : 'bg-mist/60'}`}
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    Step {s}: {page.title}
                    {s === safeStep ? ' (current)' : ''}
                  </span>
                </li>
              );
            })}
          </ol>

          {confirmingLeave ? (
            <section
              className="py-10 text-center space-y-5"
              role="alertdialog"
              aria-label="Confirm leaving wizard"
            >
              <p className="font-heading text-xl font-medium text-pine">
                Leave profile creation?
              </p>
              <p className="text-sm text-pine/70 max-w-md mx-auto leading-relaxed">
                Your progress is saved and will restore when you return.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setConfirmingLeave(false)}
                >
                  Keep editing
                </Button>
                <Button
                  variant="dark"
                  size="md"
                  onClick={() => {
                    setConfirmingLeave(false);
                    onCancel?.();
                  }}
                >
                  Leave page
                </Button>
              </div>
            </section>
          ) : (
            <>
              {serverError && (
                <div
                  role="alert"
                  className="p-4 rounded-lg bg-red-50 border border-red-300 text-sm text-red-900 space-y-2"
                >
                  <p className="font-semibold">{serverError}</p>
                  {versionMismatch && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVersionMismatch(false);
                          setServerError(null);
                          setStep(1);
                        }}
                      >
                        Reload latest terms (go to Step 1)
                      </Button>
                    </div>
                  )}
                  {mutation.isError && !versionMismatch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => mutation.reset()}
                    >
                      Dismiss &amp; retry
                    </Button>
                  )}
                </div>
              )}

              <section className="space-y-5" aria-label={currentPage?.title}>
                {currentPage?.description && (
                  <p className="text-xs text-pine/70">{currentPage.description}</p>
                )}
                {currentPage?.blocks.map(renderBlock)}
              </section>
            </>
          )}
        </div>

        {!confirmingLeave && (
          <div className="pt-4 border-t border-mist flex flex-wrap items-center justify-end gap-3">
            <span className="mr-auto text-xs text-pine/65">
              {safeStep < totalSteps
                ? 'Nothing is sent until final submit.'
                : mode === 'resign'
                ? `POST /profiles/:id/consent · consent ${activeConsentVersion}`
                : `Single POST /profiles · consent ${activeConsentVersion}`}
            </span>
            {safeStep > 1 && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setStep(safeStep - 1)}
                disabled={mutation.isPending}
              >
                Back
              </Button>
            )}
            {safeStep < totalSteps ? (
              <Button
                variant="primary"
                size="md"
                onClick={goNext}
                disabled={mutation.isPending}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? 'Submitting…'
                  : mode === 'resign'
                  ? 'Re-sign & update consent'
                  : 'Submit profile & consent'}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
