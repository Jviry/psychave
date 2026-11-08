import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { RoleGate } from '../components/auth/RoleGate';
import { useAuthStore } from '../authStore';
import type { CognitoRole } from '../lib/types';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

function signIn(role: CognitoRole) {
  act(() => {
    useAuthStore.getState().login({
      accessToken: 'access',
      idToken: 'id',
      refreshToken: 'refresh',
      user: {
        email: `${role}@test.com`,
        username: role,
        role,
        cognitoSub: `sub-${role}`,
      },
    });
  });
}

beforeEach(() => {
  replace.mockReset();
  useAuthStore.getState().logout();
});

describe('RoleGate', () => {
  it('renders children for the matching role', async () => {
    signIn('client');

    render(
      <RoleGate role="client">
        <p>Client workspace</p>
      </RoleGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Client workspace')).toBeTruthy();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated visitors to login', async () => {
    render(
      <RoleGate role="client">
        <p>Client workspace</p>
      </RoleGate>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Client workspace')).toBeNull();
  });

  it('redirects a wrong-role user to their own dashboard', async () => {
    signIn('client');

    render(
      <RoleGate role="psychologist">
        <p>Psychologist workspace</p>
      </RoleGate>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/bookings'));
    expect(screen.queryByText('Psychologist workspace')).toBeNull();
  });
});
