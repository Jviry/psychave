'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  keepPreviousData,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Mail,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { CognitoRole, PsychologistInvitation } from '@/lib/types';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/useAppStore';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Modal,
  Select,
  Skeleton,
} from '@/components/ui/primitives';

const PAGE_SIZE = 10;

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

export default function AdminUsersPage() {
  const router = useRouter();
  const publishFlowEvent = useAppStore((s) => s.publishFlowEvent);
  const currentEmail = useAuthStore((state) => state.user?.email);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<CognitoRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(PAGE_SIZE);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdInvitation, setCreatedInvitation] =
    useState<PsychologistInvitation | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Debounce typing so each keystroke does not fire a paginated request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any filter change starts from the first page.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'users', { search, role: roleFilter, page, pageSize }],
    queryFn: () => api.getAdminUsers({ search, role: roleFilter, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  // A role change can shrink the filtered result set below the current page.
  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.invitePsychologist(email),
    onSuccess: (invitation) => {
      setInviteError(null);
      setCreatedInvitation(invitation);
      setCopiedLink(false);
      publishFlowEvent(
        'Psychologist Invitation Sent',
        `Single-use 48-hour invitation created and emailed to ${invitation.email}.`
      );
    },
    onError: (err) => {
      setInviteError(
        getFriendlyErrorMessage(
          err,
          'Could not create the psychologist invitation.'
        )
      );
    },
  });

  function openInviteModal() {
    setInviteOpen(true);
    setInviteEmail('');
    setInviteError(null);
    setCreatedInvitation(null);
    setCopiedLink(false);
  }

  function closeInviteModal() {
    setInviteOpen(false);
    setInviteError(null);
    setCreatedInvitation(null);
    setCopiedLink(false);
  }

  function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviteMutation.isPending) return;
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    inviteMutation.mutate(trimmed);
  }

  async function handleCopyInviteLink() {
    if (!createdInvitation) return;
    try {
      await navigator.clipboard.writeText(createdInvitation.invitationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-mist pb-4">
        <h1 className="font-heading text-3xl font-medium text-pine">
          User Directory &amp; Access Roles
        </h1>
        <Button variant="primary" size="md" onClick={openInviteModal}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Invite Psychologist
        </Button>
      </header>

      <Card className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-mist pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,20rem)_12rem] gap-4">
            <div>
              <Label htmlFor="admin-user-search">Search users</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45"
                  aria-hidden="true"
                />
                <Input
                  id="admin-user-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by email or name…"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-user-role-filter">Filter by role</Label>
              <Select
                id="admin-user-role-filter"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as CognitoRole | 'all')
                }
              >
                <option value="all">All roles</option>
                <option value="client">Client</option>
                <option value="psychologist">Psychologist</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>

          <p
            className="text-xs font-mono text-accent-ink font-semibold tabular-nums"
            aria-live="polite"
          >
            {total} {total === 1 ? 'account' : 'accounts'}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-800"
          >
            <span>
              {getFriendlyErrorMessage(
                error,
                'Could not load the user directory. Please try again.'
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="shrink-0"
            >
              {isFetching ? 'Retrying…' : 'Try Again'}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">
              Registered user accounts with their usernames, access roles, and join dates
            </caption>
            <thead>
              <tr className="border-b border-mist text-pine/70 bg-parchment">
                <th className="py-3 px-4 font-semibold">Account</th>
                <th className="py-3 px-4 font-semibold">Username</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={4} className="py-3 px-4">
                      <Skeleton className="h-9" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={Users}
                      title="No user accounts found"
                      description={
                        search || roleFilter !== 'all'
                          ? 'No accounts match the current search and role filter.'
                          : 'Registered accounts will appear here once users sign up.'
                      }
                      action={
                        search || roleFilter !== 'all' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchInput('');
                              setSearch('');
                              setRoleFilter('all');
                              setPage(1);
                            }}
                          >
                            Clear Filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = !!currentEmail && user.email === currentEmail;
                  const detailHref = `/admin/users/${user.userId}`;
                  return (
                    <tr
                      key={user.userId}
                      onClick={() => router.push(detailHref)}
                      className="cursor-pointer hover:bg-parchment focus-within:bg-parchment transition-colors"
                    >
                      <td className="py-3.5 px-4 align-middle">
                        <Link
                          href={detailHref}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-pine break-all hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {user.email}
                        </Link>
                        {isSelf && (
                          <p className="text-xs text-accent-ink font-semibold mt-0.5">
                            Your account
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-middle text-pine/80">
                        {user.username || '—'}
                      </td>
                      <td className="py-3.5 px-4 align-middle">
                        <RoleTag role={user.role} />
                      </td>
                      <td className="py-3.5 px-4 align-middle font-mono text-pine/70 tabular-nums whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-4">
          <p className="text-xs text-pine/70" aria-live="polite">
            {total === 0
              ? 'No users to show'
              : `Showing ${firstRow}–${lastRow} of ${total} users`}
            {isFetching && !isLoading && (
              <Loader2
                className="ml-2 inline h-3.5 w-3.5 animate-spin text-accent-ink"
                aria-label="Loading page"
              />
            )}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Button>
            <span className="text-xs font-mono text-pine/70 tabular-nums px-1">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || isFetching}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={inviteOpen}
        onClose={closeInviteModal}
        title="Invite psychologist"
        description="Send a single-use, 48-hour registration link to a verified psychologist."
        maxWidth="md"
        footer={
          createdInvitation ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreatedInvitation(null);
                  setInviteEmail('');
                  setInviteError(null);
                }}
              >
                Invite another
              </Button>
              <Button type="button" variant="primary" onClick={closeInviteModal}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={closeInviteModal}
                disabled={inviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="invite-psychologist-form"
                disabled={inviteMutation.isPending || !inviteEmail.trim()}
              >
                {inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
              </Button>
            </>
          )
        }
      >
        {createdInvitation ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-mint bg-parchment px-4 py-3 text-xs text-pine space-y-1">
              <p className="font-semibold text-accent-ink">
                Invitation sent to {createdInvitation.email}
              </p>
              <p className="text-pine/75">
                Valid until {formatDate(createdInvitation.expiresAt)} (48 hours, single-use).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="created-invitation-url">
                Single-use invitation link
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="created-invitation-url"
                  value={createdInvitation.invitationUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInviteLink}
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy Invitation Link
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-pine/60">
                An invitation email has been sent. You can also copy this link to share directly.
              </p>
            </div>
          </div>
        ) : (
          <form
            id="invite-psychologist-form"
            onSubmit={submitInvite}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="invite-psychologist-email">
                Psychologist email address
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45"
                  aria-hidden="true"
                />
                <Input
                  id="invite-psychologist-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="practitioner@example.com"
                  className="pl-9"
                  required
                  data-autofocus
                />
              </div>
              <p className="mt-1.5 text-xs text-pine/60">
                The psychologist will receive a single-use link to set their username, password, PRC license, specialization, bio, and social media contact links.
              </p>
            </div>

            {inviteError && (
              <p role="alert" className="text-xs text-red-700">
                {inviteError}
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
