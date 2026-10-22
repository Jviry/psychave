import {
  BookingRequest,
  BookingStatus,
  CmsContent,
  CognitoRole,
  Persona,
  ProposedSlot,
  ResidentPsychologist,
  ServiceItem,
  UnlockedContact,
} from './types';
import { useAuthStore } from '../authStore';
import {
  CONSENT_VERSION,
  isFutureDob,
  isMinorDob,
  isValidPhone,
  normalizeName,
  type PersonaWizardPayload,
} from './consent';

/**
 * Single canonical API client for PsychAvenuePH (PSYCHAVE PH).
 * Targets NEXT_PUBLIC_API_URL (default http://localhost:8000) and automatically falls back
 * to deterministic in-memory mock state when the FastAPI/Mangum backend is offline.
 *
 * Live integration (backend-integration branch): the backend mounts bare paths
 * (`/auth`, `/services`, `/personas`, `/appointments`, `/psychologist`, `/payments`)
 * — see backend/src/controllers/app_router.py. Only wired prefixes may ever go
 * live; everything else (roster verification, CMS, lifecycle, private notes)
 * has no backend yet and always resolves from mocks, so a `real` mode run
 * never 404s into a broken public page. NEXT_PUBLIC_LIVE_ROUTES (comma list)
 * narrows liveness further, enabling the "one endpoint at a time" smoke-test
 * rule. Real-mode responses are adapted to the UI types in this file only —
 * UI components never see backend shapes.
 */
const getEnvVar = (key: string, fallback: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return fallback;
};

export const API_BASE_URL = getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:8000');
export const AUTH_MODE = getEnvVar('NEXT_PUBLIC_AUTH_MODE', 'mock');

/**
 * Backend prefixes with a real implementation today. Endpoints outside this
 * list never hit the network — mirrors app_router.py in backend/src.
 */
const WIRED_PREFIXES = ['/auth', '/services', '/personas', '/appointments', '/psychologist'];

/** Optional per-prefix allowlist (e.g. "/auth,/appointments") for incremental smoke tests. */
const LIVE_ROUTES = getEnvVar('NEXT_PUBLIC_LIVE_ROUTES', '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

export function shouldGoLive(endpoint: string): boolean {
  if (AUTH_MODE === 'mock') return false;
  const prefix = WIRED_PREFIXES.find((p) => endpoint.startsWith(p));
  if (!prefix) return false;
  if (LIVE_ROUTES.length === 0) return true;
  return LIVE_ROUTES.includes(prefix);
}

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
      'Consultation (45 min) is strictly for initial clinical screening, booking clarification, and care navigation. It does not constitute a full psychotherapy session.',
    description:
      'Structured initial consultation to clarify presenting concerns, evaluate clinical urgency, and match the client or dependent with the appropriate therapeutic modality.',
    clinicalFormat: '1-on-1 Booking Screening (Telehealth)',
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

/**
 * Clearly-labeled demo seeds. Only two bookings are kept and each is flagged
 * with `demoSeed: true` (UI-only, see BookingRequest) so cards render a
 * "Demo data" tag instead of passing invented narratives off as real content:
 *  - BK-2026-102 (proposed): demos Flow C step 4 — 3-slot proposal review.
 *  - BK-2026-103 (paid-confirmed): demos step 5 — pay-gated contact unlock.
 * All seeded copy is neutral synthetic filler; pending-state Flow C step 1 is
 * demoed by submitting the intake form, not by fake queue data.
 */
const INITIAL_BOOKINGS: BookingRequest[] = [
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
    demoSeed: true,
    concernsSummary:
      'Demo booking — synthetic content for prototype preview. Real submissions arrive via POST /api/v1/bookings/intake.',
    specificNeeds:
      'Synthetic demo text — replaced by live client scheduling preferences.',
    preferredLanguage: 'English / Taglish',
    submittedAt: '2026-09-25 09:45 PST',
    status: 'proposed',
    psychologistId: 'RP-01',
    psychologistCode: 'Resident Psychologist #RP-01',
    psychologistSpecialization: 'Adult Psychotherapy, Anxiety Disorders & Trauma-Informed CBT',
    pricePhp: 3200,
    clinicalPrepNote:
      'Demo booking — synthetic preparation note; replaced by the assigned psychologist’s clinical instructions.',
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
      'CONFIDENTIAL PSYCHOLOGIST NOTE: Demo seed — synthetic content; replaced by real private notes from the psychologist dashboard.',
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
    demoSeed: true,
    concernsSummary:
      'Demo booking — synthetic content for prototype preview. Real submissions arrive via POST /api/v1/bookings/intake.',
    specificNeeds: 'Synthetic demo text — replaced by live client scheduling preferences.',
    preferredLanguage: 'English',
    submittedAt: '2026-09-20 11:10 PST',
    status: 'paid-confirmed',
    psychologistId: 'RP-01',
    psychologistCode: 'Resident Psychologist #RP-01',
    psychologistSpecialization: 'Adult Psychotherapy, Anxiety Disorders & Trauma-Informed CBT',
    pricePhp: 2200,
    clinicalPrepNote:
      'Demo booking — synthetic preparation note; replaced by the assigned psychologist’s clinical instructions.',
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
      'CONFIDENTIAL PSYCHOLOGIST NOTE: Demo seed — synthetic content; replaced by real private notes from the psychologist dashboard. Hidden from Admin tier.',
  },
];

