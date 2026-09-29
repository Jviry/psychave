import { z } from 'zod';

/**
 * Zod Schema for creating a Client Persona (Self or Dependent)
 */
export const personaSchema = z.object({
  type: z.enum(['self', 'dependent']),
  label: z
    .string()
    .min(3, 'Please provide a non-identifying persona label (min 3 characters).')
    .max(60, 'Label must be under 60 characters.'),
  ageGroup: z.string().min(1, 'Please select an age bracket.'),
  relationshipToClient: z
    .string()
    .min(2, 'Specify relationship (e.g., Primary Account Holder, Adolescent Dependent).'),
  preferredLanguage: z.string().min(2, 'Please select a preferred session language.'),
});

export type PersonaFormValues = z.infer<typeof personaSchema>;

/**
 * Flow C Step 1: Canonical Client Intake Schema
 */
export const intakeFormSchema = z.object({
  personaId: z.string().min(1, 'Please select a Persona (Self or Dependent) before submitting.'),
  serviceId: z.string().min(1, 'Please select a clinical service.'),
  preferredLanguage: z.string().min(1, 'Please choose your preferred session language.'),
  concernsSummary: z
    .string()
    .min(20, 'Please describe your primary concerns or goals (at least 20 characters) to help verified psychologists assess fit.')
    .max(1200, 'Please keep intake summary under 1,200 characters.'),
  specificNeeds: z
    .string()
    .min(5, 'Please note any scheduling preferences, accessibility needs, or breakout accommodations.')
    .max(600, 'Maximum 600 characters.'),
  guardrailAcknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the clinical scope & duration guardrail for the selected service.',
  }),
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

/**
 * Flow C Step 3: Verified Psychologist Pick-Up + Price + 3 Date/Time Slots Schema
 */
const isFutureDate = (val: string) => {
  if (!val) return false;
  // If string has no timezone offset, normalize as Asia/Manila (+08:00)
  const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(val);
  const normalized = hasTimezone ? val : (val.length === 16 ? `${val}:00+08:00` : `${val}+08:00`);
  const d = new Date(normalized);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
};

export const proposalFormSchema = z
  .object({
    pricePhp: z
      .number({ message: 'Enter a valid PHP session fee.' })
      .min(500, 'Minimum session fee is ₱500.')
      .max(25000, 'Maximum session fee is ₱25,000.'),
    slot1DateTime: z
      .string()
      .min(1, 'Slot 1 date and time is required.')
      .refine(isFutureDate, { message: 'Slot 1 date and time cannot be in the past.' }),
    slot2DateTime: z
      .string()
      .min(1, 'Slot 2 date and time is required.')
      .refine(isFutureDate, { message: 'Slot 2 date and time cannot be in the past.' }),
    slot3DateTime: z
      .string()
      .min(1, 'Slot 3 date and time is required.')
      .refine(isFutureDate, { message: 'Slot 3 date and time cannot be in the past.' }),
    clinicalPrepNote: z
      .string()
      .min(10, 'Provide a brief preparation note for the client (at least 10 characters).')
      .max(500, 'Preparation note must be under 500 characters.'),
  })
  .refine(
    (data) => {
      const s1 = data.slot1DateTime.trim();
      const s2 = data.slot2DateTime.trim();
      const s3 = data.slot3DateTime.trim();
      return s1 !== s2 && s2 !== s3 && s1 !== s3;
    },
    {
      message: 'All 3 proposed date/time slots must be distinct.',
      path: ['slot3DateTime'],
    }
  );

export type ProposalFormValues = z.infer<typeof proposalFormSchema>;

/**
 * Psychologist Profile Schema
 */
export const psychologistProfileSchema = z.object({
  specialization: z
    .string()
    .min(3, 'Specialization must be at least 3 characters.')
    .max(150, 'Specialization must be under 150 characters.'),
  prcCredentialCode: z
    .string()
    .min(3, 'PRC license credential code must be at least 3 characters.')
    .max(80, 'Credential code must be under 80 characters.'),
  bio: z
    .string()
    .min(10, 'Bio must be at least 10 characters.')
    .max(1000, 'Bio must be under 1,000 characters.'),
  yearsPractice: z.string().min(1, 'Years of practice is required.'),
  languages: z.string().min(2, 'Languages must be specified (comma-separated).'),
});

