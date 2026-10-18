'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import {
  forgotPasswordRequestSchema,
  forgotPasswordConfirmSchema,
  type ForgotPasswordRequestValues,
  type ForgotPasswordConfirmValues,
} from '../../lib/authSchemas';
import { authApi } from '../../authApi';
import { Button } from '../ui/primitives';

type Step = 'request' | 'confirm';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ForgotPasswordModal({ onClose, onSuccess }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
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

  // Step 1 form
  const requestForm = useForm<ForgotPasswordRequestValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    mode: 'onBlur',
  });

  // Step 2 form
  const confirmForm = useForm<ForgotPasswordConfirmValues>({
    resolver: zodResolver(forgotPasswordConfirmSchema),
    mode: 'onBlur',
  });

  const handleRequest = async (data: ForgotPasswordRequestValues) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await authApi.requestForgotPassword(data.username);
      setSubmittedUsername(data.username);
      confirmForm.setValue('username', data.username);
      setStep('confirm');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    } finally {
      setIsLoading(false);
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
          className="absolute top-4 right-4 text-pine/40 hover:text-pine transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <h3 id="forgot-password-title" className="font-heading text-xl font-bold text-pine mb-1">
            {step === 'request' ? 'Reset your password' : 'Enter new password'}
          </h3>
          <p className="text-sm text-pine/60">
            {step === 'request'
              ? "Enter your username and we'll send a verification code to your email."
              : `Enter the code sent to your email and choose a new password.`}
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
          <div role="alert" className="mb-5 flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{apiError}</p>
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
              <label htmlFor="fp-username" className="block text-sm font-semibold text-pine mb-1.5">
                Username
              </label>
              <input
                id="fp-username"
                type="text"
                autoComplete="username"
                placeholder="your_username"
                aria-invalid={!!requestForm.formState.errors.username}
                {...requestForm.register('username')}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:ring-2 transition-colors ${
                  requestForm.formState.errors.username
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                    : 'border-mist focus:border-sage focus:ring-mint/30'
                }`}
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
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send Code'}
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
              <label htmlFor="fp-code" className="block text-sm font-semibold text-pine mb-1.5">
                Verification code
              </label>
              <input
                id="fp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                aria-invalid={!!confirmForm.formState.errors.confirmationCode}
                {...confirmForm.register('confirmationCode')}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-pine text-center tracking-[0.5em] font-mono placeholder:text-pine/40 focus:outline-none focus:ring-2 transition-colors ${
                  confirmForm.formState.errors.confirmationCode
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                    : 'border-mist focus:border-sage focus:ring-mint/30'
                }`}
              />
              {confirmForm.formState.errors.confirmationCode && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {confirmForm.formState.errors.confirmationCode.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="fp-new-password" className="block text-sm font-semibold text-pine mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  id="fp-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!confirmForm.formState.errors.newPassword}
                  {...confirmForm.register('newPassword')}
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:ring-2 transition-colors ${
                    confirmForm.formState.errors.newPassword
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                      : 'border-mist focus:border-sage focus:ring-mint/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmForm.formState.errors.newPassword && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {confirmForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="fp-confirm-new-password" className="block text-sm font-semibold text-pine mb-1.5">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="fp-confirm-new-password"
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!confirmForm.formState.errors.confirmNewPassword}
                  {...confirmForm.register('confirmNewPassword')}
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:ring-2 transition-colors ${
                    confirmForm.formState.errors.confirmNewPassword
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                      : 'border-mist focus:border-sage focus:ring-mint/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword((v) => !v)}
                  aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine cursor-pointer"
                >
                  {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Resetting…</> : 'Reset Password'}
            </Button>

            <button
              type="button"
              onClick={() => { setStep('request'); setApiError(null); }}
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
