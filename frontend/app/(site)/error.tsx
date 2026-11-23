'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/primitives';

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="my-12 mx-auto max-w-lg rounded-xl border border-mist bg-surface-raised p-8 text-center space-y-5 shadow-subtle"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
        Something went wrong
      </p>
      <h2 className="font-heading text-2xl font-medium text-pine">
        Unable to load this view
      </h2>
      <p className="text-sm text-pine/75 leading-relaxed">
        {error.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <div className="pt-2 flex items-center justify-center gap-3">
        <Button variant="dark" size="md" onClick={() => reset()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