export type PsychologistProfileValues = z.infer<typeof psychologistProfileSchema>;

/**
 * Flow C Step 4: Client Proposal Slot Selection & Payment Schema
 */
export const slotSelectionPaymentSchema = z.object({
  selectedSlotId: z.string().min(1, 'Please select exactly 1 of the 3 proposed schedule slots.'),
  paymentMethodLabel: z.enum(['card_visa_4242', 'gcash_paymongo_mock', 'maya_stripe_mock']),
  acknowledgeFinalizationRule: z.boolean().refine((val) => val === true, {
    message: 'Please confirm that booking finalizes and unlocks contact details only upon payment success.',
  }),
});

export type SlotSelectionPaymentValues = z.infer<typeof slotSelectionPaymentSchema>;

/**
 * Admin CMS Editor Schema
 */
export const cmsOverviewSchema = z.object({
  vision: z.string().min(20, 'Vision statement must be at least 20 characters.'),
  mission: z.string().min(20, 'Mission statement must be at least 20 characters.'),
  clinicOverview: z.string().min(30, 'Clinic overview must be at least 30 characters.'),
  impactNarrative: z.string().min(20, 'Impact placeholder description must be at least 20 characters.'),
  consentFlagBanner: z.string().min(20, 'Consent-flag governance notice is required.'),
});

export type CmsOverviewFormValues = z.infer<typeof cmsOverviewSchema>;

/* ------------------------------------------------------------------ */
/* Persona creation wizard (4 pages, single POST /personas at submit).  */
/* Page schemas validate their own slice; cross-page rules (minor/self, */
/* signer-name match, phone-vs-overseas) are enforced in               */
/* personaWizardPayloadSchema + lib/consent.ts helpers, mirroring the   */
/* backend as source of truth.                                          */
/* ------------------------------------------------------------------ */

export const wizardStep1Schema = z.object({
  whoFor: z.enum(['myself', 'someone_else']),
  relation_to_account_holder: z.enum(['child', 'spouse', 'parent', 'sibling', 'other', 'self']),
  terms_signer_name: z.string().min(2, 'Type the full name of the person signing consent.'),
  terms_signer_relation: z.enum(['parent', 'legal guardian', 'spouse', 'other', 'self']),
});

export type WizardStep1Values = z.infer<typeof wizardStep1Schema>;

export const wizardStep2Schema = z
  .object({
    scope_acknowledged: z.boolean().refine((v) => v === true, {
      message: 'Scope and limitations acknowledgement is required.',
    }),
    is_overseas_or_foreign: z.boolean(),
    overseas_acknowledged: z.boolean(),
  })
  .refine(
    (d) => (d.is_overseas_or_foreign ? d.overseas_acknowledged === true : true),
    {
      message: 'Overseas/jurisdictional acknowledgement is required when the overseas box is checked.',
      path: ['overseas_acknowledged'],
    }
  );

export type WizardStep2Values = z.infer<typeof wizardStep2Schema>;

const PHONE_LOOSE = /^\+?[0-9\s\-()]{7,20}$/;

