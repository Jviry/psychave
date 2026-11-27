'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, Check, CheckCircle2, RefreshCcw } from 'lucide-react';
import {
  registerSchema,
  confirmSchema,
  type ConfirmFormValues,
  analyzePasswordStrength,
  type PasswordStrength,
} from '../../../lib/authSchemas';
import {
  CONSENT_VERSION,
  DEFAULT_WIZARD_PAGES,
  INFORMED_CONSENT_TEXT,
} from '../../../lib/consent';
import {
  buildDynamicWizardPayloads,
  validateWizardPage,
  type WizardErrors,
  type WizardValues,
} from '../../../lib/wizardEngine';
import { authApi } from '../../../authApi';
import { getFriendlyErrorMessage } from '../../../lib/errorMessages';
import { api } from '../../../lib/api';
import type { ConsentFormTemplate, ServiceItem } from '../../../lib/types';
import { Toast } from '../../../components/auth/Toast';
import { DynamicWizardPage } from '../../../components/DynamicWizardPage';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Modal,
} from '../../../components/ui/primitives';

// ─── Password Strength Indicator ─────────────────────────────────────────────
const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; trackClass: string; textClass: string; width: string }
> = {
  weak: { label: 'Weak', trackClass: 'bg-red-500', textClass: 'text-red-600', width: '25%' },
  fair: { label: 'Fair', trackClass: 'bg-amber-500', textClass: 'text-amber-600', width: '50%' },
  good: { label: 'Good', trackClass: 'bg-sage', textClass: 'text-accent-ink', width: '75%' },
  strong: { label: 'Strong', trackClass: 'bg-pine', textClass: 'text-pine', width: '100%' },
};

