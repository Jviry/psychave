import {
  AdminUser,
  AdminUserPage,
  BookingRequest,
  BookingStatus,
  CmsContent,
  CognitoRole,
  Persona,
  PersonaReview,
  ResidentPsychologist,
  ServiceItem,
  SocialMediaLink,
} from './types';
import { useAuthStore } from '../authStore';
import { isMinorDob, type PersonaWizardPayload } from './consent';

/**
 * Single canonical API client for PsychAvenuePH (PSYCHAVE PH).
 *
 * Every operational request goes to the authenticated FastAPI backend. The
 * only local-only content is the CMS/roster marketing payload below, which
 * has no backend yet and is clearly isolated from auth, users, personas,
 * appointments, services, and payments.
 *
 * NEXT_PUBLIC_* vars are read as literal member expressions on purpose:
 * the bundler statically inlines exact `process.env.NEXT_PUBLIC_*` accesses
 * into both the server and client bundles, so every runtime sees the same
 * compile-time value.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(
  /\/+$/,
  ''
);

/**
 * Local-only CMS/marketing content. There is no CMS backend yet, so these
 * records intentionally stay in memory and are not presented as persisted
 * data. Operational data never uses this path.
 */
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
    visibleOnPublicRoster: true,
    socialMediaLinks: [
      { platform: 'Facebook', url: 'https://www.facebook.com/psychaveph' },
      { platform: 'Instagram', url: 'https://www.instagram.com/psychaveph' },
    ],
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
    visibleOnPublicRoster: true,
    socialMediaLinks: [
      { platform: 'Facebook', url: 'https://www.facebook.com/psychaveph' },
    ],
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
    visibleOnPublicRoster: true,
    socialMediaLinks: [
      { platform: 'LinkedIn', url: 'https://www.linkedin.com/company/psychaveph' },
    ],
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
    visibleOnPublicRoster: false,
    socialMediaLinks: [],
    bio: 'Associate practitioner focusing on child and adolescent emotional regulation, academic adjustment, and parent-child communication dynamics.',
  },
];

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

let localRoster: ResidentPsychologist[] = [...INITIAL_ROSTER];
let localCms: CmsContent = JSON.parse(JSON.stringify(INITIAL_CMS));
let localServiceEdits: Record<string, Partial<ServiceItem>> = {};

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
  persona_name: string;
  persona_relation: string;
  service_id: string;
  service_name: string;
  service_duration_minutes: number | null;
  service_guardrail: string | null;
  psychologist_id: string | null;
  selected_slot_id: string | null;
  price: number | null;
  presenting_concern: string;
  status: string;
  requested_datetime: string | null;
  proposed_slots: ProposedSlotRaw[];
  persona_socmed_platform: string | null;
  persona_socmed_username: string | null;
  psychologist_social_links: SocialMediaLink[];
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
  is_active: boolean;
  duration_minutes: number;
  guardrail_notice: string | null;
}

interface PersonaRaw {
  persona_id: string;
  relation_to_account_holder: string;
  persona_name: string;
  date_of_birth: string;
}

interface PersonaReviewRaw {
  persona: {
    persona_id: string;
    relation_to_account_holder: string;
    persona_name: string;
    date_of_birth: string;
    occupation: string | null;
    nationality: string;
    permanent_address: string;
    present_address: string;
    contact_number: string;
    socmed_platform: string | null;
    socmed_username: string | null;
    preferred_contact_mode: string;
    emergency_contact_name: string;
    emergency_contact_relation: string;
    emergency_contact_number: string;
  };
  consent: {
    consent_version: string;
    terms_signer_name: string;
    terms_signer_relation: string;
    scope_acknowledged: boolean;
    is_overseas_or_foreign: boolean;
    overseas_acknowledged: boolean;
    information_confirmed: boolean;
    consent_signer_name: string;
    signed_at: string | null;
  };
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
  social_media_links: SocialMediaLink[];
}

interface AdminUserRaw {
  user_id: string;
  email: string;
  role: CognitoRole;
  full_name: string | null;
  created_at: string;
}

interface AdminUserPageRaw {
  items: AdminUserRaw[];
  total: number;
  page: number;
  page_size: number;
}

function mapAdminUserRaw(raw: AdminUserRaw): AdminUser {
  return {
    userId: raw.user_id,
    email: raw.email,
    role: raw.role,
    fullName: raw.full_name ?? null,
    createdAt: raw.created_at,
  };
}