/**
 * CMS content starts empty — public pages render quiet "awaiting copy" notes
 * instead of invented institutional claims. Admin CMS edits re-populate these
 * in memory (PATCH /api/v1/cms owner edits land with the backend). The consent
 * governance banner keys stay populated: that notice is a privacy rule, not
 * placeholder content (RA 10173).
 */
const INITIAL_CMS: CmsContent = {
  vision: '',
  mission: '',
  clinicOverview: '',
  impactNarrative: '',
  impactMetrics: [],
  testimonialsConfig: {
    sectionTitle: 'Client Reflections & Consent Governance',
    consentFlagBanner:
      'Consent-Flag Governance Active — No personal quotes, client names, or identifiable narratives are displayed. Public pages render no testimonial content, in line with clinical confidentiality rules and Philippine Data Privacy Act (RA 10173) standards.',
    ethicalStandardRef: 'PAP Code of Ethics · RA 10173 Privacy Baseline',
    emptyCards: [],
  },
};

// In-memory store for prototype persistence across route changes
let mockServices: ServiceItem[] = [...INITIAL_SERVICES];
let mockPersonas: Persona[] = [...INITIAL_PERSONAS];
let mockRoster: ResidentPsychologist[] = [...INITIAL_ROSTER];
let mockBookings: BookingRequest[] = [...INITIAL_BOOKINGS];
let mockCms: CmsContent = JSON.parse(JSON.stringify(INITIAL_CMS));

/**
 * Monotonic mock booking sequence — continue past the seeded BK-2026-102..103
 * so newly created bookings never collide with seed data (or each other).
 * The random range previously reused ids on short sessions.
 */
let nextMockBookingSeq = 104;

/**
 * Shared fetch helper with AbortController timeout to prevent hung requests.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Token refresh single-flight state: a concurrent 401 burst shares one
 * POST /auth/refresh-token call (backend-dependent — see AGENTS.md).
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState()?.refreshToken ?? null;
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetchWithTimeout(
          `${API_BASE_URL}/auth/refresh-token?refresh_token=${encodeURIComponent(refreshToken)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          },
          8000
        );
        if (!res.ok) return null;
        // REFRESH_TOKEN_AUTH returns a brand-new AccessToken AND IdToken
        // (the RefreshToken stays the original one). Both must be updated —
        // the backend's verify_token() accepts ID tokens only.
        const data = (await res.json().catch(() => null)) as
          { AccessToken?: string; IdToken?: string } | null;
        const newAccess = data?.AccessToken ?? null;
        const newIdToken = data?.IdToken ?? null;
        if (newAccess && newIdToken) {
          useAuthStore.setState({ accessToken: newAccess, idToken: newIdToken });
          return newIdToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Builds the loud backend error format used across the live client.
 */
function buildBackendError(endpoint: string, status: number, json: unknown): Error {
  let errDetail = `HTTP ${status}`;
  if (json && typeof json === 'object') {
    const obj = json as { message?: string; detail?: string | unknown };
    if (obj.message) errDetail = obj.message;
    else if (obj.detail) {
      errDetail = typeof obj.detail === 'string' ? obj.detail : JSON.stringify(obj.detail);
    }
  }
  return new Error(`Backend Error (${status}) on ${endpoint}: ${errDetail}`);
}

/**
 * Low-level live request: injects the Bearer token from the real session,
 * retries once on 401 via the backend refresh endpoint, and returns the
 * status plus the parsed JSON body WITHOUT throwing — callers decide how
 * each status maps to UI behavior (404-as-null reads, claimed-booking 409s…).
 */
async function liveFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; json: unknown }> {
  const callOnce = () => {
    // Backend contract (backend/README.md): verify_token() requires the **ID
    // token** (aud = COGNITO_APP_CLIENT_ID); access tokens are rejected.
    const token = useAuthStore.getState()?.idToken ?? null;
    return fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      },
      8000
    );
  };

  let response = await callOnce();
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) response = await callOnce();
  }
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // Body not JSON (e.g. 204) — surfaced as null JSON under its real status.
  }
  return { status: response.status, json };
}

