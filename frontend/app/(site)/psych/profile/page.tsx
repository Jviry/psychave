'use client';

import React, { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
  psychologistProfileSchema,
  PsychologistProfileValues,
} from '../../../../lib/schemas';
import { useAppStore } from '../../../../stores/useAppStore';
import { useActivePsychologist } from '../../../../hooks/useActivePsychologist';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Skeleton,
  Textarea,
} from '../../../../components/ui/primitives';

const SOCIAL_PLATFORMS = [
  'Facebook',
  'Instagram',
  'LinkedIn',
  'X (Twitter)',
  'TikTok',
  'Website',
];

export default function PsychologistProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { publishFlowEvent } = useAppStore();
  const { activePsych, isLoading } = useActivePsychologist();

  const profileForm = useForm<PsychologistProfileValues>({
    resolver: zodResolver(psychologistProfileSchema),
    defaultValues: {
      specialization: '',
      prcCredentialCode: '',
      bio: '',
      socialMediaLinks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: profileForm.control,
    name: 'socialMediaLinks',
  });

  // Populate form with active profile data when loaded or switched
  useEffect(() => {
    if (activePsych) {
      profileForm.reset({
        specialization: activePsych.specialization || '',
        prcCredentialCode: activePsych.prcCredentialCode || '',
        bio: activePsych.bio || '',
        socialMediaLinks: activePsych.socialMediaLinks ?? [],
      });
    }
  }, [activePsych, profileForm]);

  const updateMutation = useMutation({
    mutationFn: (values: PsychologistProfileValues) => {
      if (!activePsych) throw new Error('No practitioner profile active.');
      return api.updatePsychologistProfile({
        specialization: values.specialization,
        prcCredentialCode: values.prcCredentialCode,
        bio: values.bio,
        socialMediaLinks: values.socialMediaLinks.map((link) => ({
          platform: link.platform ?? '',
          url: link.url ?? '',
        })),
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['psych-profile'] });
      publishFlowEvent(
        'Profile Updated Successfully',
        `${updated.anonymizedTitle} profile details (specialization, license, bio, and social media links) saved.`
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
            and social media contact links.
          </p>
        </div>
      </header>

      {/* Social media gate */}
      {(activePsych?.socialMediaLinks?.length ?? 0) === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 space-y-1">
          <p className="font-semibold">Social media contact required before accepting bookings.</p>
          <p>
            Add at least one social media link below. Confirmed clients receive these links as
            their contact channel, and the queue pick-up action stays locked until one is saved.
          </p>
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
              Update your professional biography and clinical specializations.
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

              {/* Social Media Links */}
              <div className="space-y-3 pt-1 border-t border-mist">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <Label>Social Media Links</Label>
                    <p className="text-xs text-pine/65">
                      Confirmed clients receive these links as their contact channel. Add at least
                      one to unlock booking pick-up.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({ platform: SOCIAL_PLATFORMS[0], url: '' })
                    }
                    disabled={fields.length >= 6}
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add Link
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No social media links yet. Booking pick-up remains locked until one is added.
                  </p>
                )}

                {fields.map((field, index) => {
                  const platformError =
                    profileForm.formState.errors.socialMediaLinks?.[index]?.platform;
                  const urlError =
                    profileForm.formState.errors.socialMediaLinks?.[index]?.url;
                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] gap-2 items-start rounded-lg border border-mist p-3"
                    >
                      <div>
                        <Label htmlFor={`prof-social-platform-${index}`}>Platform</Label>
                        <Select
                          id={`prof-social-platform-${index}`}
                          {...profileForm.register(
                            `socialMediaLinks.${index}.platform` as const
                          )}
                        >
                          {SOCIAL_PLATFORMS.map((platform) => (
                            <option key={platform} value={platform}>
                              {platform}
                            </option>
                          ))}
                        </Select>
                        {platformError && (
                          <p className="text-xs text-red-700 mt-1">{platformError.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`prof-social-url-${index}`}>Profile URL</Label>
                        <Input
                          id={`prof-social-url-${index}`}
                          placeholder="https://facebook.com/your-profile"
                          {...profileForm.register(
                            `socialMediaLinks.${index}.url` as const
                          )}
                        />
                        {urlError && (
                          <p className="text-xs text-red-700 mt-1">{urlError.message}</p>
                        )}
                      </div>
                      <div className="pt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          aria-label={`Remove social media link ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {profileForm.formState.errors.socialMediaLinks?.message && (
                  <p className="text-xs text-red-700">
                    {profileForm.formState.errors.socialMediaLinks.message}
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

        {/* Right Column: Read-Only Identity */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="space-y-4">
            <h3 className="font-heading text-xl font-medium text-pine border-b border-mist pb-2">
              Practitioner Identity
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-pine/70">Anonymized Identifier:</p>
                <p className="font-mono font-medium text-pine text-sm">
                  {activePsych?.anonymizedTitle ?? 'Resident Psychologist'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
