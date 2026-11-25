'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, User } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/authApi';

export default function AccountPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  useEffect(() => {
    if (!hydrated) return;
    const live = useAuthStore.getState();
    if (!live.isAuthenticated || !live.user) {
      router.replace('/login');
    }
  }, [hydrated, router]);

  if (!hydrated || !isAuthenticated || !user) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  const dashboardHref =
    user.role === 'admin'
      ? '/admin/users'
      : user.role === 'psychologist'
        ? '/psych/queue'
        : '/bookings';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-heading text-4xl font-medium text-pine">Account</h1>
        <p className="text-sm text-pine/75">
          Your signed-in account details and session controls.
        </p>
      </header>

      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-sage" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-xl font-medium text-pine truncate">
              {user.username}
            </p>
            <p className="text-xs text-pine/70 truncate">
              {user.email || 'No email on file'}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-mist text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Username
            </dt>
            <dd className="mt-1 font-medium text-pine">{user.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Role
            </dt>
            <dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-pine capitalize">
              <ShieldCheck className="w-4 h-4 text-sage" aria-hidden="true" />
              {user.role}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Email
            </dt>
            <dd className="mt-1 font-medium text-pine">
              {user.email || '—'}
            </dd>
          </div>
        </dl>

        <div className="pt-4 border-t border-mist flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={dashboardHref}
              className="text-xs font-semibold text-accent-ink underline underline-offset-4 hover:text-pine transition-colors"
            >
              Go to dashboard
            </Link>
            {user.role === 'psychologist' && (
              <Link
                href="/psych/profile"
                className="text-xs font-semibold text-accent-ink underline underline-offset-4 hover:text-pine transition-colors"
              >
                Manage practitioner profile
              </Link>
            )}
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              void authApi.logoutSession();
              logout();
              router.push('/');
            }}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Log Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
