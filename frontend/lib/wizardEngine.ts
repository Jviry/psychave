import {
  isFutureDob,
  isMinorDob,
  isValidPhone,
  isWizardBlockVisible,
  type PreferredContactMode,
  type ProfileWizardPayload,
  type RelationToAccountHolder,
  type TermsSignerRelation,
} from './consent';
import type { WizardBlock, WizardBlockType, WizardPage } from './types';

export const INPUT_BLOCK_TYPES = new Set<WizardBlockType>([
  'text',
  'textarea',
  'date',
  'phone',
  'select',
  'checkbox',
]);

export type WizardFlowMode = 'self' | 'dependent';
export type WizardValues = Record<string, unknown>;
export type WizardErrors = Record<string, string>;

const CORE_PROFILE_KEYS = new Set([
  'relation_to_account_holder',
  'profile_name',
  'date_of_birth',
  'socmed_platform',
  'socmed_username',
]);

const KNOWN_LEGACY_PROFILE_KEYS = new Set([
  'first_name',
  'last_name',
  'occupation',
  'nationality',
  'permanent_address',
  'present_address',
  'contact_number',
  'preferred_contact_mode',
  'emergency_contact_name',
  'emergency_contact_relation',
  'emergency_contact_number',
]);

const KNOWN_LEGACY_CONSENT_KEYS = new Set([
  'terms_agreed',
  'terms_signer_relation',
  'scope_acknowledged',
  'is_overseas_or_foreign',
  'overseas_acknowledged',
  'information_confirmed',
]);

/** Returns true when a CMS page contains at least one consent/legal block (used for resign mode). */
export function isConsentWizardPage(page: WizardPage): boolean {
  return page.blocks.some(
    (b) =>
      b.type === 'scrollable_doc' ||
      b.type === 'review_summary' ||
      b.target === 'consent' ||
      b.target === 'custom' ||
      b.blockId === 'final_consent_doc'
  );
}

/** Filters CMS pages for resign mode (only pages with consent/legal/review blocks). */
export function getEffectiveWizardPages(
  pages: WizardPage[],
  options: { resignOnly?: boolean } = {}
): WizardPage[] {
  if (!options.resignOnly) return pages;
  const filtered = pages.filter(isConsentWizardPage);
  return filtered.length > 0 ? filtered : pages;
}

