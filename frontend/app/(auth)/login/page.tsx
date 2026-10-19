'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { loginSchema, type LoginFormValues } from '../../../lib/authSchemas';
import { authApi } from '../../../authApi';
import { useAuthStore } from '../../../authStore';
import { ForgotPasswordModal } from '../../../components/auth/ForgotPasswordModal';
import { Toast } from '../../../components/auth/Toast';
import { Button, Input, Label } from '../../../components/ui/primitives';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const session = await authApi.loginUser({
        username: data.username,
        password: data.password,
      });

      // Decode IdToken to get user info (base64 payload, no signature verification on client)
      let userInfo = {
        email: '',
        username: data.username,
        role: 'client' as 'client' | 'psychologist' | 'admin',
        cognitoSub: '',
      };

      try {
        const payload = JSON.parse(atob(session.idToken.split('.')[1]));
        const groups: string[] = payload['cognito:groups'] || [];
        const role = groups.includes('admin')
          ? 'admin'
          : groups.includes('psychologist')
            ? 'psychologist'
            : 'client';
        userInfo = {
          email: payload.email || '',
          username: payload['cognito:username'] || data.username,
          role,
          cognitoSub: payload.sub || '',
        };
      } catch {
        // mock token won't be parseable — keep defaults
      }

      login({ ...session, user: userInfo });

      setToast({ message: 'Welcome back! Redirecting…', type: 'success' });

      const dashboardPath =
        userInfo.role === 'admin'
          ? '/admin/verifications'
          : userInfo.role === 'psychologist'
            ? '/psych/queue'
            : '/bookings';

      setTimeout(() => router.push(dashboardPath), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand logo — same image as the footer */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-block">
          <img
            src="/psychave-logo.png"
            alt="PSYCHAVE PH"
            width={1024}
            height={720}
            className="h-auto w-48 sm:w-64"
          />
        </Link>
      </div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Card */}
      <div className="bg-surface-raised rounded-lg border border-mist p-8 sm:p-10">
        {/* Header */}
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-medium text-pine mb-1.5">Welcome back</h2>
          <p className="text-sm text-pine/60">Sign in to your PsychAve PH account</p>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div
            id="login-api-error"
            role="alert"
            className="mb-6 flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{apiError}</p>
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* Username */}
          <div>
            <Label htmlFor="login-username">Username</Label>
            <Input
              id="login-username"
              type="text"
              autoComplete="username"
              placeholder="your_username"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'login-username-error' : undefined}
              {...register('username')}
            />
            {errors.username && (
              <p id="login-username-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-start justify-between">
              <Label htmlFor="login-password">Password</Label>
              <button
                type="button"
                id="forgot-password-trigger"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-sage hover:text-pine font-medium transition-colors cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                {...register('password')}
                className="pr-10"
              />
              <button
                type="button"
                id="login-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine transition-colors cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="login-password-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            id="login-submit"
            type="submit"
            variant="dark"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-pine/60">
          Don&apos;t have an account?{' '}
          <Link href="/register" id="go-to-register" className="text-sage hover:text-pine font-semibold transition-colors">
            Create account
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <ForgotPasswordModal
          onClose={() => setShowForgotPassword(false)}
          onSuccess={() => {
            setShowForgotPassword(false);
            setToast({ message: 'Password reset successful. You can now sign in.', type: 'success' });
          }}
        />
      )}
    </div>
  );
}
