'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  psychologistProfileSchema,
  PsychologistProfileValues,
} from '../../../lib/schemas';
import { useAppStore } from '../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from '../../../components/ui/primitives';

export default function PsychologistProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    activePsychologistId,
    setActivePsychologistId,
    setCognitoRole,
    publishFlowEvent,
  } = useAppStore();

  const { data: roster = [], isLoading } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const activePsych =
    roster.find((r) => r.id === activePsychologistId) || roster[0];
  const isVerified = activePsych?.verificationStatus === 'verified';

  const profileForm = useForm<PsychologistProfileValues>({
    resolver: zodResolver(psychologistProfileSchema),
    defaultValues: {
      specialization: '',
      prcCredentialCode: '',
      bio: '',
      yearsPractice: '',
      languages: '',
    },
  });

  // Populate form with active profile data when loaded or switched
  useEffect(() => {
    if (activePsych) {
      profileForm.reset({
        specialization: activePsych.specialization || '',
        prcCredentialCode: activePsych.prcCredentialCode || '',
        bio: activePsych.bio || '',
        yearsPractice: activePsych.yearsPractice || '',
        languages: activePsych.languages?.join(', ') || '',
      });
    }
  }, [activePsych, profileForm]);

  const updateMutation = useMutation({
    mutationFn: (values: PsychologistProfileValues) => {
      if (!activePsych) throw new Error('No practitioner profile active.');
      return api.updatePsychologistProfile(activePsych.id, {
        specialization: values.specialization,
        prcCredentialCode: values.prcCredentialCode,
        bio: values.bio,
        yearsPractice: values.yearsPractice,
        languages: values.languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      publishFlowEvent(
        'Profile Updated Successfully',
        `${updated.anonymizedTitle} profile details (specialization, license, and bio) saved.`
      );
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-mist pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-sage font-semibold">
            <span>Psychologist Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Practitioner Profile &amp; Governance</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-pine">
            Practitioner Profile
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Manage your clinical specializations, PRC license credentials, professional biography,
            and review your administrative verification status.
          </p>
        </div>

        {/* Practitioner State Switcher */}
        <div className="bg-white border border-mist rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs shadow-xs">
          <span className="font-semibold text-pine">Active Practitioner:</span>
          {roster.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActivePsychologistId(r.id)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activePsychologistId === r.id
                  ? 'bg-pine text-white'
                  : 'bg-[#F1F6F2] text-pine hover:bg-[#E2ECE4]'
              }`}
            >
              {r.id} ({r.verificationStatus === 'verified' ? 'Verified' : 'Unverified'})
            </button>
          ))}
        </div>
      </header>

      {/* Approval Status Banner */}
      {!isVerified ? (
        <div
          role="alert"
          className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 text-amber-950 space-y-3 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-700" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="font-heading text-xl font-bold text-amber-950">
                Read-Only Approval Status: WAITING_APPROVAL
              </h2>
            </div>
            <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-amber-200 text-amber-900 rounded-md">
              STATUS: PENDING CLINIC APPROVAL
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed max-w-3xl">
            Your clinical account is currently <strong>awaiting administrator verification</strong>.
            While pending approval, your profile is hidden from the public roster and intake pick-up actions
            remain blocked app-wide to maintain patient safety and clinical regulatory standards.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="dark"
              size="sm"
              onClick={() => setActivePsychologistId('RP-01')}
            >
              Switch to Verified Resident #RP-01
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCognitoRole('admin');
                router.push('/admin/verifications');
              }}
            >
              Authorize Credentials in Admin Portal →
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-[#EBF2EC] border border-sage rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-sage text-white flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold text-pine">
                Credential Status: Verified &amp; Active
              </p>
              <p className="text-pine/75">
                Authenticated under PRC Registration. Queue pick-up and schedule proposal privileges are enabled.
              </p>
            </div>
          </div>
          <span className="font-mono px-2.5 py-1 bg-white rounded-md text-sage font-bold border border-mist">
            {activePsych?.prcCredentialCode}
          </span>
        </div>
      )}

      {/* Main Profile Editor & Governance Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Editable Profile Form */}
        <Card className="lg:col-span-8 space-y-6">
          <div className="border-b border-mist pb-4">
            <h2 className="font-heading text-2xl font-bold text-pine">
              Edit Profile Information
            </h2>
            <p className="text-xs text-pine/70 mt-0.5">
              Update your professional biography, practice tenure, and clinical specializations.
            </p>
          </div>

          {isLoading ? (
            <div className="h-64 rounded-lg bg-parchment animate-pulse" />
          ) : (
            <form
              onSubmit={profileForm.handleSubmit((values) => updateMutation.mutate(values))}
              className="space-y-5"
            >
              {/* Specialization */}
              <div>
                <Label htmlFor="prof-specialization">Clinical Specialization</Label>
                <Input
                  id="prof-specialization"
                  placeholder="e.g. Adult Psychotherapy, Anxiety Disorders & Trauma-Informed CBT"
                  {...profileForm.register('specialization')}
                />
                {profileForm.formState.errors.specialization && (
                  <p className="text-xs text-red-700 mt-1">
                    {profileForm.formState.errors.specialization.message}
                  </p>
                )}
              </div>

              {/* License Code */}
              <div>
                <Label htmlFor="prof-license">PRC Credential / License Number</Label>
                <Input
                  id="prof-license"
                  className="font-mono text-sm"
                  placeholder="e.g. PRC-PSY-Verified-8841"
                  {...profileForm.register('prcCredentialCode')}
                />
                {profileForm.formState.errors.prcCredentialCode && (
                  <p className="text-xs text-red-700 mt-1">
                    {profileForm.formState.errors.prcCredentialCode.message}
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="prof-bio">Professional Biography</Label>
                <Textarea
                  id="prof-bio"
                  rows={4}
                  placeholder="Brief clinical background, therapeutic approach, and research focus..."
                  {...profileForm.register('bio')}
                />
                {profileForm.formState.errors.bio && (
                  <p className="text-xs text-red-700 mt-1">
                    {profileForm.formState.errors.bio.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Years of Practice */}
                <div>
                  <Label htmlFor="prof-years">Years of Clinical Practice</Label>
                  <Input
                    id="prof-years"
                    placeholder="e.g. 8+ Years Clinical Practice"
                    {...profileForm.register('yearsPractice')}
                  />
                  {profileForm.formState.errors.yearsPractice && (
                    <p className="text-xs text-red-700 mt-1">
                      {profileForm.formState.errors.yearsPractice.message}
                    </p>
                  )}
                </div>

                {/* Languages */}
                <div>
                  <Label htmlFor="prof-languages">Session Languages</Label>
                  <Input
                    id="prof-languages"
                    placeholder="e.g. English, Filipino / Taglish, Cebuano"
                    {...profileForm.register('languages')}
                  />
                  {profileForm.formState.errors.languages && (
                    <p className="text-xs text-red-700 mt-1">
                      {profileForm.formState.errors.languages.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-mist">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving Profile...' : 'Save Profile Changes'}
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Right Column: Read-Only Roster & Service Scope Governance */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="space-y-4">
            <h3 className="font-heading text-xl font-bold text-pine border-b border-mist pb-2">
              Practitioner Identity
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-pine/70">Anonymized Identifier:</p>
                <p className="font-mono font-bold text-pine text-sm">
                  {activePsych?.anonymizedTitle}
                </p>
              </div>

              <div>
                <p className="text-pine/70">Public Roster Visibility:</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-sm font-semibold text-[11px] ${
                    activePsych?.visibleOnPublicRoster
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {activePsych?.visibleOnPublicRoster
                    ? 'Listed on Public Roster'
                    : 'Hidden from Public Roster'}
                </span>
              </div>

              <div>
                <p className="text-pine/70">Assigned Case Load:</p>
                <p className="font-bold text-pine">
                  {activePsych?.assignedBookingsCount} active bookings
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="font-heading text-xl font-bold text-pine border-b border-mist pb-2">
              Certified Service Eligibility
            </h3>
            <p className="text-xs text-pine/70">
              Services you are certified to evaluate and pick up from the pending intake queue:
            </p>
            <ul className="space-y-2 text-xs">
              {activePsych?.serviceEligibility?.map((service) => (
                <li
                  key={service}
                  className="p-2.5 rounded-lg bg-parchment border border-mist/70 font-medium text-pine flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sage" />
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
