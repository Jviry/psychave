import { create } from 'zustand';
import {
  CONSENT_VERSION,
  LAST_USED_PROFILE_KEY,
  WIZARD_DRAFT_KEY,
  type PreferredContactMode,
  type RelationToAccountHolder,
  type TermsSignerRelation,
} from '../lib/consent';
import type { Profile } from '../lib/types';

export type WizardReturnTo = 'booking' | 'manage' | null;
export type WizardMode = 'create' | 'resign';

export interface ProfileWizardDraft {
  whoFor: 'myself' | 'someone_else';
  relation_to_account_holder: RelationToAccountHolder;
  terms_signer_name: string;
  terms_signer_relation: TermsSignerRelation;
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
  customValues: Record<string, unknown>;
}

export const DEFAULT_WIZARD_DRAFT: ProfileWizardDraft = {
  whoFor: 'someone_else',
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
  customValues: {},
};

interface ProfileWizardState {
  isOpen: boolean;
  mode: WizardMode;
  resignProfile: Profile | null;
  currentStep: number;
  returnTo: WizardReturnTo;
  draft: ProfileWizardDraft;
  lastUsedProfileId: string | null;
  openWizard: (returnTo?: WizardReturnTo) => void;
  openResignWizard: (profile: Profile, returnTo?: WizardReturnTo) => void;
  closeWizard: () => void;
  setStep: (step: number) => void;
  updateDraft: (partial: Partial<ProfileWizardDraft>) => void;
  setFieldValue: (fieldKey: string, value: unknown) => void;
  resetDraft: () => void;
  setLastUsedProfileId: (id: string) => void;
}

