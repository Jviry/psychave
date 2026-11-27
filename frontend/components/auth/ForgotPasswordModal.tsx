'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle, Eye, EyeOff, ArrowLeft, RefreshCcw } from 'lucide-react';
import {
  forgotPasswordRequestSchema,
  forgotPasswordConfirmSchema,
  analyzePasswordStrength,
  type ForgotPasswordRequestValues,
  type ForgotPasswordConfirmValues,
  type PasswordStrength,
} from '../../lib/authSchemas';
import { authApi, AuthApiError } from '../../authApi';
import { Button, Input, Label } from '../ui/primitives';

type Step = 'request' | 'confirm';

interface ForgotPasswordModalProps {
  initialUsername?: string;
  onClose: () => void;
  onSuccess: () => void;
}

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
      <p className={`text-xs ${config.textClass}`}>{config.label} password</p>
      {hint && <p className="text-xs text-pine/60">{hint}</p>}
    </div>
  );
}

export function ForgotPasswordModal({
  initialUsername = '',
  onClose,
  onSuccess,
}: ForgotPasswordModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [unconfirmedUsername, setUnconfirmedUsername] = useState<string | null>(null);
  const [submittedUsername, setSubmittedUsername] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Trap focus and allow Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Step 1 form
  const requestForm = useForm<ForgotPasswordRequestValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { username: initialUsername },
    mode: 'onBlur',
  });

  // Step 2 form
  const confirmForm = useForm<ForgotPasswordConfirmValues>({
    resolver: zodResolver(forgotPasswordConfirmSchema),
    mode: 'onBlur',
  });

  const newPasswordValue = confirmForm.watch('newPassword', '');

  const handleRequest = async (data: ForgotPasswordRequestValues) => {
    const trimmed = data.username.trim();
    setIsLoading(true);
    setApiError(null);
    setUnconfirmedUsername(null);
    try {
      await authApi.requestForgotPassword(trimmed);
      setSubmittedUsername(trimmed);
      confirmForm.setValue('username', trimmed);
      setCooldown(60);
      setStep('confirm');
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'USER_NOT_CONFIRMED') {
        setUnconfirmedUsername(trimmed);
        setApiError(
          'Your account email must be verified before you can reset your password.'
        );
      } else if (err instanceof AuthApiError && err.status === 429) {
        if (err.retryAfter) setCooldown(err.retryAfter);
        setApiError(err.message);
      } else {
        setApiError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!submittedUsername || cooldown > 0) return;
    setIsResending(true);
    setApiError(null);
    try {
      await authApi.requestForgotPassword(submittedUsername);
      setCooldown(60);
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429 && err.retryAfter) {
        setCooldown(err.retryAfter);
      }
      setApiError(
        err instanceof Error ? err.message : 'Unable to resend reset code. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleConfirm = async (data: ForgotPasswordConfirmValues) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await authApi.confirmForgotPassword({
        username: data.username,
        newPassword: data.newPassword,
        confirmationCode: data.confirmationCode,
      });
      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-pine/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-surface-raised rounded-lg shadow-lg border border-mist p-8">
        {/* Close */}
        <button
          type="button"
          id="forgot-password-close"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-pine/40 hover:text-pine transition-colors cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <h3 id="forgot-password-title" className="font-heading text-xl font-medium text-pine mb-1">
            {step === 'request' ? 'Reset your password' : 'Enter new password'}
          </h3>
          <p className="text-sm text-pine/60">
            {step === 'request'
              ? 'Enter your username to receive a password reset verification code.'
              : 'If an account matches that username, a reset code was sent to its registered email.'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-6">
          {(['request', 'confirm'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors duration-150 ${
                step === 'confirm' || i === 0 ? 'bg-pine' : 'bg-mist/60'
              }`}
            />
          ))}
        </div>

        {apiError && (
          <div role="alert" className="mb-5 space-y-2 p-3.5 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{apiError}</p>
            </div>
            {unconfirmedUsername && (
              <div className="pl-7">
                <Button
                  id="fp-verify-email-redirect"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    router.push(
                      `/verify-email?username=${encodeURIComponent(unconfirmedUsername)}`
                    );
                  }}
                >
                  Verify your email
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'request' ? (
          <form
            id="forgot-password-request-form"
            onSubmit={requestForm.handleSubmit(handleRequest)}
            noValidate
            className="space-y-4"
          >
            <div>
              <Label htmlFor="fp-username">Username</Label>
              <Input
                id="fp-username"
                type="text"
                autoComplete="username"
                placeholder="your_username"
                aria-invalid={!!requestForm.formState.errors.username}
                {...requestForm.register('username')}
              />
              {requestForm.formState.errors.username && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {requestForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <Button
              id="fp-request-submit"
              type="submit"
              variant="dark"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send Code'
              )}
            </Button>
          </form>
        ) : (
          <form
            id="forgot-password-confirm-form"
            onSubmit={confirmForm.handleSubmit(handleConfirm)}
            noValidate
            className="space-y-4"
          >
            <input type="hidden" {...confirmForm.register('username')} />

            <div>
              <Label htmlFor="fp-code">Verification code</Label>
              <Input
                id="fp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                aria-invalid={!!confirmForm.formState.errors.confirmationCode}
                {...confirmForm.register('confirmationCode')}
                className="text-center tracking-[0.5em] font-mono"
              />
              {confirmForm.formState.errors.confirmationCode && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {confirmForm.formState.errors.confirmationCode.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="fp-new-password">New password</Label>
              <div className="relative">
                <Input
                  id="fp-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!confirmForm.formState.errors.newPassword}
                  {...confirmForm.register('newPassword')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmForm.formState.errors.newPassword ? (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {confirmForm.formState.errors.newPassword.message}
                </p>
              ) : (
                <PasswordStrengthBar
                  password={newPasswordValue}
                  userInputs={[submittedUsername || initialUsername]}
                />
              )}
            </div>

            <div>
              <Label htmlFor="fp-confirm-new-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="fp-confirm-new-password"
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!confirmForm.formState.errors.confirmNewPassword}
                  {...confirmForm.register('confirmNewPassword')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword((v) => !v)}
                  aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  {showConfirmNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmForm.formState.errors.confirmNewPassword && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {confirmForm.formState.errors.confirmNewPassword.message}
                </p>
              )}
            </div>

            <Button
              id="fp-confirm-submit"
              type="submit"
              variant="dark"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                'Reset Password'
              )}
            </Button>

            <div className="text-center pt-1">
              {cooldown > 0 ? (
                <p className="text-xs text-pine/50">
                  Resend code in <span className="font-semibold text-pine">{cooldown}s</span>
                </p>
              ) : (
                <button
                  id="fp-resend-code"
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="inline-flex items-center gap-1.5 text-xs text-sage hover:text-pine font-semibold transition-colors cursor-pointer disabled:opacity-60 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  <RefreshCcw className="w-3 h-3" />
                  {isResending ? 'Sending…' : 'Resend reset code'}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('request');
                setApiError(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-pine/50 hover:text-pine transition-colors duration-150 cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
