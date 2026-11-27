import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminBookingsPage from '@/app/(site)/admin/bookings/page';
import { api } from '@/lib/api';
import type { BookingRequest } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  api: {
    getAdminAppointments: vi.fn(),
    confirmManualPayment: vi.fn(),
    refundAdminAppointment: vi.fn(),
  },
}));

function makeBooking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'appt-1234567890-abcdef',
    clientId: 'client-1',
    profileId: 'prof-1',
    profileType: 'self',
    profileLabel: 'Maria Santos',
    serviceId: 'srv-1',
    serviceTitle: 'Individual Counseling & Psychotherapy',
    serviceDuration: '1 hr',
    serviceDurationMinutes: 60,
    serviceGuardrail: '',
    concernsSummary: '',
    submittedAt: '2026-11-20T08:00:00Z',
    status: 'awaiting-payment',
    psychologistId: 'psych-1',
    psychologistCode: 'RPsy-1042',
    pricePhp: 1500,
    proposedSlots: [
      {
        id: 'slot-1',
        slotNumber: 1,
        isoDateTime: '2026-12-01T10:00:00Z',
        dateLabel: 'Dec 1, 2026',
        timeLabel: '10:00 AM',
        proposedBy: 'client',
        status: 'accepted',
        round: 1,
      },
    ],
    selectedSlotId: 'slot-1',
    schedulingRound: 1,
    contactUnlocked: true,
    reminders: { reminder24h: 'pending', reminder1h: 'pending' },
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminBookingsPage />
    </QueryClientProvider>
  );
}

describe('AdminBookingsPage hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error alert with Retry instead of masquerading as an empty state on query failure', async () => {
    vi.mocked(api.getAdminAppointments).mockRejectedValueOnce(
      new Error('503 Service Unavailable')
    );

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load bookings');
    expect(alert).toHaveTextContent('503 Service Unavailable');
    expect(
      screen.queryByText(/No bookings awaiting payment/i)
    ).not.toBeInTheDocument();

    vi.mocked(api.getAdminAppointments).mockResolvedValueOnce([makeBooking()]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
  });

  it('requires a payment reference note in the confirmation modal before confirming manual payment', async () => {
    const booking = makeBooking();
    vi.mocked(api.getAdminAppointments).mockResolvedValue([booking]);
    vi.mocked(api.confirmManualPayment).mockResolvedValue({
      ...booking,
      status: 'paid-confirmed',
    });

    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: /Verify payment/i })
    );

    const confirmBtn = screen.getByRole('button', {
      name: 'Confirm Manual Payment',
    });
    expect(confirmBtn).toBeDisabled();

    const noteInput = screen.getByLabelText(
      /Payment reference \/ verification note/i
    );
    await userEvent.type(noteInput, '   GCash #998877   ');
    expect(confirmBtn).toBeEnabled();

    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.confirmManualPayment).toHaveBeenCalledWith(
        booking.id,
        'GCash #998877'
      );
    });
  });

  it('rejects sub-centavo and full refund amounts and submits exact centavos with trimmed reason', async () => {
    const paidBooking = makeBooking({ status: 'paid-confirmed' });
    vi.mocked(api.getAdminAppointments).mockResolvedValue([paidBooking]);
    vi.mocked(api.refundAdminAppointment).mockResolvedValue({
      ...paidBooking,
      status: 'partially-refunded',
      refundAmountCentavos: 75050,
      refundReason: 'Session shortened',
    });

    renderPage();

    await userEvent.click(
      screen.getByRole('tab', { name: 'Paid & Refunds' })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Issue refund/i })
    );

    const amtInput = screen.getByLabelText(/Or Peso Amount/i);
    const reasonInput = screen.getByLabelText(/Refund reason/i);
    const submitBtn = screen.getByRole('button', {
      name: 'Issue Partial Refund',
    });

    await userEvent.type(amtInput, '0.001');
    await userEvent.type(reasonInput, '  Session shortened  ');
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/₱0\.01/);

    await userEvent.clear(amtInput);
    await userEvent.type(amtInput, '750.50');
    expect(submitBtn).toBeEnabled();

    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.refundAdminAppointment).toHaveBeenCalledWith(paidBooking.id, {
        amountCentavos: 75050,
        percentage: undefined,
        reason: 'Session shortened',
      });
    });
  });
});