function loadDraft(): ProfileWizardDraft {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return { ...DEFAULT_WIZARD_DRAFT, customValues: {} };
  }
  try {
    const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return { ...DEFAULT_WIZARD_DRAFT, customValues: {} };
    const parsed = JSON.parse(raw) as Partial<ProfileWizardDraft>;
    const merged: ProfileWizardDraft = {
      ...DEFAULT_WIZARD_DRAFT,
      ...parsed,
      customValues: { ...(parsed.customValues || {}) },
    };
    if ((merged.relation_to_account_holder as string) === 'self') {
      merged.relation_to_account_holder = 'child';
    }
    if ((merged.terms_signer_relation as string) === 'self') {
      merged.terms_signer_relation = 'parent';
    }
    return merged;
  } catch {
    return { ...DEFAULT_WIZARD_DRAFT, customValues: {} };
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

const TOP_LEVEL_DRAFT_KEYS = new Set<string>([
  'whoFor',
  'relation_to_account_holder',
  'terms_signer_name',
  'terms_signer_relation',
  'scope_acknowledged',
  'is_overseas_or_foreign',
  'overseas_acknowledged',
  'profile_name',
  'date_of_birth',
  'occupation',
  'nationality',
  'permanent_address',
  'present_address',
  'sameAsPermanent',
  'contact_number',
  'socmed_platform',
  'socmed_username',
  'preferred_contact_mode',
  'emergency_contact_name',
  'emergency_contact_relation',
  'emergency_contact_number',
  'information_confirmed',
  'consent_signer_name',
]);

export function getDraftFieldValue(draft: ProfileWizardDraft, fieldKey: string): unknown {
  if (TOP_LEVEL_DRAFT_KEYS.has(fieldKey)) {
    return draft[fieldKey as keyof ProfileWizardDraft];
  }
  return draft.customValues?.[fieldKey];
}

export function getDraftLookupMap(draft: ProfileWizardDraft): Record<string, unknown> {
  return {
    ...draft.customValues,
    whoFor: draft.whoFor,
    relation_to_account_holder: draft.relation_to_account_holder,
    terms_signer_name: draft.terms_signer_name,
    terms_signer_relation: draft.terms_signer_relation,
    scope_acknowledged: draft.scope_acknowledged,
    is_overseas_or_foreign: draft.is_overseas_or_foreign,
    overseas_acknowledged: draft.overseas_acknowledged,
    profile_name: draft.profile_name,
    date_of_birth: draft.date_of_birth,
    occupation: draft.occupation,
    nationality: draft.nationality,
    permanent_address: draft.permanent_address,
    present_address: draft.present_address,
    sameAsPermanent: draft.sameAsPermanent,
    contact_number: draft.contact_number,
    socmed_platform: draft.socmed_platform,
    socmed_username: draft.socmed_username,
    preferred_contact_mode: draft.preferred_contact_mode,
    emergency_contact_name: draft.emergency_contact_name,
    emergency_contact_relation: draft.emergency_contact_relation,
    emergency_contact_number: draft.emergency_contact_number,
    information_confirmed: draft.information_confirmed,
    consent_signer_name: draft.consent_signer_name,
  };
}

export const useProfileWizardStore = create<ProfileWizardState>((set) => ({
  isOpen: false,
  mode: 'create',
  resignProfile: null,
  currentStep: 1,
  returnTo: null,
  draft: loadDraft(),
  lastUsedProfileId: loadLastUsed(),

  openWizard: (returnTo = null) =>
    set((state) => {
      const draft = loadDraft();
      return {
        isOpen: true,
        mode: 'create',
        resignProfile: null,
        currentStep: state.mode === 'create' ? state.currentStep || 1 : 1,
        returnTo,
        draft,
      };
    }),

  openResignWizard: (profile, returnTo = null) =>
    set(() => {
      const isSelf = profile.type === 'self' || profile.relationshipToClient === 'self';
      const details = (profile.details || {}) as Record<string, unknown>;
      const draft: ProfileWizardDraft = {
        ...DEFAULT_WIZARD_DRAFT,
        whoFor: isSelf ? 'myself' : 'someone_else',
        relation_to_account_holder: (profile.relationshipToClient ||
          (isSelf ? 'self' : 'child')) as RelationToAccountHolder,
        terms_signer_name: isSelf ? profile.label : '',
        terms_signer_relation: isSelf ? 'self' : 'parent',
        profile_name: profile.label,
        date_of_birth: profile.dateOfBirth || '1995-01-01',
        socmed_platform: profile.socmedPlatform || '',
        socmed_username: profile.socmedUsername || '',
        occupation: String(details.occupation ?? profile.occupation ?? ''),
        nationality: String(details.nationality ?? profile.nationality ?? 'Filipino'),
        permanent_address: String(details.permanent_address ?? profile.permanentAddress ?? ''),
        present_address: String(details.present_address ?? profile.presentAddress ?? ''),
        contact_number: String(details.contact_number ?? profile.contactNumber ?? ''),
        preferred_contact_mode: (details.preferred_contact_mode ??
          profile.preferredContactMode ??
          'phone') as PreferredContactMode,
        emergency_contact_name: String(
          details.emergency_contact_name ?? profile.emergencyContactName ?? ''
        ),
        emergency_contact_relation: String(
          details.emergency_contact_relation ?? profile.emergencyContactRelation ?? ''
        ),
        emergency_contact_number: String(
          details.emergency_contact_number ?? profile.emergencyContactNumber ?? ''
        ),
        consent_signer_name: isSelf ? profile.label : '',
        customValues: { ...details },
      };
      return {
        isOpen: true,
        mode: 'resign',
        resignProfile: profile,
        currentStep: 1,
        returnTo,
        draft,
      };
    }),

  closeWizard: () => set({ isOpen: false }),

  setStep: (step) => set({ currentStep: step }),

  updateDraft: (partial) =>
    set((state) => {
      let next = {
        ...state.draft,
        ...partial,
        customValues: {
          ...(state.draft.customValues || {}),
          ...(partial.customValues || {}),
        },
      };
      if (partial.whoFor === 'myself') {
        next = {
          ...next,
          relation_to_account_holder: 'self',
          terms_signer_relation: 'self',
        };
      } else if (partial.whoFor === 'someone_else' && next.relation_to_account_holder === 'self') {
        next = {
          ...next,
          relation_to_account_holder: 'child',
          terms_signer_relation: 'parent',
        };
      }
      if (partial.sameAsPermanent === true) {
        next = { ...next, present_address: next.permanent_address };
      }
      if (partial.permanent_address !== undefined && next.sameAsPermanent) {
        next = { ...next, present_address: partial.permanent_address };
      }
      persistDraft(next);
      return { draft: next };
    }),

  setFieldValue: (fieldKey, value) =>
    set((state) => {
      const normalizedKey = fieldKey;
      let next = { ...state.draft };
      if (TOP_LEVEL_DRAFT_KEYS.has(normalizedKey)) {
        next = {
          ...next,
          [normalizedKey]: value,
        } as ProfileWizardDraft;
      } else {
        next = {
          ...next,
          customValues: {
            ...(next.customValues || {}),
            [normalizedKey]: value,
          },
        };
      }
      if (normalizedKey === 'whoFor') {
        if (value === 'myself') {
          next.relation_to_account_holder = 'self';
          next.terms_signer_relation = 'self';
        } else if (next.relation_to_account_holder === 'self') {
          next.relation_to_account_holder = 'child';
          next.terms_signer_relation = 'parent';
        }
      }
      if (normalizedKey === 'permanent_address' && next.sameAsPermanent) {
        next.present_address = String(value ?? '');
      }
      persistDraft(next);
      return { draft: next };
    }),

  resetDraft: () => {
    clearWizardDraftStorage();
    set({
      draft: { ...DEFAULT_WIZARD_DRAFT, customValues: {} },
      currentStep: 1,
      mode: 'create',
      resignProfile: null,
    });
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

/** Consent version fallback constant. */
export function getConsentVersion(): string {
  return CONSENT_VERSION;
}
