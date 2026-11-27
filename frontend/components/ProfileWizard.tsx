'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import {
  CONSENT_VERSION,
  DEFAULT_WIZARD_PAGES,
  parseApiFieldErrors,
} from '../lib/consent';
import {
  buildDynamicWizardPayloads,
  findStepIndexForField,
  getEffectiveWizardPages,
  validateWizardPage,
  type WizardErrors,
} from '../lib/wizardEngine';
import type { Profile } from '../lib/types';
import { useAppStore } from '../stores/useAppStore';
import { useAuthStore } from '../stores/authStore';
import {
  clearWizardDraftStorage,
  DEFAULT_WIZARD_DRAFT,
  getDraftLookupMap,
  useProfileWizardStore,
  type WizardReturnTo,
} from '../stores/useProfileWizardStore';
import { DynamicWizardPage } from './DynamicWizardPage';
import { Button } from './ui/primitives';

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
  const authUser = useAuthStore((s) => s.user);
  const {
    mode: storeMode,
    resignProfile: storeResignProfile,
    currentStep,
    draft,
    returnTo: storeReturnTo,
  } = useProfileWizardStore();
  const {
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
  const [extraErrors, setExtraErrors] = useState<WizardErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const keepAttemptedRef = useRef(false);

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    storeSetFieldValue(fieldKey, value);
    setExtraErrors((prev) => {
      if (!(fieldKey in prev)) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const { data: activeForm } = useQuery({
    queryKey: ['consentForm', 'active'],
    queryFn: () => api.getActiveConsentForm(),
    retry: false,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    retry: false,
  });

  const activeConsentVersion = activeForm?.consentVersion || CONSENT_VERSION;
  const allCmsPages = useMemo(
    () =>
      activeForm?.wizardPages && activeForm.wizardPages.length > 0
        ? activeForm.wizardPages
        : DEFAULT_WIZARD_PAGES,
    [activeForm]
  );

  const pages = useMemo(
    () => getEffectiveWizardPages(allCmsPages, { resignOnly: mode === 'resign' }),
    [allCmsPages, mode]
  );

  const totalSteps = pages.length;
  const safeStep = Math.min(Math.max(1, currentStep), totalSteps);
  const currentPage = pages[safeStep - 1] || pages[0];
  const isSelf =
    mode === 'resign' && draft.relation_to_account_holder === 'self';

  const lookupValues = useMemo(() => getDraftLookupMap(draft), [draft]);

  const liveErrors = useMemo(
    () =>
      currentPage
        ? validateWizardPage(currentPage, pages, lookupValues, {
            isSelf,
            resignOnly: mode === 'resign',
          })
        : {},
    [currentPage, pages, lookupValues, isSelf, mode]
  );

  const stepErrors: WizardErrors = attempted
    ? { ...extraErrors, ...liveErrors }
    : {};

  function focusFirstError() {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      if (typeof document === 'undefined') return;
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

  function goNextStep() {
    setAttempted(true);
    setExtraErrors({});
    setServerError(null);
    const errs = currentPage
      ? validateWizardPage(currentPage, pages, lookupValues, {
          isSelf,
          resignOnly: mode === 'resign',
        })
      : {};
    if (Object.keys(errs).length > 0) {
      focusFirstError();
      return;
    }
    setAttempted(false);
    setStep(Math.min(totalSteps, safeStep + 1));
  }

  function goPrevStep() {
    setAttempted(false);
    setExtraErrors({});
    setServerError(null);
    setStep(Math.max(1, safeStep - 1));
  }

  useEffect(() => {
    const jumpedToErrors = keepAttemptedRef.current;
    keepAttemptedRef.current = false;
    if (jumpedToErrors) return;
    setAttempted(false);
    setExtraErrors({});
    setServerError(null);
    setVersionMismatch(false);
  }, [safeStep]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const mutation = useMutation({
    mutationFn: () => {
      const payloads = buildDynamicWizardPayloads(allCmsPages, lookupValues, {
        isSelf,
        consentVersion: activeConsentVersion,
        fallbackProfileName: resignProfile?.label || '',
      });
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
        mode === 'resign' ? 'Consent Re-Signed' : 'Profile Created',
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
      const mapped: WizardErrors = {};
      Object.entries(fields).forEach(([k, v]) => {
        if (k !== '_form') mapped[k.split('.').pop() || k] = v;
      });
      if (Object.keys(mapped).length > 0) {
        setAttempted(true);
        setExtraErrors(mapped);
        const firstField = Object.keys(fields).find((k) => k !== '_form');
        if (firstField) {
          const targetStep = findStepIndexForField(firstField, pages);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    if (safeStep < totalSteps) {
      goNextStep();
      return;
    }

    setAttempted(true);
    setExtraErrors({});
    setServerError(null);

    for (let idx = 0; idx < pages.length; idx += 1) {
      const errs = validateWizardPage(pages[idx], pages, lookupValues, {
        isSelf,
        resignOnly: mode === 'resign',
      });
      if (Object.keys(errs).length > 0) {
        keepAttemptedRef.current = true;
        setStep(idx + 1);
        setServerError('Please fix the highlighted fields.');
        focusFirstError();
        return;
      }
    }

    mutation.mutate();
  }

  const backLabel = returnTo === 'booking' ? 'Back to booking' : 'Back to profiles';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <button
        type="button"
        onClick={requestLeave}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/70 hover:text-pine transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        {backLabel}
      </button>

      <div
        data-wizard-panel
        className="bg-surface-raised rounded-lg border border-mist p-6 sm:p-10"
      >
        {/* Header & Progress (matches Account Creation) */}
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="font-heading text-2xl font-medium text-pine mb-1">
              {mode === 'resign' && resignProfile
                ? `Re-sign consent for ${resignProfile.label}`
                : 'Create a profile'}
            </h1>
            <p className="text-sm text-pine/60">
              Step {safeStep} of {totalSteps} · {currentPage?.title}
            </p>
          </div>
          <ol className="flex items-center gap-2" aria-label="Profile creation progress">
            {pages.map((page, idx) => {
              const s = idx + 1;
              return (
                <li key={page.pageId} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      s <= safeStep ? 'bg-sage' : 'bg-mist/60'
                    }`}
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
        </div>

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
                className="mb-6 flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-2 text-sm text-red-800">
                  <p>{serverError}</p>
                  {versionMismatch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVersionMismatch(false);
                        setServerError(null);
                        setStep(1);
                      }}
                    >
                      Reload latest terms
                    </Button>
                  )}
                </div>
              </div>
            )}

            <form
              id="profile-wizard-form"
              onSubmit={handleSubmit}
              noValidate
              className="space-y-5"
            >
              {currentPage && (
                <DynamicWizardPage
                  page={currentPage}
                  allPages={pages}
                  values={lookupValues}
                  errors={stepErrors}
                  isSelf={isSelf}
                  consentVersion={activeConsentVersion}
                  services={services}
                  onChange={handleFieldChange}
                  onJumpToStep={(step) => {
                    setAttempted(false);
                    setStep(step);
                  }}
                  idPrefix="prof"
                  resignOnly={mode === 'resign'}
                />
              )}

              {/* Navigation */}
              <div className="pt-2 flex items-center justify-between gap-3">
                {safeStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={goPrevStep}
                    disabled={mutation.isPending}
                  >
                    Back
                  </Button>
                ) : (
                  <span />
                )}

                {safeStep < totalSteps ? (
                  <Button
                    key="wizard-next"
                    type="button"
                    variant="dark"
                    size="lg"
                    onClick={(e) => {
                      e.preventDefault();
                      goNextStep();
                    }}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    key="wizard-submit"
                    type="submit"
                    variant="dark"
                    size="lg"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Saving…
                      </>
                    ) : mode === 'resign' ? (
                      'Submit Signed Consent'
                    ) : (
                      'Create Profile'
                    )}
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
