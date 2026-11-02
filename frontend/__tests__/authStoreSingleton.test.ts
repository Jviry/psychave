/**
 * Regression: the auth store must survive Next.js chunk duplication and a
 * full page reload.
 *
 * Bug being locked in: `authStore.ts` got compiled into several client chunks
 * (per-route page.js/layout.js copies). Each copy called `create(persist(...))`
 * independently, producing multiple zustand instances hydrating from the same
 * `psychave-auth` entry. RoleGate on /bookings could bind to a copy that
 * stayed in its default (unauthenticated) state and bounced a logged-in user
 * to /login on refresh, even though localStorage held a valid session.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'psychave-auth';

const seededPayload = JSON.stringify({
  state: {
    isAuthenticated: true,
    accessToken: 'access-token',
    idToken: 'id-token',
    refreshToken: 'refresh-token',
    user: {
      email: 'juan@test.com',
      username: 'juan',
      role: 'client',
      cognitoSub: 'sub-juan',
    },
  },
  version: 0,
});

type AuthStore = typeof import('../authStore')['useAuthStore'];

/** Simulate a fresh page load: new chunk copy + empty module registry. */
function simulatePageLoad() {
  delete (globalThis as Record<string, unknown>).__psychaveAuthStore;
  vi.resetModules();
}

async function importAuthStore(): Promise<AuthStore> {
  const mod = await import('../authStore');
  return mod.useAuthStore;
}

function waitForHydration(store: AuthStore): Promise<void> {
  return new Promise((resolve) => {
    if (store.persist?.hasHydrated()) {
      resolve();
      return;
    }
    let unsubscribe: (() => void) | undefined;
    unsubscribe = store.persist?.onFinishHydration(() => {
      unsubscribe?.();
      resolve();
    });
  });
}

beforeEach(() => {
  localStorage.clear();
  simulatePageLoad();
});

describe('auth store singleton across chunk copies', () => {
  it('returns the exact same store instance when the module is evaluated again', async () => {
    const first = await importAuthStore();
    // A second chunk copy resolves `authStore.ts` a second time.
    vi.resetModules();
    const second = await importAuthStore();

    expect(second).toBe(first);
  });

  it('hydrates an authenticated session on a full reload', async () => {
    localStorage.setItem(STORAGE_KEY, seededPayload);

    const store = await importAuthStore();
    await waitForHydration(store);

    const state = store.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('client');
    expect(state.accessToken).toBe('access-token');
  });

  it('a copy created after reload cannot diverge into the default state', async () => {
    localStorage.setItem(STORAGE_KEY, seededPayload);

    // First chunk copy boots and hydrates.
    const first = await importAuthStore();
    await waitForHydration(first);

    // Second chunk copy of the same page (the failing scenario pre-fix).
    vi.resetModules();
    const second = await importAuthStore();
    await waitForHydration(second);

    expect(second).toBe(first);
    expect(second.getState().isAuthenticated).toBe(true);
    expect(second.getState().user?.role).toBe('client');
  });

  it('stays logged out on reload after logout', async () => {
    localStorage.setItem(STORAGE_KEY, seededPayload);

    const before = await importAuthStore();
    await waitForHydration(before);
    before.getState().logout();

    simulatePageLoad();
    const after = await importAuthStore();
    await waitForHydration(after);

    expect(after.getState().isAuthenticated).toBe(false);
    expect(after.getState().user).toBeNull();
  });

  it('boots logged out when no entry exists', async () => {
    const store = await importAuthStore();
    await waitForHydration(store);

    expect(store.getState().isAuthenticated).toBe(false);
  });
});
