'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
  psychologistProfileSchema,
  PsychologistProfileValues,
} from '../../../../lib/schemas';
import { useAppStore } from '../../../../stores/useAppStore';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { PractitionerSwitcher } from '../../../../components/dashboard/PractitionerSwitcher';
import { UnverifiedBanner } from '../../../../components/dashboard/UnverifiedBanner';
import {
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '../../../../components/ui/primitives';

export default function PsychologistProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    activePsychologistId,
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
          <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
            <span>Psychologist Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>Practitioner Profile &amp; Governance</span>
          </div>
          <h1 className="font-heading text-4xl font-medium text-pine">
            Practitioner Profile
          </h1>
          <p className="text-sm text-pine/80 max-w-2xl">
            Manage your clinical specializations, PRC license credentials, professional biography,
            and review your administrative verification status.
          </p>
        </div>

        {/* Practitioner State Switcher */}
        <PractitionerSwitcher />
      </header>

      {/* Approval Status Banner */}
      {!isVerified ? (
        <UnverifiedBanner
          title="Read-Only Approval Status: WAITING_APPROVAL"
          note="STATUS: PENDING CLINIC APPROVAL"
          body={
            <>
              Your clinical account is currently <strong>awaiting administrator verification</strong>.
              While pending approval, your profile is hidden from the public roster and booking pick-up actions
              remain blocked app-wide to maintain patient safety and clinical regulatory standards.
            </>
          }
        />
      ) : (
        <div className="bg-surface-sunken border border-mist rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-sage text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-pine">
                Credential Status: Verified &amp; Active
              </p>
              <p className="text-pine/75">
                Authenticated under PRC Registration. Queue pick-up and schedule proposal privileges are enabled.
              </p>
            </div>
          </div>
          <span className="font-mono px-2.5 py-1 bg-surface-raised rounded-md text-accent-ink font-medium border border-mist">
            {activePsych?.prcCredentialCode}
          </span>
        </div>
      )}

      {/* Main Profile Editor & Governance Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Editable Profile Form */}
        <Card className="lg:col-span-8 space-y-6">
          <div className="border-b border-mist pb-4">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Edit Profile Information
            </h2>
            <p className="text-xs text-pine/70 mt-0.5">
              Update your professional biography, practice tenure, and clinical specializations.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-64" />
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
            <h3 className="font-heading text-xl font-medium text-pine border-b border-mist pb-2">
              Practitioner Identity
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-pine/70">Anonymized Identifier:</p>
                <p className="font-mono font-medium text-pine text-sm">
                  {activePsych?.anonymizedTitle}
                </p>
              </div>

              <div>
                <p className="text-pine/70">Public Roster Visibility:</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-sm font-semibold text-xs ${
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
            <h3 className="font-heading text-xl font-medium text-pine border-b border-mist pb-2">
              Certified Service Eligibility
            </h3>
            <p className="text-xs text-pine/70">
              Services you are certified to evaluate and pick up from the pending booking queue:
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
