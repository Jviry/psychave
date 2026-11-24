'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, RefreshCcw } from 'lucide-react';
import {
  registerSchema,
  confirmSchema,
  type ConfirmFormValues,
  analyzePasswordStrength,
  type PasswordStrength,
} from '../../../lib/authSchemas';
import {
  CONSENT_VERSION,
  FINAL_CONSENT_STATEMENT,
  INFORMED_CONSENT_TEXT,
  OVERSEAS_ACK_TEXT,
  OVERSEAS_LIMITATIONS_TEXT,
  SCOPE_ACK_TEXT,
  SCOPE_LIMITATIONS_TEXT,
  TYPING_STATEMENT,
  isFutureDob,
  isMinorDob,
  isValidPhone,
  normalizeName,
  type PreferredContactMode,
} from '../../../lib/consent';
import {
  wizardStep2Schema,
  wizardStep3Schema,
  wizardStep4Schema,
} from '../../../lib/schemas';
import { authApi } from '../../../authApi';
import { Toast } from '../../../components/auth/Toast';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  Textarea,
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
  const { strength, warning, suggestions } = analyzePasswordStrength(password, userInputs);
  const config = STRENGTH_CONFIG[strength];
  const hint = warning || suggestions[0];
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
      {hint && <p className="text-xs text-pine/60">{hint}</p>}
    </div>
  );
}

// ─── Resend Code Timer ────────────────────────────────────────────────────────
function ResendCodeButton({
  username,
  onResent,
}: {
  username: string;
  onResent: () => void;
}) {
  const [seconds, setSeconds] = useState(60);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleResend = async () => {
    setIsSending(true);
    try {
      await authApi.resendCode(username);
      setSeconds(60);
      onResent();
    } catch {
      /* silently retry */
    } finally {
      setIsSending(false);
    }
  };

  return seconds > 0 ? (
    <p className="text-xs text-pine/50 text-center">
      Resend code in <span className="font-semibold text-pine">{seconds}s</span>
    </p>
  ) : (
    <button
      id="resend-confirmation-code"
      type="button"
      onClick={handleResend}
      disabled={isSending}
      className="flex items-center gap-1.5 text-xs text-sage hover:text-pine font-semibold transition-colors cursor-pointer disabled:opacity-60 mx-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      <RefreshCcw className="w-3 h-3" />
      {isSending ? 'Sending…' : 'Resend confirmation code'}
    </button>
  );
}

// ─── Email Confirmation Step ──────────────────────────────────────────────────
function ConfirmStep({
  username,
  onConfirmed,
}: {
  username: string;
  onConfirmed: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resendToast, setResendToast] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: ConfirmFormValues) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await authApi.confirmUser({ username, confirmationCode: data.code });
      onConfirmed();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-sage/10">
          <CheckCircle2 className="w-7 h-7 text-sage" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-medium text-pine">Check your email</h3>
          <p className="text-sm text-pine/60 mt-1">
            We sent a 6-digit verification code to the email you registered with.
          </p>
        </div>
      </div>

      {apiError && (
        <div role="alert" className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
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
            maxLength={6}
            placeholder="000000"
            autoComplete="one-time-code"
            aria-invalid={!!errors.code}
            aria-describedby={errors.code ? 'confirm-code-error' : undefined}
            {...register('code')}
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
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify Email'
          )}
        </Button>
      </form>

      {resendToast && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-accent-ink font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          New code sent to your email
        </p>
      )}
      <ResendCodeButton
        username={username}
        onResent={() => {
          setResendToast(true);
          setTimeout(() => setResendToast(false), 3000);
        }}
      />
    </div>
  );
}

// ─── Registration Wizard State & Validation ──────────────────────────────────
type RegWizardStep = 1 | 2 | 3 | 4 | 5;

const REG_STEP_TITLES = [
  'Account & privacy',
  'Informed consent & agreement',
  'Services & acknowledgements',
  'Personal demographics',
  'Confirmation & final consent',
] as const;

