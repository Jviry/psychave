/**
 * Integration wiring tests for lib/api.ts (backend-integration branch).
 *
 * Covers:
 *  - Mock mode parity: redaction guard still strips privateClinicalNote,
 *    shouldGoLive() is false in every mode when AUTH_MODE=mock.
 *  - Live adapters: AppointmentRead → BookingRequest mapping (status enum,
 *    slot rows, anonymized codes) without leaking backend shapes to the UI.
 *  - Pickup→slots chain and the pay flow's "never fake success" invariant.
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
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_AUTH_MODE;
  delete process.env.NEXT_PUBLIC_LIVE_ROUTES;
});

describe('mode gating', () => {
  it('mock mode never sends a single request', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
    const { api, shouldGoLive } = await import('../lib/api');

    await api.getBookingsForRole('client');
    await api.getServices();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(shouldGoLive('/appointments')).toBe(false);
    expect(shouldGoLive('/auth/login')).toBe(false);
  });

  it('real mode goes live only for wired prefixes; LIVE_ROUTES narrows further', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
    process.env.NEXT_PUBLIC_LIVE_ROUTES = '/auth,/appointments';
    const { shouldGoLive } = await import('../lib/api');

    expect(shouldGoLive('/auth/login')).toBe(true);
    expect(shouldGoLive('/appointments')).toBe(true);
    expect(shouldGoLive('/services')).toBe(false);
    expect(shouldGoLive('/api/v1/cms')).toBe(false);
    expect(shouldGoLive('/psychologist/appointments/mine')).toBe(false);
  });
});

describe('mock-mode redaction guard (contract §4 — never undo)', () => {
  it('client/admin lists never carry privateClinicalNote', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
    const { api } = await import('../lib/api');

    await api.submitBookingRequest({
      personaId: 'persona-self-01',
      serviceId: 'srv-individual',
      concernsSummary: 'A realistic concern for the demo booking flow.',
    });
    const clientList = await api.getBookingsForRole('client');
    expect(clientList.every((b) => b.privateClinicalNote === undefined)).toBe(true);

    const adminList = await api.getBookingsForRole('admin');
    expect(adminList.every((b) => b.privateClinicalNote === undefined)).toBe(true);

    const clientSingle = await api.getBookingById('BK-2026-103', 'client');
    expect(clientSingle?.privateClinicalNote).toBeUndefined();

    const psychSingle = await api.getBookingById('BK-2026-103', 'psychologist');
    expect(typeof psychSingle?.privateClinicalNote).toBe('string');
  });
});

describe('live adapters (AppointmentRead → BookingRequest)', () => {
  const SLOT_ROWS = [
    { slot_id: 'cc3dd4ee-5f60-7182-93a4-b5c6d7e8f9a0', session_date: '2026-12-05', start_time: '10:00:00', end_time: '11:30:00' },
    { slot_id: 'dd4ee5ff-6071-8293-a4b5-c6d7e8f9a0b1', session_date: '2026-12-06', start_time: '14:00:00', end_time: '15:30:00' },
    { slot_id: 'ee5ff600-7182-93a4-b5c6-d7e8f9a0b1c2', session_date: '2026-12-08', start_time: '18:00:00', end_time: '19:30:00' },
  ];

  const APPOINTMENT_CONFIRMED = {
    appointment_id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    persona_id: '7a3c11a2-1b2c-4d3e-8f90-112233445566',
    persona_name: 'Primary Account Holder',
    persona_relation: 'self',
    service_id: '9a2b1c3d-4e5f-6071-8293-a4b5c6d7e8f9',
    service_name: 'Individual Counseling & Psychotherapy',
    service_duration_minutes: 60,
    service_guardrail: null,
    psychologist_id: 'aa1bb2cc-3d4e-5f60-7182-93a4b5c6d7e8',
    selected_slot_id: 'bb2cc3dd-4e5f-6071-8293-a4b5c6d7e8f9',
    price: 2400,
    presenting_concern: 'Anxiety and burnout for two months.',
    status: 'confirmed',
    requested_datetime: '2026-12-01T10:00:00+08:00',
    proposed_slots: SLOT_ROWS,
  };

  it('getBookingById maps confirmed status + slot rows; no backend fields leak', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/slots')) {
        return new Response(JSON.stringify(SLOT_ROWS), { status: 200 });
      }
      return new Response(JSON.stringify(APPOINTMENT_CONFIRMED), { status: 200 });
    });

    const { api } = await import('../lib/api');
    const booking = await api.getBookingById(APPOINTMENT_CONFIRMED.appointment_id, 'client');

    expect(booking).not.toBeNull();
    expect(booking?.status).toBe('paid-confirmed');
    expect(booking?.contactUnlocked).toBe(true);
    expect(booking?.pricePhp).toBe(2400);
    expect(booking?.concernsSummary).toBe(APPOINTMENT_CONFIRMED.presenting_concern);
    expect(booking?.proposedSlots).toHaveLength(3);
    expect(booking?.proposedSlots[0]?.slotNumber).toBe(1);
    expect(booking?.proposedSlots[0]?.isoDateTime).toBe('2026-12-05T10:00');
    expect(booking?.selectedSlotId).toBe(APPOINTMENT_CONFIRMED.selected_slot_id);
    // UI-facing booking id is the backend UUID; no full_name anywhere:
    expect(JSON.stringify(booking)).not.toMatch(/full_name/i);
    expect(booking?.psychologistCode).toMatch(/Resident Psychologist #RP-\d+/);
  });

  it('pay flow refuses to fake success when payment stays pending', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          appointment_id: APPOINTMENT_CONFIRMED.appointment_id,
          persona_id: APPOINTMENT_CONFIRMED.persona_id,
          service_id: APPOINTMENT_CONFIRMED.service_id,
          psychologist_id: null,
          selected_slot_id: SLOT_ROWS[0].slot_id,
          price: 2400,
          presenting_concern: 'x',
          status: 'awaiting_payment',
          requested_datetime: null,
        }),
        { status: 200 }
      )
    );

    const { api } = await import('../lib/api');
    await expect(
      api.confirmSlotAndPay({
        bookingId: APPOINTMENT_CONFIRMED.appointment_id,
        selectedSlotId: SLOT_ROWS[0].slot_id,
      })
    ).rejects.toThrow(/not yet confirmed|Checkout URL/);
    // select-slot + payment initiated; contact never unlocked:
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/select-slot'))).toBe(true);
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/payment'))).toBe(true);
  });

  it('pickup → 3 distinct SlotProposal rows → mapped booking', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
    mockFetch.mockImplementation(async (url: string, init?: { body?: string }) => {
      if (url.includes('/pickup')) {
        return new Response(
          JSON.stringify({
            ...APPOINTMENT_CONFIRMED,
            psychologist_id: 'aa1bb2cc-3d4e-5f60-7182-93a4b5c6d7e8',
            status: 'pending',
            selected_slot_id: null,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/slots') && init?.body) {
        const payload = JSON.parse(init.body) as Array<Record<string, string>>;
        expect(payload).toHaveLength(3);
        expect(
          new Set(payload.map((s) => `${s.session_date}T${s.start_time}`)).size
        ).toBe(3);
        return new Response(JSON.stringify(SLOT_ROWS), { status: 200 });
      }
      return new Response(
        JSON.stringify({ ...APPOINTMENT_CONFIRMED, status: 'awaiting_slot_selection' }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    const booking = await api.pickUpAndProposeSlots({
      bookingId: APPOINTMENT_CONFIRMED.appointment_id,
      psychologistId: 'RP-01',
      pricePhp: 2400,
      slot1DateTime: '2026-12-01T10:00',
      slot2DateTime: '2026-12-02T15:00',
      slot3DateTime: '2026-12-03T18:30',
    });

    expect(booking.status).toBe('proposed');
    expect(booking.proposedSlots).toHaveLength(3);
  });

  it('mixed live mode rejects mock ids where the backend parses UUIDs', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
    mockFetch.mockReset();
    const { api } = await import('../lib/api');

    await expect(
      api.submitBookingRequest({
        personaId: 'persona-self-01',
        serviceId: 'srv-individual',
        concernsSummary: 'This should fail on uuid validation.',
      })
    ).rejects.toThrow(/not a backend UUID/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
