import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PsychologistSchedulePage from '../app/(site)/psych/schedule/page';
import PsychologistScheduleDetailPage from '../app/(site)/psych/schedule/[id]/page';
import PsychologistScheduleCalendarPage from '../app/(site)/psych/schedule/calendar/page';
import { api } from '../lib/api';
import type { BookingRequest } from '../lib/types';

const pushMock = vi.fn();
let mockParams: { id?: string } = { id: 'bk-new' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => mockParams,
}));

vi.mock('../hooks/useActivePsychologist', () => ({
  useActivePsychologist: () => ({
    activePsych: {
      id: 'psych-1',
      anonymizedTitle: 'Resident Psychologist #RP-12',
      socialMediaLinks: [{ platform: 'Instagram', url: 'https://instagram.com/rp12' }],
    },
    isLoading: false,
  }),
}));

function makeSession(overrides: Partial<BookingRequest>): BookingRequest {
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
    status: 'paid-confirmed',
    psychologistId: 'psych-1',
    psychologistCode: 'Resident Psychologist #RP-12',
    pricePhp: 2500,
    selectedSlotId: 'slot-1',
    proposedSlots: [
      {
        id: 'slot-1',
        slotNumber: 1,
        isoDateTime: '2026-12-10T10:00:00+08:00',
        dateLabel: 'Thu, Dec 10, 2026',
        timeLabel: '10:00 AM – 11:00 AM PHT',
        proposedBy: 'client',
        status: 'accepted',
        round: 1,
      },
    ],
    schedulingRound: 1,
    contactUnlocked: true,
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

describe('PsychologistSchedulePage table view', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    mockParams = { id: 'bk-new' };
  });

  it('renders assigned sessions in a table newest-first and navigates to /psych/schedule/[id] on row click', async () => {
    const older = makeSession({
      id: 'bk-old',
      serviceTitle: 'Couples Counseling',
      profileLabel: 'Jamie Cruz',
      submittedAt: '2026-11-10',
      submittedAtIso: '2026-11-10T09:00:00',
    });
    const newest = makeSession({
      id: 'bk-new',
      serviceTitle: 'Standalone Clinical Consultation',
      profileLabel: 'Alex Rivera',
      submittedAt: '2026-11-27',
      submittedAtIso: '2026-11-27T14:30:00',
    });
    const middle = makeSession({
      id: 'bk-mid',
      serviceTitle: 'Life Coaching',
      profileLabel: 'Sam Reyes',
      submittedAt: '2026-11-22',
      submittedAtIso: '2026-11-22T11:00:00',
    });
    const unassignedPending = makeSession({
      id: 'bk-pending',
      serviceTitle: 'Unassigned Queue Item',
      psychologistId: undefined,
      status: 'pending',
    });

    vi.spyOn(api, 'getBookingsForRole').mockResolvedValue([
      older,
      middle,
      newest,
      unassignedPending,
    ]);

    renderWithQuery(<PsychologistSchedulePage />);

    const table = await screen.findByRole('table');
    await within(table).findByText('Standalone Clinical Consultation');

    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(4);

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Standalone Clinical Consultation');
    expect(rows[2]).toHaveTextContent('Life Coaching');
    expect(rows[3]).toHaveTextContent('Couples Counseling');
    expect(within(table).queryByText('Unassigned Queue Item')).not.toBeInTheDocument();

    fireEvent.click(rows[1]);
    expect(pushMock).toHaveBeenCalledWith('/psych/schedule/bk-new');

    const link = within(rows[2]).getByRole('link', { name: /Life Coaching/i });
    expect(link).toHaveAttribute('href', '/psych/schedule/bk-mid');
  });
});

describe('PsychologistScheduleDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    mockParams = { id: 'bk-new' };
  });

  it('shows full session details and supports saving a meeting link and completing the session', async () => {
    const session = makeSession({
      id: 'bk-new',
      serviceTitle: 'Standalone Clinical Consultation',
      submittedAt: '2026-11-27',
      pricePhp: 1800,
      proposedSlots: [
        {
          id: 'slot-1',
          slotNumber: 1,
          isoDateTime: '2026-11-01T10:00:00+08:00',
          endIsoDateTime: '2026-11-01T11:00:00+08:00',
          dateLabel: 'Sun, Nov 1, 2026',
          timeLabel: '10:00 AM – 11:00 AM PHT',
          proposedBy: 'client',
          status: 'accepted',
          round: 1,
        },
      ],
    });

    vi.spyOn(api, 'getBookingsForRole').mockResolvedValue([session]);
    vi.spyOn(api, 'getBookingById').mockResolvedValue(session);
    const linkSpy = vi
      .spyOn(api, 'updateMeetingLink')
      .mockResolvedValue({ ...session, meetingLink: 'https://meet.google.com/abc-defg-hij' });
    const completeSpy = vi
      .spyOn(api, 'completeAppointment')
      .mockResolvedValue({ ...session, status: 'completed' });

    renderWithQuery(<PsychologistScheduleDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Standalone Clinical Consultation' })
    ).toBeInTheDocument();
    expect(screen.getByText('Managing work-related stress and sleep difficulties.')).toBeInTheDocument();
    expect(screen.getByText('₱1,800')).toBeInTheDocument();
    expect(screen.getByText('60 mins')).toBeInTheDocument();
    expect(screen.getByText('2026-11-27')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to My Schedule/i })).toHaveAttribute(
      'href',
      '/psych/schedule'
    );

    // Save meeting link
    const linkInput = screen.getByLabelText(/Session Meeting Link/i);
    fireEvent.change(linkInput, { target: { value: 'https://meet.google.com/abc-defg-hij' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Link/i }));

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith('bk-new', 'https://meet.google.com/abc-defg-hij');
    });
    expect(
      await screen.findByText('Meeting link saved and emailed to client.')
    ).toBeInTheDocument();

    // Mark session completed
    fireEvent.click(screen.getByRole('button', { name: /Mark Session Completed/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Mark Completed/i }));

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith('bk-new');
    });
  });
});

describe('PsychologistScheduleCalendarPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    mockParams = { id: 'bk-new' };
  });

  it('renders the calendar within the Schedule tab, shows scheduled sessions on their dates, and links to detail page', async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayIso = `${y}-${m}-${d}T14:00:00+08:00`;

    const session = makeSession({
      id: 'bk-cal-1',
      serviceTitle: 'Individual Counseling',
      profileLabel: 'Alex Rivera',
      proposedSlots: [
        {
          id: 'slot-1',
          slotNumber: 1,
          isoDateTime: todayIso,
          dateLabel: 'Today',
          timeLabel: '2:00 PM – 3:00 PM PHT',
          proposedBy: 'client',
          status: 'accepted',
          round: 1,
        },
      ],
    });

    vi.spyOn(api, 'getBookingsForRole').mockResolvedValue([session]);

    renderWithQuery(<PsychologistScheduleCalendarPage />);

    expect(
      await screen.findByRole('link', { name: /Sessions/i })
    ).toHaveAttribute('href', '/psych/schedule');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute(
      'href',
      '/psych/schedule/calendar'
    );

    // Event chip appears in the calendar grid and navigates to /psych/schedule/bk-cal-1
    const chip = await screen.findByRole('button', { name: /Alex Rivera/i });
    fireEvent.click(chip);
    expect(pushMock).toHaveBeenCalledWith('/psych/schedule/bk-cal-1');

    // Selected day agenda shows the session link
    const agendaLink = screen.getByRole('link', { name: /Individual Counseling/i });
    expect(agendaLink).toHaveAttribute('href', '/psych/schedule/bk-cal-1');
  });
});