interface RegistrationDraft {
  // Step 1: Account
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  privacyConsent: boolean;
  // Step 2: Informed consent (self-profile)
  terms_signer_name: string;
  // Step 3: Services & acknowledgements
  scope_acknowledged: boolean;
  is_overseas_or_foreign: boolean;
  overseas_acknowledged: boolean;
  // Step 4: Personal demographics
  profile_name: string;
  date_of_birth: string;
  occupation: string;
  nationality: string;
  permanent_address: string;
  present_address: string;
  sameAsPermanent: boolean;
  contact_number: string;
  socmed_platform: string;
  socmed_username: string;
  preferred_contact_mode: PreferredContactMode;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_number: string;
  // Step 5: Confirmation
  information_confirmed: boolean;
  consent_signer_name: string;
}

const INITIAL_DRAFT: RegistrationDraft = {
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  privacyConsent: false,
  terms_signer_name: '',
  scope_acknowledged: false,
  is_overseas_or_foreign: false,
  overseas_acknowledged: false,
  profile_name: '',
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

type Errors = Record<string, string>;

function validateRegStep(step: RegWizardStep, d: RegistrationDraft): Errors {
  const errs: Errors = {};
  if (step === 1) {
    const r = registerSchema.safeParse({
      email: d.email,
      username: d.username,
      password: d.password,
      confirmPassword: d.confirmPassword,
      privacyConsent: d.privacyConsent,
    });
    if (!r.success) {
      r.error.issues.forEach((i) => {
        const key = String(i.path[0]);
        if (!errs[key]) errs[key] = i.message;
      });
    }
  }
  if (step === 2) {
    if (d.terms_signer_name.trim().length < 2) {
      errs.terms_signer_name = 'Type your full name to sign the informed consent.';
    }
  }
  if (step === 3) {
    const r = wizardStep2Schema.safeParse({
      scope_acknowledged: d.scope_acknowledged,
      is_overseas_or_foreign: d.is_overseas_or_foreign,
      overseas_acknowledged: d.overseas_acknowledged,
    });
    if (!r.success) {
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    }
  }
  if (step === 4) {
    const r = wizardStep3Schema.safeParse({
      profile_name: d.profile_name,
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
    if (!r.success) {
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    }
    if (
      !errs.date_of_birth &&
      d.date_of_birth &&
      !isFutureDob(d.date_of_birth) &&
      isMinorDob(d.date_of_birth)
    ) {
      errs.date_of_birth =
        'Account holder must be at least 18 years old to register. Minors can be added as dependent profiles under an adult account.';
    }
    if (
      !errs.contact_number &&
      d.contact_number &&
      !isValidPhone(d.contact_number, d.is_overseas_or_foreign)
    ) {
      errs.contact_number = d.is_overseas_or_foreign
        ? 'Enter a valid international number.'
        : 'Enter a valid PH number (09XXXXXXXXX or +639XXXXXXXXX).';
    }
    if (
      !errs.emergency_contact_number &&
      d.emergency_contact_number &&
      !isValidPhone(d.emergency_contact_number, d.is_overseas_or_foreign)
    ) {
      errs.emergency_contact_number = 'Enter a valid emergency contact number.';
    }
    if (d.socmed_username.trim() && !d.socmed_platform) {
      errs.socmed_platform = 'Choose the platform for this username.';
    }
  }
  if (step === 5) {
    const r = wizardStep4Schema.safeParse({
      information_confirmed: d.information_confirmed,
      consent_signer_name: d.consent_signer_name,
    });
    if (!r.success) {
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    }
    if (
      !errs.consent_signer_name &&
      normalizeName(d.terms_signer_name) &&
      normalizeName(d.consent_signer_name) &&
      normalizeName(d.terms_signer_name) !== normalizeName(d.consent_signer_name)
    ) {
      errs.consent_signer_name = 'Must match your step-2 signer name (case-insensitive).';
    }
  }
  return errs;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

// ─── Main Register Page ───────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();

  const [draft, setDraft] = useState<RegistrationDraft>(INITIAL_DRAFT);
  const [wizardStep, setWizardStep] = useState<RegWizardStep>(1);
  const [attempted, setAttempted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'register' | 'confirm' | 'done'>('register');
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const updateDraft = (partial: Partial<RegistrationDraft>) => {
    setDraft((prev) => {
      let next = { ...prev, ...partial };
      if (partial.sameAsPermanent === true) {
        next = { ...next, present_address: next.permanent_address };
      }
      if (partial.permanent_address !== undefined && next.sameAsPermanent) {
        next = { ...next, present_address: partial.permanent_address };
      }
      return next;
    });
  };

  const stepErrors = attempted ? validateRegStep(wizardStep, draft) : {};

  const goNextStep = () => {
    setAttempted(true);
    setApiError(null);
    const errs = validateRegStep(wizardStep, draft);
    if (Object.keys(errs).length > 0) return;

    // Pre-fill profile_name from terms_signer_name when entering Demographics (step 4)
    if (wizardStep === 3 && !draft.profile_name.trim() && draft.terms_signer_name.trim()) {
      updateDraft({ profile_name: draft.terms_signer_name.trim() });
    }
    setAttempted(false);
    setWizardStep((s) => (s + 1) as RegWizardStep);
  };

  const goPrevStep = () => {
    setAttempted(false);
    setApiError(null);
    setWizardStep((s) => (s - 1) as RegWizardStep);
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wizardStep < 5) {
      goNextStep();
      return;
    }

    setAttempted(true);
    setApiError(null);

    // Validate all steps 1..5 in order
    for (const s of [1, 2, 3, 4, 5] as const) {
      const errs = validateRegStep(s, draft);
      if (Object.keys(errs).length > 0) {
        setWizardStep(s);
        return;
      }
    }

    setIsLoading(true);
    try {
      await authApi.registerUser({
        email: draft.email.trim(),
        username: draft.username.trim(),
        password: draft.password,
        profile: {
          relation_to_account_holder: 'self',
          profile_name: draft.profile_name.trim(),
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
          consent_version: CONSENT_VERSION,
          terms_signer_name: draft.terms_signer_name.trim(),
          terms_signer_relation: 'self',
          scope_acknowledged: draft.scope_acknowledged,
          is_overseas_or_foreign: draft.is_overseas_or_foreign,
          overseas_acknowledged: draft.is_overseas_or_foreign ? draft.overseas_acknowledged : false,
          information_confirmed: draft.information_confirmed,
          consent_signer_name: draft.consent_signer_name.trim(),
        },
      });
      setRegisteredUsername(draft.username.trim());
      setPhase('confirm');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmed = useCallback(() => {
    setPhase('done');
    setToast({
      message: 'Account confirmed! Please sign in.',
      type: 'success',
    });
    setTimeout(() => router.push('/login'), 2000);
  }, [router]);

  if (phase === 'confirm') {
    return (
      <div className="w-full max-w-md">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-surface-raised rounded-lg border border-mist p-8 sm:p-10">
          <ConfirmStep
            username={registeredUsername}
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
              Step {wizardStep} of 5 · {REG_STEP_TITLES[wizardStep - 1]}
            </p>
          </div>
          <ol className="flex items-center gap-2" aria-label="Registration progress">
            {([1, 2, 3, 4, 5] as const).map((s) => (
              <li key={s} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    s <= wizardStep ? 'bg-sage' : 'bg-mist/60'
                  }`}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  Step {s}
                  {s === wizardStep ? ' (current)' : ''}
                </span>
              </li>
            ))}
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
          {/* STEP 1: Account & Privacy */}
          {wizardStep === 1 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="register-email">Email address</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={draft.email}
                  onChange={(e) => updateDraft({ email: e.target.value })}
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
                  value={draft.username}
                  onChange={(e) => updateDraft({ username: e.target.value })}
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
                    value={draft.password}
                    onChange={(e) => updateDraft({ password: e.target.value })}
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
                {stepErrors.password ? (
                  <FieldError id="register-password-error" message={stepErrors.password} />
                ) : (
                  <PasswordStrengthBar
                    password={draft.password}
                    userInputs={[draft.email, draft.username]}
                  />
                )}
              </div>

              <div>
                <Label htmlFor="register-confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={draft.confirmPassword}
                    onChange={(e) => updateDraft({ confirmPassword: e.target.value })}
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
                    checked={draft.privacyConsent}
                    onChange={(e) => updateDraft({ privacyConsent: e.target.checked })}
                    aria-invalid={!!stepErrors.privacyConsent}
                    aria-describedby={stepErrors.privacyConsent ? 'register-consent-error' : undefined}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-pine/70 leading-relaxed">
                    I have read and agree to the{' '}
                    <span className="font-medium text-pine/80">
                      Data Privacy Policy
                    </span>{' '}
                    in accordance with{' '}
                    <span className="font-medium text-pine/80">RA 10173 (Data Privacy Act of 2012)</span>. I consent to
                    the collection and processing of my personal information for clinical and booking purposes.
                  </span>
                </label>
                <FieldError id="register-consent-error" message={stepErrors.privacyConsent} />
              </div>
            </div>
          )}

          {/* STEP 2: Informed Consent & Agreement (Self Profile) */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div className="rounded-lg bg-surface-sunken border border-mist px-4 py-3 text-xs text-pine/80 leading-relaxed">
                Your account automatically includes your personal client profile (<strong>Self</strong>). Dependents or family members can be added after registration.
              </div>
              <div>
                <Label htmlFor="reg-consent-text" variant="doc">
                  Informed consent text ({CONSENT_VERSION}) — scroll to read
                </Label>
                <div
                  id="reg-consent-text"
                  tabIndex={0}
                  className="mt-1.5 max-h-48 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap"
                >
                  {INFORMED_CONSENT_TEXT}
                </div>
              </div>
              <div>
                <Label htmlFor="reg-signer-name">Your full name (typed signature)</Label>
                <Input
                  id="reg-signer-name"
                  value={draft.terms_signer_name}
                  onChange={(e) => updateDraft({ terms_signer_name: e.target.value })}
                  placeholder="Type your full name"
                  autoComplete="name"
                  aria-invalid={!!stepErrors.terms_signer_name}
                  aria-describedby={stepErrors.terms_signer_name ? 'reg-signer-name-error' : undefined}
                />
                <FieldError id="reg-signer-name-error" message={stepErrors.terms_signer_name} />
                <p className="text-xs text-pine/70 mt-1.5 leading-relaxed">{TYPING_STATEMENT}</p>
              </div>
            </div>
          )}

          {/* STEP 3: Services & Acknowledgements */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="reg-scope-text" variant="doc">
                  Scope &amp; limitations of services — scroll to read
                </Label>
                <div
                  id="reg-scope-text"
                  tabIndex={0}
                  className="mt-1.5 max-h-48 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap"
                >
                  {SCOPE_LIMITATIONS_TEXT}
                </div>
              </div>
              <label className="flex items-start gap-3 text-sm text-pine cursor-pointer p-4 rounded-xl border border-mist hover:border-mint transition-colors">
                <Checkbox
                  id="reg-scope-ack"
                  className="mt-0.5"
                  checked={draft.scope_acknowledged}
                  onChange={(e) => updateDraft({ scope_acknowledged: e.target.checked })}
                  aria-invalid={!!stepErrors.scope_acknowledged}
                  aria-describedby={stepErrors.scope_acknowledged ? 'reg-scope-error' : undefined}
                />
                <span className="leading-relaxed text-xs">{SCOPE_ACK_TEXT}</span>
              </label>
              <FieldError id="reg-scope-error" message={stepErrors.scope_acknowledged} />

              <label className="flex items-start gap-3 text-sm text-pine cursor-pointer">
                <Checkbox
                  id="reg-overseas-flag"
                  className="mt-0.5"
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
                <div className="space-y-2">
                  <Label htmlFor="reg-overseas-text" variant="doc">
                    Limitations for overseas clients and foreign nationals — scroll to read
                  </Label>
                  <div
                    id="reg-overseas-text"
                    tabIndex={0}
                    className="max-h-48 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap"
                  >
                    {OVERSEAS_LIMITATIONS_TEXT}
                  </div>
                  <label className="flex items-start gap-3 text-sm text-pine cursor-pointer p-4 rounded-xl bg-surface-sunken border border-sage/50">
                    <Checkbox
                      id="reg-overseas-ack"
                      className="mt-0.5"
                      checked={draft.overseas_acknowledged}
                      onChange={(e) => updateDraft({ overseas_acknowledged: e.target.checked })}
                      aria-invalid={!!stepErrors.overseas_acknowledged}
                      aria-describedby={stepErrors.overseas_acknowledged ? 'reg-overseas-error' : undefined}
                    />
                    <span className="leading-relaxed text-xs">{OVERSEAS_ACK_TEXT}</span>
                  </label>
                </div>
              )}
              <FieldError id="reg-overseas-error" message={stepErrors.overseas_acknowledged} />
            </div>
          )}

          {/* STEP 4: Personal Demographics */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="reg-profile-name">Full name</Label>
                  <Input
                    id="reg-profile-name"
                    value={draft.profile_name}
                    onChange={(e) => updateDraft({ profile_name: e.target.value })}
                    autoComplete="name"
                    aria-invalid={!!stepErrors.profile_name}
                    aria-describedby={stepErrors.profile_name ? 'reg-profile-name-error' : undefined}
                  />
                  <FieldError id="reg-profile-name-error" message={stepErrors.profile_name} />
                </div>

                <div>
                  <Label htmlFor="reg-dob">Date of birth (must be 18+)</Label>
                  <Input
                    id="reg-dob"
                    type="date"
                    value={draft.date_of_birth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => updateDraft({ date_of_birth: e.target.value })}
                    aria-invalid={!!stepErrors.date_of_birth}
                    aria-describedby={stepErrors.date_of_birth ? 'reg-dob-error' : undefined}
                  />
                  <FieldError id="reg-dob-error" message={stepErrors.date_of_birth} />
                </div>

                <div>
                  <Label htmlFor="reg-occupation">Occupation (optional)</Label>
                  <Input
                    id="reg-occupation"
                    value={draft.occupation}
                    onChange={(e) => updateDraft({ occupation: e.target.value })}
                    autoComplete="organization-title"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-nationality">Nationality</Label>
                  <Input
                    id="reg-nationality"
                    value={draft.nationality}
                    onChange={(e) => updateDraft({ nationality: e.target.value })}
                    placeholder="e.g. Filipino"
                    autoComplete="off"
                    aria-invalid={!!stepErrors.nationality}
                    aria-describedby={stepErrors.nationality ? 'reg-nationality-error' : undefined}
                  />
                  <FieldError id="reg-nationality-error" message={stepErrors.nationality} />
                </div>

                <div>
                  <Label htmlFor="reg-contact">Contact number</Label>
                  <Input
                    id="reg-contact"
                    type="tel"
                    value={draft.contact_number}
                    onChange={(e) => updateDraft({ contact_number: e.target.value })}
                    placeholder={draft.is_overseas_or_foreign ? '+1 555 000 1234' : '09XXXXXXXXX'}
                    autoComplete="tel"
                    aria-invalid={!!stepErrors.contact_number}
                    aria-describedby={stepErrors.contact_number ? 'reg-contact-error' : undefined}
                  />
                  <FieldError id="reg-contact-error" message={stepErrors.contact_number} />
                </div>
              </div>

              <div>
                <Label htmlFor="reg-perm-address">Permanent address</Label>
                <Textarea
                  id="reg-perm-address"
                  rows={2}
                  value={draft.permanent_address}
                  onChange={(e) => updateDraft({ permanent_address: e.target.value })}
                  autoComplete="street-address"
                  aria-invalid={!!stepErrors.permanent_address}
                  aria-describedby={stepErrors.permanent_address ? 'reg-perm-error' : undefined}
                />
                <FieldError id="reg-perm-error" message={stepErrors.permanent_address} />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-pine cursor-pointer">
                <Checkbox
                  id="reg-same-address"
                  checked={draft.sameAsPermanent}
                  onChange={(e) => updateDraft({ sameAsPermanent: e.target.checked })}
                />
                Present address same as permanent
              </label>

              <div>
                <Label htmlFor="reg-pres-address">Present address</Label>
                <Textarea
                  id="reg-pres-address"
                  rows={2}
                  value={draft.present_address}
                  disabled={draft.sameAsPermanent}
                  onChange={(e) => updateDraft({ present_address: e.target.value })}
                  autoComplete="off"
                  aria-invalid={!!stepErrors.present_address}
                  aria-describedby={stepErrors.present_address ? 'reg-pres-error' : undefined}
                />
                <FieldError id="reg-pres-error" message={stepErrors.present_address} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="reg-socmed-platform">Social media platform (optional)</Label>
                  <Select
                    id="reg-socmed-platform"
                    value={draft.socmed_platform}
                    onChange={(e) => updateDraft({ socmed_platform: e.target.value })}
                    aria-invalid={!!stepErrors.socmed_platform}
                    aria-describedby={stepErrors.socmed_platform ? 'reg-socmed-error' : undefined}
                  >
                    <option value="">None</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="messenger">Messenger</option>
                    <option value="tiktok">TikTok</option>
                    <option value="x">X</option>
                    <option value="other">Other</option>
                  </Select>
                  <FieldError id="reg-socmed-error" message={stepErrors.socmed_platform} />
                </div>

                <div>
                  <Label htmlFor="reg-socmed-username">Username (optional)</Label>
                  <Input
                    id="reg-socmed-username"
                    value={draft.socmed_username}
                    onChange={(e) => updateDraft({ socmed_username: e.target.value })}
                    placeholder="@username"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-preferred-contact">Preferred contact mode</Label>
                  <Select
                    id="reg-preferred-contact"
                    value={draft.preferred_contact_mode}
                    onChange={(e) =>
                      updateDraft({ preferred_contact_mode: e.target.value as PreferredContactMode })
                    }
                  >
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="messenger">Messenger</option>
                    <option value="instagram">Instagram</option>
                  </Select>
                </div>
              </div>

              <div className="border-t border-mist/70 pt-4 space-y-3">
                <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                  Emergency Contact
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="reg-em-name">Contact name</Label>
                    <Input
                      id="reg-em-name"
                      value={draft.emergency_contact_name}
                      onChange={(e) => updateDraft({ emergency_contact_name: e.target.value })}
                      autoComplete="off"
                      aria-invalid={!!stepErrors.emergency_contact_name}
                      aria-describedby={stepErrors.emergency_contact_name ? 'reg-em-name-error' : undefined}
                    />
                    <FieldError id="reg-em-name-error" message={stepErrors.emergency_contact_name} />
                  </div>

                  <div>
                    <Label htmlFor="reg-em-relation">Relation</Label>
                    <Input
                      id="reg-em-relation"
                      value={draft.emergency_contact_relation}
                      onChange={(e) => updateDraft({ emergency_contact_relation: e.target.value })}
                      placeholder="e.g. Spouse"
                      autoComplete="off"
                      aria-invalid={!!stepErrors.emergency_contact_relation}
                      aria-describedby={stepErrors.emergency_contact_relation ? 'reg-em-rel-error' : undefined}
                    />
                    <FieldError id="reg-em-rel-error" message={stepErrors.emergency_contact_relation} />
                  </div>

                  <div>
                    <Label htmlFor="reg-em-number">Contact number</Label>
                    <Input
                      id="reg-em-number"
                      type="tel"
                      value={draft.emergency_contact_number}
                      onChange={(e) => updateDraft({ emergency_contact_number: e.target.value })}
                      autoComplete="off"
                      aria-invalid={!!stepErrors.emergency_contact_number}
                      aria-describedby={stepErrors.emergency_contact_number ? 'reg-em-num-error' : undefined}
                    />
                    <FieldError id="reg-em-num-error" message={stepErrors.emergency_contact_number} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Confirmation & Final Consent */}
          {wizardStep === 5 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-mist overflow-hidden">
                {[
                  {
                    title: 'Account credentials',
                    step: 1 as const,
                    rows: [
                      ['Email', draft.email || '—'],
                      ['Username', draft.username || '—'],
                    ],
                  },
                  {
                    title: 'Consent & agreement',
                    step: 2 as const,
                    rows: [
                      ['Profile relation', 'Self (Primary)'],
                      ['Signer name', draft.terms_signer_name || '—'],
                    ],
                  },
                  {
                    title: 'Services & acknowledgements',
                    step: 3 as const,
                    rows: [
                      ['Scope acknowledged', draft.scope_acknowledged ? 'Yes' : 'No'],
                      ['Overseas / foreign national', draft.is_overseas_or_foreign ? 'Yes' : 'No'],
                      ...(draft.is_overseas_or_foreign
                        ? [['Overseas acknowledged', draft.overseas_acknowledged ? 'Yes' : 'No'] as [string, string]]
                        : []),
                    ],
                  },
                  {
                    title: 'Personal demographics',
                    step: 4 as const,
                    rows: [
                      ['Full name', draft.profile_name || '—'],
                      ['Date of birth', draft.date_of_birth || '—'],
                      ['Contact', draft.contact_number || '—'],
                      ['Nationality', draft.nationality || '—'],
                      ['Preferred contact', draft.preferred_contact_mode],
                      [
                        'Emergency contact',
                        draft.emergency_contact_name
                          ? `${draft.emergency_contact_name} (${draft.emergency_contact_relation}) · ${draft.emergency_contact_number}`
                          : '—',
                      ],
                    ],
                  },
                ].map((group) => (
                  <div key={group.title} className="border-b border-mist last:border-b-0">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-mist">
                      <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                        {group.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setAttempted(false);
                          setWizardStep(group.step);
                        }}
                        className="text-xs font-medium text-sage hover:text-pine transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded"
                      >
                        Edit
                      </button>
                    </div>
                    <dl className="px-4 py-2 space-y-1">
                      {group.rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 text-xs">
                          <dt className="text-pine/65">{k}</dt>
                          <dd className="font-medium text-pine text-right break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 py-1">
                <Checkbox
                  id="reg-confirm-checkbox"
                  checked={draft.information_confirmed}
                  onChange={(e) => updateDraft({ information_confirmed: e.target.checked })}
                  aria-invalid={!!stepErrors.information_confirmed}
                  aria-describedby={stepErrors.information_confirmed ? 'reg-confirm-info-error' : undefined}
                />
                <label htmlFor="reg-confirm-checkbox" className="text-xs text-pine leading-relaxed cursor-pointer">
                  I confirm that the information I have provided is accurate and complete.{' '}
                  {FINAL_CONSENT_STATEMENT}
                </label>
              </div>
              <FieldError id="reg-confirm-info-error" message={stepErrors.information_confirmed} />

              <div>
                <Label htmlFor="reg-final-signer">Final consent — type your full name to sign</Label>
                <Input
                  id="reg-final-signer"
                  value={draft.consent_signer_name}
                  onChange={(e) => updateDraft({ consent_signer_name: e.target.value })}
                  placeholder="Must match step-2 signer name"
                  autoComplete="off"
                  aria-invalid={!!stepErrors.consent_signer_name}
                  aria-describedby={stepErrors.consent_signer_name ? 'reg-final-signer-error' : undefined}
                />
                <FieldError id="reg-final-signer-error" message={stepErrors.consent_signer_name} />
              </div>
            </div>
          )}

          {/* Wizard Navigation */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {wizardStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goPrevStep}
                disabled={isLoading}
              >
                Back
              </Button>
            ) : (
              <span />
            )}

            {wizardStep < 5 ? (
              <Button
                id="register-next"
                type="button"
                variant="dark"
                size="lg"
                onClick={goNextStep}
              >
                Continue
              </Button>
            ) : (
              <Button
                id="register-submit"
                type="submit"
                variant="dark"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
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
        <p className="mt-6 text-center text-sm text-pine/60">
          Already have an account?{' '}
          <Link href="/login" id="go-to-login" className="text-sage hover:text-pine font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
