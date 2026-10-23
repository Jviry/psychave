import { create } from 'zustand';

interface BookingDraft {
  personaId: string;
  serviceId: string;
  concernsSummary: string;
}

interface AppState {
  /**
   * Active psychologist profile ID used by the mock roster.
   * Live mode resolves identity from GET /psychologist-profile/me instead.
   */
  activePsychologistId: string;
  setActivePsychologistId: (id: string) => void;

  /**
   * Simulate Stripe payment failure to demonstrate the required "payment failed" error state
   * where booking is NOT finalized and contact remains locked.
   */
  simulatePaymentFailure: boolean;
  setSimulatePaymentFailure: (val: boolean) => void;

  /**
   * Client Booking Draft state (persisted while browsing Services -> Personas/Booking)
   */
  bookingDraft: BookingDraft;
  updateBookingDraft: (partial: Partial<BookingDraft>) => void;
  resetBookingDraft: () => void;

  /**
   * Toast / notification banner message for real-time Flow C transitions
   */
  lastFlowEvent: {
    id: string;
    title: string;
    detail: string;
    timestamp: string;
  } | null;
  publishFlowEvent: (title: string, detail: string) => void;
  clearFlowEvent: () => void;
}

/**
 * Empty by design: in real mode persona/service ids must come from the
 * backend (UUIDs). The booking page binds these to the first live row when
 * they are unset, so a mock id can never reach `submitBookingRequest`.
 */
const DEFAULT_DRAFT: BookingDraft = {
  personaId: '',
  serviceId: '',
  concernsSummary: '',
};

export const useAppStore = create<AppState>((set) => ({
  activePsychologistId: 'RP-01',
  setActivePsychologistId: (id) => set({ activePsychologistId: id }),

  simulatePaymentFailure: false,
  setSimulatePaymentFailure: (val) => set({ simulatePaymentFailure: val }),

  bookingDraft: DEFAULT_DRAFT,
  updateBookingDraft: (partial) =>
    set((state) => ({
      bookingDraft: { ...state.bookingDraft, ...partial },
    })),
  resetBookingDraft: () => set({ bookingDraft: DEFAULT_DRAFT }),

  // No synthetic event on load: a pre-filled fake notification misleads users.
  // Flow events appear only after real in-app transitions (publishFlowEvent).
  lastFlowEvent: null,
  publishFlowEvent: (title, detail) =>
    set({
      lastFlowEvent: {
        id: `evt-${Date.now()}`,
        title,
        detail,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    }),
  clearFlowEvent: () => set({ lastFlowEvent: null }),
}));
