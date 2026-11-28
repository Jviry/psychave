'use client';

import React, { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/primitives';

function ProposalRedirectInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const bookingId = params.id || '';
  const query = searchParams.toString();

  useEffect(() => {
    const target = bookingId
      ? `/bookings/${encodeURIComponent(bookingId)}${query ? `?${query}` : ''}`
      : '/bookings';
    router.replace(target);
  }, [bookingId, query, router]);

  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-48" />
    </div>
  );
}

export default function ProposalRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-48" />
        </div>
      }
    >
      <ProposalRedirectInner />
    </Suspense>
  );
}
