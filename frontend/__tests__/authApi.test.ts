/**
 * TDD — RED Phase
 * Auth API functions: loginUser, registerUser, confirmUser,
 *                     resendCode, requestForgotPassword, confirmForgotPassword
 *
 * Tests mock the fetch layer and verify the dual-mode contract:
 *  - AUTH_MODE=mock → returns mock data immediately
 *  - AUTH_MODE=live → calls backend endpoints and surfaces errors correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the auth api module once it exists
// For now these tests define the expected shape and behaviour

// ─── Mock next/navigation (needed if any imports pull it in transitively) ───
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({}),
}));

// ─── Intercept fetch globally ────────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

// We import the api module — it reads AUTH_MODE from process.env at module load time
// So we reset modules between tests to allow env overrides
describe('auth API — mock mode', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_MODE;
  });

  it('loginUser resolves with a mock session containing an accessToken', async () => {
    const { authApi } = await import('../authApi');
    const result = await authApi.loginUser({ username: 'testuser', password: 'Pass@123' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('idToken');
    expect(typeof result.accessToken).toBe('string');
  });

  it('mock login derives role from username for dashboard access', async () => {
    const { authApi } = await import('../authApi');

    const client = await authApi.loginUser({ username: 'client', password: 'Pass@123' });
    const psychologist = await authApi.loginUser({
      username: 'psychologist',
      password: 'Pass@123',
    });
    const admin = await authApi.loginUser({ username: 'admin', password: 'Pass@123' });

    const groups = (token: string) =>
      JSON.parse(atob(token.split('.')[1]))['cognito:groups'] as string[];

    expect(groups(client.idToken)).toEqual([]);
    expect(groups(psychologist.idToken)).toEqual(['psychologist']);
    expect(groups(admin.idToken)).toEqual(['admin']);
  });

  it('registerUser resolves with a message in mock mode', async () => {
    const { authApi } = await import('../authApi');
    const result = await authApi.registerUser({
      email: 'test@test.com',
      username: 'newuser',
      password: 'Pass@123',
      role: 'client',
    });
    expect(result).toHaveProperty('message');
  });

  it('confirmUser resolves with a message in mock mode', async () => {
    const { authApi } = await import('../authApi');
    const result = await authApi.confirmUser({ username: 'testuser', confirmationCode: '123456' });
    expect(result).toHaveProperty('message');
  });

  it('resendCode resolves with a message in mock mode', async () => {
    const { authApi } = await import('../authApi');
    const result = await authApi.resendCode('testuser');
    expect(result).toHaveProperty('message');
  });

  it('requestForgotPassword resolves with a message in mock mode', async () => {
    const { authApi } = await import('../authApi');
    const result = await authApi.requestForgotPassword('testuser');
    expect(result).toHaveProperty('message');
  });

  it('confirmForgotPassword resolves with a message in mock mode', async () => {
    const { authApi } = await import('../authApi');
    const result = await authApi.confirmForgotPassword({
      username: 'testuser',
      newPassword: 'NewPass@99',
      confirmationCode: '654321',
    });
    expect(result).toHaveProperty('message');
  });
});

describe('auth API — live mode (real fetch)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_MODE;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('loginUser calls POST /auth/login with credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        AccessToken: 'access-tok',
        IdToken: 'id-tok',
        RefreshToken: 'refresh-tok',
      }),
    });

    const { authApi } = await import('../authApi');
    const result = await authApi.loginUser({ username: 'realuser', password: 'Pass@123' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/login');
    expect(JSON.parse(opts.body)).toEqual({ username: 'realuser', password: 'Pass@123' });
    expect(result.accessToken).toBe('access-tok');
  });

  it('loginUser throws a readable error on 400 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'Incorrect username or password.' }),
    });

    const { authApi } = await import('../authApi');
    await expect(authApi.loginUser({ username: 'u', password: 'p' })).rejects.toThrow(
      'Incorrect username or password.'
    );
  });

  it('registerUser calls POST /auth/create-user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'register successful, check email for code' }),
    });

    const { authApi } = await import('../authApi');
    await authApi.registerUser({
      email: 'user@example.com',
      username: 'username1',
      password: 'Pass@123',
      role: 'client',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/create-user');
  });

  it('confirmUser calls POST /auth/confirm', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'user confirmed' }),
    });

    const { authApi } = await import('../authApi');
    await authApi.confirmUser({ username: 'u', confirmationCode: '123456' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/confirm');
  });
});
