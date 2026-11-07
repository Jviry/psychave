export type CognitoRole = 'client' | 'psychologist' | 'admin';

export type BookingStatus =
  | 'pending'
  | 'awaiting-review'
  | 'awaiting-client'
  | 'awaiting-payment'
  | 'paid-confirmed'
  | 'completed'
  | 'reschedule-requested'
  | 'cancelled';

export type SchedulingTurn = 'client' | 'psychologist';
export type SlotProposer = 'client' | 'psychologist';
export type SlotStatus = 'proposed' | 'accepted' | 'declined' | 'expired';

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

export interface PersonaReview {
  persona: {
    id: string;
    name: string;
    relationToAccountHolder: string;
    dateOfBirth: string;
    occupation: string | null;
    nationality: string;
    permanentAddress: string;
    presentAddress: string;
    contactNumber: string;
    socmedPlatform: string | null;
    socmedUsername: string | null;
    preferredContactMode: string;
    emergencyContactName: string;
    emergencyContactRelation: string;
    emergencyContactNumber: string;
  };
  consent: {
    version: string;
    termsSignerName: string;
    termsSignerRelation: string;
    scopeAcknowledged: boolean;
    isOverseasOrForeign: boolean;
    overseasAcknowledged: boolean;
    informationConfirmed: boolean;
    consentSignerName: string;
    signedAt: string | null;
  };
}

export interface SocialMediaLink {
  platform: string;
  url: string;
}

export interface ProposedSlot {
  id: string;
  slotNumber: number;
  isoDateTime: string;
  endIsoDateTime?: string;
  dateLabel: string;
  timeLabel: string;
  proposedBy: SlotProposer;
  status: SlotStatus;
  round: number;
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
  serviceDurationMinutes: number;
  serviceGuardrail: string;
  concernsSummary: string;
  submittedAt: string;
  status: BookingStatus;
  psychologistId?: string;
  psychologistCode?: string;
  psychologistSpecialization?: string;
  pricePhp?: number;
  proposedSlots: ProposedSlot[];
  schedulingTurn?: SchedulingTurn;
  schedulingRound: number;
  paymentDeadline?: string;
  conflictingSlotIds?: string[];
  selectedSlotId?: string;
  paidAt?: string;
  contactUnlocked: boolean;
  psychologistSocialLinks?: SocialMediaLink[];
  clientSocialMedia?: {
    platform: string;
    username: string;
  };
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
  visibleOnPublicRoster: boolean;
  socialMediaLinks: SocialMediaLink[];
  bio?: string;
}

export interface AdminUser {
  userId: string;
  email: string;
  role: CognitoRole;
  fullName: string | null;
  createdAt: string;
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
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
