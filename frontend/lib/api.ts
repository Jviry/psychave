import {
  BookingRequest,
  CmsContent,
  CognitoRole,
  Persona,
  ResidentPsychologist,
  ServiceItem,
} from './types';

/**
 * Single canonical API client for PsychAvenuePH (PSYCHAVE PH).
 * Targets NEXT_PUBLIC_API_URL (default http://localhost:8000) and automatically falls back
 * to deterministic in-memory mock state when the FastAPI/Mangum backend is offline.
 */
const getEnvVar = (key: string, fallback: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return fallback;
};

export const API_BASE_URL = getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:8000');
export const AUTH_MODE = getEnvVar('NEXT_PUBLIC_AUTH_MODE', 'mock');

const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv-consultation',
    indexNumber: '01',
    title: 'Standalone Clinical Consultation',
    categoryGroup: 'Initial Assessment & Triage',
    durationLabel: '45 mins',
    durationMinutes: 45,
    guardrailTitle: 'Screening-Only · Not Full Therapy',
    guardrailNotice:
      'Consultation (45 min) is strictly for initial clinical screening, intake clarification, and care navigation. It does not constitute a full psychotherapy session.',
    description:
      'Structured initial consultation to clarify presenting concerns, evaluate clinical urgency, and match the client or dependent with the appropriate therapeutic modality.',
    clinicalFormat: '1-on-1 Intake Screening (Telehealth)',
    isStandaloneConsultation: true,
  },
  {
    id: 'srv-individual',
    indexNumber: '02',
    title: 'Individual Counseling & Psychotherapy',
    categoryGroup: 'Core Clinical Practice',
    durationLabel: '1 hr (60 mins)',
    durationMinutes: 60,
    guardrailTitle: 'Standard 1-Hour Evidence-Based Psychotherapy',
    guardrailNotice:
      'Individual sessions run for 1 hour (60 minutes) with a PRC-licensed resident psychologist. Not for acute emergency psychiatric crisis stabilization.',
    description:
      'Confidential one-on-one psychotherapy addressing anxiety, mood concerns, trauma recovery, life transitions, and emotional regulation through evidence-based modalities.',
    clinicalFormat: '1-on-1 Clinical Session (60 mins)',
  },
  {
    id: 'srv-couples',
    indexNumber: '03',
    title: 'Couples Counseling',
    categoryGroup: 'Relational & Systems Practice',
    durationLabel: '1.5 hrs (90 mins)',
    durationMinutes: 90,
    guardrailTitle: '1.5 Hours Total · Includes 15-Min Individual Breakouts',
    guardrailNotice:
      'Couples sessions are structured across 90 minutes and explicitly incorporate two 15-minute individual breakout check-ins (one per partner) alongside joint relational work.',
    description:
      'Structured relational therapy for partners navigating communication ruptures, trust reconstruction, life-stage transitions, and collaborative conflict resolution.',
    clinicalFormat: '60m Joint + Two 15m Individual Breakouts',
  },
  {
    id: 'srv-family-group',
    indexNumber: '04',
    title: 'Family & Group Counseling',
    categoryGroup: 'Relational & Systems Practice',
    durationLabel: '2 hrs (120 mins)',
    durationMinutes: 120,
    guardrailTitle: '2 Hours Total · Psychologist Clinical Autonomy on Structure',
    guardrailNotice:
      'Family and Group sessions run for 2 hours (120 minutes). Plenary vs. sub-group pacing and interval structure are governed under full psychologist clinical autonomy.',
    description:
      'Multi-participant systemic counseling for family units or therapeutic process groups, paced dynamically by the assigned verified psychologist.',
    clinicalFormat: 'Multi-Participant Session (Psychologist-Paced)',
  },
  {
    id: 'srv-coaching',
    indexNumber: '05',
    title: 'Life Coaching',
    categoryGroup: 'Personal & Executive Development',
    durationLabel: '1 hr (60 mins)',
    durationMinutes: 60,
    guardrailTitle: 'Non-Clinical · Explicitly Not Psychotherapy',
    guardrailNotice:
      'Life Coaching is strictly future-focused and goal-oriented. It is NOT psychotherapy, does not diagnose or treat mental health disorders, and is not a substitute for clinical care.',
    description:
      'Action-oriented coaching for career transitions, executive habits, academic accountability, and personal milestone execution.',
    clinicalFormat: '1-on-1 Goal & Habit Architecture (60 mins)',
  },
  {
    id: 'srv-supervision',
    indexNumber: '06',
    title: 'Clinical Supervision for Early Career Psychologists',
    categoryGroup: 'Professional & Peer Development',
    durationLabel: '1 hr (60 mins)',
    durationMinutes: 60,
    guardrailTitle: 'Open to Internal Residents + External Early-Career Psychologists',
    guardrailNotice:
      'Clinical Supervision supports both internal PsychAvenuePH residents and external early-career psychologists. All discussed case material must be strictly de-identified.',
    description:
      'Reflective clinical case conceptualization, ethical boundary navigation, and modality skill-building led by senior supervising psychologists.',
    clinicalFormat: 'Internal & External Practitioner Supervision',
  },
  {
    id: 'srv-academic',
    indexNumber: '07',
    title: 'Academic & Research Services',
    categoryGroup: 'Research & Psychometrics',
    durationLabel: '1 hr Consultation / Scoped Advisory',
    durationMinutes: 60,
    guardrailTitle: 'Thesis Supervision & Data Analysis Only · NO Full-Write',
    guardrailNotice:
      'Strictly limited to thesis/dissertation methodology supervision, psychometric validation, and statistical data analysis. Ghostwriting or full-write authoring is strictly prohibited.',
    description:
      'Methodological mentorship, research design review, and quantitative/qualitative data analysis guidance for psychology and social science researchers.',
    clinicalFormat: 'Supervision & Statistical Advisory (No Ghostwriting)',
  },
];

