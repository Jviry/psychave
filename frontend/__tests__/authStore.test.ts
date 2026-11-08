/**
 * TDD — RED Phase
 * useAuthStore: Zustand store for auth session state.
 *
 * Tests the store's actions (login, logout) and derived state (isAuthenticated, user).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { useAuthStore } from '../authStore';

// Reset Zustand between tests
beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    accessToken: null,
    idToken: null,
    refreshToken: null,
    user: null,
  });
});

describe('useAuthStore', () => {
  it('starts unauthenticated with no user', () => {
    const { isAuthenticated, user, accessToken } = useAuthStore.getState();
    expect(isAuthenticated).toBe(false);
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });

  it('login() sets isAuthenticated and stores user info', () => {
    act(() => {
      useAuthStore.getState().login({
        accessToken: 'acc-tok',
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        user: { email: 'user@test.com', username: 'testuser', role: 'client', cognitoSub: 'sub-123' },
      });
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('acc-tok');
    expect(state.user?.email).toBe('user@test.com');
    expect(state.user?.role).toBe('client');
  });

  it('logout() clears all auth state', () => {
    act(() => {
      useAuthStore.getState().login({
        accessToken: 'acc-tok',
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        user: { email: 'user@test.com', username: 'testuser', role: 'client', cognitoSub: 'sub-123' },
      });
    });

    act(() => {
      useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('role-based dashboard path is correct for client', () => {
    act(() => {
      useAuthStore.getState().login({
        accessToken: 'acc-tok',
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        user: { email: 'c@test.com', username: 'client1', role: 'client', cognitoSub: 'sub-c' },
      });
    });
    expect(useAuthStore.getState().getDashboardPath()).toBe('/bookings');
  });

  it('role-based dashboard path is correct for psychologist', () => {
    act(() => {
      useAuthStore.getState().login({
        accessToken: 'acc-tok',
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        user: { email: 'p@test.com', username: 'psych1', role: 'psychologist', cognitoSub: 'sub-p' },
      });
    });
    expect(useAuthStore.getState().getDashboardPath()).toBe('/psych/queue');
  });

  it('role-based dashboard path is correct for admin', () => {
    act(() => {
      useAuthStore.getState().login({
        accessToken: 'acc-tok',
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        user: { email: 'a@test.com', username: 'admin1', role: 'admin', cognitoSub: 'sub-a' },
      });
    });
    expect(useAuthStore.getState().getDashboardPath()).toBe('/admin/users');
  });

  it('getDashboardPath returns /login when unauthenticated', () => {
    expect(useAuthStore.getState().getDashboardPath()).toBe('/login');
  });
});