/**
 * Helper to attempt real backend fetch against NEXT_PUBLIC_API_URL.
 * - Endpoint NOT wired to the backend (no matching prefix) → resolves from
 *   in-memory mock state in every mode: those endpoints don't exist backend-side.
 * - NEXT_PUBLIC_AUTH_MODE === 'mock' → never touches the network (120ms delay),
 *   same as before.
 * - AUTH_MODE === 'real' + wired endpoint → live HTTP with loud 4xx/5xx errors;
 *   nothing is silently masked, and the optional `transform` adapts the raw
 *   backend shape into the UI type at this single boundary.
 */
async function requestWithMockFallback<T>(
  endpoint: string,
  options: RequestInit | undefined,
  mockResolver: () => T | Promise<T>,
  transform?: (raw: unknown) => T
): Promise<T> {
  if (shouldGoLive(endpoint)) {
    const { status, json } = await liveFetch(endpoint, options ?? {});
    if (status < 200 || status >= 300) {
      throw buildBackendError(endpoint, status, json);
    }
    return transform ? transform(json) : (json as T);
  }

  if (AUTH_MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 120));
  }
  return mockResolver();
}

function formatSlotDateAndTime(isoString: string, durationMinutes = 60): { dateLabel: string; timeLabel: string } {
  // If string has no timezone offset (Z or +/-HH:mm), treat wall-clock value as Asia/Manila (+08:00)
  const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(isoString);
  const normalized = hasTimezone ? isoString : `${isoString}+08:00`;
  const parsed = new Date(normalized);

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
    timeZone: 'Asia/Manila',
  });
  const startLabel = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const endLabel = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  return {
    dateLabel,
    timeLabel: `${startLabel} – ${endLabel} PST`,
  };
}

// ─── Real-backend response adapters (backend/src/schemas + controllers) ──────
// Response shapes live here ONLY. UI components keep consuming UI types
// (BookingRequest etc.); UUIDs → UI values, backend enum statuses → UI
// statuses, and anonymized display codes are derived in this block.

interface AppointmentRaw {
  appointment_id: string;
  persona_id: string;
  service_id: string;
  psychologist_id: string | null;
  selected_slot_id: string | null;
  price: number | null;
  presenting_concern: string;
  status: string;
  requested_datetime: string | null;
}

interface ProposedSlotRaw {
  slot_id: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
}

interface ServiceRaw {
  service_id: string;
  name: string;
  description: string;
}

interface PersonaRaw {
  persona_id: string;
  relation_to_account_holder: string;
  persona_name: string;
  date_of_birth: string;
}