const INITIAL_PERSONAS: Persona[] = [
  {
    id: 'persona-self-01',
    clientId: 'client-01',
    type: 'self',
    label: 'Primary Account Holder (Self)',
    ageGroup: 'Adult (25–34)',
    relationshipToClient: 'Self',
    preferredLanguage: 'English / Taglish',
    createdAt: '2026-08-14',
  },
  {
    id: 'persona-dep-02',
    clientId: 'client-01',
    type: 'dependent',
    label: 'Dependent Ward #D-01 (Adolescent)',
    ageGroup: 'Adolescent (13–17)',
    relationshipToClient: 'Legal Guardian / Parent',
    preferredLanguage: 'Filipino / Taglish',
    createdAt: '2026-09-02',
  },
];

const INITIAL_ROSTER: ResidentPsychologist[] = [
  {
    id: 'RP-01',
    anonymizedTitle: 'Resident Psychologist #RP-01',
    prcCredentialCode: 'PRC-PSY-Verified-8841',
    specialization: 'Adult Psychotherapy, Anxiety Disorders & Trauma-Informed CBT',
    serviceEligibility: [
      'Standalone Clinical Consultation',
      'Individual Counseling & Psychotherapy',
      'Clinical Supervision for Early Career Psychologists',
    ],
    languages: ['English', 'Filipino / Taglish'],
    yearsPractice: '8+ Years Clinical Practice',
    verificationStatus: 'verified',
    visibleOnPublicRoster: true,
    assignedBookingsCount: 2,
    bio: 'Licensed clinical psychologist specializing in cognitive behavioral therapy, anxiety disorders, and trauma-informed care for adults. Committed to culturally sensitive and evidence-based mental healthcare.',
  },
  {
    id: 'RP-02',
    anonymizedTitle: 'Resident Psychologist #RP-02',
    prcCredentialCode: 'PRC-PSY-Verified-9104',
    specialization: 'Couples Systems, Family Dynamics & Relational Restructuring',
    serviceEligibility: [
      'Standalone Clinical Consultation',
      'Couples Counseling',
      'Family & Group Counseling',
    ],
    languages: ['English', 'Filipino / Taglish', 'Cebuano'],
    yearsPractice: '10+ Years Clinical Practice',
    verificationStatus: 'verified',
    visibleOnPublicRoster: true,
    assignedBookingsCount: 1,
    bio: 'Dedicated relational therapist trained in systemic and Emotion-Focused Therapy for couples and families navigating transitional stress, communication breakdowns, and attachment repair.',
  },
  {
    id: 'RP-03',
    anonymizedTitle: 'Resident Specialist #RP-03',
    prcCredentialCode: 'PRC-PSY-Verified-7732',
    specialization: 'Psychometric Research Supervision, Statistical Modeling & Life Coaching',
    serviceEligibility: [
      'Life Coaching',
      'Academic & Research Services',
      'Standalone Clinical Consultation',
    ],
    languages: ['English', 'Filipino'],
    yearsPractice: '6+ Years Academic & Applied Practice',
    verificationStatus: 'verified',
    visibleOnPublicRoster: true,
    assignedBookingsCount: 0,
    bio: 'Academic researcher and certified behavioral coach specializing in psychological test construction, quantitative statistical methodology, and executive performance coaching.',
  },
  {
    id: 'RP-04',
    anonymizedTitle: 'Associate Psychologist #RP-04',
    prcCredentialCode: 'PRC-PSY-Pending-9921',
    specialization: 'Adolescent Counseling & Emotional Regulation',
    serviceEligibility: [
      'Standalone Clinical Consultation',
      'Individual Counseling & Psychotherapy',
    ],
    languages: ['English', 'Filipino / Taglish'],
    yearsPractice: '3 Years Clinical Practice',
    verificationStatus: 'waiting_approval',
    visibleOnPublicRoster: false,
    assignedBookingsCount: 0,
    bio: 'Associate practitioner focusing on child and adolescent emotional regulation, academic adjustment, and parent-child communication dynamics. Awaiting administrative credential verification.',
  },
];

