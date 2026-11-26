import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({}),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const BASE_RAW = {
  appointment_id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  profile_id: '7a3c11a2-1b2c-4d3e-8f90-112233445566',
  profile_name: 'Primary Account Holder',
  profile_relation: 'self',
  service_id: '9a2b1c3d-4e5f-6071-8293-a4b5c6d7e8f9',
  service_name: 'Individual Counseling',
  service_duration_minutes: 60,
  service_guardrail: null,
  psychologist_id: 'aa1bb2cc-3d4e-5f60-7182-93a4b5c6d7e8',
  selected_slot_id: null,
  price: 1500,
  presenting_concern: 'Stress',
  status: 'confirmed',
  requested_datetime: '2026-11-26T08:00:00',
  scheduling_turn: null,
  scheduling_round: 1,
  payment_deadline: null,
  proposed_slots: [],
  profile_socmed_platform: null,
  profile_socmed_username: null,
  psychologist_social_links: [],
  is_session_paid: true,
};

describe('reschedule, no-show & partial refund API adapters', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('maps reschedule_requested, no_show, partially_refunded, refunded and isSessionPaid', async () => {
    const statuses: Array<[string, string]> = [
      ['reschedule_requested', 'reschedule-requested'],
      ['no_show', 'no-show'],
      ['partially_refunded', 'partially-refunded'],
      ['refunded', 'refunded'],
    ];

    for (const [rawStatus, expected] of statuses) {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...BASE_RAW,
            status: rawStatus,
            refund_amount_centavos: rawStatus.includes('refunded') ? 75000 : null,
            refund_reason: rawStatus.includes('refunded') ? 'Policy refund' : null,
          }),
          { status: 200 }
        )
      );
      const { api } = await import('../lib/api');
      const booking = await api.getBookingById(BASE_RAW.appointment_id);
      expect(booking?.status).toBe(expected);
      expect(booking?.isSessionPaid).toBe(true);
    }
  });

  it('calls requestReschedule, markNoShow, waiveRescheduleFee, and refundAdminAppointment', async () => {
    const { api } = await import('../lib/api');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...BASE_RAW, status: 'reschedule_requested' }), {
        status: 200,
      })
    );
    const r1 = await api.requestReschedule(BASE_RAW.appointment_id, 'Emergency');
    expect(r1.status).toBe('reschedule-requested');
    expect(String(mockFetch.mock.calls[0][0])).toContain(
      `/appointments/${BASE_RAW.appointment_id}/reschedule-request`
    );

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...BASE_RAW, status: 'no_show' }), { status: 200 })
    );
    const r2 = await api.markNoShow(BASE_RAW.appointment_id);
    expect(r2.status).toBe('no-show');
    expect(String(mockFetch.mock.calls[1][0])).toContain(
      `/appointments/${BASE_RAW.appointment_id}/no-show`
    );

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...BASE_RAW,
          status: 'awaiting_schedule',
          scheduling_turn: 'client',
          reschedule_fee_waived: true,
        }),
        { status: 200 }
      )
    );
    const r3 = await api.waiveRescheduleFee(BASE_RAW.appointment_id);
    expect(r3.status).toBe('awaiting-client');
    expect(r3.rescheduleFeeWaived).toBe(true);
    expect(String(mockFetch.mock.calls[2][0])).toContain(
      `/appointments/${BASE_RAW.appointment_id}/waive-reschedule-fee`
    );

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...BASE_RAW,
          status: 'partially_refunded',
          refund_amount_centavos: 75000,
          refund_reason: 'Partial',
        }),
        { status: 200 }
      )
    );
    const r4 = await api.refundAdminAppointment(BASE_RAW.appointment_id, {
      percentage: 50,
      reason: 'Partial',
    });
    expect(r4.status).toBe('partially-refunded');
    expect(r4.refundAmountCentavos).toBe(75000);
    expect(String(mockFetch.mock.calls[3][0])).toContain(
      `/admin/appointments/${BASE_RAW.appointment_id}/refund`
    );
  });

  it('payRescheduleFee redirects to PayMongo checkout URL when pending', async () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assignSpy },
      writable: true,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          payment_id: '11111111-1111-4111-8111-111111111111',
          appointment_id: BASE_RAW.appointment_id,
          amount: 600,
          payment_type: 'reschedule_fee',
          provider: 'paymongo',
          provider_ref: 'cs_fee_1',
          checkout_url: 'https://checkout.paymongo.com/cs_fee_1',
          status: 'pending',
          created_at: '2026-11-26T08:00:00Z',
        }),
        { status: 200 }
      )
    );

    const { api } = await import('../lib/api');
    const res = await api.payRescheduleFee(BASE_RAW.appointment_id);
    expect(assignSpy).toHaveBeenCalledWith('https://checkout.paymongo.com/cs_fee_1');
    expect(res.status).toBe('reschedule-requested');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
