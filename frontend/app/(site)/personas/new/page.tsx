'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PersonaWizard } from '@/components/PersonaWizard';
import { Skeleton } from '@/components/ui/primitives';
import { useAppStore } from '@/stores/useAppStore';
import { usePersonaWizardStore } from '@/stores/usePersonaWizardStore';

function NewPersonaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const wizardReturnTo = returnTo === '/book' ? 'booking' : 'manage';
  const destination = returnTo === '/book' ? '/book' : '/personas';

  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const setLastUsedPersonaId = usePersonaWizardStore((s) => s.setLastUsedPersonaId);

  return (
    <PersonaWizard
      returnTo={wizardReturnTo}
      onCreated={(id) => {
        updateBookingDraft({ personaId: id });
        setLastUsedPersonaId(id);
        router.push(destination);
      }}
      onCancel={() => router.push(destination)}
    />
  );
}

export default function NewPersonaPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <NewPersonaContent />
    </Suspense>
  );
}