const INITIAL_BOOKINGS: BookingRequest[] = [
  {
    id: 'BK-2026-101',
    clientId: 'client-01',
    personaId: 'persona-dep-02',
    personaType: 'dependent',
    personaLabel: 'Dependent Ward #D-01 (Adolescent)',
    serviceId: 'srv-consultation',
    serviceTitle: 'Standalone Clinical Consultation',
    serviceDuration: '45 mins',
    serviceGuardrail: 'Screening-only, not full therapy.',
    concernsSummary:
      'Seeking initial 45-minute screening for adolescent dependent experiencing academic transition stress and sleep schedule disruption after moving schools.',
    specificNeeds:
      'Prefer late afternoon weekday or Saturday morning slots; guardian will attend first 10 minutes for consent orientation.',
    preferredLanguage: 'Filipino / Taglish',
    submittedAt: '2026-09-26 14:20 PST',
    status: 'pending',
    proposedSlots: [],
    contactUnlocked: false,
    reminders: {
      reminder24h: 'pending',
      reminder1h: 'pending',
    },
  },
  {
    id: 'BK-2026-102',
    clientId: 'client-01',
    personaId: 'persona-self-01',
    personaType: 'self',
    personaLabel: 'Primary Account Holder (Self)',
    serviceId: 'srv-couples',
    serviceTitle: 'Couples Counseling',
    serviceDuration: '1.5 hrs (90 mins)',
    serviceGuardrail: '1.5 hr session with two 15-min individual breakouts.',
    concernsSummary:
      'Looking for structured relational communication support around work-life boundaries and shared financial planning.',
    specificNeeds:
      'Both partners will join from separate devices to facilitate the 15-minute individual breakout rooms.',
    preferredLanguage: 'English / Taglish',
    submittedAt: '2026-09-25 09:45 PST',
    status: 'proposed',
    psychologistId: 'RP-01',
    psychologistCode: 'Resident Psychologist #RP-01',
    psychologistSpecialization: 'Adult Psychotherapy, Anxiety Disorders & Trauma-Informed CBT',
    pricePhp: 3200,
    clinicalPrepNote:
      'We will begin with a 30-minute joint intake, followed by two 15-minute individual breakout check-ins, and reconvene for 30 minutes of goal alignment.',
    proposedSlots: [
      {
        id: 'slot-102-a',
        slotNumber: 1,
        isoDateTime: '2026-10-02T10:00',
        dateLabel: 'Fri, Oct 2, 2026',
        timeLabel: '10:00 AM – 11:30 AM PST',
      },
      {
        id: 'slot-102-b',
        slotNumber: 2,
        isoDateTime: '2026-10-03T14:00',
        dateLabel: 'Sat, Oct 3, 2026',
        timeLabel: '2:00 PM – 3:30 PM PST',
      },
      {
        id: 'slot-102-c',
        slotNumber: 3,
        isoDateTime: '2026-10-05T18:00',
        dateLabel: 'Mon, Oct 5, 2026',
        timeLabel: '6:00 PM – 7:30 PM PST',
      },
    ],
    contactUnlocked: false,
    reminders: {
      reminder24h: 'pending',
      reminder1h: 'pending',
    },
    privateClinicalNote:
      'CONFIDENTIAL PSYCHOLOGIST NOTE: Prepare Gottman-informed relational intake protocol and separate breakout room links prior to session start.',
  },
  {
    id: 'BK-2026-103',
    clientId: 'client-01',
    personaId: 'persona-self-01',
    personaType: 'self',
    personaLabel: 'Primary Account Holder (Self)',
    serviceId: 'srv-individual',
    serviceTitle: 'Individual Counseling & Psychotherapy',
    serviceDuration: '1 hr (60 mins)',
    serviceGuardrail: 'Standard 1-hour evidence-based psychotherapy.',
    concernsSummary:
      'Ongoing occupational burnout, cognitive fatigue, and difficulty detaching from high-pressure engineering deadlines.',
    specificNeeds: 'Quiet evening slot preferred; open to structured CBT homework between sessions.',
    preferredLanguage: 'English',
    submittedAt: '2026-09-20 11:10 PST',
    status: 'paid-confirmed',
    psychologistId: 'RP-01',
    psychologistCode: 'Resident Psychologist #RP-01',
    psychologistSpecialization: 'Adult Psychotherapy, Anxiety Disorders & Trauma-Informed CBT',
    pricePhp: 2200,
    clinicalPrepNote:
      'Please complete the digital informed consent signature 15 minutes before our scheduled hour.',
    proposedSlots: [
      {
        id: 'slot-103-a',
        slotNumber: 1,
        isoDateTime: '2026-09-29T17:00',
        dateLabel: 'Tue, Sep 29, 2026',
        timeLabel: '5:00 PM – 6:00 PM PST',
      },
      {
        id: 'slot-103-b',
        slotNumber: 2,
        isoDateTime: '2026-09-30T17:00',
        dateLabel: 'Wed, Sep 30, 2026',
        timeLabel: '5:00 PM – 6:00 PM PST',
      },
      {
        id: 'slot-103-c',
        slotNumber: 3,
        isoDateTime: '2026-10-01T19:00',
        dateLabel: 'Thu, Oct 1, 2026',
        timeLabel: '7:00 PM – 8:00 PM PST',
      },
    ],
    selectedSlotId: 'slot-103-b',
    paidAt: '2026-09-22 16:04 PST',
    contactUnlocked: true,
    unlockedContact: {
      teletherapyUrl: 'https://session.psychaveph.clinical/room/BK-2026-103-RP01',
      coordinationEmail: 'psychaveph.info@gmail.com',
      sessionReferenceCode: 'CONF-RP01-103B',
      emergencyProtocolNote:
        'Direct session channel unlocked post-payment. Automated 24h and 1h reminders are active.',
    },
    reminders: {
      reminder24h: 'scheduled',
      reminder1h: 'scheduled',
    },
    privateClinicalNote:
      'CONFIDENTIAL PSYCHOLOGIST NOTE: Session #1 focus on occupational boundary inventory and somatic grounding exercises. Hidden from Admin tier.',
  },
];

