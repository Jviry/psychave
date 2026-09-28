export type CognitoRole = 'client' | 'psychologist' | 'admin';

export type BookingStatus =
  | 'pending'
  | 'proposed'
  | 'paid-confirmed'
  | 'reschedule-requested'
  | 'cancelled';

export interface ServiceItem {
  id: string;
  indexNumber: string;
  title: string;
  categoryGroup: string;
  durationLabel: string;
  durationMinutes: number;
  guardrailTitle: string;
  guardrailNotice: string;
  description: string;
  clinicalFormat: string;
  isStandaloneConsultation?: boolean;
}

export interface Persona {
  id: string;
  clientId: string;
  type: 'self' | 'dependent';
  label: string;
  ageGroup: string;
  relationshipToClient: string;
  preferredLanguage: string;
  createdAt: string;
}

export interface ProposedSlot {
  id: string;
  slotNumber: 1 | 2 | 3;
  isoDateTime: string;
  dateLabel: string;
  timeLabel: string;
}

export interface UnlockedContact {
  teletherapyUrl: string;
  coordinationEmail: string;
  sessionReferenceCode: string;
  emergencyProtocolNote: string;
}

export interface BookingRequest {
  id: string;
  clientId: string;
  personaId: string;
  personaType: 'self' | 'dependent';
  personaLabel: string;
  serviceId: string;
  serviceTitle: string;
  serviceDuration: string;
  serviceGuardrail: string;
  concernsSummary: string;
  specificNeeds: string;
  preferredLanguage: string;
  submittedAt: string;
  status: BookingStatus;
  psychologistId?: string;
  psychologistCode?: string;
  psychologistSpecialization?: string;
  pricePhp?: number;
  proposedSlots: ProposedSlot[];
  clinicalPrepNote?: string;
  selectedSlotId?: string;
  paidAt?: string;
  contactUnlocked: boolean;
  unlockedContact?: UnlockedContact;
  reminders: {
    reminder24h: 'pending' | 'scheduled' | 'dispatched';
    reminder1h: 'pending' | 'scheduled' | 'dispatched';
  };
  /**
   * Strictly accessible ONLY to the assigned Psychologist.
   * Redacted in Admin and Client payloads.
   */
  privateClinicalNote?: string;
}

export interface ResidentPsychologist {
  id: string;
  anonymizedTitle: string;
  prcCredentialCode: string;
  specialization: string;
  serviceEligibility: string[];
  languages: string[];
  yearsPractice: string;
  verificationStatus: 'verified' | 'waiting_approval';
  visibleOnPublicRoster: boolean;
  assignedBookingsCount: number;
  bio?: string;
}

export interface TestimonialSlot {
  id: string;
  slotCode: string;
  serviceCategory: string;
  consentFlagStatus: 'withheld_by_default' | 'anonymized_structure_only';
  governanceNote: string;
}

export interface CmsContent {
  vision: string;
  mission: string;
  clinicOverview: string;
  impactNarrative: string;
  impactMetrics: {
    id: string;
    metricValue: string;
    metricLabel: string;
    timeframeContext: string;
  }[];
  testimonialsConfig: {
    sectionTitle: string;
    consentFlagBanner: string;
    ethicalStandardRef: string;
    emptyCards: TestimonialSlot[];
  };
}
