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
export const proposalFormSchema = z
  .object({
    pricePhp: z
      .number({ message: 'Enter a valid PHP session fee.' })
      .min(500, 'Minimum session fee is ₱500.')
      .max(25000, 'Maximum session fee is ₱25,000.'),
    slot1DateTime: z.string().min(1, 'Slot 1 date and time is required.'),
    slot2DateTime: z.string().min(1, 'Slot 2 date and time is required.'),
    slot3DateTime: z.string().min(1, 'Slot 3 date and time is required.'),
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
