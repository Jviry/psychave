import { create } from 'zustand';
import {
  CONSENT_VERSION,
  LAST_USED_PERSONA_KEY,
  WIZARD_DRAFT_KEY,
  type PreferredContactMode,
  type RelationToAccountHolder,
  type TermsSignerRelation,
} from '../lib/consent';

export type WizardReturnTo = 'booking' | 'manage' | null;

export interface PersonaWizardDraft {
  whoFor: 'myself' | 'someone_else';
  relation_to_account_holder: RelationToAccountHolder;
  terms_signer_name: string;
  terms_signer_relation: TermsSignerRelation;
  scope_acknowledged: boolean;
  is_overseas_or_foreign: boolean;
  overseas_acknowledged: boolean;
  persona_name: string;
  date_of_birth: string;
  occupation: string;
  nationality: string;
  permanent_address: string;
  present_address: string;
  sameAsPermanent: boolean;
  contact_number: string;
  socmed_platform: string;
  socmed_username: string;
  preferred_contact_mode: PreferredContactMode;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_number: string;
  information_confirmed: boolean;
  consent_signer_name: string;
}

export const DEFAULT_WIZARD_DRAFT: PersonaWizardDraft = {
  whoFor: 'myself',
  relation_to_account_holder: 'self',
  terms_signer_name: '',
  terms_signer_relation: 'self',
  scope_acknowledged: false,
  is_overseas_or_foreign: false,
  overseas_acknowledged: false,
  persona_name: '',
  date_of_birth: '',
  occupation: '',
  nationality: '',
  permanent_address: '',
  present_address: '',
  sameAsPermanent: false,
  contact_number: '',
  socmed_platform: '',
  socmed_username: '',
  preferred_contact_mode: 'phone',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  emergency_contact_number: '',
  information_confirmed: false,
  consent_signer_name: '',
};

interface PersonaWizardState {
  isOpen: boolean;
  currentStep: 1 | 2 | 3 | 4;
  returnTo: WizardReturnTo;
  draft: PersonaWizardDraft;
  lastUsedPersonaId: string | null;
  openWizard: (returnTo?: WizardReturnTo) => void;
  closeWizard: () => void;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  updateDraft: (partial: Partial<PersonaWizardDraft>) => void;
  resetDraft: () => void;
  setLastUsedPersonaId: (id: string) => void;
}

function loadDraft(): PersonaWizardDraft {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return { ...DEFAULT_WIZARD_DRAFT };
  }
  try {
    const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return { ...DEFAULT_WIZARD_DRAFT };
    const parsed = JSON.parse(raw) as Partial<PersonaWizardDraft>;
    return { ...DEFAULT_WIZARD_DRAFT, ...parsed };
  } catch {
    return { ...DEFAULT_WIZARD_DRAFT };
  }
}

function loadLastUsed(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_USED_PERSONA_KEY);
  } catch {
    return null;
  }
}

function persistDraft(draft: PersonaWizardDraft) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full/blocked — wizard still works in-memory for this session.
  }
}

export function clearWizardDraftStorage() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(WIZARD_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export const usePersonaWizardStore = create<PersonaWizardState>((set) => ({
  isOpen: false,
  currentStep: 1,
  returnTo: null,
  draft: loadDraft(),
  lastUsedPersonaId: loadLastUsed(),

  openWizard: (returnTo = null) =>
    set((state) => {
      // Refresh draft from sessionStorage so a refresh mid-wizard restores progress.
      const draft = loadDraft();
      return { isOpen: true, currentStep: state.currentStep || 1, returnTo, draft };
    }),

  closeWizard: () => set({ isOpen: false }),

  setStep: (step) => set({ currentStep: step }),

  updateDraft: (partial) =>
    set((state) => {
      let next = { ...state.draft, ...partial };
      // "Myself" shortcut: keep relation/signer consistent per spec.
      if (partial.whoFor === 'myself') {
        next = {
          ...next,
          relation_to_account_holder: 'self',
          terms_signer_relation: 'self',
        };
      }
      // "Same as permanent" copies the value forward.
      if (partial.sameAsPermanent === true) {
        next = { ...next, present_address: next.permanent_address };
      }
      if (partial.permanent_address !== undefined && next.sameAsPermanent) {
        next = { ...next, present_address: partial.permanent_address };
      }
      persistDraft(next);
      return { draft: next };
    }),

  resetDraft: () => {
    clearWizardDraftStorage();
    set({ draft: { ...DEFAULT_WIZARD_DRAFT }, currentStep: 1 });
  },

  setLastUsedPersonaId: (id) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAST_USED_PERSONA_KEY, id);
      } catch {
        // ignore
      }
    }
    set({ lastUsedPersonaId: id });
  },
}));

/** Consent version is owned by a single frontend constant (matches backend current). */
export function getConsentVersion(): string {
  return CONSENT_VERSION;
}