interface PaymentRaw {
  payment_id: string;
  appointment_id: string;
  amount: number;
  payment_method: string | null;
  provider: string;
  provider_ref: string | null;
  checkout_url: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface PsychologistProfileRaw {
  psychologist_id: string;
  full_name: string;
  license_number: string | null;
  specialization: string | null;
  bio: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
}

/**
 * Live-mode service/persona caches. Backend rows carry UUID ids the UI never
 * sees in mock mode; lookups fall back to mock seeds, then placeholders.
 */
let liveServiceItems: ServiceItem[] = [];
let livePersonaItems: Persona[] = [];

function resolveService(serviceId: string): ServiceItem {
  return (
    liveServiceItems.find((s) => s.id === serviceId) ||
    mockServices.find((s) => s.id === serviceId) || {
      id: serviceId,
      indexNumber: '--',
      title: 'Service',
      categoryGroup: '',
      durationLabel: '—',
      durationMinutes: 60,
      guardrailTitle: '',
      guardrailNotice: '',
      description: '',
      clinicalFormat: '',
    }
  );
}

function resolvePersona(personaId: string): Persona {
  return (
    livePersonaItems.find((p) => p.id === personaId) ||
    mockPersonas.find((p) => p.id === personaId) || {
      id: personaId,
      clientId: 'client-01',
      type: 'dependent',
      label: 'Client persona',
      ageGroup: '',
      relationshipToClient: '',
      preferredLanguage: '',
      createdAt: '',
    }
  );
}

/**
 * Anonymized display codes (RP-0x) mapped from real UUIDs at this boundary
 * only. RP-01..RP-04 belong to the mock roster, so anonymous live codes start
 * at RP-11. Full names from the backend never reach the UI.
 */
const anonymizedCodeByUuid = new Map<string, string>();
let nextAnonymizedCode = 11;

function anonymizedPsychCode(uuid: string | null): string {
  if (!uuid) return '';
  const existing = anonymizedCodeByUuid.get(uuid);
  if (existing) return existing;
  const code = `RP-${String(nextAnonymizedCode++).padStart(2, '0')}`;
  anonymizedCodeByUuid.set(uuid, code);
  return code;
}

function mapStatusToBookingStatus(raw: string): BookingStatus {
  switch (raw) {
    case 'awaiting_slot_selection':
    case 'awaiting_payment':
      return 'proposed';
    case 'confirmed':
      return 'paid-confirmed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

interface MapAppointmentOptions {
  /** Display id used when the psychologist side exists (schedule-filter compat). */
  psychologistIdLabel?: string;
}

function mapAppointmentRaw(raw: AppointmentRaw, options: MapAppointmentOptions = {}): BookingRequest {
  const service = resolveService(raw.service_id);
  const persona = resolvePersona(raw.persona_id);
  const status = mapStatusToBookingStatus(raw.status);
  const code = anonymizedPsychCode(raw.psychologist_id);
  const contactUnlocked = raw.status === 'confirmed';

  const unlockedContact: UnlockedContact | undefined = contactUnlocked
    ? {
        teletherapyUrl: `https://session.psychaveph.clinical/room/${raw.appointment_id.slice(0, 8)}-${code || 'RP'}`,
        coordinationEmail: 'psychaveph.info@gmail.com',
        sessionReferenceCode: `CONF-${code || 'RP'}-${raw.appointment_id.slice(0, 8)}`,
        emergencyProtocolNote:
          'Direct session channel unlocked after payment confirmation. Automated 24h and 1h reminders are active.',
      }
    : undefined;

  return {
    id: raw.appointment_id,
    clientId: 'client-01',
    personaId: raw.persona_id,
    personaType: persona.type,
    personaLabel: persona.label,
    serviceId: raw.service_id,
    serviceTitle: service.title,
    serviceDuration: service.durationLabel,
    serviceGuardrail: service.guardrailNotice,
    concernsSummary: raw.presenting_concern,
    // Backend has no forms content columns yet (contract §7.3) — intake is lossy.
    specificNeeds: '',
    preferredLanguage: '',
    submittedAt: raw.requested_datetime ? raw.requested_datetime.slice(0, 10) : '—',
    status,
    psychologistId: raw.psychologist_id
      ? options.psychologistIdLabel || code
      : undefined,
    psychologistCode: code ? `Resident Psychologist #${code}` : undefined,
    pricePhp: raw.price ?? undefined,
    proposedSlots: [],
    selectedSlotId: raw.selected_slot_id ?? undefined,
    contactUnlocked,
    unlockedContact,
    reminders: contactUnlocked
      ? { reminder24h: 'scheduled', reminder1h: 'scheduled' }
      : { reminder24h: 'pending', reminder1h: 'pending' },
  };
}

function mapProposedSlotRaw(
  raw: ProposedSlotRaw,
  serviceId: string,
  slotNumber: 1 | 2 | 3
): ProposedSlot {
  const time = raw.start_time.length === 5 ? raw.start_time : raw.start_time.slice(0, 5);
  const iso = `${raw.session_date.slice(0, 10)}T${time}`;
  const { dateLabel, timeLabel } = formatSlotDateAndTime(
    iso,
    resolveService(serviceId).durationMinutes || 60
  );
  return { id: raw.slot_id, slotNumber, isoDateTime: iso, dateLabel, timeLabel };
}

/**
 * AppointmentRead carries no slot rows — the client reads them from
 * GET /appointments/{id}/slots (psychologist tokens are not permitted there).
 * Failures are swallowed on purpose: 404 (still pending, no slots) and 403
 * (psychologist-scoped callers) both simply keep the appointment metadata.
 */
async function attachClientSlots(booking: BookingRequest): Promise<BookingRequest> {
  if (!shouldGoLive('/appointments')) return booking;
  try {
    const { status, json } = await liveFetch(`/appointments/${booking.id}/slots`);
    if (status >= 200 && status < 300 && Array.isArray(json)) {
      booking.proposedSlots = (json as ProposedSlotRaw[]).map((s, i) =>
        mapProposedSlotRaw(s, booking.serviceId, ((i + 1) as 1 | 2 | 3))
      );
    }
  } catch {
    // Slot rows are best-effort supplementation; appointment metadata still stands.
  }
  return booking;
}

function mapServiceRaw(raw: ServiceRaw, index: number): ServiceItem {
  // Backend services table has no duration/guardrail columns yet (contract §7.1).
  return {
    id: raw.service_id,
    indexNumber: String(index + 1).padStart(2, '0'),
    title: raw.name ?? 'Service',
    categoryGroup: '',
    durationLabel: '—',
    durationMinutes: 60,
    guardrailTitle: '',
    guardrailNotice: '',
    description: raw.description ?? '',
    clinicalFormat: '',
  };
}

function mapPersonaRaw(raw: PersonaRaw): Persona {
  const dob = String(raw.date_of_birth ?? '').slice(0, 10);
  return {
    id: raw.persona_id,
    clientId: 'client-01',
    type: raw.relation_to_account_holder === 'self' ? 'self' : 'dependent',
    label: raw.persona_name,
    ageGroup: isMinorDob(dob) ? 'Minor (<18)' : 'Adult (18+)',
    relationshipToClient: raw.relation_to_account_holder ?? '',
    preferredLanguage: '',
    createdAt: '',
  };
}

/** Guards against posting mock ids where the backend parses UUIDs. */
function assertUuid(value: string | undefined, label: string): string {
  const isUuid =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value ?? '');
  if (!isUuid) {
    throw new Error(
      `${label} is not a backend UUID (got "${value}"). In mixed live mode, flip matching endpoints (personas/services) live together with appointments first.`
    );
  }
  return value as string;
}

/** ISO datetime ('YYYY-MM-DDTHH:mm[...]') → SlotProposal body rows. */
function toSlotProposal(isoDateTime: string, durationMinutes: number) {
  const clean = isoDateTime.slice(0, 16);
  const sessionDate = clean.slice(0, 10);
  const timePart = clean.slice(11, 16);
  const [h, m] = timePart.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid slot datetime format: "${isoDateTime}"`);
  }
  const total = (h * 60 + m + durationMinutes) % (24 * 60);
  const endHours = String(Math.floor(total / 60)).padStart(2, '0');
  const endMinutes = String(total % 60).padStart(2, '0');
  return { session_date: sessionDate, start_time: `${timePart}:00`, end_time: `${endHours}:${endMinutes}:00` };
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
    requestWithMockFallback(
      '/services',
      undefined,
      () => [...mockServices],
      (raw) => {
        const list = Array.isArray(raw) ? (raw as ServiceRaw[]) : [];
        liveServiceItems = list.map((s, i) => mapServiceRaw(s, i));
        return liveServiceItems;
      }
    ),

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
      '/psychologist-profile/me',
      {
        method: 'PATCH',
        // Backend PsychologistProfileUpdate: only specialization/bio/license_number
        // — languages/yearsPractice/prcCredentialCode stay UI-side (contract §7.2).
        body: JSON.stringify({
          specialization: updates.specialization,
          bio: updates.bio,
          license_number: updates.prcCredentialCode,
        }),
      },
      () => {
        const idx = mockRoster.findIndex((r) => r.id === psychId);
        if (idx === -1) throw new Error('Psychologist profile not found.');
        mockRoster[idx] = { ...mockRoster[idx], ...updates };
        return { ...mockRoster[idx] };
      },
      (raw) => {
        const profile = (raw ?? null) as PsychologistProfileRaw | null;
        const base = mockRoster.find((r) => r.id === psychId) ?? {
          id: psychId,
          anonymizedTitle: 'Resident Psychologist',
          prcCredentialCode: '',
          specialization: '',
          serviceEligibility: [],
          languages: [],
          yearsPractice: '',
          verificationStatus: 'verified' as const,
          visibleOnPublicRoster: true,
          assignedBookingsCount: 0,
          bio: '',
        };
        return {
          ...base,
          specialization: profile?.specialization ?? base.specialization,
          bio: profile?.bio ?? base.bio,
          prcCredentialCode: profile?.license_number ?? base.prcCredentialCode,
        };
      }
    ),

  /**
   * Client Personas API
   */
  getPersonas: async (): Promise<Persona[]> =>
    requestWithMockFallback(
      '/personas',
      undefined,
      () => [...mockPersonas],
      (raw) => {
        const list = Array.isArray(raw) ? (raw as PersonaRaw[]) : [];
        livePersonaItems = list.map(mapPersonaRaw);
        return livePersonaItems;
      }
    ),

  createPersona: async (input: Partial<Omit<Persona, 'id' | 'clientId' | 'createdAt'>>): Promise<Persona> =>
    requestWithMockFallback(
      '/api/v1/personas-legacy-quick-add',
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
   * Persona creation wizard: single POST /personas creating persona + consent
   * rows in one transaction. Backend remains source of truth; the mock below
   * mirrors server validation so UI errors map to the right field/page.
   * Nothing is sent until the wizard's final submit calls this once.
   */
  createPersonaWithConsent: async (payload: PersonaWizardPayload): Promise<Persona> =>
    requestWithMockFallback(
      '/personas',
      // Backend POST /personas takes PersonaWithConsentCreate {persona, consent}
      // — the wizard payload already matches its field names.
      { method: 'POST', body: JSON.stringify(payload) },
      () => {
        const fieldErrors: Record<string, string> = {};
        const { persona, consent } = payload;
        if (consent.consent_version !== CONSENT_VERSION) {
          throw new Error(
            'Consent version mismatch: reload the latest terms and re-sign before submitting.'
          );
        }
        if (consent.scope_acknowledged !== true)
          fieldErrors['consent.scope_acknowledged'] = 'Scope acknowledgement is required.';
        if (consent.information_confirmed !== true)
          fieldErrors['consent.information_confirmed'] = 'Information confirmation is required.';
        if (consent.is_overseas_or_foreign && consent.overseas_acknowledged !== true)
          fieldErrors['consent.overseas_acknowledged'] =
            'Overseas acknowledgement is required for overseas clients.';
        if (!persona.persona_name || persona.persona_name.trim().length < 2)
          fieldErrors['persona.persona_name'] = 'Enter the persona full name.';
        if (!persona.date_of_birth) fieldErrors['persona.date_of_birth'] = 'Date of birth is required.';
        else if (isFutureDob(persona.date_of_birth))
          fieldErrors['persona.date_of_birth'] = 'Date of birth cannot be in the future.';
        else if (isMinorDob(persona.date_of_birth) && consent.terms_signer_relation === 'self')
          fieldErrors['consent.terms_signer_relation'] =
            'A minor cannot use signer relation "self".';
        if (
          normalizeName(consent.terms_signer_name).length > 0 &&
          normalizeName(consent.consent_signer_name).length > 0 &&
          normalizeName(consent.terms_signer_name) !== normalizeName(consent.consent_signer_name)
        )
          fieldErrors['consent.consent_signer_name'] =
            'consent_signer_name must match terms_signer_name.';
        if (!isValidPhone(persona.contact_number || '', consent.is_overseas_or_foreign))
          fieldErrors['persona.contact_number'] = 'Enter a valid contact number.';
        if (!isValidPhone(persona.emergency_contact_number || '', consent.is_overseas_or_foreign))
          fieldErrors['persona.emergency_contact_number'] =
            'Enter a valid emergency contact number.';
        if (!persona.nationality || persona.nationality.trim().length < 2)
          fieldErrors['persona.nationality'] = 'Enter nationality.';
        if (!persona.permanent_address || persona.permanent_address.trim().length < 5)
          fieldErrors['persona.permanent_address'] = 'Enter the permanent address.';
        if (!persona.present_address || persona.present_address.trim().length < 5)
          fieldErrors['persona.present_address'] = 'Enter the present address.';
        if (Object.keys(fieldErrors).length > 0) {
          throw new Error(`Persona validation failed. FIELDS:${JSON.stringify(fieldErrors)}`);
        }
        const created: Persona = {
          id: `persona-wiz-${Date.now().toString().slice(-6)}`,
          clientId: 'client-01',
          type: persona.relation_to_account_holder === 'self' ? 'self' : 'dependent',
          label: persona.persona_name,
          ageGroup: `DOB ${persona.date_of_birth}`,
          relationshipToClient: persona.relation_to_account_holder,
          preferredLanguage: 'English / Taglish',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        mockPersonas = [...mockPersonas, created];
        return created;
      },
      // Live response is PersonaRead — map + refresh the persona snapshot.
      (raw) => {
        const created = mapPersonaRaw(raw as PersonaRaw);
        livePersonaItems = [...livePersonaItems, created];
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
  ): Promise<BookingRequest[]> => {
    // Legacy role-filter query params are derived server-side from the real
    // token in live mode — never trust the client for scoping (contract §7.1).
    if (role === 'client' && shouldGoLive('/appointments')) {
      const { status, json } = await liveFetch('/appointments');
      if (status < 200 || status >= 300) {
        throw buildBackendError('/appointments', status, json);
      }
      return (Array.isArray(json) ? (json as AppointmentRaw[]) : []).map((r) =>
        mapAppointmentRaw(r)
      );
    }
    if (role === 'psychologist' && shouldGoLive('/psychologist')) {
      const label = { psychologistIdLabel: psychologistId };
      const [pendingRes, mineRes] = await Promise.all([
        liveFetch('/psychologist/appointments/pending'),
        liveFetch('/psychologist/appointments/mine'),
      ]);
      if (pendingRes.status < 200 || pendingRes.status >= 300) {
        throw buildBackendError(
          '/psychologist/appointments/pending',
          pendingRes.status,
          pendingRes.json
        );
      }
      if (mineRes.status < 200 || mineRes.status >= 300) {
        throw buildBackendError(
          '/psychologist/appointments/mine',
          mineRes.status,
          mineRes.json
        );
      }
      const toPendingRows = Array.isArray(pendingRes.json)
        ? (pendingRes.json as AppointmentRaw[])
        : [];
      const toMineRows = Array.isArray(mineRes.json) ? (mineRes.json as AppointmentRaw[]) : [];
      const merged: BookingRequest[] = [];
      const seen = new Set<string>();
      for (const raw of [...toPendingRows, ...toMineRows]) {
        if (seen.has(raw.appointment_id)) continue;
        seen.add(raw.appointment_id);
        merged.push(mapAppointmentRaw(raw, label));
      }
      return merged;
    }
    // Admin reads + all mock-mode reads.
    return requestWithMockFallback(
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
    );
  },

  getBookingById: async (bookingId: string, role: CognitoRole = 'client'): Promise<BookingRequest | null> => {
    if (shouldGoLive('/appointments') && role !== 'admin') {
      const { status, json } = await liveFetch(`/appointments/${bookingId}`);
      if (status === 404) return null;
      if (status < 200 || status >= 300) {
        throw buildBackendError(`/appointments/${bookingId}`, status, json);
      }
      const mapped = mapAppointmentRaw(json as AppointmentRaw, {
        psychologistIdLabel: 'RP-01',
      });
      // Slot rows live in a separate client-scoped endpoint; supplement them
      // whenever the booking carries one (proposed pay view / confirmed card).
      return attachClientSlots(mapped);
    }
    return requestWithMockFallback(`/api/v1/bookings/${bookingId}`, undefined, () => {
      const found = mockBookings.find((b) => b.id === bookingId);
      if (!found) return null;
      if (role !== 'psychologist') {
        const { privateClinicalNote: _redacted, ...safeBooking } = found;
        return safeBooking;
      }
      return { ...found };
    });
  },

  /**
   * Flow C Step 1: Client submits Persona + Booking Form -> enters 'pending' queue
   */
  submitBookingRequest: async (input: {
    personaId: string;
    serviceId: string;
    preferredLanguage: string;
    concernsSummary: string;
    specificNeeds: string;
  }): Promise<BookingRequest> => {
    if (shouldGoLive('/appointments')) {
      const body = {
        persona_id: assertUuid(input.personaId, 'personaId'),
        service_id: assertUuid(input.serviceId, 'serviceId'),
        // Backend AppointmentCreate carries a single presenting_concern column;
        // specificNeeds/preferredLanguage have no forms columns yet (§7.3).
        presenting_concern: input.concernsSummary,
      };
      const { status, json } = await liveFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (status < 200 || status >= 300) {
        throw buildBackendError('/api/v1/bookings/intake', status, json);
      }
      return mapAppointmentRaw(json as AppointmentRaw);
    }
    return requestWithMockFallback(
      '/api/v1/bookings/intake',
      { method: 'POST', body: JSON.stringify(input) },
      () => {
        const persona =
          mockPersonas.find((p) => p.id === input.personaId) || mockPersonas[0];
        const service =
          mockServices.find((s) => s.id === input.serviceId) || mockServices[0];

        const newBooking: BookingRequest = {
          id: `BK-2026-${nextMockBookingSeq++}`,
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
    );
  },

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
    // If backend is active, run the real pickup → durations → 3-slot proposal chain.
    if (shouldGoLive('/psychologist')) {
      // Step 1: claim the pending request. PickupRequest body is { price } —
      // the psychologist identity is derived from the token, never the client
      // (dependencies/auth.py require_approved_psychologist).
      const pickupRes = await liveFetch(
        `/psychologist/appointments/${input.bookingId}/pickup`,
        {
          method: 'POST',
          body: JSON.stringify({ price: input.pricePhp }),
        }
      );

      if (pickupRes.status === 404) {
        throw new Error(
          `Booking ${input.bookingId} was not found on ${API_BASE_URL} — it may belong to another client or no longer be on the queue.`
        );
      }
      if (pickupRes.status === 403) {
        throw new Error(
          'Credential Guardrail: Unverified psychologists cannot pick up booking requests or propose slots.'
        );
      }
      if (pickupRes.status === 409 || pickupRes.status === 400) {
        throw new Error(
          `Request already claimed: Booking ${input.bookingId} has already been claimed by another psychologist. Please refresh your queue.`
        );
      }
      if (pickupRes.status < 200 || pickupRes.status >= 300) {
        throw buildBackendError(
          `/psychologist/appointments/${input.bookingId}/pickup`,
          pickupRes.status,
          pickupRes.json
        );
      }

      // CRITICAL (Copilot Finding 2, updated): pickup was successful — the
      // appointment is claimed. NEVER fall back to mocks or legacy endpoints
      // from here; failures surface loudly so nobody double-claims.
      const apptRes = await liveFetch(`/appointments/${input.bookingId}`);
      if (apptRes.status < 200 || apptRes.status >= 300) {
        throw buildBackendError(
          `/appointments/${input.bookingId}`,
          apptRes.status,
          apptRes.json
        );
      }
      const claimedRaw = apptRes.json as AppointmentRaw;
      const durationMinutes = resolveService(claimedRaw.service_id).durationMinutes || 60;

      // Step 2: exactly 3 distinct SlotProposal rows with session_date + times.
      const slotPayload = [input.slot1DateTime, input.slot2DateTime, input.slot3DateTime].map(
        (dt) => toSlotProposal(dt, durationMinutes)
      );

      const slotsRes = await liveFetch(
        `/psychologist/appointments/${input.bookingId}/slots`,
        {
          method: 'POST',
          body: JSON.stringify(slotPayload),
        }
      );

      if (slotsRes.status < 200 || slotsRes.status >= 300) {
        const detail =
          (slotsRes.json as { detail?: string | unknown } | null)?.detail ?? `HTTP ${slotsRes.status}`;
        throw new Error(
          `Appointment ${input.bookingId} was successfully claimed, but proposing slots failed (${typeof detail === 'string' ? detail : JSON.stringify(detail)}). It stays assigned to you — please check My Schedule or contact admin.`
        );
      }

      // Step 3: refetch the claimed appointment (now awaiting slot selection)
      // and return it with the proposed slot rows attached.
      const finalRes = await liveFetch(`/appointments/${input.bookingId}`);
      if (finalRes.status < 200 || finalRes.status >= 300) {
        throw buildBackendError(
          `/appointments/${input.bookingId}`,
          finalRes.status,
          finalRes.json
        );
      }
      const mapped = mapAppointmentRaw(finalRes.json as AppointmentRaw, {
        psychologistIdLabel: input.psychologistId,
      });
      const slotRows = Array.isArray(slotsRes.json)
        ? (slotsRes.json as ProposedSlotRaw[])
        : [];
      mapped.proposedSlots = slotRows.map((s, i) =>
        mapProposedSlotRaw(s, claimedRaw.service_id, ((i + 1) as 1 | 2 | 3))
      );
      return mapped;
    }

    return requestWithMockFallback(
      `/api/v1/bookings/${input.bookingId}/propose`,
      { method: 'POST', body: JSON.stringify(input) },
      () => {
        const psych = mockRoster.find((r) => r.id === input.psychologistId);
        if (!psych || psych.verificationStatus !== 'verified') {
          throw new Error(
            'Credential Guardrail: Unverified psychologists cannot pick up booking requests or propose slots.'
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
          privateClinicalNote: `CONFIDENTIAL PSYCHOLOGIST NOTE (${psych.anonymizedTitle}): Booking reviewed and 3 slots proposed. Hidden from Admin tier.`,
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
  }): Promise<BookingRequest> => {
    if (shouldGoLive('/appointments')) {
      // simulateFailure stays a mock-only dev toggle (never sent to the backend).
      if (input.simulateFailure) {
        throw new Error(
          'Payment Declined (Simulated Stripe Error): Booking is NOT finalized and contact channels remain locked until payment succeeds.'
        );
      }

      // Step 1: select the slot — appointment flips to awaiting_payment.
      const selectRes = await liveFetch(`/appointments/${input.bookingId}/select-slot`, {
        method: 'POST',
        body: JSON.stringify({
          slot_id: assertUuid(input.selectedSlotId, 'selectedSlotId'),
        }),
      });
      if (selectRes.status < 200 || selectRes.status >= 300) {
        throw buildBackendError(
          `/appointments/${input.bookingId}/select-slot`,
          selectRes.status,
          selectRes.json
        );
      }

      // Step 2: initiate payment. The provider seam returns a PENDING payment
      // row + checkout ref; the appointment only becomes confirmed via the
      // provider webhook (POST /payments/webhook {provider_ref, outcome}).
      // NEVER fake a success here — contact stays locked until confirmation.
      const payRes = await liveFetch(`/appointments/${input.bookingId}/payment`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (payRes.status < 200 || payRes.status >= 300) {
        throw buildBackendError(
          `/appointments/${input.bookingId}/payment`,
          payRes.status,
          payRes.json
        );
      }
      const payment = payRes.json as PaymentRaw | null;

      // Step 3: short confirmation poll — covers synchronous gateways.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((r) => setTimeout(r, 500));
        const appt = await liveFetch(`/appointments/${input.bookingId}`);
        if (appt.status >= 200 && appt.status < 300) {
          const raw = appt.json as AppointmentRaw;
          if (raw.status === 'confirmed') {
            const mapped = mapAppointmentRaw(raw);
            await attachClientSlots(mapped);
            return mapped;
          }
          if (raw.status === 'cancelled') break;
        }
      }

      throw new Error(
        `Payment initiated (provider: ${payment?.provider ?? 'gateway'}, ref: ${payment?.provider_ref ?? 'n/a'}) but not yet confirmed — contact stays locked until the provider webhook marks it paid.${payment?.checkout_url ? ` Checkout URL: ${payment.checkout_url}` : ''}`
      );
    }

    return requestWithMockFallback(
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
    );
  },

  /**
   * Flow C Step 5: Real-time status updates for Reschedule / Cancel / Reminder dispatch
   */
  updateBookingLifecycleStatus: async (input: {
    bookingId: string;
    action: 'cancel' | 'request-reschedule' | 'dispatch-reminders';
  }): Promise<BookingRequest> => {
    // Live transitions: cancel is the only backend-backed one
    // (DELETE /appointments/{id}; reschedule/reminder dispatch stay pending §7.5).
    if (input.action === 'cancel' && shouldGoLive('/appointments')) {
      const { status, json } = await liveFetch(`/appointments/${input.bookingId}`, {
        method: 'DELETE',
      });
      if (status < 200 || status >= 300) {
        throw buildBackendError(
          `/appointments/${input.bookingId}`,
          status,
          json
        );
      }
      return mapAppointmentRaw(json as AppointmentRaw);
    }
    return requestWithMockFallback(
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
    );
  },

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
