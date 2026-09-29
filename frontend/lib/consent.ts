/**
 * Persona wizard constants + helpers (frontend-only).
 *
 * Source: firm booking forms (consent v2). Logic reads CONSENT_VERSION from this
 * single constant and sends it in the POST /personas payload.
 */

export const CONSENT_VERSION = 'v2';

export const WIZARD_DRAFT_KEY = 'psychave.personaWizard.v1';
export const LAST_USED_PERSONA_KEY = 'psychave.lastUsedPersonaId';

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