const INITIAL_CMS: CmsContent = {
  vision:
    'Placeholder — Vision Statement: To establish a trusted, ethically governed Philippine mental-health ecosystem where every client and family accesses credential-verified psychological care with full clinical transparency.',
  mission:
    'Placeholder — Mission Statement: We bridge individuals, couples, families, and early-career practitioners with PRC-verified psychologists through structured clinical intake, clear therapeutic guardrails, and privacy-first care navigation.',
  clinicOverview:
    'Placeholder — Clinic Overview: PsychAvenuePH (PSYCHAVE PH) operates a structured, multi-disciplinary psychological practice delivering consultation, psychotherapy, relational systems counseling, non-clinical coaching, clinical supervision, and ethical research advisory.',
  impactNarrative:
    'Placeholder — Impact Framework: All clinical outcomes and community access metrics are tracked in aggregate without exposing identifiable client records or session transcripts.',
  impactMetrics: [
    {
      id: 'imp-1',
      metricValue: '100%',
      metricLabel: 'PRC-Verified Clinical Roster',
      timeframeContext: 'Mandatory credential check prior to queue pick-up access',
    },
    {
      id: 'imp-2',
      metricValue: '3-Slot',
      metricLabel: 'Canonical Flow C Proposal Standard',
      timeframeContext: 'Every picked-up intake receives 3 curated schedule options',
    },
    {
      id: 'imp-3',
      metricValue: '24h & 1h',
      metricLabel: 'Automated Session Reminders',
      timeframeContext: 'Dispatched automatically after payment confirmation',
    },
  ],
  testimonialsConfig: {
    sectionTitle: 'Client Reflections & Consent Governance',
    consentFlagBanner:
      'Consent-Flag Governance Active — No personal quotes, client names, or identifiable narratives are displayed. Empty placeholder cards reflect strict adherence to clinical confidentiality and Philippine Data Privacy Act (RA 10173) standards.',
    ethicalStandardRef: 'PAP Code of Ethics · RA 10173 Privacy Baseline',
    emptyCards: [
      {
        id: 't-slot-01',
        slotCode: 'CONSENT-SLOT-01',
        serviceCategory: 'Individual Counseling & Psychotherapy (1 hr)',
        consentFlagStatus: 'withheld_by_default',
        governanceNote:
          'Personal quote intentionally omitted. Client feedback is stored solely for internal clinical quality assurance.',
      },
      {
        id: 't-slot-02',
        slotCode: 'CONSENT-SLOT-02',
        serviceCategory: 'Couples Counseling (1.5 hr w/ 15-min Breakouts)',
        consentFlagStatus: 'withheld_by_default',
        governanceNote:
          'Personal quote intentionally omitted. Relational session feedback remains strictly confidential.',
      },
      {
        id: 't-slot-03',
        slotCode: 'CONSENT-SLOT-03',
        serviceCategory: 'Clinical Supervision & Academic Advisory',
        consentFlagStatus: 'anonymized_structure_only',
        governanceNote:
          'Personal quote intentionally omitted. Supervision and thesis advisory records exclude personal attribution.',
      },
    ],
  },
};

