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
  rateLabel?: string | null;
  guardrailTitle: string;
  guardrailNotice: string;
  description: string;
  clinicalFormat: string;
  isActive?: boolean;
  isStandaloneConsultation?: boolean;
}

export interface Profile {
  id: string;
  clientId: string;
  type: 'self' | 'dependent';
  label: string;
  ageGroup: string;
  relationshipToClient: string;
  preferredLanguage: string;
  createdAt: string;
  dateOfBirth?: string;
  occupation?: string | null;
  nationality?: string;
  permanentAddress?: string;
  presentAddress?: string;
  contactNumber?: string;
  socmedPlatform?: string | null;
  socmedUsername?: string | null;
  preferredContactMode?: 'phone' | 'email' | 'messenger' | 'instagram';
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactNumber?: string;
  details?: Record<string, unknown>;
  signedConsentVersion?: string | null;
  activeConsentVersion?: string;
  consentOutdated?: boolean;
}

export interface ReviewField {
  fieldKey: string;
  label: string;
  type: string;
  value: unknown;
}

export interface ReviewSection {
  pageId: string;
  title: string;
  fields: ReviewField[];
}

export interface ProfileReview {
  profile: {
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
    details?: Record<string, unknown>;
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
    responses?: Record<string, unknown>;
  };
  reviewSections?: ReviewSection[];
}

export type WizardBlockType =
  | 'scrollable_doc'
  | 'info_text'
  | 'section_heading'
  | 'services_list'
  | 'review_summary'
  | 'text'
  | 'textarea'
  | 'date'
  | 'phone'
  | 'select'
  | 'checkbox';

export type WizardFieldTarget = 'profile' | 'consent' | 'ui' | 'custom';

export type WizardAppliesTo = 'all' | 'self' | 'dependent';

export interface WizardSelectOption {
  value: string;
  label: string;
}

export interface WizardShowIf {
  fieldKey: string;
  equals: string | boolean;
}

export interface WizardBlock {
  blockId: string;
  type: WizardBlockType;
  label: string;
  content?: string | null;
  helperText?: string | null;
  placeholder?: string | null;
  target?: WizardFieldTarget | null;
  fieldKey?: string | null;
  appliesTo: WizardAppliesTo;
  required: boolean;
  options: WizardSelectOption[];
  showIf?: WizardShowIf | null;
  systemLocked: boolean;
}

export interface WizardPage {
  pageId: string;
  title: string;
  description?: string | null;
  blocks: WizardBlock[];
}

export interface ConsentFormTemplate {
  templateId: string;
  consentVersion: string;
  informedConsentText: string;
  typingStatement: string;
  scopeLimitationsText: string;
  scopeAckText: string;
  overseasLimitationsText: string;
  overseasAckText: string;
  finalConsentStatement: string;
  wizardPages: WizardPage[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  profileId: string;
  profileType: 'self' | 'dependent';
  profileLabel: string;
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
  meetingLink?: string;
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

export interface PsychologistInvitation {
  invitationId: string;
  email: string;
  invitationUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface TestimonialSlot {
  id: string;
  slotCode: string;
  serviceCategory: string;
  consentFlagStatus: 'withheld_by_default' | 'anonymized_structure_only';
  governanceNote: string;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  authorLabel: string;
  serviceCategory: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface CmsContent {
  vision: string;
  mission: string;
  clinicOverview: string;
  impactNarrative: string;
  updatedAt?: string;
  testimonials: TestimonialItem[];
  impactMetrics?: {
    id: string;
    metricValue: string;
    metricLabel: string;
    timeframeContext: string;
  }[];
  testimonialsConfig?: {
    sectionTitle: string;
    consentFlagBanner: string;
    ethicalStandardRef: string;
    emptyCards: TestimonialSlot[];
  };
}
