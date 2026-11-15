'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, MailCheck, RefreshCcw } from 'lucide-react';
import { authApi, AuthApiError } from '@/lib/authApi';
import { confirmSchema } from '@/lib/authSchemas';
import { Toast } from '@/components/auth/Toast';
import { Button, Input, Label } from '@/components/ui/primitives';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get('username') ?? '';

  const [username, setUsername] = useState(initialUsername);
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; code?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    initialUsername
      ? 'Your account email is not verified yet. Enter your 6-digit code or request a new one below.'
      : null
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setInfoMessage(null);

    const trimmedUsername = username.trim();
    const errs: { username?: string; code?: string } = {};
    if (!trimmedUsername) {
      errs.username = 'Username is required';
    }
    const parsedCode = confirmSchema.safeParse({ code: code.trim() });
    if (!parsedCode.success) {
      errs.code = parsedCode.error.issues[0]?.message ?? 'Enter a valid 6-digit code';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setIsVerifying(true);
    try {
      await authApi.confirmUser({
        username: trimmedUsername,
        confirmationCode: code.trim(),
      });
      setToast({
        message: 'Email verified! Please sign in to continue.',
        type: 'success',
      });
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        if (err.retryAfter) setCooldown(err.retryAfter);
        setApiError(err.message);
      } else {
        setApiError(
          err instanceof Error ? err.message : 'Unable to verify code. Please try again.'
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setApiError(null);
    setInfoMessage(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setFieldErrors({ username: 'Enter your username to request a verification code.' });
      return;
    }

    setFieldErrors({});
    setIsResending(true);
    try {
      await authApi.resendCode(trimmedUsername);
      setCooldown(60);
      setInfoMessage(
        'If an unverified account matches that username, a new verification code has been sent to its registered email.'
      );
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        if (err.retryAfter) setCooldown(err.retryAfter);
        setApiError(err.message);
      } else {
        setApiError(
          err instanceof Error
            ? err.message
            : 'Unable to send verification code right now. Please try again.'
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="bg-surface-raised rounded-lg border border-mist p-8 sm:p-10 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-sage/10">
            <MailCheck className="w-7 h-7 text-sage" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-medium text-pine">Verify your email</h2>
            <p className="text-sm text-pine/60 mt-1">
              Complete email verification before signing in to your account.
            </p>
          </div>
        </div>

        {apiError && (
          <div
            id="verify-email-api-error"
            role="alert"
            className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{apiError}</p>
          </div>
        )}

        {infoMessage && !apiError && (
          <div
            id="verify-email-info"
            role="status"
            className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-sunken border border-mist"
          >
            <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-0.5" />
            <p className="text-xs text-pine/80 leading-relaxed">{infoMessage}</p>
          </div>
        )}

        <form id="verify-email-form" onSubmit={handleVerify} noValidate className="space-y-4">
          <div>
            <Label htmlFor="verify-username">Username</Label>
            <Input
              id="verify-username"
              type="text"
              autoComplete="username"
              placeholder="your_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'verify-username-error' : undefined}
            />
            {fieldErrors.username && (
              <p id="verify-username-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="verify-code">Verification code</Label>
            <Input
              id="verify-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={!!fieldErrors.code}
              aria-describedby={fieldErrors.code ? 'verify-code-error' : undefined}
              className="text-center tracking-[0.5em] font-mono"
            />
            {fieldErrors.code && (
              <p id="verify-code-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.code}
              </p>
            )}
          </div>

          <Button
            id="verify-submit"
            type="submit"
            variant="dark"
            size="lg"
            className="w-full"
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify Email'
            )}
          </Button>
        </form>

        <div className="pt-1 text-center">
          {cooldown > 0 ? (
            <p className="text-xs text-pine/50">
              Resend code in <span className="font-semibold text-pine">{cooldown}s</span>
            </p>
          ) : (
            <button
              id="verify-resend-code"
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="inline-flex items-center gap-1.5 text-xs text-sage hover:text-pine font-semibold transition-colors cursor-pointer disabled:opacity-60 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              <RefreshCcw className="w-3 h-3" />
              {isResending ? 'Sending…' : 'Send / Resend verification code'}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-pine/60 pt-2 border-t border-mist">
          Already verified?{' '}
          <Link href="/login" className="text-sage hover:text-pine font-semibold transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-96 bg-surface-raised rounded-lg border border-mist" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
