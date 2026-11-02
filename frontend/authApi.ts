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

import { API_BASE_URL } from './lib/api';

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
}

export interface ConfirmCredentials {
  username: string;
  confirmationCode: string;
}

export interface ForgotPasswordConfirmCredentials {
  username: string;
  newPassword: string;
  confirmationCode: string;
}

interface MessageResponse {
  message: string;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function post<T>(endpoint: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data?.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        else if (data?.message) detail = data.message;
      } catch {
        /* body not JSON */
      }
      throw new Error(detail);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
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
   * Create a new Cognito user. Returns a message directing user to check email.
   */
  registerUser: async (credentials: RegisterCredentials): Promise<MessageResponse> =>
    post<MessageResponse>('/auth/create-user', {
      email: credentials.email,
      username: credentials.username,
      password: credentials.password,
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
   * Refresh access token using the stored refresh token.
   */
  refreshAccessToken: async (refreshToken: string): Promise<{ accessToken: string }> => {
    const raw = await post<{ AccessToken: string }>(
      `/auth/refresh-token?refresh_token=${encodeURIComponent(refreshToken)}`,
      {}
    );
    return { accessToken: raw.AccessToken };
  },

  /**
   * Sign out the user from Cognito (invalidates the access token).
   */
  logoutUser: async (accessToken: string): Promise<MessageResponse> =>
    post<MessageResponse>(`/auth/logout?access_token=${encodeURIComponent(accessToken)}`, {}, {
      Authorization: `Bearer ${accessToken}`,
    }),
};
