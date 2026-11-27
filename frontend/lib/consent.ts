import type { WizardBlock, WizardPage } from './types';

/**
 * Profile wizard constants + helpers.
 *
 * Source: firm booking forms (consent v2). Dynamic wizard pages fetched from
 * GET /forms/active override these defaults at runtime.
 */

export const CONSENT_VERSION = 'v2';

export const WIZARD_DRAFT_KEY = 'psychave.profileWizard.v1';
export const LAST_USED_PROFILE_KEY = 'psychave.lastUsedProfileId';

/** Informed consent + data privacy agreement (wizard page 1, scrollable). */
export const INFORMED_CONSENT_TEXT = `INFORMED CONSENT AND DATA PRIVACY AGREEMENT
This informed consent form explains the nature, purpose, scope, and limitations of the psychological services provided by licensed psychologists of PsychAve PH: Psychological Services, in accordance with the Professional Regulatory Commission (PRC) and the Psychological Association of the Philippines (PAP) Code of Ethics, as well as the Data Privacy Act of 2012 (Republic Act No. 10173).

All information shared during psychological services, including personal data, session content, screening results, and records, is treated as confidential in accordance with PAP ethical standards and Philippine law.

Personal data is collected, processed, and stored solely for legitimate clinical, documentation, and professional purposes. Records are securely maintained and accessed only by the psychologist or authorized personnel.

Confidentiality may be ethically or legally breached only under the following circumstances:

Presence of serious and imminent risk of harm to self or others
Suspected abuse or neglect as required by law
Court orders or lawful demands
Other situations mandated by Philippine laws and professional regulations
Important limitation: All sessions, screening, and results are strictly for therapeutic, clinical, and personal use. These will not be used, shared, or submitted for any legal, court, or administrative proceedings, unless otherwise required by law under exceptional circumstances.`;

/** Typed-signature statement under the page-1 signer field. */
export const TYPING_STATEMENT =
  'By typing your full name in the designated field, you confirm that you have read, understood, and voluntarily agreed to the terms stated above. If filling out for a minor, write your full name and relation to the client.';

/** Scope & limitations reference text (wizard page 2, scrollable). */
export const SCOPE_LIMITATIONS_TEXT = `SCOPE & LIMITATIONS OF SERVICES: All services provided are delivered by licensed psychologists and are intended for clinical, therapeutic, coaching, and personal development purposes only. Services are based on professional training, ethical standards, client self-report, and clinical judgement, and are conducted within the psychologists' scope of competence in accordance with PRC Regulations and PAP ethical guidelines.

Psychological services are not forensic or medico-legal in nature. Information shared, screening results, professional opinions, sessions notes, and documents issued are not intended for court, legal, administrative, or disciplinary proceedings, and no expert testimony or legal opinions will be provided based on these services.

Outcomes may vary among individuals. Recommendations and observations are based on information available at the time of service and may change as new information emerges.`;

/** Scope acknowledgement checkbox (wizard page 2). */
export const SCOPE_ACK_TEXT =
  'I have read and understood the scope and limitations applicable to all psychological services provided.';

/** Overseas/jurisdictional limitations reference text (wizard page 2, scrollable, conditional). */
export const OVERSEAS_LIMITATIONS_TEXT = `LIMITATIONS FOR OVERSEAS CLIENTS AND FOREIGN NATIONALS

(Applicable to clients living abroad and foreign nationals residing in the Philippines)

Jurisdiction and Professional Scope: Psychological services are provided by a psychologist licensed in the Philippines and are governed by Philippine laws, PRC regulations, and the Psychological Association of the Philippines (PAP) Code of Ethics. All services are delivered within this professional and legal framework.

Overseas Filipino Clients (Filipino Citizenship): For Filipino clients residing outside the Philippines, services are limited to non-forensic, non-medico-legal psychological support. Services may be subject to legal, regulatory, or practice restrictions in the client's country of residence. The psychologist does not claim licensure or authority to practice psychology under the laws of the host country.

Foreign Nationals: For foreign nationals, whether residing in the Philippines, psychological services are provided for clinical and supportive purposes only and are governed by Philippine professional and ethical standards. Services are not intended to satisfy legal, immigration, employment, or court-related requirements of the client's home country or any other jurisdiction.

Emergency and Crisis Limitations:
Psychological services are not a substitute for local emergency or crisis intervention services. Clients residing outside the Philippines, as well as foreign nationals, are responsible for identifying and accessing appropriate emergency or crisis resources within their current country of residence.`;

/** Overseas acknowledgement checkbox (wizard page 2, conditional). */
export const OVERSEAS_ACK_TEXT =
  'I understand the jurisdictional and service limitations applicable to overseas clients and foreign nationals.';