export const wizardStep3Schema = z.object({
  persona_name: z.string().min(2, 'Enter the persona full name.'),
  date_of_birth: z
    .string()
    .min(1, 'Select a date of birth.')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid date of birth.')
    .refine((v) => new Date(v).getTime() <= Date.now(), 'Date of birth cannot be in the future.'),
  occupation: z.string().optional().default(''),
  nationality: z.string().min(2, 'Enter nationality.'),
  permanent_address: z.string().min(5, 'Enter the permanent address.'),
  present_address: z.string().min(5, 'Enter the present address.'),
  sameAsPermanent: z.boolean(),
  contact_number: z
    .string()
    .min(7, 'Enter a contact number.')
    .refine((v) => PHONE_LOOSE.test(v.trim()), 'Enter a valid phone number.'),
  socmed_platform: z.string().optional().default(''),
  socmed_username: z.string().optional().default(''),
  preferred_contact_mode: z.enum(['phone', 'email', 'messenger', 'instagram']),
  emergency_contact_name: z.string().min(2, 'Enter an emergency contact name.'),
  emergency_contact_relation: z.string().min(2, 'Enter the emergency contact relation.'),
  emergency_contact_number: z
    .string()
    .min(7, 'Enter an emergency contact number.')
    .refine((v) => PHONE_LOOSE.test(v.trim()), 'Enter a valid emergency contact number.'),
});

export type WizardStep3Values = z.infer<typeof wizardStep3Schema>;

export const wizardStep4Schema = z.object({
  information_confirmed: z.boolean().refine((v) => v === true, {
    message: 'Please confirm the information is accurate and complete.',
  }),
  consent_signer_name: z.string().min(2, 'Type your full name to sign.'),
});

export type WizardStep4Values = z.infer<typeof wizardStep4Schema>;

/** Full-payload validation mirroring the backend (source of truth). */
export const personaWizardPayloadSchema = z
  .object({
    persona: z.object({
      relation_to_account_holder: z.enum(['child', 'spouse', 'parent', 'sibling', 'other', 'self']),
      persona_name: z.string().min(2),
      date_of_birth: z.string().min(1),
      occupation: z.string().nullable(),
      nationality: z.string().min(2),
      permanent_address: z.string().min(5),
      present_address: z.string().min(5),
      contact_number: z.string().min(7),
      socmed_platform: z.string().nullable(),
      socmed_username: z.string().nullable(),
      preferred_contact_mode: z.enum(['phone', 'email', 'messenger', 'instagram']),
      emergency_contact_name: z.string().min(2),
      emergency_contact_relation: z.string().min(2),
      emergency_contact_number: z.string().min(7),
    }),
    consent: z.object({
      consent_version: z.string().min(1),
      terms_signer_name: z.string().min(2),
      terms_signer_relation: z.enum(['parent', 'legal guardian', 'spouse', 'other', 'self']),
      scope_acknowledged: z.boolean(),
      is_overseas_or_foreign: z.boolean(),
      overseas_acknowledged: z.boolean(),
      information_confirmed: z.boolean(),
      consent_signer_name: z.string().min(2),
    }),
  })
  .superRefine((val, ctx) => {
    if (val.consent.scope_acknowledged !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scope_acknowledged must be true.', path: ['consent', 'scope_acknowledged'] });
    }
    if (val.consent.information_confirmed !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'information_confirmed must be true.', path: ['consent', 'information_confirmed'] });
    }
    if (val.consent.is_overseas_or_foreign && val.consent.overseas_acknowledged !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'overseas_acknowledged must be true for overseas clients.',
        path: ['consent', 'overseas_acknowledged'],
      });
    }
    const dob = new Date(val.persona.date_of_birth);
    if (Number.isNaN(dob.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date_of_birth.', path: ['persona', 'date_of_birth'] });
    } else {
      if (dob.getTime() > Date.now()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date_of_birth cannot be in the future.', path: ['persona', 'date_of_birth'] });
      } else {
        const now = new Date();
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
        if (age < 18 && val.consent.terms_signer_relation === 'self') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'A minor cannot use signer relation "self".',
            path: ['consent', 'terms_signer_relation'],
          });
        }
      }
    }
    const a = val.consent.terms_signer_name.trim().toLowerCase().replace(/\s+/g, ' ');
    const b = val.consent.consent_signer_name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (a.length > 0 && b.length > 0 && a !== b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'consent_signer_name must match terms_signer_name.',
        path: ['consent', 'consent_signer_name'],
      });
    }
  });

export type PersonaWizardPayloadValues = z.infer<typeof personaWizardPayloadSchema>;