/** Composes full name from first_name + last_name, falling back to profile_name. */
export function composeProfileFullName(values: WizardValues): string {
  const first = String(values.first_name ?? '').trim();
  const last = String(values.last_name ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  return String(values.profile_name ?? '').trim();
}

/** Validates a single dynamic CMS wizard page against current values and flow mode. */
export function validateWizardPage(
  page: WizardPage,
  allPages: WizardPage[],
  values: WizardValues,
  options: {
    isSelf: boolean;
    resignOnly?: boolean;
  }
): WizardErrors {
  const errs: WizardErrors = {};
  const { isSelf, resignOnly = false } = options;
  const isOverseas = Boolean(values.is_overseas_or_foreign);

  for (const block of page.blocks) {
    if (!INPUT_BLOCK_TYPES.has(block.type)) continue;
    if (!block.fieldKey) continue;
    if (block.target === 'ui') continue;
    if (!isWizardBlockVisible(block, isSelf, values)) continue;
    if (resignOnly && block.target === 'profile') continue;

    const key = block.fieldKey;
    const raw = values[key];

    if (block.type === 'checkbox') {
      if (block.required && raw !== true) {
        errs[key] =
          key === 'terms_agreed'
            ? 'Please agree to the informed consent and data privacy terms.'
            : key === 'scope_acknowledged'
              ? 'Please acknowledge the scope & limitations.'
              : key === 'overseas_acknowledged'
                ? 'Please acknowledge the overseas & foreign national limitations.'
                : key === 'information_confirmed'
                  ? 'Please confirm that the information provided is accurate and complete.'
                  : `Please confirm "${block.label}".`;
      }
      continue;
    }

    const strVal = raw == null ? '' : String(raw).trim();

    if (block.required && !strVal) {
      if (key === 'first_name') errs[key] = 'Enter first name.';
      else if (key === 'last_name') errs[key] = 'Enter last name.';
      else if (key === 'profile_name') errs[key] = 'Enter full name.';
      else if (key === 'date_of_birth') errs[key] = 'Enter date of birth.';
      else if (key === 'relation_to_account_holder')
        errs[key] = 'Select the relation to the account holder.';
      else if (key === 'terms_signer_relation')
        errs[key] = 'Select the signer relation to the client.';
      else errs[key] = `${block.label} is required.`;
      continue;
    }

    if (!strVal) continue;

    if (key === 'relation_to_account_holder' && !isSelf && strVal === 'self') {
      errs[key] = 'Select a dependent relation to the account holder.';
      continue;
    }

    if (key === 'terms_signer_relation') {
      if (!isSelf && strVal === 'self') {
        errs[key] = 'Select the signer relation to the client.';
        continue;
      }
      const dob = String(values.date_of_birth ?? '').trim();
      if (dob && !isFutureDob(dob) && isMinorDob(dob) && strVal === 'self') {
        errs[key] = 'A minor profile cannot use signer relation "self".';
        continue;
      }
    }

    if (block.type === 'date' || key === 'date_of_birth') {
      if (key === 'date_of_birth') {
        if (isFutureDob(strVal)) {
          errs[key] = 'Date of birth cannot be in the future.';
          continue;
        }
        if (isSelf && isMinorDob(strVal)) {
          errs[key] =
            'Account holder must be at least 18 years old to register. Minors can be added as dependent profiles under an adult account.';
          continue;
        }
      }
    }

    if (block.type === 'phone') {
      if (!isValidPhone(strVal, isOverseas)) {
        errs[key] = isOverseas
          ? 'Enter a valid international contact number.'
          : 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';
        continue;
      }
    }

    if (block.type === 'select' && block.options.length > 0) {
      const allowed = new Set(block.options.map((o) => o.value));
      if (!allowed.has(strVal)) {
        errs[key] = `Choose a valid option for ${block.label}.`;
        continue;
      }
    }
  }

  // Cross-field social media check when socmed_username is filled on this page
  const hasSocmedUsername = page.blocks.some(
    (b) => b.fieldKey === 'socmed_username' && isWizardBlockVisible(b, isSelf, values)
  );
  if (hasSocmedUsername) {
    const handle = String(values.socmed_username ?? '').trim();
    const platform = String(values.socmed_platform ?? '').trim();
    if (handle && !platform) {
      errs.socmed_platform = 'Choose the platform for this username.';
    }
  }

  return errs;
}

/**
 * Builds the canonical `{ profile, consent }` submission payload from dynamic CMS wizard pages
 * and the current form values. Works identically for `/auth/create-user` (self) and `/profiles` (dependent).
 */
export function buildDynamicWizardPayloads(
  pages: WizardPage[],
  values: WizardValues,
  options: {
    isSelf: boolean;
    consentVersion: string;
    fallbackProfileName?: string;
  }
): ProfileWizardPayload {
  const { isSelf, consentVersion, fallbackProfileName } = options;

  const fullName =
    composeProfileFullName(values) || (fallbackProfileName ?? '').trim();
  const relation: RelationToAccountHolder = isSelf
    ? 'self'
    : ((String(values.relation_to_account_holder || 'child') as RelationToAccountHolder) ===
      'self'
        ? 'child'
        : (String(values.relation_to_account_holder || 'child') as RelationToAccountHolder));

  const details: Record<string, unknown> = {};
  const responses: Record<string, unknown> = {};

  const firstName = String(values.first_name ?? '').trim();
  const lastName = String(values.last_name ?? '').trim();
  if (firstName) details.first_name = firstName;
  if (lastName) details.last_name = lastName;

  for (const page of pages) {
    for (const block of page.blocks) {
      if (!INPUT_BLOCK_TYPES.has(block.type)) continue;
      if (!block.fieldKey) continue;
      if (block.target === 'ui') continue;
      if (!isWizardBlockVisible(block, isSelf, values)) continue;

      const key = block.fieldKey;
      const raw = values[key];
      const normalized =
        block.type === 'checkbox'
          ? Boolean(raw)
          : typeof raw === 'string'
            ? raw.trim()
            : raw;

      const target = block.target || 'custom';
      if (target === 'profile') {
        if (!CORE_PROFILE_KEYS.has(key) && normalized !== undefined && normalized !== '') {
          details[key] = normalized;
        }
      } else {
        // target === 'consent' | 'custom'
        if (normalized !== undefined && (block.type === 'checkbox' || normalized !== '')) {
          responses[key] = normalized;
        }
      }
    }
  }

  // Ensure standard consent defaults when omitted or hidden by appliesTo
  const signerRelation: TermsSignerRelation = isSelf
    ? 'self'
    : ((String(responses.terms_signer_relation || values.terms_signer_relation || 'parent') as TermsSignerRelation));

  const isOverseas = Boolean(responses.is_overseas_or_foreign ?? values.is_overseas_or_foreign);
  const overseasAck = isOverseas
    ? Boolean(responses.overseas_acknowledged ?? values.overseas_acknowledged)
    : false;

  const socmedPlatform = String(values.socmed_platform ?? '').trim() || null;
  const socmedUsername = String(values.socmed_username ?? '').trim() || null;

  const profilePayload: ProfileWizardPayload['profile'] = {
    relation_to_account_holder: relation,
    profile_name: fullName,
    date_of_birth: String(values.date_of_birth ?? '').trim(),
    socmed_platform: socmedPlatform,
    socmed_username: socmedUsername,
    details,
  };

  // Populate top-level legacy keys for backwards compatibility with older mocks/schemas
  for (const key of KNOWN_LEGACY_PROFILE_KEYS) {
    if (key in details) {
      profilePayload[key] = details[key];
    }
  }
  if (!profilePayload.preferred_contact_mode && values.preferred_contact_mode) {
    profilePayload.preferred_contact_mode = values.preferred_contact_mode as PreferredContactMode;
  }

  const consentPayload: ProfileWizardPayload['consent'] = {
    consent_version: consentVersion,
    terms_agreed: Boolean(responses.terms_agreed ?? values.terms_agreed),
    terms_signer_relation: signerRelation,
    scope_acknowledged: Boolean(responses.scope_acknowledged ?? values.scope_acknowledged),
    is_overseas_or_foreign: isOverseas,
    overseas_acknowledged: overseasAck,
    information_confirmed: Boolean(responses.information_confirmed ?? values.information_confirmed),
    responses,
  };

  for (const key of KNOWN_LEGACY_CONSENT_KEYS) {
    if (key in responses) {
      consentPayload[key] = responses[key];
    }
  }

  return { profile: profilePayload, consent: consentPayload };
}

/** Finds the 1-based step index owning a given field key (for jumping on backend 422 errors). */
export function findStepIndexForField(
  field: string,
  pages: WizardPage[]
): number {
  const cleanKey = field.includes('.') ? field.split('.').pop() || field : field;
  const idx = pages.findIndex((p) =>
    p.blocks.some((b) => b.fieldKey === cleanKey || b.blockId === cleanKey)
  );
  return idx >= 0 ? idx + 1 : 1;
}

/** Formats a block value for display inside `review_summary`. */
export function formatReviewValue(block: WizardBlock, raw: unknown): string {
  if (block.type === 'checkbox') {
    return raw ? 'Yes' : 'No';
  }
  if (raw == null || String(raw).trim() === '') {
    return '—';
  }
  const str = String(raw);
  if (block.type === 'select' && block.options.length > 0) {
    const found = block.options.find((o) => o.value === str);
    if (found) return found.label;
  }
  return str;
}
