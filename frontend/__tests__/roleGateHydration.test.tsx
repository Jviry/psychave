/**
 * Regression: React's hydration pass renders `useSyncExternalStore` with the
 * store's SERVER snapshot (zustand's `getInitialState()`), which is the
 * unauthenticated default — even though the live store has already hydrated a
 * valid session. RoleGate must not treat that transient snapshot as a logout.
 *
 * Bug: on every full page load (refresh), a logged-in user was redirected to
 * /login because the redirect effect acted on the stale hydration snapshot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

// Hook values as seen DURING React's hydration pass — deliberately logged out.
const hydrationSnapshot = { isAuthenticated: false, user: null };

// The live store — already hydrated from localStorage and fully authenticated.
const liveStore = {
  isAuthenticated: true,
  user: {
    email: 'juan@test.com',
    username: 'juan',
    role: 'client',
    cognitoSub: 'sub-juan',
  },
  getDashboardPath: () => '/bookings',
};

vi.mock('../authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof hydrationSnapshot) => unknown) =>
      selector(hydrationSnapshot),
    {
      getState: () => liveStore,
      persist: {
        hasHydrated: () => true,
        onFinishHydration: () => () => {},
      },
    }
  ),
}));

// Imported after the mock so RoleGate binds to it.
import { RoleGate } from '../components/auth/RoleGate';

beforeEach(() => {
  replace.mockReset();
});

describe('RoleGate during the hydration pass', () => {
  it('does not bounce a hydrated session to /login on a stale snapshot', async () => {
    render(
      <RoleGate role="client">
        <p>Client workspace</p>
      </RoleGate>
    );

    // Give effects a chance to run; the gate may still show the skeleton this
    // pass, but it must NOT navigate the user away.
    await new Promise((resolve) => setTimeout(resolve, 25));
    await waitFor(() => expect(replace).not.toHaveBeenCalledWith('/login'));
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('still routes a genuinely wrong role using the live store', async () => {
    render(
      <RoleGate role="psychologist">
        <p>Psychologist workspace</p>
      </RoleGate>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/bookings'));
  });
});
