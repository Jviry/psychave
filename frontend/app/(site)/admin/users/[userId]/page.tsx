'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { CognitoRole } from '@/lib/types';
import { useAuthStore } from '@/stores/authStore';
import { SocialLinksList } from '@/components/SocialLinksList';
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives';

const roleLabels: Record<CognitoRole, string> = {
  client: 'Client',
  psychologist: 'Psychologist',
  admin: 'Admin',
};

function RoleTag({ role }: { role: CognitoRole }) {
  const styles: Record<CognitoRole, string> = {
    client: 'bg-surface-sunken text-pine/80 border-mist',
    psychologist: 'bg-mint/20 text-accent-ink border-mint',
    admin: 'bg-pine text-parchment border-pine',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[role]}`}
    >
      {roleLabels[role]}
    </span>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelation(relation: string): string {
  if (!relation) return '—';
  return relation.charAt(0).toUpperCase() + relation.slice(1);
}

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = typeof params?.userId === 'string' ? params.userId : '';

  const currentEmail = useAuthStore((state) => state.user?.email);

  const {
    data: user,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => api.getAdminUserDetail(userId),
    enabled: Boolean(userId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:text-pine transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to User Directory
        </Link>

        <Card className="p-6 space-y-4">
          <p role="alert" className="text-sm text-red-800">
            {error
              ? getFriendlyErrorMessage(
                  error,
                  'Could not load this user’s details.'
                )
              : 'User account not found.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Retrying…' : 'Try Again'}
            </Button>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-accent-ink underline underline-offset-4 hover:text-pine"
            >
              Return to User Directory
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isSelf = !!currentEmail && user.email === currentEmail;

  return (
    <div className="space-y-8">
      <div className="space-y-4 border-b border-mist pb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:text-pine transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to User Directory
        </Link>

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine break-all">
                {user.username || user.email}
              </h1>
              <RoleTag role={user.role} />
              {isSelf && (
                <span className="text-xs font-semibold text-accent-ink">
                  Your account
                </span>
              )}
            </div>
            <p className="text-sm text-pine/70 break-all">{user.email}</p>
          </div>
        </header>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5 text-sage" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-medium text-pine">
              Account Details
            </h2>
            <p className="text-xs text-pine/65">
              Core identity and access metadata for this account.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-4 border-t border-mist text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Username
            </dt>
            <dd className="mt-1 font-medium text-pine break-all">
              {user.username || '—'}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Email
            </dt>
            <dd className="mt-1 font-medium text-pine break-all">
              {user.email}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Full Name
            </dt>
            <dd className="mt-1 font-medium text-pine">
              {user.fullName || '—'}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Role
            </dt>
            <dd className="mt-1">
              <RoleTag role={user.role} />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              Joined
            </dt>
            <dd className="mt-1 font-mono text-xs text-pine/80 tabular-nums">
              {formatDate(user.createdAt)}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
              User ID
            </dt>
            <dd className="mt-1 font-mono text-xs text-pine/70 break-all">
              {user.userId}
            </dd>
          </div>
        </dl>
      </Card>

      {user.psychologistProfile && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="font-heading text-xl font-medium text-pine">
              Psychologist Profile
            </h2>
            <p className="text-xs text-pine/65">
              Practitioner credentials and contact links on file.
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-mist text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Display Name
              </dt>
              <dd className="mt-1 font-medium text-pine">
                {user.psychologistProfile.fullName}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                PRC License Number
              </dt>
              <dd className="mt-1 font-mono text-xs text-pine">
                {user.psychologistProfile.licenseNumber || '—'}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Specialization
              </dt>
              <dd className="mt-1 text-pine">
                {user.psychologistProfile.specialization || '—'}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-pine/60">
                Bio
              </dt>
              <dd className="mt-1 text-pine/85 whitespace-pre-line leading-relaxed">
                {user.psychologistProfile.bio || '—'}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-pine/60 mb-1.5">
                Social Media Links
              </dt>
              <dd>
                <SocialLinksList
                  links={user.psychologistProfile.socialMediaLinks}
                />
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {(user.role === 'client' || user.clientProfiles.length > 0) && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-medium text-pine">
                Care Profiles
              </h2>
              <p className="text-xs text-pine/65">
                Self and dependent profiles registered under this account.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-accent-ink tabular-nums">
              {user.clientProfiles.length}{' '}
              {user.clientProfiles.length === 1 ? 'profile' : 'profiles'}
            </span>
          </div>

          {user.clientProfiles.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No care profiles yet"
              description="This client has not created any care profiles yet."
            />
          ) : (
            <div className="overflow-x-auto border-t border-mist pt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-mist text-pine/70 bg-parchment">
                    <th className="py-2.5 px-3 font-semibold">Profile Name</th>
                    <th className="py-2.5 px-3 font-semibold">Relation</th>
                    <th className="py-2.5 px-3 font-semibold">Date of Birth</th>
                    <th className="py-2.5 px-3 font-semibold">Social Media</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist/60">
                  {user.clientProfiles.map((profile) => (
                    <tr key={profile.profileId}>
                      <td className="py-3 px-3 font-medium text-pine">
                        {profile.profileName}
                      </td>
                      <td className="py-3 px-3 text-pine/80">
                        {formatRelation(profile.relationToAccountHolder)}
                      </td>
                      <td className="py-3 px-3 font-mono text-pine/70 tabular-nums whitespace-nowrap">
                        {formatDate(profile.dateOfBirth)}
                      </td>
                      <td className="py-3 px-3 text-pine/80">
                        {profile.socmedPlatform || profile.socmedUsername
                          ? [profile.socmedPlatform, profile.socmedUsername]
                              .filter(Boolean)
                              .join(' · ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
