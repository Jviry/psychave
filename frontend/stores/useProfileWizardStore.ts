import { create } from 'zustand';
import {
  CONSENT_VERSION,
  LAST_USED_PROFILE_KEY,
  WIZARD_DRAFT_KEY,
  type PreferredContactMode,
  type RelationToAccountHolder,
  type TermsSignerRelation,
} from '../lib/consent';

export type WizardReturnTo = 'booking' | 'manage' | null;

export interface ProfileWizardDraft {
  relation_to_account_holder: Exclude<RelationToAccountHolder, 'self'>;
  terms_signer_name: string;
  terms_signer_relation: Exclude<TermsSignerRelation, 'self'>;
  scope_acknowledged: boolean;
  is_overseas_or_foreign: boolean;
  overseas_acknowledged: boolean;
  profile_name: string;
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

export const DEFAULT_WIZARD_DRAFT: ProfileWizardDraft = {
  relation_to_account_holder: 'child',
  terms_signer_name: '',
  terms_signer_relation: 'parent',
  scope_acknowledged: false,
  is_overseas_or_foreign: false,
  overseas_acknowledged: false,
  profile_name: '',
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

interface ProfileWizardState {
  isOpen: boolean;
  currentStep: 1 | 2 | 3 | 4;
  returnTo: WizardReturnTo;
  draft: ProfileWizardDraft;
  lastUsedProfileId: string | null;
  openWizard: (returnTo?: WizardReturnTo) => void;
  closeWizard: () => void;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  updateDraft: (partial: Partial<ProfileWizardDraft>) => void;
  resetDraft: () => void;
  setLastUsedProfileId: (id: string) => void;
}

function loadDraft(): ProfileWizardDraft {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return { ...DEFAULT_WIZARD_DRAFT };
  }
  try {
    const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return { ...DEFAULT_WIZARD_DRAFT };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged = { ...DEFAULT_WIZARD_DRAFT, ...(parsed as Partial<ProfileWizardDraft>) };
    if ((merged.relation_to_account_holder as string) === 'self') {
      merged.relation_to_account_holder = 'child';
    }
    if ((merged.terms_signer_relation as string) === 'self') {
      merged.terms_signer_relation = 'parent';
    }
    return merged;
  } catch {
    return { ...DEFAULT_WIZARD_DRAFT };
  }
}

function loadLastUsed(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_USED_PROFILE_KEY);
  } catch {
    return null;
  }
}

function persistDraft(draft: ProfileWizardDraft) {
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

export const useProfileWizardStore = create<ProfileWizardState>((set) => ({
  isOpen: false,
  currentStep: 1,
  returnTo: null,
  draft: loadDraft(),
  lastUsedProfileId: loadLastUsed(),

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

  setLastUsedProfileId: (id) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAST_USED_PROFILE_KEY, id);
      } catch {
        // ignore
      }
    }
    set({ lastUsedProfileId: id });
  },
}));

/** Consent version is owned by a single frontend constant (matches backend current). */
export function getConsentVersion(): string {
  return CONSENT_VERSION;
}
