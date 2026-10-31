import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CognitoRole } from './lib/types';

export interface AuthUser {
  email: string;
  username: string;
  role: CognitoRole;
  cognitoSub: string;
}

interface LoginPayload {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;

  login: (payload: LoginPayload) => void;
  logout: () => void;
  getDashboardPath: () => string;
}

const ROLE_DASHBOARD: Record<CognitoRole, string> = {
  client: '/bookings',
  psychologist: '/psych/queue',
  admin: '/admin/users',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      accessToken: null,
      idToken: null,
      refreshToken: null,
      user: null,

      login: (payload) =>
        set({
          isAuthenticated: true,
          accessToken: payload.accessToken,
          idToken: payload.idToken,
          refreshToken: payload.refreshToken,
          user: payload.user,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          accessToken: null,
          idToken: null,
          refreshToken: null,
          user: null,
        }),

      getDashboardPath: () => {
        const { user } = get();
        if (!user) return '/login';
        return ROLE_DASHBOARD[user.role] ?? '/';
      },
    }),
    {
      name: 'psychave-auth',
      // Only persist the minimal session info — no sensitive tokens in localStorage in production
      // For the prototype, we persist for convenience. Replace with httpOnly cookies pre-prod.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        idToken: state.idToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
