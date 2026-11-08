/**
 * Integration wiring tests for lib/api.ts.
 *
 * Every operational call now goes to the authenticated backend. These tests
 * cover response adaptation and the guardrails that must survive the mock
 * removal:
 *  - public catalog uses GET /services/active
 *  - appointment reads map to UI types without leaking backend shapes
 *  - pickup → 3 slot rows chain
 *  - payment never fakes success before provider confirmation
 *  - UUID validation blocks placeholder ids
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
  localStorage.clear();
  mockFetch.mockReset();
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('service catalog', () => {
  it('getPublicServices calls GET /services/active', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            service_id: '9a2b1c3d-4e5f-6071-8293-a4b5c6d7e8f9',
            name: 'Individual Counseling',
            description: 'One-on-one therapy.',
            is_active: true,
            duration_minutes: 60,
            guardrail_notice: 'Not for emergencies.',
          },
        ]),
        { status: 200 }
      )
    );

    const { api } = await import('../lib/api');
    const services = await api.getPublicServices();

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(String(mockFetch.mock.calls[0][0])).toContain('/services/active');
    expect(services).toHaveLength(1);
    expect(services[0].title).toBe('Individual Counseling');
    expect(services[0].durationMinutes).toBe(60);
  });

  it('getServices calls the authenticated catalog path', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const { api } = await import('../lib/api');
    await api.getServices();

    expect(String(mockFetch.mock.calls[0][0])).toContain('/services');
    expect(String(mockFetch.mock.calls[0][0])).not.toContain('/services/active');
  });
});

describe('live adapters (AppointmentRead → BookingRequest)', () => {
  const SLOT_ROWS = [
    { slot_id: 'cc3dd4ee-5f60-7182-93a4-b5c6d7e8f9a0', session_date: '2026-12-05', start_time: '10:00:00', end_time: '11:30:00', proposed_by: 'client', status: 'proposed', round: 1 },
    { slot_id: 'dd4ee5ff-6071-8293-a4b5-c6d7e8f9a0b1', session_date: '2026-12-06', start_time: '14:00:00', end_time: '15:30:00', proposed_by: 'client', status: 'proposed', round: 1 },
    { slot_id: 'ee5ff600-7182-93a4-b5c6-d7e8f9a0b1c2', session_date: '2026-12-08', start_time: '18:00:00', end_time: '19:30:00', proposed_by: 'client', status: 'proposed', round: 1 },
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
    scheduling_turn: null,
    scheduling_round: 1,
    payment_deadline: null,
    proposed_slots: SLOT_ROWS,
    persona_socmed_platform: 'Facebook',
    persona_socmed_username: '@client.demo',
    psychologist_social_links: [
      { platform: 'Facebook', url: 'https://facebook.com/psych.demo' },
    ],
  };

  it('getBookingById maps confirmed status + slot rows; no backend fields leak', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(APPOINTMENT_CONFIRMED), { status: 200 })
    );

    const { api } = await import('../lib/api');
    const booking = await api.getBookingById(APPOINTMENT_CONFIRMED.appointment_id);

    expect(booking).not.toBeNull();
    expect(booking?.status).toBe('paid-confirmed');
    expect(booking?.contactUnlocked).toBe(true);
    expect(booking?.serviceDurationMinutes).toBe(60);
    expect(booking?.pricePhp).toBe(2400);
    expect(booking?.concernsSummary).toBe(APPOINTMENT_CONFIRMED.presenting_concern);
    expect(booking?.proposedSlots).toHaveLength(3);
    expect(booking?.proposedSlots[0]?.slotNumber).toBe(1);
    expect(booking?.proposedSlots[0]?.isoDateTime).toBe('2026-12-05T10:00');
    expect(booking?.selectedSlotId).toBe(APPOINTMENT_CONFIRMED.selected_slot_id);
    expect(booking?.psychologistSocialLinks).toEqual([
      { platform: 'Facebook', url: 'https://facebook.com/psych.demo' },
    ]);
    expect(booking?.clientSocialMedia).toEqual({
      platform: 'Facebook',
      username: '@client.demo',
    });
    expect(JSON.stringify(booking)).not.toMatch(/full_name/i);
    expect(booking?.psychologistCode).toMatch(/Resident Psychologist #RP-\d+/);
  });

  it('getPersonaReview maps the psychologist review payload', async () => {
    const personaId = '7a3c11a2-1b2c-4d3e-8f90-112233445566';
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          persona: {
            persona_id: personaId,
            relation_to_account_holder: 'self',
            persona_name: 'Ana Santos',
            date_of_birth: '1994-06-12',
            occupation: 'Designer',
            nationality: 'Filipino',
            permanent_address: 'Makati City',
            present_address: 'Makati City',
            contact_number: '+639170000000',
            socmed_platform: 'Facebook',
            socmed_username: '@ana',
            preferred_contact_mode: 'phone',
            emergency_contact_name: 'Ben Santos',
            emergency_contact_relation: 'Sibling',
            emergency_contact_number: '+639180000000',
          },
          consent: {
            consent_version: 'v2',
            terms_signer_name: 'Ana Santos',
            terms_signer_relation: 'self',
            scope_acknowledged: true,
            is_overseas_or_foreign: false,
            overseas_acknowledged: false,
            information_confirmed: true,
            consent_signer_name: 'Ana Santos',
            signed_at: '2026-10-01T09:00:00+08:00',
          },
        }),
        { status: 200 }
      )
    );

    const { api } = await import('../lib/api');
    const review = await api.getPersonaReview(personaId);

    expect(review.persona.name).toBe('Ana Santos');
    expect(review.persona.contactNumber).toBe('+639170000000');
    expect(review.consent.version).toBe('v2');
    expect(review.consent.scopeAcknowledged).toBe(true);
    expect(JSON.stringify(review)).not.toMatch(/persona_name|consent_version|signed_at/);
  });

  it('pay flow refuses to fake success when payment stays pending', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('/payment')) {
        return new Response(
          JSON.stringify({ provider: 'fake', provider_ref: 'ref-123', checkout_url: null }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          ...APPOINTMENT_CONFIRMED,
          selected_slot_id: SLOT_ROWS[0].slot_id,
          status: 'awaiting_payment',
          payment_deadline: '2026-12-04T10:00:00',
        }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    await expect(api.payBooking(APPOINTMENT_CONFIRMED.appointment_id)).rejects.toThrow(
      /not yet confirmed|Checkout URL/
    );
    expect(mockFetch.mock.calls.some((call) => String(call[0]).includes('/payment'))).toBe(
      true
    );
  });

  it('pickup atomically claims the request and accepts a preferred slot', async () => {
    mockFetch.mockImplementationOnce(async (url: string, init?: { method?: string; body?: string }) => {
      expect(url).toContain(`/appointments/${APPOINTMENT_CONFIRMED.appointment_id}/pickup`);
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body ?? '{}')).toEqual({
        price: 2400,
        slot_id: SLOT_ROWS[0].slot_id,
      });
      return new Response(
        JSON.stringify({
          ...APPOINTMENT_CONFIRMED,
          psychologist_id: 'aa1bb2cc-3d4e-5f60-7182-93a4b5c6d7e8',
          price: 2400,
          status: 'awaiting_payment',
          scheduling_turn: null,
          selected_slot_id: SLOT_ROWS[0].slot_id,
          payment_deadline: '2026-12-04T10:00:00',
        }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    const booking = await api.pickUpBooking({
      bookingId: APPOINTMENT_CONFIRMED.appointment_id,
      pricePhp: 2400,
      slotId: SLOT_ROWS[0].slot_id,
    });

    expect(booking.status).toBe('awaiting-payment');
    expect(booking.selectedSlotId).toBe(SLOT_ROWS[0].slot_id);
    expect(booking.paymentDeadline).toBe('2026-12-04T10:00:00');
    expect(booking.psychologistSocialLinks).toBeUndefined();
    expect(booking.clientSocialMedia).toEqual({
      platform: 'Facebook',
      username: '@client.demo',
    });
  });

  it('pickup atomically claims the request with a counter-offer and surfaces schedule conflicts', async () => {
    mockFetch.mockImplementationOnce(async (url: string, init?: { method?: string; body?: string }) => {
      expect(url).toContain(`/appointments/${APPOINTMENT_CONFIRMED.appointment_id}/pickup`);
      expect(JSON.parse(init?.body ?? '{}')).toEqual({
        price: 2500,
        counter_slot: { session_date: '2026-12-09', start_time: '09:00:00' },
      });
      return new Response(
        JSON.stringify({
          ...APPOINTMENT_CONFIRMED,
          status: 'awaiting_schedule',
          scheduling_turn: 'client',
          scheduling_round: 2,
          selected_slot_id: null,
          proposed_slots: [
            {
              slot_id: 'ff600071-8293-a4b5-c6d7-e8f9a0b1c2d3',
              session_date: '2026-12-09',
              start_time: '09:00:00',
              end_time: '10:00:00',
              proposed_by: 'psychologist',
              status: 'proposed',
              round: 2,
            },
          ],
        }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    const countered = await api.pickUpBooking({
      bookingId: APPOINTMENT_CONFIRMED.appointment_id,
      pricePhp: 2500,
      counterDateTime: '2026-12-09T09:00',
    });
    expect(countered.status).toBe('awaiting-client');
    expect(countered.schedulingRound).toBe(2);

    mockFetch.mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          detail: 'You already have a session at this time; offer an alternative schedule',
        }),
        { status: 409 }
      );
    });

    await expect(
      api.pickUpBooking({
        bookingId: APPOINTMENT_CONFIRMED.appointment_id,
        pricePhp: 2500,
        slotId: SLOT_ROWS[0].slot_id,
      })
    ).rejects.toThrow(/You already have a session at this time/);
  });

  it('psychologist accepts a preferred slot through the dedicated path', async () => {
    mockFetch.mockImplementationOnce(async (url: string, init?: { method?: string; body?: string }) => {
      expect(url).toContain('/accept-preferred-slot');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body ?? '{}').slot_id).toBe(SLOT_ROWS[0].slot_id);
      return new Response(
        JSON.stringify({
          ...APPOINTMENT_CONFIRMED,
          status: 'awaiting_payment',
          scheduling_turn: null,
          selected_slot_id: SLOT_ROWS[0].slot_id,
          payment_deadline: '2026-12-04T10:00:00',
        }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    const booking = await api.acceptPreferredSlot({
      bookingId: APPOINTMENT_CONFIRMED.appointment_id,
      slotId: SLOT_ROWS[0].slot_id,
    });

    expect(booking.status).toBe('awaiting-payment');
    expect(booking.selectedSlotId).toBe(SLOT_ROWS[0].slot_id);
    expect(booking.paymentDeadline).toBe('2026-12-04T10:00:00');
  });

  it('psychologist counter-offers exactly one alternative time', async () => {
    mockFetch.mockImplementationOnce(async (url: string, init?: { method?: string; body?: string }) => {
      expect(url).toContain('/counter-offer');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body ?? '{}')).toEqual({
        session_date: '2026-12-09',
        start_time: '09:00:00',
      });
      return new Response(
        JSON.stringify({
          ...APPOINTMENT_CONFIRMED,
          status: 'awaiting_schedule',
          scheduling_turn: 'client',
          scheduling_round: 2,
          selected_slot_id: null,
          proposed_slots: [
            {
              slot_id: 'ff600071-8293-a4b5-c6d7-e8f9a0b1c2d3',
              session_date: '2026-12-09',
              start_time: '09:00:00',
              end_time: '10:00:00',
              proposed_by: 'psychologist',
              status: 'proposed',
              round: 2,
            },
          ],
        }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    const booking = await api.counterOffer({
      bookingId: APPOINTMENT_CONFIRMED.appointment_id,
      dateTime: '2026-12-09T09:00',
    });

    expect(booking.status).toBe('awaiting-client');
    expect(booking.schedulingTurn).toBe('client');
    expect(booking.schedulingRound).toBe(2);
    expect(booking.proposedSlots[0]?.proposedBy).toBe('psychologist');
  });

  it('maps completed bookings and keeps contact details unlocked', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...APPOINTMENT_CONFIRMED, status: 'completed' }), {
        status: 200,
      })
    );

    const { api } = await import('../lib/api');
    const booking = await api.getBookingById(APPOINTMENT_CONFIRMED.appointment_id);

    expect(booking?.status).toBe('completed');
    expect(booking?.contactUnlocked).toBe(true);
    expect(booking?.psychologistSocialLinks).toHaveLength(1);
    expect(booking?.clientSocialMedia?.username).toBe('@client.demo');
  });

  it('completes a confirmed appointment through POST /complete', async () => {
    mockFetch.mockImplementationOnce(async (url: string, init?: { method?: string }) => {
      expect(url).toContain(
        `/appointments/${APPOINTMENT_CONFIRMED.appointment_id}/complete`
      );
      expect(init?.method).toBe('POST');
      return new Response(
        JSON.stringify({ ...APPOINTMENT_CONFIRMED, status: 'completed' }),
        { status: 200 }
      );
    });

    const { api } = await import('../lib/api');
    const booking = await api.completeAppointment(
      APPOINTMENT_CONFIRMED.appointment_id
    );

    expect(booking.status).toBe('completed');
    expect(booking.contactUnlocked).toBe(true);
  });

  it('rejects placeholder ids where the backend parses UUIDs', async () => {
    mockFetch.mockReset();
    const { api } = await import('../lib/api');

    await expect(
      api.submitBookingRequest({
        personaId: 'persona-self-01',
        serviceId: 'srv-individual',
        concernsSummary: 'This should fail on uuid validation.',
        preferredSlots: [
          '2026-12-01T10:00',
          '2026-12-02T15:00',
          '2026-12-03T18:30',
        ],
      })
    ).rejects.toThrow(/not a backend UUID/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