// In-memory store for prototype persistence across route changes
let mockServices: ServiceItem[] = [...INITIAL_SERVICES];
let mockPersonas: Persona[] = [...INITIAL_PERSONAS];
let mockRoster: ResidentPsychologist[] = [...INITIAL_ROSTER];
let mockBookings: BookingRequest[] = [...INITIAL_BOOKINGS];
let mockCms: CmsContent = JSON.parse(JSON.stringify(INITIAL_CMS));

/**
 * Helper to attempt real backend fetch against NEXT_PUBLIC_API_URL first
 * (with short timeout so offline preview responds instantaneously with mock fallback).
 */
async function requestWithMockFallback<T>(
  endpoint: string,
  options: RequestInit | undefined,
  mockResolver: () => T | Promise<T>
): Promise<T> {
  // When in mock mode or when backend is unreachable, fall back cleanly
  if (AUTH_MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 120));
    return mockResolver();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch {
    clearTimeout(timer);
    return mockResolver();
  }
}

function formatSlotDateAndTime(isoString: string, durationMinutes = 60): { dateLabel: string; timeLabel: string } {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return {
      dateLabel: isoString.split('T')[0] || 'Scheduled Date',
      timeLabel: isoString.split('T')[1] || 'Scheduled Time',
    };
  }
  const end = new Date(parsed.getTime() + durationMinutes * 60_000);
  const dateLabel = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startLabel = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endLabel = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return {
    dateLabel,
    timeLabel: `${startLabel} – ${endLabel} PST`,
  };
}

