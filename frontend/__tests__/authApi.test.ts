/**
 * Auth API functions always call the Cognito-backed FastAPI endpoints.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({}),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('auth API — real fetch', () => {
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
    expect(result.idToken).toBe('id-tok');
    expect(result.refreshToken).toBe('refresh-tok');
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

  it('resendCode calls POST /auth/resend-code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'confirmation code sent' }),
    });

    const { authApi } = await import('../authApi');
    await authApi.resendCode('u');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/resend-code');
  });

  it('requestForgotPassword calls POST /auth/request-forgot-password', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'confirmation code sent to email' }),
    });

    const { authApi } = await import('../authApi');
    await authApi.requestForgotPassword('u');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/request-forgot-password');
  });

  it('confirmForgotPassword calls POST /auth/confirm-forgot-password', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'password change successful' }),
    });

    const { authApi } = await import('../authApi');
    await authApi.confirmForgotPassword({
      username: 'u',
      newPassword: 'NewPass@99',
      confirmationCode: '654321',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/confirm-forgot-password');
  });
});
