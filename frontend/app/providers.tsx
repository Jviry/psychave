'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../authStore';
import { useAppStore } from '../stores/useAppStore';

/**
 * Client-only providers live here so the root layout can stay a server
 * component (required for `export const metadata` and html/body ownership).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Real-session → mock-role sync (one direction only: the real user's role
  // drives cognitoRole, never the reverse). Runs on login AND on persisted
  // session rehydration (persist restores without re-calling login()).
  useEffect(() => {
    const apply = (s: ReturnType<typeof useAuthStore.getState>) => {
      if (s.isAuthenticated && s.user) {
        useAppStore.getState().setCognitoRole(s.user.role);
      }
    };
    apply(useAuthStore.getState());
    return useAuthStore.subscribe(apply);
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
