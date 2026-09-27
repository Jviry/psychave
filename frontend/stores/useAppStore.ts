import { create } from 'zustand';
import { CognitoRole } from '../lib/types';

interface IntakeDraft {
  personaId: string;
  serviceId: string;
  preferredLanguage: string;
  concernsSummary: string;
  specificNeeds: string;
}

interface AppState {
  /**
   * Mock AWS Cognito Groups switcher (NEXT_PUBLIC_AUTH_MODE=mock)
   */
  cognitoRole: CognitoRole;
  setCognitoRole: (role: CognitoRole) => void;

  /**
   * Active psychologist profile ID when viewing as 'psychologist'
   * Allows switching between a Verified Psychologist (RP-01) and an Unverified Psychologist (RP-04)
   * to test the Flow C guardrail: "Unverified cannot pick up" & "Waiting approval" empty state.
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
   * Client Intake Draft state (persisted while browsing Services -> Personas/Intake)
   */
  intakeDraft: IntakeDraft;
  updateIntakeDraft: (partial: Partial<IntakeDraft>) => void;
  resetIntakeDraft: () => void;

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

const DEFAULT_DRAFT: IntakeDraft = {
  personaId: 'persona-self-01',
  serviceId: 'srv-individual',
  preferredLanguage: 'English / Taglish',
  concernsSummary: '',
  specificNeeds: '',
};

export const useAppStore = create<AppState>((set) => ({
  cognitoRole: 'client',
  setCognitoRole: (role) => set({ cognitoRole: role }),

  activePsychologistId: 'RP-01',
  setActivePsychologistId: (id) => set({ activePsychologistId: id }),

  simulatePaymentFailure: false,
  setSimulatePaymentFailure: (val) => set({ simulatePaymentFailure: val }),

  intakeDraft: DEFAULT_DRAFT,
  updateIntakeDraft: (partial) =>
    set((state) => ({
      intakeDraft: { ...state.intakeDraft, ...partial },
    })),
  resetIntakeDraft: () => set({ intakeDraft: DEFAULT_DRAFT }),

  lastFlowEvent: {
    id: 'init-flow-c',
    title: 'Proposal Alert Ready for Review',
    detail:
      'Booking #BK-2026-102 has 3 proposed schedule slots from Resident Psychologist #RP-01 awaiting your slot selection and payment.',
    timestamp: 'Just now',
  },
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
