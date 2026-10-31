/**
 * Admin user directory API — mock-mode parity with backend /admin/users.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_AUTH_MODE;
  delete process.env.NEXT_PUBLIC_LIVE_ROUTES;
});

describe('admin user directory (mock mode)', () => {
  it('paginates users and reports the total', async () => {
    const { api } = await import('../lib/api');

    const first = await api.getAdminUsers({ page: 1, pageSize: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.total).toBe(24);
    expect(first.page).toBe(1);

    const last = await api.getAdminUsers({ page: 3, pageSize: 10 });
    expect(last.items).toHaveLength(4);
    expect(last.total).toBe(24);
  });

  it('searches by email and profile name', async () => {
    const { api } = await import('../lib/api');

    const byEmail = await api.getAdminUsers({ search: 'maria.santos' });
    expect(byEmail.total).toBe(1);
    expect(byEmail.items[0].email).toBe('maria.santos@example.com');

    const byName = await api.getAdminUsers({ search: 'elena' });
    expect(byName.total).toBe(1);
    expect(byName.items[0].fullName).toBe('Dr. Elena Reyes');
  });

  it('filters by role', async () => {
    const { api } = await import('../lib/api');

    const psychologists = await api.getAdminUsers({ role: 'psychologist' });
    expect(psychologists.total).toBe(3);
    expect(psychologists.items.every((u) => u.role === 'psychologist')).toBe(true);
  });

  it('updates a role and persists it in mock state', async () => {
    const { api } = await import('../lib/api');

    const updated = await api.updateAdminUserRole('usr-003', {
      role: 'psychologist',
      fullName: 'Maria Santos',
    });
    expect(updated.role).toBe('psychologist');
    expect(updated.fullName).toBe('Maria Santos');

    const after = await api.getAdminUsers({ search: 'maria.santos' });
    expect(after.items[0].role).toBe('psychologist');
  });

  it('requires a full name for the psychologist role', async () => {
    const { api } = await import('../lib/api');

    await expect(
      api.updateAdminUserRole('usr-004', { role: 'psychologist' })
    ).rejects.toThrow(/Full name is required/i);
  });

  it('blocks changing your own role', async () => {
    const { useAuthStore } = await import('../authStore');
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        email: 'admin@mock.psychave.local',
        username: 'admin',
        role: 'admin',
        cognitoSub: 'mock-admin',
      },
    });

    const { api } = await import('../lib/api');

    await expect(
      api.updateAdminUserRole('usr-001', { role: 'client' })
    ).rejects.toThrow(/own role/i);
  });

  it('blocks demoting the last admin', async () => {
    const { api } = await import('../lib/api');

    await api.updateAdminUserRole('usr-023', { role: 'client' });

    await expect(
      api.updateAdminUserRole('usr-001', { role: 'client' })
    ).rejects.toThrow(/last admin/i);
  });
});
