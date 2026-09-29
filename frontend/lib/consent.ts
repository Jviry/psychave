/**
 * Persona wizard constants + helpers (frontend-only).
 *
 * NOTE: Consent/service copy below is PLACEHOLDER until compliance owners
 * provide final versioned text. Logic reads CONSENT_VERSION from this single
 * constant and sends it in the POST /personas payload.
 */

export const CONSENT_VERSION = 'v1';

export const WIZARD_DRAFT_KEY = 'psychave.personaWizard.v1';
export const LAST_USED_PERSONA_KEY = 'psychave.lastUsedPersonaId';

/** PLACEHOLDER — compliance to replace. Versioned informed-consent copy. */
export const INFORMED_CONSENT_TEXT = `PLACEHOLDER — Informed Consent (${CONSENT_VERSION}).

1. Nature of services. PsychAvenuePH provides scheduled outpatient psychological services (consultation, psychotherapy, relational counseling, coaching, supervision, research advisory) delivered by PRC-verified resident psychologists, primarily via telehealth.
2. Voluntary participation. You may stop the intake or booking process at any time before payment. Paid-confirmed sessions follow the cancellation/rescheduling policy shown at booking.
3. Confidentiality and limits. Session content is confidential subject to Philippine law, including imminent-harm, abuse-of-minor, and court-order exceptions, and the platform's tiered access rule (assigned psychologist only sees private clinical notes; admins never do).
4. Data use. Intake and demographic details are used for care coordination and quality assurance only, in line with RA 10173. Testimonial use requires separate explicit consent and is withheld by default.
5. Screening tools. Before or during consultation you may be asked to complete brief screening tools; results are discussed with you and are not a standalone diagnosis.
6. Non-emergency platform. PsychAvenuePH is not a crisis service. For acute emergencies contact the NCMH Crisis Hotline 1553 / 0917-899-8727.

By typing your full name below you acknowledge you have read this version (${CONSENT_VERSION}) and agree to proceed.`;

/** PLACEHOLDER — compliance to replace. Typed-signature statement (page 1). */
export const TYPING_STATEMENT =
  'By typing your full name, you confirm you are the person authorized to consent for this persona under this consent version.';

/** PLACEHOLDER — compliance to replace. Scope & limitations acknowledgement (page 2). */
export const SCOPE_ACK_TEXT =
  'I understand each service has a defined scope and duration (e.g. Consultation 45 mins is screening-only, not full therapy; Life Coaching is not psychotherapy; Academic services exclude full-write authorship), and that my intake enters a pending queue until a verified psychologist proposes 3 schedule slots.';

/** PLACEHOLDER — compliance to replace. Overseas/jurisdictional acknowledgement (page 2). */
export const OVERSEAS_ACK_TEXT =
  'I understand that as an overseas client or foreign national, sessions are governed by Philippine law and clinician licensure scope, emergency protocols may differ by jurisdiction, and certain services (e.g. prescription-related support) may be unavailable.';

/** PLACEHOLDER — compliance to replace. Final confirmation statement (page 4). */
export const FINAL_CONSENT_STATEMENT =
  'I confirm the information provided is accurate and complete, and I consent to the creation of this persona record together with this signed consent under the version shown.';

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

export interface PersonaWizardPersona {
  relation_to_account_holder: RelationToAccountHolder;
  persona_name: string;
  date_of_birth: string;
  occupation: string | null;
  nationality: string;
  permanent_address: string;
  present_address: string;
  contact_number: string;
  socmed_platform: string | null;
  socmed_username: string | null;
  preferred_contact_mode: PreferredContactMode;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_number: string;
}

export interface PersonaWizardConsent {
  consent_version: string;
  terms_signer_name: string;
  terms_signer_relation: TermsSignerRelation;
  scope_acknowledged: boolean;
  is_overseas_or_foreign: boolean;
  overseas_acknowledged: boolean;
  information_confirmed: boolean;
  consent_signer_name: string;
}

export interface PersonaWizardPayload {
  persona: PersonaWizardPersona;
  consent: PersonaWizardConsent;
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

/** Which wizard step (1–4) owns a given payload field, for jumping to the right page. */
export function stepForField(field: string): 1 | 2 | 3 | 4 {
  if (
    field.startsWith('persona.') &&
    !['scope_acknowledged', 'is_overseas_or_foreign', 'overseas_acknowledged'].includes(field)
  ) {
    if (
      [
        'persona.relation_to_account_holder',
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
