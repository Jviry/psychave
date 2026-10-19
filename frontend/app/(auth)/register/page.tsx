'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, RefreshCcw, Check } from 'lucide-react';
import {
  registerSchema,
  confirmSchema,
  type RegisterFormValues,
  type ConfirmFormValues,
  getPasswordStrength,
  type PasswordStrength,
} from '../../../lib/authSchemas';
import { authApi } from '../../../authApi';
import { Toast } from '../../../components/auth/Toast';
import { Button, Checkbox, Input, Label } from '../../../components/ui/primitives';

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

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);
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
  role,
  onConfirmed,
}: {
  username: string;
  role: 'client' | 'psychologist';
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
      {/* Success icon */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-sage/10">
          <CheckCircle2 className="w-7 h-7 text-sage" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-medium text-pine">Check your email</h3>
          <p className="text-sm text-pine/60 mt-1">
            We sent a 6-digit verification code to the email you registered with.
          </p>
          {role === 'psychologist' && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Psychologist accounts</span> require admin credential
                verification before you can access the queue. You&apos;ll be notified once approved.
              </p>
            </div>
          )}
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

// ─── Main Register Page ───────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [step, setStep] = useState<'register' | 'confirm' | 'done'>('register');
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [registeredRole, setRegisteredRole] = useState<'client' | 'psychologist'>('client');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { role: 'client' },
  });

  const passwordValue = watch('password', '');
  const selectedRole = watch('role', 'client');

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await authApi.registerUser({
        email: data.email,
        username: data.username,
        password: data.password,
        role: data.role,
      });
      setRegisteredUsername(data.username);
      setRegisteredRole(data.role);
      setStep('confirm');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmed = useCallback(() => {
    setStep('done');
    setToast({
      message:
        registeredRole === 'psychologist'
          ? 'Account confirmed! Await admin approval to access the queue.'
          : 'Account confirmed! Please sign in.',
      type: 'success',
    });
    setTimeout(() => router.push('/login'), 2000);
  }, [registeredRole, router]);

  if (step === 'confirm') {
    return (
      <div className="w-full max-w-md">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-surface-raised rounded-lg border border-mist p-8 sm:p-10">
          <ConfirmStep
            username={registeredUsername}
            role={registeredRole}
            onConfirmed={handleConfirmed}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-surface-raised rounded-lg border border-mist p-8 sm:p-10">
        {/* Header */}
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-medium text-pine mb-1.5">Create your account</h2>
          <p className="text-sm text-pine/60">Join PsychAve PH to get started</p>
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

        <form id="register-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

          {/* Role Selector */}
          <div>
            <Label>I am registering as</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'client', label: 'Client', desc: 'Seeking psychological support' },
                { value: 'psychologist', label: 'Psychologist', desc: 'Provider — PRC-licensed' },
              ].map(({ value, label, desc }) => {
                const isSelected = selectedRole === value;
                return (
                  <label
                    key={value}
                    className={`relative flex flex-col gap-0.5 p-3.5 rounded-lg border cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? 'border-sage bg-sage/5'
                        : 'border-mist hover:border-mint bg-surface-raised'
                    }`}
                  >
                    <input
                      type="radio"
                      value={value}
                      id={`role-${value}`}
                      {...register('role')}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-pine">{label}</span>
                    <span className="text-xs text-pine/55">{desc}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-sage flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} aria-hidden="true" />
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
            {errors.role && (
              <p role="alert" className="mt-1.5 text-xs text-red-600">{errors.role.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="register-email">Email address</Label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="register-email-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="register-username">Username</Label>
            <Input
              id="register-username"
              type="text"
              autoComplete="username"
              placeholder="your_username"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'register-username-error' : 'register-username-hint'}
              {...register('username')}
            />
            {errors.username ? (
              <p id="register-username-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.username.message}
              </p>
            ) : (
              <p id="register-username-hint" className="mt-1.5 text-xs text-pine/50">
                3–30 characters. Letters, numbers, underscores, hyphens only.
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="register-password">Password</Label>
            <div className="relative">
              <Input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
                {...register('password')}
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
            {errors.password ? (
              <p id="register-password-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.password.message}
              </p>
            ) : (
              <PasswordStrengthBar password={passwordValue} />
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="register-confirm-password">Confirm password</Label>
            <div className="relative">
              <Input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
                {...register('confirmPassword')}
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
            {errors.confirmPassword && (
              <p id="register-confirm-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Privacy Consent */}
          <div>
            <label
              htmlFor="register-privacy-consent"
              className={`flex items-start gap-3 cursor-pointer group ${errors.privacyConsent ? 'opacity-100' : ''}`}
            >
              <Checkbox
                id="register-privacy-consent"
                aria-invalid={!!errors.privacyConsent}
                aria-describedby={errors.privacyConsent ? 'register-consent-error' : undefined}
                {...register('privacyConsent')}
                className="mt-0.5"
              />
              <span className="text-xs text-pine/70 leading-relaxed">
                I have read and agree to the{' '}
                <a
                  href="/#ra-10173-consent"
                  className="text-sage hover:text-pine underline font-medium focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2"
                >
                  Data Privacy Policy
                </a>{' '}
                in accordance with{' '}
                <span className="font-medium text-pine/80">RA 10173 (Data Privacy Act of 2012)</span>. I consent to
                the collection and processing of my personal information for clinical and booking purposes.
              </span>
            </label>
            {errors.privacyConsent && (
              <p id="register-consent-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.privacyConsent.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            id="register-submit"
            type="submit"
            variant="dark"
            size="lg"
            className="w-full"
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