/** Final consent & acknowledgement statement (wizard page 4). */
export const FINAL_CONSENT_STATEMENT =
  'By typing my full name below, I confirm that I have read and understood the description, purpose, scope, limitations, confidentiality, data privacy provisions, and ethical boundaries of the psychological service I am availing.';

/** Canonical 4-page v2 wizard schema fallback (matches backend build_default_wizard_pages). */
export const DEFAULT_WIZARD_PAGES: WizardPage[] = [
  {
    pageId: 'step-1-consent',
    title: 'Informed consent & agreement',
    description: 'Review the informed consent and data privacy terms.',
    blocks: [
      {
        blockId: 'informed_consent_doc',
        type: 'scrollable_doc',
        label: 'Informed consent text — scroll to read',
        content: INFORMED_CONSENT_TEXT,
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'relation_to_account_holder',
        type: 'select',
        label: 'Relation to account holder',
        target: 'profile',
        fieldKey: 'relation_to_account_holder',
        appliesTo: 'dependent',
        required: true,
        options: [
          { value: 'child', label: 'Child' },
          { value: 'spouse', label: 'Spouse' },
          { value: 'parent', label: 'Parent' },
          { value: 'sibling', label: 'Sibling' },
          { value: 'other', label: 'Other' },
        ],
        systemLocked: true,
      },
      {
        blockId: 'terms_signer_relation',
        type: 'select',
        label: "Signer's relation to the client",
        target: 'consent',
        fieldKey: 'terms_signer_relation',
        appliesTo: 'dependent',
        required: true,
        options: [
          { value: 'parent', label: 'Parent' },
          { value: 'legal guardian', label: 'Legal guardian' },
          { value: 'spouse', label: 'Spouse' },
          { value: 'other', label: 'Other' },
        ],
        systemLocked: false,
      },
      {
        blockId: 'terms_signer_name',
        type: 'text',
        label: 'Signer full name (typed signature)',
        helperText: TYPING_STATEMENT,
        placeholder: 'Type full name',
        target: 'consent',
        fieldKey: 'terms_signer_name',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
    ],
  },
  {
    pageId: 'step-2-scope',
    title: 'Services & acknowledgements',
    description: 'Review offered services and clinical scope notices.',
    blocks: [
      {
        blockId: 'services_overview',
        type: 'services_list',
        label: 'Services offered (read-only)',
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'scope_limitations_doc',
        type: 'scrollable_doc',
        label: 'Scope & limitations of services — scroll to read',
        content: SCOPE_LIMITATIONS_TEXT,
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'scope_acknowledged',
        type: 'checkbox',
        label: SCOPE_ACK_TEXT,
        target: 'consent',
        fieldKey: 'scope_acknowledged',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'is_overseas_or_foreign',
        type: 'checkbox',
        label: 'I am an overseas client or foreign national',
        target: 'consent',
        fieldKey: 'is_overseas_or_foreign',
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'overseas_limitations_doc',
        type: 'scrollable_doc',
        label: 'Limitations for overseas clients and foreign nationals — scroll to read',
        content: OVERSEAS_LIMITATIONS_TEXT,
        appliesTo: 'all',
        required: false,
        options: [],
        showIf: { fieldKey: 'is_overseas_or_foreign', equals: true },
        systemLocked: false,
      },
      {
        blockId: 'overseas_acknowledged',
        type: 'checkbox',
        label: OVERSEAS_ACK_TEXT,
        target: 'consent',
        fieldKey: 'overseas_acknowledged',
        appliesTo: 'all',
        required: true,
        options: [],
        showIf: { fieldKey: 'is_overseas_or_foreign', equals: true },
        systemLocked: false,
      },
    ],
  },
  {
    pageId: 'step-3-demographics',
    title: 'Demographics',
    description: 'Provide demographic and contact information.',
    blocks: [
      {
        blockId: 'first_name',
        type: 'text',
        label: 'First name',
        placeholder: 'Enter first name',
        target: 'profile',
        fieldKey: 'first_name',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: true,
      },
      {
        blockId: 'last_name',
        type: 'text',
        label: 'Last name',
        placeholder: 'Enter last name',
        target: 'profile',
        fieldKey: 'last_name',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: true,
      },
      {
        blockId: 'date_of_birth',
        type: 'date',
        label: 'Date of birth',
        target: 'profile',
        fieldKey: 'date_of_birth',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: true,
      },
      {
        blockId: 'occupation',
        type: 'text',
        label: 'Occupation (optional)',
        target: 'profile',
        fieldKey: 'occupation',
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'nationality',
        type: 'text',
        label: 'Nationality',
        placeholder: 'e.g. Filipino',
        target: 'profile',
        fieldKey: 'nationality',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'contact_number',
        type: 'phone',
        label: 'Contact number',
        target: 'profile',
        fieldKey: 'contact_number',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'permanent_address',
        type: 'textarea',
        label: 'Permanent address',
        target: 'profile',
        fieldKey: 'permanent_address',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'present_address',
        type: 'textarea',
        label: 'Present address',
        target: 'profile',
        fieldKey: 'present_address',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'socmed_platform',
        type: 'select',
        label: 'Social media platform (optional)',
        target: 'profile',
        fieldKey: 'socmed_platform',
        appliesTo: 'all',
        required: false,
        options: [
          { value: '', label: 'None' },
          { value: 'instagram', label: 'Instagram' },
          { value: 'facebook', label: 'Facebook' },
          { value: 'messenger', label: 'Messenger' },
          { value: 'tiktok', label: 'TikTok' },
          { value: 'x', label: 'X' },
          { value: 'other', label: 'Other' },
        ],
        systemLocked: true,
      },
      {
        blockId: 'socmed_username',
        type: 'text',
        label: 'Username (optional)',
        placeholder: '@username',
        target: 'profile',
        fieldKey: 'socmed_username',
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: true,
      },
      {
        blockId: 'preferred_contact_mode',
        type: 'select',
        label: 'Preferred contact mode',
        target: 'profile',
        fieldKey: 'preferred_contact_mode',
        appliesTo: 'all',
        required: true,
        options: [
          { value: 'phone', label: 'Phone' },
          { value: 'email', label: 'Email' },
          { value: 'messenger', label: 'Messenger' },
          { value: 'instagram', label: 'Instagram' },
        ],
        systemLocked: false,
      },
      {
        blockId: 'emergency_contact_heading',
        type: 'section_heading',
        label: 'Emergency Contact',
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'emergency_contact_name',
        type: 'text',
        label: 'Emergency contact name',
        target: 'profile',
        fieldKey: 'emergency_contact_name',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'emergency_contact_relation',
        type: 'text',
        label: 'Emergency contact relation',
        placeholder: 'e.g. Mother',
        target: 'profile',
        fieldKey: 'emergency_contact_relation',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'emergency_contact_number',
        type: 'phone',
        label: 'Emergency contact number',
        target: 'profile',
        fieldKey: 'emergency_contact_number',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
    ],
  },
  {
    pageId: 'step-4-confirmation',
    title: 'Confirmation & final consent',
    description: 'Review your entries and sign to complete.',
    blocks: [
      {
        blockId: 'review_summary',
        type: 'review_summary',
        label: 'Review your entries before signing',
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'information_confirmed',
        type: 'checkbox',
        label: 'I confirm that the information provided is accurate and complete.',
        target: 'consent',
        fieldKey: 'information_confirmed',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'final_consent_doc',
        type: 'info_text',
        label: 'Final consent & acknowledgement',
        content: FINAL_CONSENT_STATEMENT,
        appliesTo: 'all',
        required: false,
        options: [],
        systemLocked: false,
      },
      {
        blockId: 'consent_signer_name',
        type: 'text',
        label: 'Final consent signer full name',
        placeholder: 'Type full name to sign',
        target: 'consent',
        fieldKey: 'consent_signer_name',
        appliesTo: 'all',
        required: true,
        options: [],
        systemLocked: false,
      },
    ],
  },
];

function extractConsentSignature(pages: WizardPage[]): string {
  const sig: unknown[] = [];
  for (const page of pages) {
    for (const block of page.blocks) {
      const isConsent =
        block.target === 'consent' ||
        block.type === 'scrollable_doc' ||
        block.blockId === 'final_consent_doc';
      if (isConsent) {
        sig.push({
          blockId: block.blockId,
          type: block.type,
          fieldKey: block.fieldKey ?? null,
          label: (block.label || '').trim(),
          content: (block.content || '').trim(),
          helperText: (block.helperText || '').trim(),
          required: Boolean(block.required),
          appliesTo: block.appliesTo || 'all',
          options: block.options || [],
          showIf: block.showIf ?? null,
        });
      }
    }
  }
  return JSON.stringify(sig);
}

/**
 * Returns true when any consent field or scrollable legal document changed
 * compared to the baseline pages (which triggers a major version bump requiring
 * clients to re-sign). Returns false when only demographic or UI fields changed
 * (which triggers a minor decimal bump without requiring re-sign).
 */
export function didConsentBlocksChange(
  oldPages: WizardPage[],
  newPages: WizardPage[]
): boolean {
  return extractConsentSignature(oldPages) !== extractConsentSignature(newPages);
}

/** Evaluates whether a WizardBlock is visible for the current flow & field values. */
export function isWizardBlockVisible(
  block: WizardBlock,
  isSelf: boolean,
  values: Record<string, unknown>
): boolean {
  const appliesTo = block.appliesTo || 'all';
  if (appliesTo === 'self' && !isSelf) return false;
  if (appliesTo === 'dependent' && isSelf) return false;

  if (block.showIf && block.showIf.fieldKey) {
    const actual = values[block.showIf.fieldKey];
    if (actual !== block.showIf.equals) return false;
  }
  return true;
}

export type RelationToAccountHolder =
  | 'child'
  | 'spouse'
  | 'parent'
  | 'sibling'
  | 'other'
  | 'self';

export type TermsSignerRelation =
  | 'parent'
  | 'legal guardian'
  | 'spouse'
  | 'other'
  | 'self';

export type PreferredContactMode = 'phone' | 'email' | 'messenger' | 'instagram';

export interface ProfileWizardProfile {
  relation_to_account_holder: RelationToAccountHolder;
  profile_name: string;
  date_of_birth: string;
  occupation?: string | null;
  nationality?: string;
  permanent_address?: string;
  present_address?: string;
  contact_number?: string;
  socmed_platform?: string | null;
  socmed_username?: string | null;
  preferred_contact_mode?: PreferredContactMode | string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_number?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProfileWizardConsent {
  consent_version: string;
  terms_signer_name?: string;
  terms_signer_relation?: TermsSignerRelation | string;
  scope_acknowledged?: boolean;
  is_overseas_or_foreign?: boolean;
  overseas_acknowledged?: boolean;
  information_confirmed?: boolean;
  consent_signer_name?: string;
  responses?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProfileWizardPayload {
  profile: ProfileWizardProfile;
  consent: ProfileWizardConsent;
}

/** Compute minor status (<18y) from an ISO date string. Returns false on invalid input. */
export function isMinorDob(dobIso: string, now = new Date()): boolean {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime()) || dob > now) return false;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age < 18;
}

export function isFutureDob(dobIso: string, now = new Date()): boolean {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return false;
  return dob.getTime() > now.getTime();
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * PH phone check with international allowed for overseas clients.
 * Non-overseas: must look like 09XXXXXXXXX or +639XXXXXXXXX.
 * Overseas: any sane international number (7–18 digits/space/dash/paren).
 */
export function isValidPhone(phone: string, isOverseas: boolean): boolean {
  const raw = phone.trim();
  if (!/^\+?[0-9\s\-()]{7,20}$/.test(raw)) return false;
  if (isOverseas) return true;
  const digits = raw.replace(/\D/g, '');
  return /^(09\d{9}|639\d{9})$/.test(digits);
}

/** Map a backend 422-style error (or mock error) to field errors when possible. */
export function parseApiFieldErrors(err: unknown): Record<string, string> {
  if (!err) return {};
  const msg = err instanceof Error ? err.message : String(err);
  // Convention: mock/real server may throw "FIELDS:{json}" for mapped errors.
  const marker = 'FIELDS:';
  const idx = msg.indexOf(marker);
  if (idx >= 0) {
    try {
      const parsed = JSON.parse(msg.slice(idx + marker.length));
      if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    } catch {
      // fall through to generic message
    }
  }
  return { _form: msg };
}

/** Which wizard step (1–N) owns a given payload field, for jumping to the right page. */
export function stepForField(field: string, pages?: WizardPage[]): number {
  const cleanKey = field.includes('.') ? field.split('.').pop() || field : field;
  if (pages && pages.length > 0) {
    const idx = pages.findIndex((p) => p.blocks.some((b) => b.fieldKey === cleanKey));
    if (idx >= 0) return idx + 1;
  }
  if (
    field.startsWith('profile.') &&
    !['scope_acknowledged', 'is_overseas_or_foreign', 'overseas_acknowledged'].includes(field)
  ) {
    if (
      [
        'profile.relation_to_account_holder',
        'consent.terms_signer_name',
        'consent.terms_signer_relation',
      ].includes(field)
    )
      return 1;
    return 3;
  }
  if (field.startsWith('consent.')) {
    if (
      ['consent.scope_acknowledged', 'consent.is_overseas_or_foreign', 'consent.overseas_acknowledged'].includes(
        field
      )
    )
      return 2;
    if (['consent.terms_signer_name', 'consent.terms_signer_relation'].includes(field)) return 1;
    return 4;
  }
  if (['relation_to_account_holder', 'terms_signer_name', 'terms_signer_relation'].includes(field)) return 1;
  if (['scope_acknowledged', 'is_overseas_or_foreign', 'overseas_acknowledged'].includes(field)) return 2;
  if (['information_confirmed', 'consent_signer_name'].includes(field)) return 4;
  return 3;
}
