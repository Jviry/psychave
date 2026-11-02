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

    // Decide from the LIVE store, not the hook values above. During React's
    // hydration pass, useSyncExternalStore deliberately renders zustand's
    // getServerSnapshot (the store's INITIAL state), which is unauthenticated
    // even when a valid persisted session is being restored. Acting on that
    // snapshot bounced logged-in users to /login on every full page load.
    const live = useAuthStore.getState();
    if (!live.isAuthenticated || !live.user) {
      router.replace('/login');
      return;
    }

    if (live.user.role !== role) {
      router.replace(live.getDashboardPath());
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
