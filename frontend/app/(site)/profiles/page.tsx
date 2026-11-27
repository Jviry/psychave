'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import { useProfileWizardStore } from '@/stores/useProfileWizardStore';
import { Button, Card, Skeleton } from '@/components/ui/primitives';

function ProfilesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const returnTo = searchParams.get('returnTo');
  const shouldOpenNew = searchParams.get('new') === '1';
  const newProfileHref = returnTo === '/book' ? '/profiles/new?returnTo=/book' : '/profiles/new';

  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const lastUsedProfileId = useProfileWizardStore((s) => s.lastUsedProfileId);
  const setLastUsedProfileId = useProfileWizardStore((s) => s.setLastUsedProfileId);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  useEffect(() => {
    if (shouldOpenNew) {
      router.replace(newProfileHref);
    }
  }, [shouldOpenNew, newProfileHref, router]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setConfirmDeleteId(null);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Could not delete profile.');
      setConfirmDeleteId(null);
    },
  });

  const handleBookWithProfile = (profileId: string) => {
    updateBookingDraft({ profileId });
    setLastUsedProfileId(profileId);
    router.push('/book');
  };

  const editHrefFor = (profileId: string) =>
    returnTo === '/book'
      ? `/profiles/${profileId}/edit?returnTo=/book`
      : `/profiles/${profileId}/edit`;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-4 border-b border-mist pb-6">
        {returnTo === '/book' && (
          <Link
            href="/book"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink hover:text-pine transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to booking
          </Link>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="font-heading text-4xl font-medium text-pine">Client Profiles</h1>
            <p className="text-sm text-pine/75">
              Profiles with signed informed consent for yourself or a dependent.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(newProfileHref)}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New profile
          </Button>
        </div>
      </header>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}

      {profilesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : profiles.length === 0 ? (
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-medium text-pine">No profiles yet</h2>
            <p className="text-sm text-pine/75 leading-relaxed">
              Create a profile with signed informed consent before booking a session.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => router.push(newProfileHref)}
          >
            Create a profile
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => {
            const isLastUsed = lastUsedProfileId === profile.id;
            const isConfirmingDelete = confirmDeleteId === profile.id;

            return (
              <Card key={profile.id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-pine/70">
                      <span className="font-semibold text-accent-ink">
                        {profile.type === 'self' ? 'Self (Primary)' : 'Dependent'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{profile.ageGroup}</span>
                      {profile.type !== 'self' && profile.relationshipToClient && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{profile.relationshipToClient}</span>
                        </>
                      )}
                      {isLastUsed && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-accent-ink font-medium">Last used</span>
                        </>
                      )}
                      {profile.consentOutdated && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                            Consent update required ({profile.activeConsentVersion ?? 'new version'})
                          </span>
                        </>
                      )}
                    </div>
                    <p className="font-heading text-xl font-medium text-pine">{profile.label}</p>
                    {profile.contactNumber && (
                      <p className="text-xs text-pine/65 tabular-nums">
                        {profile.contactNumber}
                        {profile.preferredContactMode ? ` · Prefers ${profile.preferredContactMode}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {profile.consentOutdated && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/profiles/new?resign=${profile.id}`)}
                      >
                        Review &amp; Re-sign Consent
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(editHrefFor(profile.id))}
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                    {profile.type !== 'self' && (
                      !isConfirmingDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionError(null);
                            setConfirmDeleteId(profile.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Delete
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(profile.id)}
                          >
                            {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBookWithProfile(profile.id)}
                    >
                      Book a session
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-24" />
        </div>
      }
    >
      <ProfilesContent />
    </Suspense>
  );
}