export const api = {
  getConfigInfo: () => ({
    apiUrl: API_BASE_URL,
    authMode: AUTH_MODE,
    flowVersion: 'Flow C Canonical',
  }),

  /**
   * Services API
   */
  getServices: async (): Promise<ServiceItem[]> =>
    requestWithMockFallback('/api/v1/services', undefined, () => [...mockServices]),

  updateServiceGuardrail: async (
    serviceId: string,
    payload: { durationLabel: string; guardrailTitle: string; guardrailNotice: string; description: string }
  ): Promise<ServiceItem[]> =>
    requestWithMockFallback(
      `/api/v1/services/${serviceId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      () => {
        mockServices = mockServices.map((s) =>
          s.id === serviceId ? { ...s, ...payload } : s
        );
        return [...mockServices];
      }
    ),

  /**
   * Resident Roster & Admin Credential Verification API
   */
  getRoster: async (includeHiddenForAdmin = false): Promise<ResidentPsychologist[]> =>
    requestWithMockFallback('/api/v1/roster', undefined, () =>
      includeHiddenForAdmin
        ? [...mockRoster]
        : mockRoster.filter((r) => r.verificationStatus === 'verified' && r.visibleOnPublicRoster)
    ),

  updatePsychologistVerification: async (
    psychId: string,
    updates: Partial<Pick<ResidentPsychologist, 'verificationStatus' | 'visibleOnPublicRoster'>>
  ): Promise<ResidentPsychologist[]> =>
    requestWithMockFallback(
      `/api/v1/admin/verifications/${psychId}`,
      { method: 'PATCH', body: JSON.stringify(updates) },
      () => {
        mockRoster = mockRoster.map((r) => (r.id === psychId ? { ...r, ...updates } : r));
        return [...mockRoster];
      }
    ),

  updatePsychologistProfile: async (
    psychId: string,
    updates: Partial<Pick<ResidentPsychologist, 'specialization' | 'prcCredentialCode' | 'bio' | 'languages' | 'yearsPractice'>>
  ): Promise<ResidentPsychologist> =>
    requestWithMockFallback(
      `/api/v1/psychologists/${psychId}/profile`,
      { method: 'PATCH', body: JSON.stringify(updates) },
      () => {
        const idx = mockRoster.findIndex((r) => r.id === psychId);
        if (idx === -1) throw new Error('Psychologist profile not found.');
        mockRoster[idx] = { ...mockRoster[idx], ...updates };
        return { ...mockRoster[idx] };
      }
    ),

  /**
   * Client Personas API
   */
  getPersonas: async (): Promise<Persona[]> =>
    requestWithMockFallback('/api/v1/personas', undefined, () => [...mockPersonas]),

  createPersona: async (input: Partial<Omit<Persona, 'id' | 'clientId' | 'createdAt'>>): Promise<Persona> =>
    requestWithMockFallback(
      '/api/v1/personas',
      { method: 'POST', body: JSON.stringify(input) },
      () => {
        const created: Persona = {
          type: input.type ?? 'dependent',
          label: input.label ?? 'Dependent Ward (Unlabeled)',
          ageGroup: input.ageGroup ?? 'Adult (25–34)',
          relationshipToClient: input.relationshipToClient ?? 'Self',
          preferredLanguage: input.preferredLanguage ?? 'English / Taglish',
          id: `persona-${input.type}-${Date.now().toString().slice(-4)}`,
          clientId: 'client-01',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        mockPersonas = [...mockPersonas, created];
        return created;
      }
    ),

  /**
   * Flow C Bookings API with Tiered Role Filtering:
   * - Client: sees only their own client-01 bookings (without private clinical notes)
   * - Psychologist:
   *    - queue: sees all 'pending' bookings
   *    - schedule: sees ONLY bookings booked/picked-up under their psychologistId
   * - Admin: sees preliminary booking metadata ONLY; privateClinicalNote is strictly redacted.
   */
  getBookingsForRole: async (
    role: CognitoRole,
    psychologistId = 'RP-01'
  ): Promise<BookingRequest[]> =>
    requestWithMockFallback(
      `/api/v1/bookings?role=${role}&psychId=${psychologistId}`,
      undefined,
      () => {
        if (role === 'client') {
          return mockBookings
            .filter((b) => b.clientId === 'client-01')
            .map(({ privateClinicalNote: _redacted, ...rest }) => rest);
        }
        if (role === 'psychologist') {
          return mockBookings.filter(
            (b) => b.status === 'pending' || b.psychologistId === psychologistId
          );
        }
        // Admin tier: strictly strip privateClinicalNote
        return mockBookings.map(({ privateClinicalNote: _redacted, ...rest }) => rest);
      }
    ),

  getBookingById: async (bookingId: string, role: CognitoRole = 'client'): Promise<BookingRequest | null> =>
    requestWithMockFallback(`/api/v1/bookings/${bookingId}`, undefined, () => {
      const found = mockBookings.find((b) => b.id === bookingId);
      if (!found) return null;
      if (role !== 'psychologist') {
        const { privateClinicalNote: _redacted, ...safeBooking } = found;
        return safeBooking;
      }
      return { ...found };
    }),

  /**
   * Flow C Step 1: Client submits Persona + Intake Form -> enters 'pending' queue
   */
  submitIntakeRequest: async (input: {
    personaId: string;
    serviceId: string;
    preferredLanguage: string;
    concernsSummary: string;
    specificNeeds: string;
  }): Promise<BookingRequest> =>
    requestWithMockFallback(
      '/api/v1/bookings/intake',
      { method: 'POST', body: JSON.stringify(input) },
      () => {
        const persona =
          mockPersonas.find((p) => p.id === input.personaId) || mockPersonas[0];
        const service =
          mockServices.find((s) => s.id === input.serviceId) || mockServices[0];

        const newBooking: BookingRequest = {
          id: `BK-2026-${Math.floor(104 + Math.random() * 890)}`,
          clientId: 'client-01',
          personaId: persona.id,
          personaType: persona.type,
          personaLabel: persona.label,
          serviceId: service.id,
          serviceTitle: service.title,
          serviceDuration: service.durationLabel,
          serviceGuardrail: service.guardrailNotice,
          concernsSummary: input.concernsSummary,
          specificNeeds: input.specificNeeds,
          preferredLanguage: input.preferredLanguage,
          submittedAt: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'pending',
          proposedSlots: [],
          contactUnlocked: false,
          reminders: {
            reminder24h: 'pending',
            reminder1h: 'pending',
          },
        };

        mockBookings = [newBooking, ...mockBookings];
        return newBooking;
      }
    ),

  /**
   * Flow C Step 3: Verified Psychologist picks up pending request + sets price + proposes 3 slots
   */
  pickUpAndProposeSlots: async (input: {
    bookingId: string;
    psychologistId: string;
    pricePhp: number;
    slot1DateTime: string;
    slot2DateTime: string;
    slot3DateTime: string;
    clinicalPrepNote: string;
  }): Promise<BookingRequest> => {
    // If backend is active and using /appointments REST routes, execute dual pickup + slots endpoints
    if (AUTH_MODE !== 'mock') {
      try {
        const pickupRes = await fetch(`${API_BASE_URL}/appointments/${input.bookingId}/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            psychologistId: input.psychologistId,
            pricePhp: input.pricePhp,
          }),
        });
        if (pickupRes.ok) {
          const slotsRes = await fetch(`${API_BASE_URL}/appointments/${input.bookingId}/slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slots: [
                { slotNumber: 1, dateTime: input.slot1DateTime },
                { slotNumber: 2, dateTime: input.slot2DateTime },
                { slotNumber: 3, dateTime: input.slot3DateTime },
              ],
              clinicalPrepNote: input.clinicalPrepNote,
            }),
          });
          if (slotsRes.ok) {
            return (await slotsRes.json()) as BookingRequest;
          }
        } else if (pickupRes.status === 409 || pickupRes.status === 400) {
          const errData = await pickupRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              `Request already claimed: Booking ${input.bookingId} has already been claimed by another psychologist.`
          );
        } else if (pickupRes.status === 403) {
          throw new Error(
            'Credential Guardrail: Unverified psychologists cannot pick up intake requests or propose slots.'
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('already claimed') || err.message.includes('Credential Guardrail'))) {
          throw err;
        }
        // If /appointments endpoints aren't implemented, fall through to /api/v1/bookings propose
      }
    }

    return requestWithMockFallback(
      `/api/v1/bookings/${input.bookingId}/propose`,
      { method: 'POST', body: JSON.stringify(input) },
      () => {
        const psych = mockRoster.find((r) => r.id === input.psychologistId);
        if (!psych || psych.verificationStatus !== 'verified') {
          throw new Error(
            'Credential Guardrail: Unverified psychologists cannot pick up intake requests or propose slots.'
          );
        }

        const target = mockBookings.find((b) => b.id === input.bookingId);
        if (!target) {
          throw new Error('Booking request not found.');
        }

        if (target.status !== 'pending') {
          throw new Error(
            `Request already claimed: Booking ${input.bookingId} has already been claimed by another psychologist (current status: ${target.status}). Please refresh your queue.`
          );
        }

        const serviceObj = mockServices.find((s) => s.id === target.serviceId);
        const durationMins = serviceObj?.durationMinutes || 60;

        const s1 = formatSlotDateAndTime(input.slot1DateTime, durationMins);
        const s2 = formatSlotDateAndTime(input.slot2DateTime, durationMins);
        const s3 = formatSlotDateAndTime(input.slot3DateTime, durationMins);

        const updated: BookingRequest = {
          ...target,
          status: 'proposed',
          psychologistId: psych.id,
          psychologistCode: psych.anonymizedTitle,
          psychologistSpecialization: psych.specialization,
          pricePhp: input.pricePhp,
          clinicalPrepNote: input.clinicalPrepNote,
          proposedSlots: [
            {
              id: `slot-${target.id}-1`,
              slotNumber: 1,
              isoDateTime: input.slot1DateTime,
              dateLabel: s1.dateLabel,
              timeLabel: s1.timeLabel,
            },
            {
              id: `slot-${target.id}-2`,
              slotNumber: 2,
              isoDateTime: input.slot2DateTime,
              dateLabel: s2.dateLabel,
              timeLabel: s2.timeLabel,
            },
            {
              id: `slot-${target.id}-3`,
              slotNumber: 3,
              isoDateTime: input.slot3DateTime,
              dateLabel: s3.dateLabel,
              timeLabel: s3.timeLabel,
            },
          ],
          privateClinicalNote: `CONFIDENTIAL PSYCHOLOGIST NOTE (${psych.anonymizedTitle}): Intake reviewed and 3 slots proposed. Hidden from Admin tier.`,
        };

        mockBookings = mockBookings.map((b) => (b.id === input.bookingId ? updated : b));
        return updated;
      }
    );
  },

  /**
   * Flow C Step 4: Client selects 1 of 3 slots and completes payment.
   * Finalized ONLY on payment success -> unlocks contact + schedules 24h/1h reminders.
   */
  confirmSlotAndPay: async (input: {
    bookingId: string;
    selectedSlotId: string;
    simulateFailure?: boolean;
  }): Promise<BookingRequest> =>
    requestWithMockFallback(
      `/api/v1/bookings/${input.bookingId}/pay`,
      { method: 'POST', body: JSON.stringify(input) },
      () => {
        if (input.simulateFailure) {
          throw new Error(
            'Payment Declined (Simulated Stripe Error): Booking is NOT finalized and contact channels remain locked until payment succeeds.'
          );
        }

        const target = mockBookings.find((b) => b.id === input.bookingId);
        if (!target) {
          throw new Error('Booking not found.');
        }

        const updated: BookingRequest = {
          ...target,
          status: 'paid-confirmed',
          selectedSlotId: input.selectedSlotId,
          paidAt: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          contactUnlocked: true,
          unlockedContact: {
            teletherapyUrl: `https://session.psychaveph.clinical/room/${target.id}-${target.psychologistId || 'RP01'}`,
            coordinationEmail: 'psychaveph.info@gmail.com',
            sessionReferenceCode: `CONF-${target.psychologistId || 'RP01'}-${target.id.slice(-3)}`,
            emergencyProtocolNote:
              'Contact unlocked for both Client and Assigned Psychologist. Automated 24h and 1h reminders are scheduled.',
          },
          reminders: {
            reminder24h: 'scheduled',
            reminder1h: 'scheduled',
          },
        };

        mockBookings = mockBookings.map((b) => (b.id === input.bookingId ? updated : b));
        return updated;
      }
    ),

  /**
   * Flow C Step 5: Real-time status updates for Reschedule / Cancel / Reminder dispatch
   */
  updateBookingLifecycleStatus: async (input: {
    bookingId: string;
    action: 'cancel' | 'request-reschedule' | 'dispatch-reminders';
  }): Promise<BookingRequest> =>
    requestWithMockFallback(
      `/api/v1/bookings/${input.bookingId}/lifecycle`,
      { method: 'PATCH', body: JSON.stringify(input) },
      () => {
        const target = mockBookings.find((b) => b.id === input.bookingId);
        if (!target) throw new Error('Booking not found');

        let updated: BookingRequest = { ...target };
        if (input.action === 'cancel') {
          updated.status = 'cancelled';
        } else if (input.action === 'request-reschedule') {
          updated.status = 'reschedule-requested';
        } else if (input.action === 'dispatch-reminders') {
          updated.reminders = {
            reminder24h: 'dispatched',
            reminder1h: 'dispatched',
          };
        }

        mockBookings = mockBookings.map((b) => (b.id === input.bookingId ? updated : b));
        return updated;
      }
    ),

  /**
   * Update psychologist-only private note (strictly hidden from Admin/Client)
   */
  updatePrivatePsychNote: async (input: {
    bookingId: string;
    privateClinicalNote: string;
  }): Promise<BookingRequest> =>
    requestWithMockFallback(
      `/api/v1/bookings/${input.bookingId}/private-note`,
      { method: 'PATCH', body: JSON.stringify(input) },
      () => {
        const target = mockBookings.find((b) => b.id === input.bookingId);
        if (!target) throw new Error('Booking not found');
        const updated: BookingRequest = {
          ...target,
          privateClinicalNote: input.privateClinicalNote,
        };
        mockBookings = mockBookings.map((b) => (b.id === input.bookingId ? updated : b));
        return updated;
      }
    ),

  /**
   * Admin Payload CMS Content API
   */
  getCmsContent: async (): Promise<CmsContent> =>
    requestWithMockFallback('/api/v1/cms', undefined, () =>
      JSON.parse(JSON.stringify(mockCms))
    ),

  updateCmsContent: async (partial: Partial<CmsContent>): Promise<CmsContent> =>
    requestWithMockFallback(
      '/api/v1/cms',
      { method: 'PATCH', body: JSON.stringify(partial) },
      () => {
        mockCms = {
          ...mockCms,
          ...partial,
        };
        return JSON.parse(JSON.stringify(mockCms));
      }
    ),
};
