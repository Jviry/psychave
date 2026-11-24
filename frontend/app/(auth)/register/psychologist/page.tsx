'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  authApi,
  AuthApiError,
  PsychologistInvitationInfo,
} from '@/lib/authApi';
import {
  analyzePasswordStrength,
  PsychologistInviteRegisterFormValues,
  psychologistInviteRegisterSchema,
  PasswordStrength,
} from '@/lib/authSchemas';
import { Toast } from '@/components/auth/Toast';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui/primitives';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

const SOCIAL_PLATFORMS = [
  'Facebook',
  'Instagram',
  'LinkedIn',
  'X (Twitter)',
  'TikTok',
  'Website',
];

const strengthConfig: Record<
  PasswordStrength,
  { label: string; color: string; width: string }
> = {
  weak: { label: 'Weak', color: 'bg-red-400', width: 'w-1/4' },
  fair: { label: 'Fair', color: 'bg-amber-400', width: 'w-2/4' },
  good: { label: 'Good', color: 'bg-mint', width: 'w-3/4' },
  strong: { label: 'Strong', color: 'bg-sage', width: 'w-full' },
};

function PsychologistInviteRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();

  const [invitation, setInvitation] =
    useState<PsychologistInvitationInfo | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const form = useForm<PsychologistInviteRegisterFormValues>({
    resolver: zodResolver(psychologistInviteRegisterSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      prcCredentialCode: '',
      specialization: '',
      bio: '',
      socialMediaLinks: [{ platform: 'Facebook', url: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'socialMediaLinks',
  });

  useEffect(() => {
    let active = true;
    if (!token) {
      setVerifying(false);
      setVerifyError(
        'Missing invitation token. Please open the full invitation link sent by your administrator.'
      );
      return;
    }

    setVerifying(true);
    setVerifyError(null);
    authApi
      .verifyPsychologistInvitation(token)
      .then((info) => {
        if (!active) return;
        setInvitation(info);
        setVerifying(false);
      })
      .catch((err) => {
        if (!active) return;
        setVerifying(false);
        setVerifyError(
          err instanceof Error
            ? err.message
            : 'This psychologist invitation link is invalid or has expired.'
        );
      });

    return () => {
      active = false;
    };
  }, [token]);

  const passwordValue = form.watch('password', '');
  const usernameValue = form.watch('username', '');
  const fullNameValue = form.watch('fullName', '');
  const strengthAnalysis = passwordValue
    ? analyzePasswordStrength(passwordValue, [
        usernameValue,
        fullNameValue,
        invitation?.email ?? '',
      ])
    : null;
  const strengthHint =
    strengthAnalysis?.warning || strengthAnalysis?.suggestions[0] || '';

  const onSubmit = async (values: PsychologistInviteRegisterFormValues) => {
    if (!token || !invitation) return;
    setToast(null);
    try {
      await authApi.registerInvitedPsychologist({
        token,
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        licenseNumber: values.prcCredentialCode,
        specialization: values.specialization,
        bio: values.bio,
        socialMediaLinks: values.socialMediaLinks.map((link) => ({
          platform: link.platform.trim(),
          url: link.url.trim(),
        })),
      });
      setToast({
        message: 'Psychologist account created! Redirecting to sign in…',
        type: 'success',
      });
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (err) {
      const msg =
        err instanceof AuthApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not complete psychologist registration.';
      setToast({ message: msg, type: 'error' });
    }
  };

  if (verifying) {
    return (
      <div className="w-full max-w-xl">
        <Card className="p-8 text-center space-y-4">
          <Loader2
            className="mx-auto h-7 w-7 animate-spin text-accent-ink"
            aria-hidden="true"
          />
          <h1 className="font-heading text-2xl font-medium text-pine">
            Verifying your invitation…
          </h1>
          <p className="text-xs text-pine/70">
            Checking your single-use psychologist onboarding token.
          </p>
        </Card>
      </div>
    );
  }

  if (verifyError || !invitation) {
    return (
      <div className="w-full max-w-xl">
        <Card className="p-8 space-y-5">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="h-6 w-6 text-red-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-medium text-pine">
                Invitation Link Unavailable
              </h1>
              <p className="text-xs text-pine/80 leading-relaxed">
                {verifyError ||
                  'This psychologist invitation link is invalid or has expired.'}
              </p>
            </div>
          </div>
          <p className="text-xs text-pine/65">
            Ask a PsychAvenuePH administrator to send a new invitation to your email address.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="primary" size="md">
                Return to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {toast && (
        <div className="mb-4">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      <Card className="p-8 space-y-6">
        <div className="space-y-2 border-b border-mist pb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent-ink">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Verified Practitioner Onboarding</span>
          </div>
          <h1 className="font-heading text-3xl font-medium text-pine">
            Complete Psychologist Registration
          </h1>
          <p className="text-xs text-pine/75 leading-relaxed">
            Set your account credentials and practitioner profile details. Once submitted,
            your account will be confirmed and ready to accept client bookings immediately.
          </p>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-6"
        >
          {/* Account credentials */}
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-medium text-pine">
              1. Account Credentials
            </h2>

            <div>
              <Label htmlFor="psych-invite-email">Invited Email Address</Label>
              <div className="relative">
                <Input
                  id="psych-invite-email"
                  type="email"
                  value={invitation.email}
                  readOnly
                  disabled
                  className="bg-surface-sunken pr-9"
                />
                <Lock
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1 text-[11px] text-pine/60">
                Verified by your single-use invitation link.
              </p>
            </div>

            <div>
              <Label htmlFor="psych-invite-username">Username</Label>
              <Input
                id="psych-invite-username"
                placeholder="dr_santos"
                autoComplete="username"
                {...form.register('username')}
              />
              <FieldError message={form.formState.errors.username?.message} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="psych-invite-password">Password</Label>
                <div className="relative">
                  <Input
                    id="psych-invite-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 chars, 1 upper, 1 number, 1 symbol"
                    autoComplete="new-password"
                    className="pr-10"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/50 hover:text-pine"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {strengthAnalysis && (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1 w-full rounded-full bg-mist overflow-hidden">
                      <div
                        className={`h-full transition-all ${strengthConfig[strengthAnalysis.strength].color} ${strengthConfig[strengthAnalysis.strength].width}`}
                      />
                    </div>
                    <p className="text-[11px] text-pine/65">
                      Strength:{' '}
                      <strong>
                        {strengthConfig[strengthAnalysis.strength].label}
                      </strong>
                    </p>
                    {strengthHint && (
                      <p className="text-[11px] text-pine/55">{strengthHint}</p>
                    )}
                  </div>
                )}
                <FieldError message={form.formState.errors.password?.message} />
              </div>

              <div>
                <Label htmlFor="psych-invite-confirm-password">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="psych-invite-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="pr-10"
                    {...form.register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/50 hover:text-pine"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <FieldError
                  message={form.formState.errors.confirmPassword?.message}
                />
              </div>
            </div>
          </div>

          {/* Professional details */}
          <div className="space-y-4 border-t border-mist pt-5">
            <h2 className="font-heading text-xl font-medium text-pine">
              2. Personal &amp; Professional Profile
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="psych-invite-full-name">Full Name</Label>
                <Input
                  id="psych-invite-full-name"
                  placeholder="Dr. Maria Santos, RPsy"
                  {...form.register('fullName')}
                />
                <FieldError message={form.formState.errors.fullName?.message} />
              </div>

              <div>
                <Label htmlFor="psych-invite-license">
                  PRC License Credential Code
                </Label>
                <Input
                  id="psych-invite-license"
                  placeholder="PRC-RPSY-2024-001"
                  {...form.register('prcCredentialCode')}
                />
                <FieldError
                  message={form.formState.errors.prcCredentialCode?.message}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="psych-invite-specialization">
                Clinical Specialization
              </Label>
              <Input
                id="psych-invite-specialization"
                placeholder="Trauma-Informed CBT, Anxiety & Mood Disorders"
                {...form.register('specialization')}
              />
              <FieldError
                message={form.formState.errors.specialization?.message}
              />
            </div>

            <div>
              <Label htmlFor="psych-invite-bio">Professional Biography</Label>
              <Textarea
                id="psych-invite-bio"
                rows={3}
                placeholder="Summarize your clinical background, therapeutic approach, and populations served…"
                {...form.register('bio')}
              />
              <FieldError message={form.formState.errors.bio?.message} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Social Media Contact Links</Label>
                  <p className="text-[11px] text-pine/65">
                    At least one link is required. Confirmed clients unlock these links after payment.
                  </p>
                </div>
                {fields.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ platform: 'Facebook', url: '' })}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add link
                  </Button>
                )}
              </div>

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_auto] gap-2 items-start"
                >
                  <div>
                    <Select
                      aria-label={`Social platform ${index + 1}`}
                      {...form.register(
                        `socialMediaLinks.${index}.platform` as const
                      )}
                    >
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </Select>
                    <FieldError
                      message={
                        form.formState.errors.socialMediaLinks?.[index]?.platform
                          ?.message
                      }
                    />
                  </div>
                  <div>
                    <Input
                      aria-label={`Social URL ${index + 1}`}
                      placeholder="https://facebook.com/your.practice"
                      {...form.register(
                        `socialMediaLinks.${index}.url` as const
                      )}
                    />
                    <FieldError
                      message={
                        form.formState.errors.socialMediaLinks?.[index]?.url
                          ?.message
                      }
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      aria-label={`Remove link ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-700" />
                    </Button>
                  )}
                </div>
              ))}
              <FieldError
                message={form.formState.errors.socialMediaLinks?.root?.message}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creating Psychologist Account…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Complete Registration &amp; Activate Account
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function PsychologistInviteRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-lg h-96 bg-surface-raised rounded-lg border border-mist" />
      }
    >
      <PsychologistInviteRegisterContent />
    </Suspense>
  );
}
