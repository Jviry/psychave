/**
 * Auth API module — dual-mode (live backend ↔ mock fallback)
 *
 * Maps to backend endpoints from PR #28:
 *   POST /auth/login           → loginUser
 *   POST /auth/create-user     → registerUser
 *   POST /auth/confirm         → confirmUser
 *   POST /auth/resend-code     → resendCode
 *   POST /auth/request-forgot-password   → requestForgotPassword
 *   POST /auth/confirm-forgot-password   → confirmForgotPassword
 *   POST /auth/refresh-token   → refreshToken
 *   POST /auth/logout          → logoutUser
 */

import { API_BASE_URL, shouldGoLive } from './lib/api';

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
  role: 'client' | 'psychologist';
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

// ─── Mock delay ──────────────────────────────────────────────────────────────

const mockDelay = () => new Promise((r) => setTimeout(r, 200));

// ─── Mock session (deterministic for prototype) ──────────────────────────────

const MOCK_SESSION: LoginResponse = {
  accessToken: 'mock-access-token-psychave-prototype',
  idToken: 'mock-id-token-psychave-prototype',
  refreshToken: 'mock-refresh-token-psychave-prototype',
};

// ─── API ─────────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Log in with username + password.
   * Cognito returns AccessToken/IdToken/RefreshToken (capital-case keys).
   */
  loginUser: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { ...MOCK_SESSION };
    }

    // Cognito via backend returns AuthenticationResult with capital-case keys
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
  registerUser: async (credentials: RegisterCredentials): Promise<MessageResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { message: 'register successful, check email for code' };
    }

    return post<MessageResponse>('/auth/create-user', {
      email: credentials.email,
      username: credentials.username,
      password: credentials.password,
      role: credentials.role,
    });
  },

  /**
   * Confirm the user's account with the Cognito verification code sent to email.
   */
  confirmUser: async (credentials: ConfirmCredentials): Promise<MessageResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { message: 'user confirmed' };
    }

    return post<MessageResponse>('/auth/confirm', {
      username: credentials.username,
      confirmation_code: credentials.confirmationCode,
    });
  },

  /**
   * Resend the Cognito confirmation code to the user's email.
   */
  resendCode: async (username: string): Promise<MessageResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { message: 'confirmation code sent' };
    }

    return post<MessageResponse>(`/auth/resend-code?username=${encodeURIComponent(username)}`, {});
  },

  /**
   * Request a forgot-password verification code (step 1).
   */
  requestForgotPassword: async (username: string): Promise<MessageResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { message: 'confirmation code sent to email' };
    }

    return post<MessageResponse>(
      `/auth/request-forgot-password?username=${encodeURIComponent(username)}`,
      {}
    );
  },

  /**
   * Confirm a new password with the verification code (step 2).
   */
  confirmForgotPassword: async (credentials: ForgotPasswordConfirmCredentials): Promise<MessageResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { message: 'password change successful' };
    }

    return post<MessageResponse>('/auth/confirm-forgot-password', {
      username: credentials.username,
      new_password: credentials.newPassword,
      confirmation_code: credentials.confirmationCode,
    });
  },

  /**
   * Refresh access token using the stored refresh token.
   */
  refreshAccessToken: async (refreshToken: string): Promise<{ accessToken: string }> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { accessToken: MOCK_SESSION.accessToken };
    }

    const raw = await post<{ AccessToken: string }>(
      `/auth/refresh-token?refresh_token=${encodeURIComponent(refreshToken)}`,
      {}
    );
    return { accessToken: raw.AccessToken };
  },

  /**
   * Sign out the user from Cognito (invalidates the access token).
   */
  logoutUser: async (accessToken: string): Promise<MessageResponse> => {
    if (!shouldGoLive('/auth')) {
      await mockDelay();
      return { message: 'logout successful' };
    }

    return post<MessageResponse>(`/auth/logout?access_token=${encodeURIComponent(accessToken)}`, {}, {
      Authorization: `Bearer ${accessToken}`,
    });
  },
};