function PasswordStrengthBar({
  password,
  userInputs,
}: {
  password: string;
  userInputs?: string[];
}) {
  if (!password) return null;
  const { strength } = analyzePasswordStrength(password, userInputs);
  const config = STRENGTH_CONFIG[strength];
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1 rounded-full bg-mist overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${config.trackClass}`}
          style={{ width: config.width }}
        />
      </div>
      <p className={`text-xs ${config.textClass}`}>
        {config.label} password
      </p>
    </div>
  );
}

// ─── Resend Code Timer ────────────────────────────────────────────────────────
function ResendCodeButton({
  username,
  onResent,
  onError,
}: {
  username: string;
  onResent: () => void;
  onError: (message: string) => void;
}) {
  const [seconds, setSeconds] = useState(60);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleResend = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await authApi.resendCode(username);
      setSeconds(60);
      onResent();
    } catch (err) {
      onError(
        getFriendlyErrorMessage(
          err,
          'Could not resend the verification code. Please try again in a moment.'
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  return seconds > 0 ? (
    <p className="text-xs text-pine/70 text-center">
      Resend code in <span className="font-semibold text-pine">{seconds}s</span>
    </p>
  ) : (
    <button
      id="resend-confirmation-code"
      type="button"
      onClick={handleResend}
      disabled={isSending}
      className="flex items-center gap-1.5 text-xs text-accent-ink hover:text-pine font-semibold transition-colors cursor-pointer disabled:opacity-60 mx-auto py-2 px-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      <RefreshCcw className="w-3 h-3" aria-hidden="true" />
      {isSending ? 'Sending…' : 'Resend confirmation code'}
    </button>
  );
}

// ─── Email Confirmation Step ──────────────────────────────────────────────────
function ConfirmStep({
  username,
  email,
  onConfirmed,
}: {
  username: string;
  email: string;
  onConfirmed: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resendToast, setResendToast] = useState(false);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    mode: 'onBlur',
  });

  const codeField = register('code');

  const onSubmit = async (data: ConfirmFormValues) => {
    if (isLoading) return;
    setIsLoading(true);
    setApiError(null);
    try {
      await authApi.confirmUser({ username, confirmationCode: data.code });
      onConfirmed();
    } catch (err) {
      setApiError(
        getFriendlyErrorMessage(
          err,
          'That verification code could not be confirmed. Please double-check the 6 digits and try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-sage/10">
          <CheckCircle2 className="w-7 h-7 text-accent-ink" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-medium text-pine">Check your email</h2>
          <p className="text-sm text-pine/75 mt-1">
            {email ? (
              <>
                We sent a 6-digit verification code to{' '}
                <strong className="font-semibold text-pine break-all">{email}</strong>.
              </>
            ) : (
              'We sent a 6-digit verification code to the email you registered with.'
            )}
          </p>
        </div>
      </div>

      {apiError && (
        <div role="alert" className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-800">{apiError}</p>
        </div>
      )}

      <form id="confirm-email-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <Label htmlFor="confirm-code">Verification code</Label>
          <Input
            id="confirm-code"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            autoComplete="one-time-code"
            aria-invalid={!!errors.code}
            aria-describedby={errors.code ? 'confirm-code-error' : undefined}
            {...codeField}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              setValue('code', digits, { shouldValidate: !!errors.code });
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              const digits = pasted.replace(/\D/g, '').slice(0, 6);
              if (digits) {
                e.preventDefault();
                setValue('code', digits, { shouldValidate: true });
              }
            }}
            className="text-center tracking-[0.5em] font-mono"
          />
          {errors.code && (
            <p id="confirm-code-error" role="alert" className="mt-1.5 text-xs text-red-600">
              {errors.code.message}
            </p>
          )}
        </div>

        <Button
          id="confirm-submit"
          type="submit"
          variant="dark"
          size="lg"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Verifying…
            </>
          ) : (
            'Verify Email'
          )}
        </Button>
      </form>

      {resendToast && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-1.5 text-xs text-accent-ink font-medium"
        >
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          New code sent to your email
        </p>
      )}

      <div className="space-y-2 text-center">
        <ResendCodeButton
          username={username}
          onResent={() => {
            setApiError(null);
            setResendToast(true);
            if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
            resendTimerRef.current = setTimeout(() => setResendToast(false), 3000);
          }}
          onError={(msg) => {
            setResendToast(false);
            setApiError(msg);
          }}
        />
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

// ─── Registration Draft State ─────────────────────────────────────────────────
interface AccountDraft {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  privacyConsent: boolean;
}

const INITIAL_ACCOUNT_DRAFT: AccountDraft = {
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  privacyConsent: false,
};

const INITIAL_WIZARD_VALUES: WizardValues = {
  relation_to_account_holder: 'self',
  terms_signer_relation: 'self',
  preferred_contact_mode: 'phone',
  sameAsPermanent: false,
  is_overseas_or_foreign: false,
  overseas_acknowledged: false,
  scope_acknowledged: false,
  information_confirmed: false,
};

const REGISTER_DRAFT_STORAGE_KEY = 'psychave_register_draft_v4';

interface PersistedRegisterState {
  wizardValues: WizardValues;
  account: Omit<AccountDraft, 'password' | 'confirmPassword'>;
  wizardStep: number;
  phase: 'register' | 'confirm';
  registeredUsername: string;
  registeredEmail: string;
}

function validateAccountStep(account: AccountDraft): WizardErrors {
  const errs: WizardErrors = {};
  const r = registerSchema.safeParse({
    email: account.email,
    username: account.username,
    password: account.password,
    confirmPassword: account.confirmPassword,
    privacyConsent: account.privacyConsent,
  });
  if (!r.success) {
    r.error.issues.forEach((i) => {
      const key = String(i.path[0]);
      if (!errs[key]) errs[key] = i.message;
    });
  }
  return errs;
}

// ─── Main Register Page ───────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();

  const [wizardValues, setWizardValues] = useState<WizardValues>(INITIAL_WIZARD_VALUES);
  const [account, setAccount] = useState<AccountDraft>(INITIAL_ACCOUNT_DRAFT);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [attempted, setAttempted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityErrors, setAvailabilityErrors] = useState<{
    email?: string;
    username?: string;
  }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'register' | 'confirm' | 'done'>('register');
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTemplate, setActiveTemplate] = useState<ConsentFormTemplate | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getActiveConsentForm()
      .then((tpl) => {
        if (!cancelled) setActiveTemplate(tpl);
      })
      .catch(() => {
        // Fallback to static DEFAULT_WIZARD_PAGES if template fetch fails.
      });
    api
      .getServices()
      .then((list) => {
        if (!cancelled) setServices(list);
      })
      .catch(() => {
        // Services list is optional in the form preview.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cmsPages = useMemo(
    () =>
      activeTemplate?.wizardPages && activeTemplate.wizardPages.length > 0
        ? activeTemplate.wizardPages
        : DEFAULT_WIZARD_PAGES,
    [activeTemplate]
  );

  const totalSteps = cmsPages.length + 1;
  const accountStepNumber = totalSteps;
  const safeStep = Math.min(Math.max(1, wizardStep), totalSteps);
  const isAccountStep = safeStep === accountStepNumber;
  const currentCmsPage = !isAccountStep ? cmsPages[safeStep - 1] : null;

  const liveConsentVersion = activeTemplate?.consentVersion || CONSENT_VERSION;
  const liveInformedConsentText =
    activeTemplate?.informedConsentText || INFORMED_CONSENT_TEXT;

  const stepTitles = useMemo(
    () => [...cmsPages.map((p) => p.title), 'Account & privacy'],
    [cmsPages]
  );

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedRegisterState>;
        if (parsed.wizardValues) {
          setWizardValues((prev) => ({
            ...prev,
            ...parsed.wizardValues,
            relation_to_account_holder: 'self',
            terms_signer_relation: 'self',
          }));
        }
        if (parsed.account) {
          setAccount((prev) => ({
            ...prev,
            ...parsed.account,
            password: '',
            confirmPassword: '',
          }));
        }
        if (typeof parsed.wizardStep === 'number' && parsed.wizardStep >= 1) {
          setWizardStep(parsed.wizardStep);
        }
        if (parsed.phase === 'confirm' && parsed.registeredUsername) {
          setPhase('confirm');
          setRegisteredUsername(parsed.registeredUsername);
          setRegisteredEmail(parsed.registeredEmail ?? parsed.account?.email ?? '');
        }
      }
    } catch {
      // Ignore storage read errors in restricted browsers
    } finally {
      setHydrated(true);
    }

    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || phase === 'done') return;
    try {
      const { password: _pw, confirmPassword: _cpw, ...safeAccount } = account;
      const payload: PersistedRegisterState = {
        wizardValues,
        account: safeAccount,
        wizardStep: safeStep,
        phase,
        registeredUsername,
        registeredEmail,
      };
      window.sessionStorage.setItem(
        REGISTER_DRAFT_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Ignore storage write errors in restricted browsers
    }
  }, [hydrated, wizardValues, account, safeStep, phase, registeredUsername, registeredEmail]);

  const clearPersistedDraft = useCallback(() => {
    try {
      window.sessionStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }
  }, []);

  const handleWizardFieldChange = (fieldKey: string, value: unknown) => {
    setWizardValues((prev) => {
      const next: WizardValues = { ...prev, [fieldKey]: value };
      if (fieldKey === 'sameAsPermanent' && value === true) {
        next.present_address = String(next.permanent_address ?? '');
      }
      if (fieldKey === 'permanent_address' && next.sameAsPermanent) {
        next.present_address = String(value ?? '');
      }
      if (fieldKey === 'is_overseas_or_foreign' && value === false) {
        next.overseas_acknowledged = false;
      }
      return next;
    });
  };

  const updateAccount = (partial: Partial<AccountDraft>) => {
    if (partial.email !== undefined || partial.username !== undefined) {
      setAvailabilityErrors((prev) => {
        if (!prev.email && !prev.username) return prev;
        return {
          ...(partial.email === undefined ? { email: prev.email } : {}),
          ...(partial.username === undefined ? { username: prev.username } : {}),
        };
      });
    }
    setAccount((prev) => ({ ...prev, ...partial }));
  };

  const baseStepErrors: WizardErrors = attempted
    ? isAccountStep
      ? validateAccountStep(account)
      : currentCmsPage
        ? validateWizardPage(currentCmsPage, cmsPages, wizardValues, { isSelf: true })
        : {}
    : {};

  const stepErrors: WizardErrors = isAccountStep
    ? {
        ...(availabilityErrors.email ? { email: availabilityErrors.email } : {}),
        ...(availabilityErrors.username ? { username: availabilityErrors.username } : {}),
        ...baseStepErrors,
      }
    : baseStepErrors;

  const goNextStep = async () => {
    if (isCheckingAvailability) return;
    setAttempted(true);
    setApiError(null);
    const errs = currentCmsPage
      ? validateWizardPage(currentCmsPage, cmsPages, wizardValues, { isSelf: true })
      : {};
    if (Object.keys(errs).length > 0) return;

    setAttempted(false);
    setWizardStep(Math.min(totalSteps, safeStep + 1));
  };

  const goPrevStep = () => {
    setAttempted(false);
    setAvailabilityErrors({});
    setApiError(null);
    setWizardStep(Math.max(1, safeStep - 1));
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isCheckingAvailability) return;
    if (!isAccountStep) {
      await goNextStep();
      return;
    }

    setAttempted(true);
    setApiError(null);

    // Validate all dynamic CMS pages 1..N in order
    for (let idx = 0; idx < cmsPages.length; idx += 1) {
      const errs = validateWizardPage(cmsPages[idx], cmsPages, wizardValues, {
        isSelf: true,
      });
      if (Object.keys(errs).length > 0) {
        setWizardStep(idx + 1);
        return;
      }
    }

    // Validate final account step
    const accountErrs = validateAccountStep(account);
    if (Object.keys(accountErrs).length > 0) {
      return;
    }

    setIsCheckingAvailability(true);
    setAvailabilityErrors({});
    try {
      const res = await authApi.checkAvailability({
        email: account.email.trim(),
        username: account.username.trim(),
      });
      if (!res.emailAvailable || !res.usernameAvailable) {
        setAvailabilityErrors({
          ...(!res.emailAvailable
            ? { email: 'An account with this email is already registered.' }
            : {}),
          ...(!res.usernameAvailable
            ? { username: 'This username is already taken.' }
            : {}),
        });
        return;
      }
    } catch (err) {
      setApiError(
        getFriendlyErrorMessage(
          err,
          'Could not verify email and username availability. Please try again.'
        )
      );
      return;
    } finally {
      setIsCheckingAvailability(false);
    }

    setIsLoading(true);
    try {
      const { profile, consent } = buildDynamicWizardPayloads(
        cmsPages,
        wizardValues,
        {
          isSelf: true,
          consentVersion: liveConsentVersion,
        }
      );
      await authApi.registerUser({
        email: account.email.trim(),
        username: account.username.trim(),
        password: account.password,
        profile,
        consent,
      });
      setRegisteredUsername(account.username.trim());
      setRegisteredEmail(account.email.trim());
      setPhase('confirm');
    } catch (err) {
      setApiError(
        getFriendlyErrorMessage(err, 'Registration failed. Please check your details and try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmed = useCallback(() => {
    clearPersistedDraft();
    setPhase('done');
    setToast({
      message: 'Account confirmed! Please sign in.',
      type: 'success',
    });
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    redirectTimerRef.current = setTimeout(() => router.push('/login'), 2500);
  }, [clearPersistedDraft, router]);

  if (phase === 'done') {
    return (
      <div className="w-full max-w-md">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-surface-raised rounded-2xl border border-mist p-8 sm:p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-sage/15 mx-auto">
            <CheckCircle2 className="w-7 h-7 text-accent-ink" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Your account is verified
            </h2>
            <p className="text-sm text-pine/75">
              You&apos;re all set. Sign in with your username and password to access your
              dashboard.
            </p>
          </div>
          <Button
            type="button"
            variant="dark"
            size="lg"
            className="w-full"
            onClick={() => {
              if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
              router.push('/login');
            }}
          >
            Continue to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="w-full max-w-md">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-surface-raised rounded-2xl border border-mist p-8 sm:p-10">
          <ConfirmStep
            username={registeredUsername}
            email={registeredEmail || account.email.trim()}
            onConfirmed={handleConfirmed}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-surface-raised rounded-lg border border-mist p-6 sm:p-10">
        {/* Header & Progress */}
        <div className="mb-6 space-y-3">
          <div>
            <h2 className="font-heading text-2xl font-medium text-pine mb-1">Create your account</h2>
            <p className="text-sm text-pine/60">
              Step {safeStep} of {totalSteps} · {stepTitles[safeStep - 1]}
            </p>
          </div>
          <ol className="flex items-center gap-2" aria-label="Registration progress">
            {stepTitles.map((title, idx) => {
              const s = idx + 1;
              return (
                <li key={`${s}-${title}`} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      s <= safeStep ? 'bg-sage' : 'bg-mist/60'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    Step {s}: {title}
                    {s === safeStep ? ' (current)' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div
            id="register-api-error"
            role="alert"
            className="mb-6 flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{apiError}</p>
          </div>
        )}

        <form id="register-form" onSubmit={handleSubmitRegistration} noValidate className="space-y-5">
          {/* STEPS 1..N: Dynamic CMS Profile & Consent Pages */}
          {!isAccountStep && currentCmsPage && (
            <DynamicWizardPage
              page={currentCmsPage}
              allPages={cmsPages}
              values={wizardValues}
              errors={stepErrors}
              isSelf={true}
              consentVersion={liveConsentVersion}
              services={services}
              onChange={handleWizardFieldChange}
              onJumpToStep={(step) => {
                setAttempted(false);
                setWizardStep(step);
              }}
              idPrefix="reg"
            />
          )}

          {/* FINAL STEP (N + 1): Account & Privacy */}
          {isAccountStep && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="register-email">Email address</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={account.email}
                  onChange={(e) => updateAccount({ email: e.target.value })}
                  aria-invalid={!!stepErrors.email}
                  aria-describedby={stepErrors.email ? 'register-email-error' : undefined}
                />
                <FieldError id="register-email-error" message={stepErrors.email} />
              </div>

              <div>
                <Label htmlFor="register-username">Username</Label>
                <Input
                  id="register-username"
                  type="text"
                  autoComplete="username"
                  placeholder="your_username"
                  value={account.username}
                  onChange={(e) => updateAccount({ username: e.target.value })}
                  aria-invalid={!!stepErrors.username}
                  aria-describedby={stepErrors.username ? 'register-username-error' : 'register-username-hint'}
                />
                {stepErrors.username ? (
                  <FieldError id="register-username-error" message={stepErrors.username} />
                ) : (
                  <p id="register-username-hint" className="mt-1.5 text-xs text-pine/50">
                    3–30 characters. Letters, numbers, underscores, hyphens only.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="register-password">Password</Label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={account.password}
                    onChange={(e) => updateAccount({ password: e.target.value })}
                    aria-invalid={!!stepErrors.password}
                    aria-describedby={stepErrors.password ? 'register-password-error' : undefined}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    id="register-toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine transition-colors cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError id="register-password-error" message={stepErrors.password} />
                <PasswordStrengthBar
                  password={account.password}
                  userInputs={[account.email, account.username]}
                />
                <ul
                  id="register-password-requirements"
                  className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs"
                  aria-label="Password requirements"
                >
                  {[
                    { label: 'At least 8 characters', met: account.password.length >= 8 },
                    { label: 'One uppercase letter (A–Z)', met: /[A-Z]/.test(account.password) },
                    { label: 'One number (0–9)', met: /[0-9]/.test(account.password) },
                    { label: 'One special character (e.g. !@#$)', met: /[^A-Za-z0-9]/.test(account.password) },
                  ].map((rule) => (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 ${
                        rule.met ? 'text-accent-ink font-medium' : 'text-pine/70'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 ${
                          rule.met ? 'text-accent-ink' : 'text-pine/30'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Label htmlFor="register-confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={account.confirmPassword}
                    onChange={(e) => updateAccount({ confirmPassword: e.target.value })}
                    aria-invalid={!!stepErrors.confirmPassword}
                    aria-describedby={stepErrors.confirmPassword ? 'register-confirm-error' : undefined}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    id="register-toggle-confirm-password"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine transition-colors cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError id="register-confirm-error" message={stepErrors.confirmPassword} />
              </div>

              <div>
                <label
                  htmlFor="register-privacy-consent"
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <Checkbox
                    id="register-privacy-consent"
                    checked={account.privacyConsent}
                    onChange={(e) => updateAccount({ privacyConsent: e.target.checked })}
                    aria-invalid={!!stepErrors.privacyConsent}
                    aria-describedby={stepErrors.privacyConsent ? 'register-consent-error' : undefined}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-pine/75 leading-relaxed">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPrivacyModalOpen(true);
                      }}
                      className="font-semibold text-accent-ink underline underline-offset-2 hover:text-pine cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                    >
                      Data Privacy Policy
                    </button>{' '}
                    in accordance with{' '}
                    <span className="font-medium text-pine">RA 10173 (Data Privacy Act of 2012)</span>. I consent to
                    the collection and processing of my personal information for clinical and booking purposes.
                  </span>
                </label>
                <FieldError id="register-consent-error" message={stepErrors.privacyConsent} />
              </div>
            </div>
          )}

          {/* Wizard Navigation */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {safeStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goPrevStep}
                disabled={isLoading || isCheckingAvailability}
              >
                Back
              </Button>
            ) : (
              <span />
            )}

            {!isAccountStep ? (
              <Button
                key="register-next"
                id="register-next"
                type="button"
                variant="dark"
                size="lg"
                onClick={(e) => {
                  e.preventDefault();
                  void goNextStep();
                }}
                disabled={isCheckingAvailability}
              >
                {isCheckingAvailability ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            ) : (
              <Button
                key="register-submit"
                id="register-submit"
                type="submit"
                variant="dark"
                size="lg"
                disabled={isLoading || isCheckingAvailability}
              >
                {isCheckingAvailability ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking…
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            )}
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-pine/75">
          Already have an account?{' '}
          <Link href="/login" id="go-to-login" className="text-accent-ink hover:text-pine font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      {/* Data Privacy Policy Modal */}
      <Modal
        open={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        title="Data Privacy Policy (RA 10173)"
        description="How PsychAve PH collects, protects, and uses your personal and clinical information."
        maxWidth="lg"
        footer={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsPrivacyModalOpen(false)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs text-pine/85 leading-relaxed">
          <p>
            In compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>{' '}
            and the Psychological Association of the Philippines (PAP) Code of Ethics, your account
            and intake details are collected solely to coordinate bookings and provide confidential
            psychological care.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-mist bg-parchment p-4 whitespace-pre-wrap text-pine/90">
            {liveInformedConsentText}
          </div>
        </div>
      </Modal>
    </div>
  );
}
