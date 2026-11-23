'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProfileWizard } from '@/components/ProfileWizard';
import { Skeleton } from '@/components/ui/primitives';
import { useAppStore } from '@/stores/useAppStore';
import { useProfileWizardStore } from '@/stores/useProfileWizardStore';

function NewProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const wizardReturnTo = returnTo === '/book' ? 'booking' : 'manage';
  const destination = returnTo === '/book' ? '/book' : '/profiles';

  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const setLastUsedProfileId = useProfileWizardStore((s) => s.setLastUsedProfileId);

  return (
    <ProfileWizard
      returnTo={wizardReturnTo}
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