/**
 * Anonymized display codes (RP-0x) mapped from real UUIDs at this boundary
 * only. RP-01..RP-04 belong to the local marketing roster, so live codes start
 * at RP-11. Full names from the backend never reach the UI.
 */
const anonymizedCodeByUuid = new Map<string, string>();
let nextAnonymizedCode = 11;

export function anonymizedPsychCode(uuid: string | null): string {
  if (!uuid) return '';
  const existing = anonymizedCodeByUuid.get(uuid);
  if (existing) return existing;
  const code = `RP-${String(nextAnonymizedCode++).padStart(2, '0')}`;
  anonymizedCodeByUuid.set(uuid, code);
  return code;
}

function durationLabel(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} mins`;
  if (minutes === 60) return '1 hr (60 mins)';
  if (minutes === 90) return '1.5 hr (90 mins)';
  if (minutes % 60 === 0) return `${minutes / 60} hrs`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} mins`;
}

function mapStatusToBookingStatus(raw: string): BookingStatus {
  switch (raw) {
    case 'awaiting_slot_selection':
    case 'awaiting_payment':
      return 'proposed';
    case 'confirmed':
      return 'paid-confirmed';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function mapAppointmentRaw(raw: AppointmentRaw): BookingRequest {
  const status = mapStatusToBookingStatus(raw.status);
  const code = anonymizedPsychCode(raw.psychologist_id);
  const contactUnlocked =
    raw.status === 'confirmed' || raw.status === 'completed';
  const durationMinutes = raw.service_duration_minutes ?? 60;

  const psychologistSocialLinks = contactUnlocked
    ? (raw.psychologist_social_links ?? [])
    : undefined;
  const clientSocialMedia =
    raw.persona_socmed_platform || raw.persona_socmed_username
      ? {
          platform: raw.persona_socmed_platform ?? '',
          username: raw.persona_socmed_username ?? '',
        }
      : undefined;

  const proposedSlots = (raw.proposed_slots ?? []).map((slot, index) => {
    const time =
      slot.start_time.length === 5 ? slot.start_time : slot.start_time.slice(0, 5);
    const iso = `${slot.session_date.slice(0, 10)}T${time}`;
    const endTime = slot.end_time
      ? slot.end_time.length === 5
        ? slot.end_time
        : slot.end_time.slice(0, 5)
      : null;
    const endIso = endTime ? `${slot.session_date.slice(0, 10)}T${endTime}` : undefined;
    const { dateLabel, timeLabel } = formatSlotDateAndTime(iso, durationMinutes);
    return {
      id: slot.slot_id,
      slotNumber: ((index + 1) as 1 | 2 | 3),
      isoDateTime: iso,
      endIsoDateTime: endIso,
      dateLabel,
      timeLabel,
    };
  });

  return {
    id: raw.appointment_id,
    clientId: 'client-01',
    personaId: raw.persona_id,
    personaType: raw.persona_relation === 'self' ? 'self' : 'dependent',
    personaLabel: raw.persona_name,
    serviceId: raw.service_id,
    serviceTitle: raw.service_name,
    serviceDuration: durationLabel(raw.service_duration_minutes),
    serviceDurationMinutes: durationMinutes,
    serviceGuardrail: raw.service_guardrail ?? '',
    concernsSummary: raw.presenting_concern,
    submittedAt: raw.requested_datetime ? raw.requested_datetime.slice(0, 10) : '—',
    status,
    psychologistId: raw.psychologist_id ?? undefined,
    psychologistCode: code ? `Resident Psychologist #${code}` : undefined,
    pricePhp: raw.price ?? undefined,
    proposedSlots,
    selectedSlotId: raw.selected_slot_id ?? undefined,
    contactUnlocked,
    psychologistSocialLinks,
    clientSocialMedia,
    reminders: contactUnlocked
      ? { reminder24h: 'scheduled', reminder1h: 'scheduled' }
      : { reminder24h: 'pending', reminder1h: 'pending' },
  };
}

function mapServiceRaw(raw: ServiceRaw, index: number): ServiceItem {
  return {
    id: raw.service_id,
    indexNumber: String(index + 1).padStart(2, '0'),
    title: raw.name ?? 'Service',
    categoryGroup: '',
    durationLabel: durationLabel(raw.duration_minutes),
    durationMinutes: raw.duration_minutes || 60,
    guardrailTitle: '',
    guardrailNotice: raw.guardrail_notice ?? '',

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

function mapPersonaReviewRaw(raw: PersonaReviewRaw): PersonaReview {
  return {
    persona: {
      id: raw.persona.persona_id,
      name: raw.persona.persona_name,
      relationToAccountHolder: raw.persona.relation_to_account_holder,
      dateOfBirth: raw.persona.date_of_birth,
      occupation: raw.persona.occupation,
      nationality: raw.persona.nationality,
      permanentAddress: raw.persona.permanent_address,
      presentAddress: raw.persona.present_address,
      contactNumber: raw.persona.contact_number,
      socmedPlatform: raw.persona.socmed_platform,
      socmedUsername: raw.persona.socmed_username,
      preferredContactMode: raw.persona.preferred_contact_mode,
      emergencyContactName: raw.persona.emergency_contact_name,
      emergencyContactRelation: raw.persona.emergency_contact_relation,
      emergencyContactNumber: raw.persona.emergency_contact_number,
    },
    consent: {
      version: raw.consent.consent_version,
      termsSignerName: raw.consent.terms_signer_name,
      termsSignerRelation: raw.consent.terms_signer_relation,
      scopeAcknowledged: raw.consent.scope_acknowledged,
      isOverseasOrForeign: raw.consent.is_overseas_or_foreign,
      overseasAcknowledged: raw.consent.overseas_acknowledged,
      informationConfirmed: raw.consent.information_confirmed,
      consentSignerName: raw.consent.consent_signer_name,
      signedAt: raw.consent.signed_at,
    },
  };
}

/** Guards against posting non-UUID ids where the backend parses UUIDs. */
function assertUuid(value: string | undefined, label: string): string {
  const isUuid =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value ?? '');
  if (!isUuid) {
    throw new Error(
      `${label} is not a backend UUID (got "${value}"). Reload the page and select a server-loaded record.`
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

async function liveRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { status, json } = await liveFetch(endpoint, options);
  if (status < 200 || status >= 300) {
    throw buildBackendError(endpoint, status, json);
  }
  return json as T;
}

function mapPsychologistProfileRaw(raw: PsychologistProfileRaw): ResidentPsychologist {
  return {
    id: raw.psychologist_id,
    anonymizedTitle: `Resident Psychologist #${anonymizedPsychCode(raw.psychologist_id)}`,
    prcCredentialCode: raw.license_number ?? '',
    specialization: raw.specialization ?? '',
    serviceEligibility: [],
    languages: [],
    yearsPractice: '',
    visibleOnPublicRoster: true,
    socialMediaLinks: raw.social_media_links ?? [],
    bio: raw.bio ?? '',
  };
}

async function fetchServices(endpoint: string): Promise<ServiceItem[]> {
  const raw = await liveRequest<ServiceRaw[]>(endpoint);
  const list = Array.isArray(raw) ? raw : [];
  return list.map((service, index) => ({
    ...mapServiceRaw(service, index),
    ...(localServiceEdits[service.service_id] ?? {}),
  }));
}

export const api = {
  /**
   * Public catalog — no authentication required. Booking surfaces use the
   * authenticated getServices() below.
   */
  getPublicServices: async (): Promise<ServiceItem[]> => fetchServices('/services/active'),

  /**
   * Authenticated services API.
   */
  getServices: async (): Promise<ServiceItem[]> => fetchServices('/services'),

  /**
   * Local-only CMS edit. The backend has no service mutation endpoint yet, so
   * this keeps edits in memory for the CMS editor preview.
   */
  updateServiceGuardrail: async (
    serviceId: string,
    payload: { durationLabel: string; guardrailTitle: string; guardrailNotice: string; description: string }
  ): Promise<ServiceItem[]> => {
    localServiceEdits = {
      ...localServiceEdits,
      [serviceId]: payload,
    };
    return fetchServices('/services');
  },

  /**
   * Local-only marketing roster. No backend roster endpoint exists yet.
   */
  getRoster: async (includeHiddenForAdmin = false): Promise<ResidentPsychologist[]> => {
    const roster = includeHiddenForAdmin
      ? localRoster
      : localRoster.filter((resident) => resident.visibleOnPublicRoster);
    return roster.map((resident) => ({ ...resident }));
  },

  /**
   * Current psychologist's own profile.
   */
  getMyPsychologistProfile: async (): Promise<ResidentPsychologist> => {
    const raw = await liveRequest<PsychologistProfileRaw>('/psychologist-profile/me');
    return mapPsychologistProfileRaw(raw);
  },

  updatePsychologistProfile: async (
    updates: Partial<
      Pick<
        ResidentPsychologist,
        'specialization' | 'prcCredentialCode' | 'bio' | 'socialMediaLinks'
      >
    >
  ): Promise<ResidentPsychologist> => {
    const raw = await liveRequest<PsychologistProfileRaw>('/psychologist-profile/me', {
      method: 'PATCH',
      body: JSON.stringify({
        specialization: updates.specialization,
        bio: updates.bio,
        license_number: updates.prcCredentialCode,
        social_media_links: updates.socialMediaLinks,
      }),
    });
    return mapPsychologistProfileRaw(raw);
  },

  /**
   * Client Personas API
   */
  getPersonas: async (): Promise<Persona[]> => {
    const raw = await liveRequest<PersonaRaw[]>('/personas');
    const list = Array.isArray(raw) ? raw : [];
    return list.map(mapPersonaRaw);
  },

  getPersonaReview: async (personaId: string): Promise<PersonaReview> => {
    const raw = await liveRequest<PersonaReviewRaw>(`/personas/${personaId}/review`);
    return mapPersonaReviewRaw(raw);
  },

  /**
   * Persona creation wizard: single POST creating persona + consent rows.
   */
  createPersonaWithConsent: async (payload: PersonaWizardPayload): Promise<Persona> => {
    const raw = await liveRequest<PersonaRaw>('/personas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapPersonaRaw(raw);
  },

  /**
   * Flow C Bookings API. The backend derives the caller's scope from the
   * authenticated token — never from client-supplied role ids.
   */
  getBookingsForRole: async (
    role: 'client' | 'psychologist'
  ): Promise<BookingRequest[]> => {
    if (role === 'client') {
      const raw = await liveRequest<AppointmentRaw[]>('/appointments');
      return (Array.isArray(raw) ? raw : []).map((appointment) =>
        mapAppointmentRaw(appointment)
      );
    }

    const [pendingRows, mineRows] = await Promise.all([
      liveRequest<AppointmentRaw[]>('/appointments/pending'),
      liveRequest<AppointmentRaw[]>('/appointments/mine'),
    ]);
    const merged: BookingRequest[] = [];
    const seen = new Set<string>();
    for (const raw of [
      ...(Array.isArray(pendingRows) ? pendingRows : []),
      ...(Array.isArray(mineRows) ? mineRows : []),
    ]) {
      if (seen.has(raw.appointment_id)) continue;
      seen.add(raw.appointment_id);
      merged.push(mapAppointmentRaw(raw));
    }
    return merged;
  },

  getBookingById: async (bookingId: string): Promise<BookingRequest | null> => {
    const { status, json } = await liveFetch(`/appointments/${bookingId}`);
    if (status === 404) return null;
    if (status < 200 || status >= 300) {
      throw buildBackendError(`/appointments/${bookingId}`, status, json);
    }
    return mapAppointmentRaw(json as AppointmentRaw);
  },

  /**
   * Flow C Step 1: Client submits Persona + Booking Form → pending queue.
   */
  submitBookingRequest: async (input: {
    personaId: string;
    serviceId: string;
    concernsSummary: string;
  }): Promise<BookingRequest> => {
    const body = {
      persona_id: assertUuid(input.personaId, 'personaId'),
      service_id: assertUuid(input.serviceId, 'serviceId'),
      presenting_concern: input.concernsSummary,
    };
    const raw = await liveRequest<AppointmentRaw>('/appointments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return mapAppointmentRaw(raw);
  },

  /**
   * Flow C Step 3: Psychologist claims a request, sets price, proposes 3 slots.
   */
  pickUpAndProposeSlots: async (input: {
    bookingId: string;
    pricePhp: number;
    slot1DateTime: string;
    slot2DateTime: string;
    slot3DateTime: string;
  }): Promise<BookingRequest> => {
    const pickupRes = await liveFetch(`/appointments/${input.bookingId}/pickup`, {
      method: 'POST',
      body: JSON.stringify({ price: input.pricePhp }),
    });

    if (pickupRes.status === 404) {
      throw new Error(
        `Booking ${input.bookingId} was not found on ${API_BASE_URL} — it may belong to another client or no longer be on the queue.`
      );
    }
    if (pickupRes.status === 409 || pickupRes.status === 400) {
      throw new Error(
        `Request already claimed: Booking ${input.bookingId} has already been claimed by another psychologist. Please refresh your queue.`
      );
    }
    if (pickupRes.status === 422) {
      const detail =
        (pickupRes.json as { detail?: unknown } | null)?.detail ??
        'Add at least one social media link to your profile before accepting booking requests.';
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    if (pickupRes.status < 200 || pickupRes.status >= 300) {
      throw buildBackendError(
        `/appointments/${input.bookingId}/pickup`,
        pickupRes.status,
        pickupRes.json
      );
    }

    // Pickup succeeded: never fall back from here. The appointment is claimed.
    const claimed = await liveRequest<AppointmentRaw>(
      `/appointments/${input.bookingId}`
    );
    const durationMinutes = claimed.service_duration_minutes || 60;
    const slotPayload = [
      input.slot1DateTime,
      input.slot2DateTime,
      input.slot3DateTime,
    ].map((dateTime) => toSlotProposal(dateTime, durationMinutes));

    const slotsRes = await liveFetch(`/appointments/${input.bookingId}/slots`, {
      method: 'POST',
      body: JSON.stringify(slotPayload),
    });
    if (slotsRes.status < 200 || slotsRes.status >= 300) {
      const detail =
        (slotsRes.json as { detail?: string | unknown } | null)?.detail ??
        `HTTP ${slotsRes.status}`;
      throw new Error(
        `Appointment ${input.bookingId} was successfully claimed, but proposing slots failed (${typeof detail === 'string' ? detail : JSON.stringify(detail)}). It stays assigned to you — please check My Schedule or contact admin.`
      );
    }

    const final = await liveRequest<AppointmentRaw>(
      `/appointments/${input.bookingId}`
    );
    return mapAppointmentRaw(final);
  },

  /**
   * Flow C Step 4: Client selects 1 of 3 slots and initiates payment.
   * Contact stays locked until the provider confirms payment.
   */
  confirmSlotAndPay: async (input: {
    bookingId: string;
    selectedSlotId: string;
  }): Promise<BookingRequest> => {
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

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const appointment = await liveFetch(`/appointments/${input.bookingId}`);
      if (appointment.status >= 200 && appointment.status < 300) {
        const raw = appointment.json as AppointmentRaw;
        if (raw.status === 'confirmed') {
          return mapAppointmentRaw(raw);
        }
        if (raw.status === 'cancelled') break;
      }
    }

    throw new Error(
      `Payment initiated (provider: ${payment?.provider ?? 'gateway'}, ref: ${payment?.provider_ref ?? 'n/a'}) but not yet confirmed — contact stays locked until the provider webhook marks it paid.${payment?.checkout_url ? ` Checkout URL: ${payment.checkout_url}` : ''}`
    );
  },

  cancelBooking: async (bookingId: string): Promise<BookingRequest> => {
    const raw = await liveRequest<AppointmentRaw>(`/appointments/${bookingId}`, {
      method: 'DELETE',
    });
    return mapAppointmentRaw(raw);
  },

  completeAppointment: async (bookingId: string): Promise<BookingRequest> => {
    const raw = await liveRequest<AppointmentRaw>(
      `/appointments/${bookingId}/complete`,
      { method: 'POST' }
    );
    return mapAppointmentRaw(raw);
  },

  /**
   * Admin user directory & role management API.
   */
  getAdminUsers: async ({
    search = '',
    role,
    page = 1,
    pageSize = 10,
  }: {
    search?: string;
    role?: CognitoRole | 'all';
    page?: number;
    pageSize?: number;
  } = {}): Promise<AdminUserPage> => {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const params = new URLSearchParams({
      page: String(safePage),
      page_size: String(safePageSize),
    });
    if (search.trim()) params.set('search', search.trim());
    if (role && role !== 'all') params.set('role', role);

    const data = await liveRequest<AdminUserPageRaw>(
      `/admin/users?${params.toString()}`
    );
    return {
      items: data.items.map(mapAdminUserRaw),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
    };
  },

  updateAdminUserRole: async (
    userId: string,
    payload: { role: CognitoRole; fullName?: string }
  ): Promise<AdminUser> => {
    const raw = await liveRequest<AdminUserRaw>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({
        role: payload.role,
        full_name: payload.fullName,
      }),
    });
    return mapAdminUserRaw(raw);
  },

  /**
   * Local-only CMS content. There is no CMS backend yet.
   */
  getCmsContent: async (): Promise<CmsContent> => JSON.parse(JSON.stringify(localCms)),

  updateCmsContent: async (partial: Partial<CmsContent>): Promise<CmsContent> => {
    localCms = {
      ...localCms,
      ...partial,
    };
    return JSON.parse(JSON.stringify(localCms));
  },
};
