'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProfileWizard } from '@/components/ProfileWizard';
import { Skeleton } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import { useProfileWizardStore } from '@/stores/useProfileWizardStore';

function NewProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const resignId = searchParams.get('resign');
  const wizardReturnTo = returnTo === '/book' ? 'booking' : 'manage';
  const destination = returnTo === '/book' ? '/book' : '/profiles';

  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const setLastUsedProfileId = useProfileWizardStore((s) => s.setLastUsedProfileId);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
    enabled: Boolean(resignId),
  });

  if (resignId && isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const resignProfile = resignId
    ? profiles.find((p) => p.id === resignId) ?? null
    : null;

  return (
    <ProfileWizard
      returnTo={wizardReturnTo}
      resignProfile={resignProfile}
      onCreated={(id) => {
        updateBookingDraft({ profileId: id });
        setLastUsedProfileId(id);
        router.push(destination);
      }}
      onCancel={() => router.push(destination)}
    />
  );
}

export default function NewProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <NewProfileContent />
    </Suspense>
  );
}
