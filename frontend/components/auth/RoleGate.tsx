'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../authStore';
import { CognitoRole } from '../../lib/types';
import { Skeleton } from '../ui/primitives';

/**
 * Client-side route gate. The backend remains the real authorization boundary;
 * this only keeps each role out of dashboards it does not own.
 */
export function RoleGate({
  role,
  children,
}: {
  role: CognitoRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated?.() ?? false
  );

  useEffect(() => {
    const persistApi = useAuthStore.persist;
    if (!persistApi) {
      setHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  const allowed = hydrated && isAuthenticated && user?.role === role;

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }

    if (user.role !== role) {
      router.replace(useAuthStore.getState().getDashboardPath());
    }
  }, [hydrated, isAuthenticated, user, role, router]);

  if (!allowed) {
    return (
      <div className="py-16" aria-busy="true" aria-label="Checking access">
        <Skeleton className="h-40" />
      </div>
    );
  }

  return <>{children}</>;
}
