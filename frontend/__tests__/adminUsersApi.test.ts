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
        username: 'clinic_admin',
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
    expect(result.items[0].username).toBe('clinic_admin');
    expect(result.items[0].fullName).toBe('Clinic Administrator');
  });

  it('fetches and maps single user details', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_id: 'usr-002',
          email: 'client@example.com',
          username: 'juan_delacruz',
          role: 'client',
          full_name: null,
          created_at: '2026-02-01T09:00:00+08:00',
          psychologist_profile: null,
          client_profiles: [
            {
              profile_id: 'prof-001',
              profile_name: 'Juan Dela Cruz',
              relation_to_account_holder: 'self',
              date_of_birth: '1995-05-12',
              socmed_platform: 'Instagram',
              socmed_username: '@juandc',
            },
          ],
        }),
        { status: 200 }
      )
    );

    const { api } = await import('../lib/api');
    const detail = await api.getAdminUserDetail('usr-002');

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/admin/users/usr-002');
    expect(detail.username).toBe('juan_delacruz');
    expect(detail.psychologistProfile).toBeNull();
    expect(detail.clientProfiles).toHaveLength(1);
    expect(detail.clientProfiles[0].profileName).toBe('Juan Dela Cruz');
    expect(detail.clientProfiles[0].socmedUsername).toBe('@juandc');
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

  it('creates a psychologist invitation and maps response fields', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          invitation_id: 'inv-001',
          email: 'dr.santos@example.com',
          invitation_url:
            'http://localhost:3000/register/psychologist?token=tok_123',
          expires_at: '2026-11-24T12:00:00Z',
          created_at: '2026-11-22T12:00:00Z',
        }),
        { status: 201 }
      )
    );

    const { api } = await import('../lib/api');
    const invited = await api.invitePsychologist('  Dr.Santos@example.com ');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/admin/psychologist-invitations');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ email: 'dr.santos@example.com' });
    expect(invited.invitationId).toBe('inv-001');
    expect(invited.invitationUrl).toBe(
      'http://localhost:3000/register/psychologist?token=tok_123'
    );
  });
});
