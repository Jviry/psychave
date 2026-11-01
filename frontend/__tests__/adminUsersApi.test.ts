/**
 * Admin user directory API — authenticated backend contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
});

function userPage(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        user_id: 'usr-001',
        email: 'admin@example.com',
        role: 'admin',
        full_name: 'Clinic Administrator',
        created_at: '2026-01-05T09:00:00+08:00',
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
    ...overrides,
  };
}

describe('admin user directory', () => {
  it('sends pagination, search, and role params', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(userPage()), { status: 200 })
    );

    const { api } = await import('../lib/api');
    const result = await api.getAdminUsers({
      search: '  admin  ',
      role: 'admin',
      page: 2,
      pageSize: 25,
    });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe('/admin/users');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('page_size')).toBe('25');
    expect(parsed.searchParams.get('search')).toBe('admin');
    expect(parsed.searchParams.get('role')).toBe('admin');
    expect(result.pageSize).toBe(10);
    expect(result.items[0].fullName).toBe('Clinic Administrator');
  });

  it('omits search and role when empty/all', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(userPage()), { status: 200 })
    );

    const { api } = await import('../lib/api');
    await api.getAdminUsers({ search: '   ', role: 'all' });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.has('search')).toBe(false);
    expect(parsed.searchParams.has('role')).toBe(false);
  });

  it('maps a role update response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_id: 'usr-003',
          email: 'maria.santos@example.com',
          role: 'psychologist',
          full_name: 'Maria Santos',
          created_at: '2026-01-18T09:00:00+08:00',
        }),
        { status: 200 }
      )
    );

    const { api } = await import('../lib/api');
    const updated = await api.updateAdminUserRole('usr-003', {
      role: 'psychologist',
      fullName: 'Maria Santos',
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/admin/users/usr-003/role');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({
      role: 'psychologist',
      full_name: 'Maria Santos',
    });
    expect(updated.role).toBe('psychologist');
    expect(updated.fullName).toBe('Maria Santos');
  });

  it('surfaces the backend guardrail error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: 'Cannot change the role of the last admin account' }),
        { status: 409 }
      )
    );

    const { api } = await import('../lib/api');
    await expect(
      api.updateAdminUserRole('usr-001', { role: 'client' })
    ).rejects.toThrow(/last admin/i);
  });
});
