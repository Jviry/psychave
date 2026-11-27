/**
 * Auth API module — always talks to the FastAPI/Cognito backend.
 *
 * Maps to backend endpoints:
 *   POST /auth/login           → loginUser
 *   POST /auth/create-user     → registerUser
 *   POST /auth/confirm         → confirmUser
 *   POST /auth/resend-code     → resendCode
 *   POST /auth/request-forgot-password   → requestForgotPassword
 *   POST /auth/confirm-forgot-password   → confirmForgotPassword
 *   POST /auth/refresh-token   → refreshToken
 *   POST /auth/logout          → logoutUser
 */

import { API_BASE_URL } from './api';
import type { ProfileWizardConsent, ProfileWizardProfile } from './consent';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  profile: ProfileWizardProfile;
  consent: ProfileWizardConsent;
}

export interface ConfirmCredentials {
  username: string;
  confirmationCode: string;
}

export interface CheckAvailabilityResponse {
  emailAvailable: boolean;
  usernameAvailable: boolean;
}

export interface ForgotPasswordConfirmCredentials {
  username: string;
  newPassword: string;
  confirmationCode: string;
}

export interface PsychologistInvitationInfo {
  email: string;
  expiresAt: string;
}

export interface PsychologistInviteRegisterCredentials {
  token: string;
  username: string;
  password: string;
  fullName: string;
  licenseNumber: string;
  specialization: string;
  bio: string;
  socialMediaLinks: { platform: string; url: string }[];
}

interface MessageResponse {
  message: string;
}

// ─── Error Type ───────────────────────────────────────────────────────────────

export class AuthApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(headers || {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timed out. Please check that the backend server is running.');
      }
      throw new Error(
        `Unable to reach the server (${API_BASE_URL}). Please ensure the backend API is running.`
      );
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const data = await res.json();
        if (data?.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        else if (data?.message) detail = data.message;
        if (typeof data?.code === 'string') code = data.code;
      } catch {
        /* body not JSON */
      }
      const retryHeader = res.headers?.get?.('Retry-After');
      const parsedRetry = retryHeader ? Number.parseInt(retryHeader, 10) : NaN;
      const retryAfter = Number.isFinite(parsedRetry) && parsedRetry > 0 ? parsedRetry : undefined;
      throw new AuthApiError(detail, res.status, code, retryAfter);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function post<T>(endpoint: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return request<T>('POST', endpoint, body, headers);
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Log in with username + password.
   * Cognito returns AccessToken/IdToken/RefreshToken (capital-case keys).
   */
  loginUser: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const raw = await post<{ AccessToken: string; IdToken: string; RefreshToken: string }>(
      '/auth/login',
      credentials
    );

    return {
      accessToken: raw.AccessToken,
      idToken: raw.IdToken,
      refreshToken: raw.RefreshToken,
    };
  },

  /**
   * Check whether an email and/or username are available for registration.
   */
  checkAvailability: async (params: {
    email?: string;
    username?: string;
  }): Promise<CheckAvailabilityResponse> => {
    const raw = await post<{
      email_available: boolean;
      username_available: boolean;
    }>('/auth/check-availability', {
      email: params.email,
      username: params.username,
    });
    return {
      emailAvailable: raw.email_available,
      usernameAvailable: raw.username_available,
    };
  },

  /**
   * Create a new Cognito user along with their primary 'self' profile and signed consent.
   * Returns a message directing user to check email.
   */
  registerUser: async (credentials: RegisterCredentials): Promise<MessageResponse> =>
    post<MessageResponse>('/auth/create-user', {
      email: credentials.email,
      username: credentials.username,
      password: credentials.password,
      profile: credentials.profile,
      consent: credentials.consent,
    }),

  /**
   * Confirm the user's account with the Cognito verification code sent to email.
   */
  confirmUser: async (credentials: ConfirmCredentials): Promise<MessageResponse> =>
    post<MessageResponse>('/auth/confirm', {
      username: credentials.username,
      confirmation_code: credentials.confirmationCode,
    }),

  /**
   * Resend the Cognito confirmation code to the user's email.
   */
  resendCode: async (username: string): Promise<MessageResponse> =>
    post<MessageResponse>(`/auth/resend-code?username=${encodeURIComponent(username)}`, {}),

  /**
   * Request a forgot-password verification code (step 1).
   */
  requestForgotPassword: async (username: string): Promise<MessageResponse> =>
    post<MessageResponse>(
      `/auth/request-forgot-password?username=${encodeURIComponent(username)}`,
      {}
    ),

  /**
   * Confirm a new password with the verification code (step 2).
   */
  confirmForgotPassword: async (
    credentials: ForgotPasswordConfirmCredentials
  ): Promise<MessageResponse> =>
    post<MessageResponse>('/auth/confirm-forgot-password', {
      username: credentials.username,
      new_password: credentials.newPassword,
      confirmation_code: credentials.confirmationCode,
    }),

  /**
   * Log in via the Next.js BFF so Cognito tokens are stored in httpOnly cookies
   * and never exposed to browser JS or localStorage.
   */
  loginSession: async (
    credentials: LoginCredentials
  ): Promise<{
    user: {
      email: string;
      username: string;
      role: 'client' | 'psychologist' | 'admin';
      cognitoSub: string;
    };
  }> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const data = await res.json();
        if (data?.detail) {
          detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else if (data?.message) {
          detail = data.message;
        }
        if (typeof data?.code === 'string') code = data.code;
      } catch {
        /* ignore */
      }
      throw new AuthApiError(detail, res.status, code);
    }
    return res.json();
  },

  /**
   * Clear httpOnly session cookies and revoke the Cognito session server-side.
   */
  logoutSession: async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* best effort */
    }
  },

  /**
   * Refresh access token using the stored refresh token.
   */
  refreshAccessToken: async (refreshToken: string): Promise<{ accessToken: string }> => {
    const raw = await post<{ AccessToken: string }>('/auth/refresh-token', {
      refresh_token: refreshToken,
    });
    return { accessToken: raw.AccessToken };
  },

  /**
   * Sign out the user from Cognito (invalidates the access token).
   */
  logoutUser: async (accessToken: string, idToken?: string): Promise<MessageResponse> =>
    post<MessageResponse>(
      '/auth/logout',
      { access_token: accessToken },
      {
        Authorization: `Bearer ${idToken || accessToken}`,
      }
    ),

  /**
   * Validate a single-use psychologist invitation token and return the invited email.
   */
  verifyPsychologistInvitation: async (
    token: string
  ): Promise<PsychologistInvitationInfo> => {
    const raw = await request<{ email: string; expires_at: string }>(
      'GET',
      `/auth/psychologist-invitations/${encodeURIComponent(token)}`
    );
    return {
      email: raw.email,
      expiresAt: raw.expires_at,
    };
  },

  /**
   * Complete psychologist registration using a single-use invitation token.
   */
  registerInvitedPsychologist: async (
    input: PsychologistInviteRegisterCredentials
  ): Promise<MessageResponse> =>
    post<MessageResponse>('/auth/register-psychologist', {
      token: input.token,
      username: input.username,
      password: input.password,
      full_name: input.fullName,
      license_number: input.licenseNumber,
      specialization: input.specialization,
      bio: input.bio,
      social_media_links: input.socialMediaLinks,
    }),
};
