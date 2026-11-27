import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientBookingsPage from '../app/(site)/bookings/page';
import ClientBookingDetailPage from '../app/(site)/bookings/[id]/page';
import { sortBookingsNewestFirst } from '../lib/booking';
import { api } from '../lib/api';
import type { BookingRequest } from '../lib/types';

const pushMock = vi.fn();
let mockParams: { id?: string } = { id: 'bk-new' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => mockParams,
}));

function makeBooking(overrides: Partial<BookingRequest>): BookingRequest {
  return {
    id: 'bk-default',
    clientId: 'client-01',
    profileId: 'prof-1',
    profileType: 'self',
    profileLabel: 'Alex Rivera',
    serviceId: 'svc-1',
    serviceTitle: 'Individual Counseling',
    serviceDuration: '1 hr (60 mins)',
    serviceDurationMinutes: 60,
    serviceGuardrail: 'Private online consultation',
    concernsSummary: 'Managing work-related stress and sleep difficulties.',
    submittedAt: '2026-11-20',
    submittedAtIso: '2026-11-20T08:00:00',
    status: 'pending',
    proposedSlots: [
      {
        id: 'slot-1',
        slotNumber: 1,
        isoDateTime: '2026-11-28T10:00',
        dateLabel: 'Sat, Nov 28, 2026',
        timeLabel: '10:00 AM – 11:00 AM PST',
        proposedBy: 'client',
        status: 'proposed',
        round: 1,
      },
    ],
    schedulingRound: 1,
    contactUnlocked: false,
    reminders: { reminder24h: 'pending', reminder1h: 'pending' },
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('sortBookingsNewestFirst', () => {
  it('orders bookings newest-first using full ISO timestamps including same-day submissions', () => {
    const oldest = makeBooking({
      id: 'bk-oldest',
      submittedAt: '2026-11-18',
      submittedAtIso: '2026-11-18T14:00:00',
    });
    const sameDayMorning = makeBooking({
      id: 'bk-morning',
      submittedAt: '2026-11-25',
      submittedAtIso: '2026-11-25T09:15:00',
    });
    const sameDayEvening = makeBooking({
      id: 'bk-evening',
      submittedAt: '2026-11-25',
      submittedAtIso: '2026-11-25T21:45:00',
    });
    const missingDate = makeBooking({
      id: 'bk-missing',
      submittedAt: '—',
      submittedAtIso: undefined,
    });

    const sorted = sortBookingsNewestFirst([
      oldest,
      missingDate,
      sameDayMorning,
      sameDayEvening,
    ]);

    expect(sorted.map((b) => b.id)).toEqual([
      'bk-evening',
      'bk-morning',
      'bk-oldest',
      'bk-missing',
    ]);
  });
});

describe('ClientBookingsPage compact table view', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    mockParams = { id: 'bk-new' };
  });

  it('renders a compact table newest-first and navigates to /bookings/[id] on row click', async () => {
    const older = makeBooking({
      id: 'bk-old',
      serviceTitle: 'Couples Counseling',
      submittedAt: '2026-11-10',
      submittedAtIso: '2026-11-10T10:00:00',
      status: 'completed',
      psychologistCode: 'Resident Psychologist #RP-11',
      pricePhp: 2500,
      contactUnlocked: true,
      concernsSummary: 'Communication alignment for upcoming life transition.',
    });
    const newest = makeBooking({
      id: 'bk-new',
      serviceTitle: 'Standalone Clinical Consultation',
      submittedAt: '2026-11-27',
      submittedAtIso: '2026-11-27T09:30:00',
      status: 'awaiting-payment',
      psychologistCode: 'Resident Psychologist #RP-12',
      pricePhp: 1800,
      selectedSlotId: 'slot-1',
      concernsSummary: 'Initial intake for anxiety management.',
    });
    const middle = makeBooking({
      id: 'bk-mid',
      serviceTitle: 'Life Coaching',
      submittedAt: '2026-11-22',
      submittedAtIso: '2026-11-22T15:00:00',
      status: 'pending',
      concernsSummary: 'Career transition planning.',
    });

    vi.spyOn(api, 'getBookingsForRole').mockResolvedValue([older, middle, newest]);

    renderWithQuery(<ClientBookingsPage />);

    const table = await screen.findByRole('table');
    await within(table).findByText('Standalone Clinical Consultation');

    // Compact 4-column header: Service, Schedule, Status, Submitted
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(4);

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Standalone Clinical Consultation');
    expect(rows[2]).toHaveTextContent('Life Coaching');
    expect(rows[3]).toHaveTextContent('Couples Counseling');

    // Heavy details stay off the table
    expect(within(table).queryByText('Initial intake for anxiety management.')).not.toBeInTheDocument();
    expect(within(table).queryByText('Resident Psychologist #RP-12')).not.toBeInTheDocument();
    expect(within(table).queryByText('₱1,800')).not.toBeInTheDocument();

    // Clicking the row navigates to the dedicated booking detail page
    fireEvent.click(rows[1]);
    expect(pushMock).toHaveBeenCalledWith('/bookings/bk-new');

    // Link inside the row also targets /bookings/[id]
    const rowLink = within(rows[2]).getByRole('link', { name: /Life Coaching/i });
    expect(rowLink).toHaveAttribute('href', '/bookings/bk-mid');

    // Filter to Completed only
    fireEvent.click(screen.getByRole('button', { name: /Completed \(1\)/i }));
    const filteredRows = within(table).getAllByRole('row');
    expect(filteredRows).toHaveLength(2);
    expect(filteredRows[1]).toHaveTextContent('Couples Counseling');
  });
});

describe('ClientBookingDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    mockParams = { id: 'bk-new' };
  });

  it('renders full booking details and supports cancelling a cancellable request', async () => {
    const booking = makeBooking({
      id: 'bk-new',
      serviceTitle: 'Standalone Clinical Consultation',
      submittedAt: '2026-11-27',
      submittedAtIso: '2026-11-27T09:30:00',
      status: 'awaiting-payment',
      psychologistCode: 'Resident Psychologist #RP-12',
      pricePhp: 1800,
      selectedSlotId: 'slot-1',
      concernsSummary: 'Initial intake for anxiety management.',
    });

    vi.spyOn(api, 'getBookingById').mockResolvedValue(booking);
    const cancelSpy = vi
      .spyOn(api, 'cancelBooking')
      .mockResolvedValue({ ...booking, status: 'cancelled' });

    renderWithQuery(<ClientBookingDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Standalone Clinical Consultation' })
    ).toBeInTheDocument();
    expect(screen.getByText('Initial intake for anxiety management.')).toBeInTheDocument();
    expect(screen.getByText('Resident Psychologist #RP-12')).toBeInTheDocument();
    expect(screen.getByText('₱1,800')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to My Bookings/i })).toHaveAttribute(
      'href',
      '/bookings'
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel Request/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Yes, Cancel Request/i }));

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('bk-new');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows a clean not-found state when the booking does not exist', async () => {
    mockParams = { id: 'bk-missing' };
    vi.spyOn(api, 'getBookingById').mockResolvedValue(null);

    renderWithQuery(<ClientBookingDetailPage />);

    expect(await screen.findByText('Booking not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to My Bookings/i })).toHaveAttribute(
      'href',
      '/bookings'
    );
  });
});
