import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGetAdminUsers = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    getAdminUsers: (...args: unknown[]) => mockGetAdminUsers(...args),
    invitePsychologist: vi.fn(),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { email: string } }) => unknown) =>
    selector({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: (selector: (s: { publishFlowEvent: () => void }) => unknown) =>
    selector({ publishFlowEvent: vi.fn() }),
}));

import AdminUsersPage from '../app/(site)/admin/users/page';

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetAdminUsers.mockReset();
    mockGetAdminUsers.mockResolvedValue({
      items: [
        {
          userId: 'usr-123',
          email: 'maria@example.com',
          username: 'maria_santos',
          role: 'client',
          fullName: 'Maria Santos',
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it('omits the eyebrow header, removes Actions column, shows Username column, and navigates on row click', async () => {
    renderWithQuery(<AdminUsersPage />);

    expect(screen.queryByText(/Admin Dashboard/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/User Accounts & Role Administration/i)
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', { name: 'Username' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Name' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Actions' })
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('maria_santos')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('maria_santos'));
    expect(mockPush).toHaveBeenCalledWith('/admin/users/usr-123');
  });
});
