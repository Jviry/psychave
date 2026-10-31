'use client';

import React, { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { AdminUser, CognitoRole } from '../../../../lib/types';
import { useAuthStore } from '../../../../authStore';
import { useAppStore } from '../../../../stores/useAppStore';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Modal,
  Select,
  Skeleton,
} from '../../../../components/ui/primitives';

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
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();
  const currentEmail = useAuthStore((state) => state.user?.email);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<CognitoRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(PAGE_SIZE);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [targetRole, setTargetRole] = useState<CognitoRole>('client');
  const [fullName, setFullName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Debounce typing so each keystroke does not fire a paginated request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any filter change starts from the first page.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const { data, isLoading, isFetching, error } = useQuery({
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

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
      name,
    }: {
      userId: string;
      role: CognitoRole;
      name?: string;
    }) => api.updateAdminUserRole(userId, { role, fullName: name }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      publishFlowEvent(
        'User Role Updated',
        `${updated.email} is now ${roleLabels[updated.role]}. They must sign in again before the new role takes effect.`
      );
      closeModal();
    },
    onError: (err) => {
      setFormError(
        err instanceof Error ? err.message : 'Could not change this user’s role.'
      );
    },
  });

  function openModal(user: AdminUser) {
    setEditingUser(user);
    setTargetRole(user.role);
    setFullName(user.fullName ?? '');
    setFormError(null);
  }

  function closeModal() {
    setEditingUser(null);
    setFormError(null);
  }

  function submitRoleChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser || roleMutation.isPending) return;

    const trimmedName = fullName.trim();
    if (targetRole === 'psychologist' && !trimmedName && !editingUser.fullName) {
      setFormError(
        'Full name is required when assigning the psychologist role.'
      );
      return;
    }

    roleMutation.mutate({
      userId: editingUser.userId,
      role: targetRole,
      name: trimmedName || undefined,
    });
  }

  const nameRequired =
    targetRole === 'psychologist' && !editingUser?.fullName;
  const unchangedRole = !!editingUser && targetRole === editingUser.role;

  return (
    <div className="space-y-10">
      <header className="space-y-2 border-b border-mist pb-6">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
          <span>Admin Dashboard</span>
          <span aria-hidden="true">·</span>
          <span>User Accounts &amp; Role Administration</span>
        </div>
        <h1 className="font-heading text-4xl font-medium text-pine">
          User Directory &amp; Access Roles
        </h1>
        <p className="text-sm text-pine/80 max-w-3xl">
          Search registered accounts, filter by access role, and assign the Client,
          Psychologist, or Admin role. Role changes update the Cognito access group —
          the affected user must sign in again before the new dashboard unlocks.
        </p>
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
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800"
          >
            {error instanceof Error
              ? error.message
              : 'Could not load the user directory.'}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">
              Registered user accounts with their access roles and join dates
            </caption>
            <thead>
              <tr className="border-b border-mist text-pine/70 bg-parchment">
                <th className="py-3 px-4 font-semibold">Account</th>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Joined</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={5} className="py-3 px-4">
                      <Skeleton className="h-9" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Users}
                      title="No user accounts found"
                      description={
                        search || roleFilter !== 'all'
                          ? 'No accounts match the current search and role filter. Try clearing them.'
                          : 'Registered accounts will appear here once users sign up.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = !!currentEmail && user.email === currentEmail;
                  return (
                    <tr key={user.userId} className="hover:bg-parchment">
                      <td className="py-3.5 px-4 align-middle">
                        <p className="font-medium text-pine break-all">
                          {user.email}
                        </p>
                        {isSelf && (
                          <p className="text-xs text-accent-ink font-semibold mt-0.5">
                            Your account
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-middle text-pine/80">
                        {user.fullName || '—'}
                      </td>
                      <td className="py-3.5 px-4 align-middle">
                        <RoleTag role={user.role} />
                      </td>
                      <td className="py-3.5 px-4 align-middle font-mono text-pine/70 tabular-nums whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 align-middle text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openModal(user)}
                          disabled={isSelf}
                          title={
                            isSelf
                              ? 'You cannot change your own role'
                              : `Change role for ${user.email}`
                          }
                        >
                          Change role
                        </Button>
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
        open={!!editingUser}
        onClose={closeModal}
        title="Change user role"
        description={
          editingUser
            ? `Update access for ${editingUser.email}.`
            : undefined
        }
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closeModal}
              disabled={roleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="role-change-form"
              disabled={
                roleMutation.isPending || unchangedRole || !editingUser
              }
            >
              {roleMutation.isPending ? 'Saving…' : 'Save role'}
            </Button>
          </>
        }
      >
        <form
          id="role-change-form"
          onSubmit={submitRoleChange}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="role-change-select">New role</Label>
            <Select
              id="role-change-select"
              value={targetRole}
              onChange={(event) =>
                setTargetRole(event.target.value as CognitoRole)
              }
              data-autofocus
            >
              <option value="client">Client</option>
              <option value="psychologist">Psychologist</option>
              <option value="admin">Admin</option>
            </Select>
            {editingUser && (
              <p className="mt-1.5 text-xs text-pine/60">
                Current role: <span className="font-semibold">{roleLabels[editingUser.role]}</span>
              </p>
            )}
          </div>

          {targetRole !== 'client' && (
            <div>
              <Label htmlFor="role-change-name">
                Full name{nameRequired ? '' : ' (optional)'}
              </Label>
              <Input
                id="role-change-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Display name shown on internal records"
                aria-required={nameRequired}
              />
              {targetRole === 'psychologist' && (
                <p className="mt-1.5 text-xs text-pine/60">
                  Required for the psychologist profile clients see after booking.
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-mist bg-surface-sunken px-3.5 py-3 text-xs text-pine/75 leading-relaxed">
            Role changes swap the user’s Cognito access group immediately, but their
            current session keeps the old group. They must sign out and sign in again
            before the new dashboard unlocks.
          </div>

          {formError && (
            <p role="alert" className="text-xs text-red-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
