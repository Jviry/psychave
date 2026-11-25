import {
  AdminUser,
  AdminUserPage,
  BookingRequest,
  BookingStatus,
  CmsContent,
  CognitoRole,
  ConsentFormTemplate,
  Profile,
  ProfileReview,
  PsychologistInvitation,
  ResidentPsychologist,
  ReviewSection,
  ServiceItem,
  SlotProposer,
  SlotStatus,
  SocialMediaLink,
  TestimonialItem,
  WizardAppliesTo,
  WizardBlock,
  WizardBlockType,
  WizardFieldTarget,
  WizardPage,
} from './types';
import { useAuthStore } from '../authStore';
import { DEFAULT_WIZARD_PAGES, isMinorDob, type ProfileWizardPayload } from './consent';

/**
 * Single canonical API client for PsychAvenuePH (PSYCHAVE PH).
 *
 * Every operational request goes to the authenticated FastAPI backend. The
 * only local-only content is the CMS/roster marketing payload below, which
 * has no backend yet and is clearly isolated from auth, users, profiles,
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

let localRoster: ResidentPsychologist[] = [...INITIAL_ROSTER];

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
          `${API_BASE_URL}/auth/refresh-token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
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
function buildBackendError(_endpoint: string, status: number, json: unknown): Error {
  let errDetail = `HTTP ${status}`;
  if (json && typeof json === 'object') {
    const obj = json as { message?: string; detail?: string | unknown };
    if (obj.message) errDetail = obj.message;
    else if (obj.detail) {
      errDetail = typeof obj.detail === 'string' ? obj.detail : JSON.stringify(obj.detail);
    }
  }
  return new Error(`Request failed (${status}): ${errDetail}`);
}

/**
 * Checks whether a JWT's `exp` claim is expired (or within `skewSeconds` of
 * expiring). Non-JWT placeholder strings in tests return `false`.
 */
function isJwtExpired(token: string, skewSeconds = 60): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return false;
  }
}

/**
 * Low-level live request: injects the Bearer token from the real session,
 * proactively refreshes expired ID tokens before hitting API Gateway's JWT
 * authorizer, retries once on 401 via the backend refresh endpoint, and
 * returns the status plus the parsed JSON body WITHOUT throwing — callers
 * decide how each status maps to UI behavior (404-as-null reads, claimed-booking 409s…).
 */
async function liveFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; json: unknown }> {
  const initialToken = useAuthStore.getState()?.idToken ?? null;
  if (initialToken && isJwtExpired(initialToken)) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      if (useAuthStore.getState()?.isAuthenticated) {
        useAuthStore.getState().logout();
      }
      if (!endpoint.startsWith('/services/active') && endpoint !== '/cms') {
        return {
          status: 401,
          json: { detail: 'Session expired. Please sign in again.' },
        };
      }
    }
  }

  const callOnce = () => {
    // Backend contract (backend/README.md): verify_token() requires the **ID
    // token** (aud = COGNITO_APP_CLIENT_ID); access tokens are rejected.
    const state = useAuthStore.getState();
    const token = state?.idToken ?? null;
    const useBffProxy =
      typeof window !== 'undefined' && Boolean(state?.isAuthenticated) && !token;
    const url = useBffProxy ? `/api/proxy${endpoint}` : `${API_BASE_URL}${endpoint}`;
    return fetchWithTimeout(
      url,
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

  let response: Response;
  try {
    response = await callOnce();
  } catch (err) {
    // API Gateway's JWT authorizer returns 401 without CORS headers when a
    // token is rejected at the edge, which surfaces in browsers as a network
    // TypeError. If we have a refresh token, attempt one refresh + retry.
    const canTryRefresh =
      Boolean(useAuthStore.getState()?.idToken) &&
      Boolean(useAuthStore.getState()?.refreshToken) &&
      !(err instanceof Error && /timed out/i.test(err.message));
    if (!canTryRefresh) throw err;

    const newToken = await refreshAccessToken();
    if (!newToken) {
      if (useAuthStore.getState()?.isAuthenticated) {
        useAuthStore.getState().logout();
      }
      return {
        status: 401,
        json: { detail: 'Session expired. Please sign in again.' },
      };
    }
    response = await callOnce();
  }

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await callOnce();
    } else if (useAuthStore.getState()?.isAuthenticated) {
      useAuthStore.getState().logout();
    }
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
  profile_id: string;
  profile_name: string;
  profile_relation: string;
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
  scheduling_turn: string | null;
  scheduling_round: number;
  payment_deadline: string | null;
  proposed_slots: ProposedSlotRaw[];
  conflicting_slot_ids?: string[];
  profile_socmed_platform: string | null;
  profile_socmed_username: string | null;
  psychologist_social_links: SocialMediaLink[];
}

interface ProposedSlotRaw {
  slot_id: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  proposed_by: string;
  status: string;
  round: number;
}

interface ServiceRaw {
  service_id: string;
  name: string;
  description: string;
  is_active: boolean;
  duration_minutes: number;
  guardrail_notice: string | null;
  rate_label?: string | null;
}

interface ProfileRaw {
  profile_id: string;
  relation_to_account_holder: string;
  profile_name: string;
  date_of_birth: string;
  occupation?: string | null;
  nationality?: string;
  permanent_address?: string;
  present_address?: string;
  contact_number?: string;
  socmed_platform?: string | null;
  socmed_username?: string | null;
  preferred_contact_mode?: 'phone' | 'email' | 'messenger' | 'instagram';
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_number?: string;
  details?: Record<string, unknown>;
  signed_consent_version?: string | null;
  active_consent_version?: string;
  consent_outdated?: boolean;
}

interface ReviewFieldRaw {
  field_key: string;
  label: string;
  type: string;
  value: unknown;
}

interface ReviewSectionRaw {
  page_id: string;
  title: string;
  fields: ReviewFieldRaw[];
}

interface ProfileReviewRaw {
  profile: {
    profile_id: string;
    relation_to_account_holder: string;
    profile_name: string;
    date_of_birth: string;
    occupation?: string | null;
    nationality?: string;
    permanent_address?: string;
    present_address?: string;
    contact_number?: string;
    socmed_platform?: string | null;
    socmed_username?: string | null;
    preferred_contact_mode?: string;
    emergency_contact_name?: string;
    emergency_contact_relation?: string;
    emergency_contact_number?: string;
    details?: Record<string, unknown>;
  };
  consent: {
    consent_version: string;
    terms_signer_name?: string;
    terms_signer_relation?: string;
    scope_acknowledged?: boolean;
    is_overseas_or_foreign?: boolean;
    overseas_acknowledged?: boolean;
    information_confirmed?: boolean;
    consent_signer_name?: string;
    signed_at?: string | null;
    responses?: Record<string, unknown>;
  };
  review_sections?: ReviewSectionRaw[];
}

interface WizardSelectOptionRaw {
  value: string;
  label: string;
}

interface WizardShowIfRaw {
  field_key: string;
  equals: string | boolean;
}

interface WizardBlockRaw {
  block_id: string;
  type: WizardBlockType;
  label: string;
  content?: string | null;
  helper_text?: string | null;
  placeholder?: string | null;
  target?: WizardFieldTarget | null;
  field_key?: string | null;
  applies_to?: WizardAppliesTo;
  required?: boolean;
  options?: WizardSelectOptionRaw[];
  show_if?: WizardShowIfRaw | null;
  system_locked?: boolean;
}

interface WizardPageRaw {
  page_id: string;
  title: string;
  description?: string | null;
  blocks: WizardBlockRaw[];
}

interface ConsentFormTemplateRaw {
  template_id: string;
  consent_version: string;
  informed_consent_text: string;
  typing_statement: string;
  scope_limitations_text: string;
  scope_ack_text: string;
  overseas_limitations_text: string;
  overseas_ack_text: string;
  final_consent_statement: string;
  wizard_pages: WizardPageRaw[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

function mapStatusToBookingStatus(
  raw: string,
  schedulingTurn: string | null
): BookingStatus {
  switch (raw) {
    case 'awaiting_schedule':
      return schedulingTurn === 'client' ? 'awaiting-client' : 'awaiting-review';
    case 'awaiting_payment':
      return 'awaiting-payment';
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
  const status = mapStatusToBookingStatus(raw.status, raw.scheduling_turn);
  const code = anonymizedPsychCode(raw.psychologist_id);
  const contactUnlocked =
    raw.status === 'confirmed' || raw.status === 'completed';
  const durationMinutes = raw.service_duration_minutes ?? 60;

  const psychologistSocialLinks = contactUnlocked
    ? (raw.psychologist_social_links ?? [])
    : undefined;
  const clientSocialMedia =
    raw.profile_socmed_platform || raw.profile_socmed_username
      ? {
          platform: raw.profile_socmed_platform ?? '',
          username: raw.profile_socmed_username ?? '',
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
    const slotStatus: SlotStatus =
      slot.status === 'accepted' ||
      slot.status === 'declined' ||
      slot.status === 'expired'
        ? slot.status
        : 'proposed';
    const proposedBy: SlotProposer =
      slot.proposed_by === 'client' ? 'client' : 'psychologist';
    return {
      id: slot.slot_id,
      slotNumber: index + 1,
      isoDateTime: iso,
      endIsoDateTime: endIso,
      dateLabel,
      timeLabel,
      proposedBy,
      status: slotStatus,
      round: slot.round ?? 1,
    };
  });

  return {
    id: raw.appointment_id,
    clientId: 'client-01',
    profileId: raw.profile_id,
    profileType: raw.profile_relation === 'self' ? 'self' : 'dependent',
    profileLabel: raw.profile_name,
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
    schedulingTurn:
      raw.scheduling_turn === 'client' || raw.scheduling_turn === 'psychologist'
        ? raw.scheduling_turn
        : undefined,
    schedulingRound: raw.scheduling_round ?? 1,
    paymentDeadline: raw.payment_deadline ?? undefined,
    conflictingSlotIds: raw.conflicting_slot_ids ?? [],
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
    rateLabel: raw.rate_label ?? null,
    guardrailTitle: '',
    guardrailNotice: raw.guardrail_notice ?? '',
    description: raw.description ?? '',
    clinicalFormat: '',
    isActive: raw.is_active ?? true,
  };
}

function mapProfileRaw(raw: ProfileRaw): Profile {
  const dob = String(raw.date_of_birth ?? '').slice(0, 10);
  const details = (raw.details ?? {}) as Record<string, unknown>;
  return {
    id: raw.profile_id,
    clientId: 'client-01',
    type: raw.relation_to_account_holder === 'self' ? 'self' : 'dependent',
    label: raw.profile_name,
    ageGroup: isMinorDob(dob) ? 'Minor (<18)' : 'Adult (18+)',
    relationshipToClient: raw.relation_to_account_holder ?? '',
    preferredLanguage: '',
    createdAt: '',
    dateOfBirth: dob,
    occupation: raw.occupation ?? (details.occupation != null ? String(details.occupation) : null),
    nationality: String(raw.nationality ?? details.nationality ?? ''),
    permanentAddress: String(raw.permanent_address ?? details.permanent_address ?? ''),
    presentAddress: String(raw.present_address ?? details.present_address ?? ''),
    contactNumber: String(raw.contact_number ?? details.contact_number ?? ''),
    socmedPlatform: raw.socmed_platform ?? null,
    socmedUsername: raw.socmed_username ?? null,
    preferredContactMode: (raw.preferred_contact_mode ??
      details.preferred_contact_mode ??
      'phone') as Profile['preferredContactMode'],
    emergencyContactName: String(
      raw.emergency_contact_name ?? details.emergency_contact_name ?? ''
    ),
    emergencyContactRelation: String(
      raw.emergency_contact_relation ?? details.emergency_contact_relation ?? ''
    ),
    emergencyContactNumber: String(
      raw.emergency_contact_number ?? details.emergency_contact_number ?? ''
    ),
    details: raw.details ?? {},
    signedConsentVersion: raw.signed_consent_version ?? null,
    activeConsentVersion: raw.active_consent_version ?? 'v2',
    consentOutdated: Boolean(raw.consent_outdated),
  };
}

function mapProfileReviewRaw(raw: ProfileReviewRaw): ProfileReview {
  const details = (raw.profile.details ?? {}) as Record<string, unknown>;
  const responses = (raw.consent.responses ?? {}) as Record<string, unknown>;
  const reviewSections: ReviewSection[] | undefined =
    Array.isArray(raw.review_sections) && raw.review_sections.length > 0
      ? raw.review_sections.map((sec) => ({
          pageId: sec.page_id,
          title: sec.title,
          fields: (sec.fields ?? []).map((f) => ({
            fieldKey: f.field_key,
            label: f.label,
            type: f.type,
            value: f.value,
          })),
        }))
      : undefined;

  return {
    profile: {
      id: raw.profile.profile_id,
      name: raw.profile.profile_name,
      relationToAccountHolder: raw.profile.relation_to_account_holder,
      dateOfBirth: raw.profile.date_of_birth,
      occupation:
        raw.profile.occupation ??
        (details.occupation != null ? String(details.occupation) : null),
      nationality: String(raw.profile.nationality ?? details.nationality ?? ''),
      permanentAddress: String(
        raw.profile.permanent_address ?? details.permanent_address ?? ''
      ),
      presentAddress: String(
        raw.profile.present_address ?? details.present_address ?? ''
      ),
      contactNumber: String(
        raw.profile.contact_number ?? details.contact_number ?? ''
      ),
      socmedPlatform: raw.profile.socmed_platform ?? null,
      socmedUsername: raw.profile.socmed_username ?? null,
      preferredContactMode: String(
        raw.profile.preferred_contact_mode ?? details.preferred_contact_mode ?? 'phone'
      ),
      emergencyContactName: String(
        raw.profile.emergency_contact_name ?? details.emergency_contact_name ?? ''
      ),
      emergencyContactRelation: String(
        raw.profile.emergency_contact_relation ??
          details.emergency_contact_relation ??
          ''
      ),
      emergencyContactNumber: String(
        raw.profile.emergency_contact_number ?? details.emergency_contact_number ?? ''
      ),
      ...(raw.profile.details ? { details: raw.profile.details } : {}),
    },
    consent: {
      version: raw.consent.consent_version,
      termsSignerName: String(
        raw.consent.terms_signer_name ?? responses.terms_signer_name ?? ''
      ),
      termsSignerRelation: String(
        raw.consent.terms_signer_relation ?? responses.terms_signer_relation ?? 'self'
      ),
      scopeAcknowledged: Boolean(
        raw.consent.scope_acknowledged ?? responses.scope_acknowledged
      ),
      isOverseasOrForeign: Boolean(
        raw.consent.is_overseas_or_foreign ?? responses.is_overseas_or_foreign
      ),
      overseasAcknowledged: Boolean(
        raw.consent.overseas_acknowledged ?? responses.overseas_acknowledged
      ),
      informationConfirmed: Boolean(
        raw.consent.information_confirmed ?? responses.information_confirmed
      ),
      consentSignerName: String(
        raw.consent.consent_signer_name ?? responses.consent_signer_name ?? ''
      ),
      signedAt: raw.consent.signed_at ?? null,
      ...(raw.consent.responses ? { responses: raw.consent.responses } : {}),
    },
    ...(reviewSections ? { reviewSections } : {}),
  };
}

function mapWizardBlockRaw(raw: WizardBlockRaw): WizardBlock {
  return {
    blockId: raw.block_id,
    type: raw.type,
    label: raw.label,
    content: raw.content ?? null,
    helperText: raw.helper_text ?? null,
    placeholder: raw.placeholder ?? null,
    target: raw.target ?? null,
    fieldKey: raw.field_key ?? null,
    appliesTo: raw.applies_to ?? 'all',
    required: Boolean(raw.required),
    options: (raw.options ?? []).map((opt) => ({
      value: opt.value,
      label: opt.label,
    })),
    showIf: raw.show_if
      ? {
          fieldKey: raw.show_if.field_key,
          equals: raw.show_if.equals,
        }
      : null,
    systemLocked: Boolean(raw.system_locked),
  };
}

function mapWizardPageRaw(raw: WizardPageRaw): WizardPage {
  return {
    pageId: raw.page_id,
    title: raw.title,
    description: raw.description ?? null,
    blocks: (raw.blocks ?? []).map(mapWizardBlockRaw),
  };
}

function serializeWizardPage(page: WizardPage): WizardPageRaw {
  return {
    page_id: page.pageId,
    title: page.title,
    description: page.description ?? null,
    blocks: page.blocks.map((block) => ({
      block_id: block.blockId,
      type: block.type,
      label: block.label,
      content: block.content ?? null,
      helper_text: block.helperText ?? null,
      placeholder: block.placeholder ?? null,
      target: block.target ?? null,
      field_key: block.fieldKey ?? null,
      applies_to: block.appliesTo ?? 'all',
      required: Boolean(block.required),
      options: (block.options ?? []).map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
      show_if: block.showIf
        ? {
            field_key: block.showIf.fieldKey,
            equals: block.showIf.equals,
          }
        : null,
      system_locked: Boolean(block.systemLocked),
    })),
  };
}

function mapConsentFormTemplateRaw(raw: ConsentFormTemplateRaw): ConsentFormTemplate {
  const wizardPages =
    Array.isArray(raw.wizard_pages) && raw.wizard_pages.length > 0
      ? raw.wizard_pages.map(mapWizardPageRaw)
      : DEFAULT_WIZARD_PAGES;
  return {
    templateId: raw.template_id,
    consentVersion: raw.consent_version,
    informedConsentText: raw.informed_consent_text,
    typingStatement: raw.typing_statement,
    scopeLimitationsText: raw.scope_limitations_text,
    scopeAckText: raw.scope_ack_text,
    overseasLimitationsText: raw.overseas_limitations_text,
    overseasAckText: raw.overseas_ack_text,
    finalConsentStatement: raw.final_consent_statement,
    wizardPages,
    isActive: Boolean(raw.is_active),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
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

/** ISO datetime ('YYYY-MM-DDTHH:mm[...]') → SlotInput body row. */
function toSlotPreference(isoDateTime: string) {
  const clean = isoDateTime.slice(0, 16);
  const sessionDate = clean.slice(0, 10);
  const timePart = clean.slice(11, 16);
  const [h, m] = timePart.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid slot datetime format: "${isoDateTime}"`);
  }
  return { session_date: sessionDate, start_time: `${timePart}:00` };
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
  return list.map((service, index) => mapServiceRaw(service, index));
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
   * Admin CMS Services API (includes inactive services).
   */
  getAdminServices: async (): Promise<ServiceItem[]> => fetchServices('/services/all'),

  createService: async (payload: {
    title: string;
    description: string;
    durationMinutes: number;
    rateLabel?: string | null;
    guardrailNotice?: string | null;
    isActive?: boolean;
  }): Promise<ServiceItem> => {
    const raw = await liveRequest<ServiceRaw>('/services', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.title.trim(),
        description: payload.description.trim(),
        duration_minutes: payload.durationMinutes,
        rate_label: payload.rateLabel?.trim() || null,
        guardrail_notice: payload.guardrailNotice?.trim() || null,
        is_active: payload.isActive ?? true,
      }),
    });
    return mapServiceRaw(raw, 0);
  },

  updateService: async (
    serviceId: string,
    payload: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      rateLabel?: string | null;
      guardrailNotice?: string | null;
      isActive?: boolean;
    }
  ): Promise<ServiceItem> => {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined) body.name = payload.title.trim();
    if (payload.description !== undefined) body.description = payload.description.trim();
    if (payload.durationMinutes !== undefined) body.duration_minutes = payload.durationMinutes;
    if (payload.rateLabel !== undefined) {
      body.rate_label = payload.rateLabel?.trim() || null;
    }
    if (payload.guardrailNotice !== undefined) {
      body.guardrail_notice = payload.guardrailNotice?.trim() || null;
    }
    if (payload.isActive !== undefined) body.is_active = payload.isActive;

    const raw = await liveRequest<ServiceRaw>(`/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return mapServiceRaw(raw, 0);
  },

  /**
   * Multi-Page Wizard & Consent Form Templates CMS API.
   */
  getActiveConsentForm: async (): Promise<ConsentFormTemplate> => {
    const raw = await liveRequest<ConsentFormTemplateRaw>('/forms/active');
    return mapConsentFormTemplateRaw(raw);
  },

  getConsentFormTemplates: async (): Promise<ConsentFormTemplate[]> => {
    const raw = await liveRequest<ConsentFormTemplateRaw[]>('/forms/templates');
    return (Array.isArray(raw) ? raw : []).map(mapConsentFormTemplateRaw);
  },

  updateActiveConsentForm: async (payload: {
    consentVersion: string;
    bumpType?: 'auto' | 'minor' | 'major' | 'explicit';
    wizardPages: WizardPage[];
  }): Promise<ConsentFormTemplate> => {
    const raw = await liveRequest<ConsentFormTemplateRaw>('/forms/active', {
      method: 'PUT',
      body: JSON.stringify({
        consent_version: payload.consentVersion,
        bump_type: payload.bumpType ?? 'auto',
        wizard_pages: payload.wizardPages.map(serializeWizardPage),
      }),
    });
    return mapConsentFormTemplateRaw(raw);
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
   * Client Profiles API
   */
  getProfiles: async (): Promise<Profile[]> => {
    const raw = await liveRequest<ProfileRaw[]>('/profiles');
    const list = Array.isArray(raw) ? raw : [];
    return list.map(mapProfileRaw);
  },

  getProfileReview: async (profileId: string): Promise<ProfileReview> => {
    const raw = await liveRequest<ProfileReviewRaw>(`/profiles/${profileId}/review`);
    return mapProfileReviewRaw(raw);
  },

  /**
   * Profile creation wizard: single POST creating profile + consent rows.
   */
  createProfileWithConsent: async (payload: ProfileWizardPayload): Promise<Profile> => {
    const raw = await liveRequest<ProfileRaw>('/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapProfileRaw(raw);
  },

  /**
   * Re-sign updated active major consent version for an existing profile.
   */
  resignProfileConsent: async (
    profileId: string,
    consent: Record<string, unknown> & { consent_version: string }
  ): Promise<Profile> => {
    const raw = await liveRequest<ProfileRaw>(`/profiles/${assertUuid(profileId, 'profileId')}/consent`, {
      method: 'POST',
      body: JSON.stringify(consent),
    });
    return mapProfileRaw(raw);
  },

  updateProfile: async (
    profileId: string,
    payload: ProfileWizardPayload['profile']
  ): Promise<Profile> => {
    const raw = await liveRequest<ProfileRaw>(`/profiles/${assertUuid(profileId, 'profileId')}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return mapProfileRaw(raw);
  },

  deleteProfile: async (profileId: string): Promise<Profile> => {
    const raw = await liveRequest<ProfileRaw>(`/profiles/${assertUuid(profileId, 'profileId')}`, {
      method: 'DELETE',
    });
    return mapProfileRaw(raw);
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
   * Flow C Step 1: Client submits Profile + Booking Form → pending queue.
   */
  submitBookingRequest: async (input: {
    profileId: string;
    serviceId: string;
    concernsSummary: string;
    preferredSlots: string[];
  }): Promise<BookingRequest> => {
    if (input.preferredSlots.length < 3) {
      throw new Error('Choose at least 3 preferred schedules.');
    }
    const body = {
      profile_id: assertUuid(input.profileId, 'profileId'),
      service_id: assertUuid(input.serviceId, 'serviceId'),
      presenting_concern: input.concernsSummary,
      preferred_slots: input.preferredSlots.map(toSlotPreference),
    };
    const raw = await liveRequest<AppointmentRaw>('/appointments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return mapAppointmentRaw(raw);
  },

  /**
   * Psychologist atomically claims a pending request, sets the session price,
   * and either accepts a client-preferred schedule or offers one alternative.
   */
  pickUpBooking: async (input: {
    bookingId: string;
    pricePhp: number;
    slotId?: string;
    counterDateTime?: string;
  }): Promise<BookingRequest> => {
    const hasSlot = Boolean(input.slotId);
    const hasCounter = Boolean(input.counterDateTime);
    if (hasSlot === hasCounter) {
      throw new Error('Choose a preferred schedule or offer an alternative.');
    }

    const body: Record<string, unknown> = { price: input.pricePhp };
    if (input.slotId) {
      body.slot_id = assertUuid(input.slotId, 'slotId');
    } else if (input.counterDateTime) {
      body.counter_slot = toSlotPreference(input.counterDateTime);
    }

    const path = `/appointments/${assertUuid(input.bookingId, 'bookingId')}/pickup`;
    const pickupRes = await liveFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (pickupRes.status === 404) {
      throw new Error(
        `Booking ${input.bookingId} was not found on ${API_BASE_URL} — it may belong to another client or no longer be on the queue.`
      );
    }
    if (pickupRes.status === 409 || pickupRes.status === 400) {
      const detail = (pickupRes.json as { detail?: unknown } | null)?.detail;
      const detailText = typeof detail === 'string' ? detail : '';
      if (
        /already been picked up|no longer pending/i.test(detailText) ||
        !detailText
      ) {
        throw new Error(
          `Request already claimed: Booking ${input.bookingId} has already been claimed by another psychologist. Please refresh your queue.`
        );
      }
      throw new Error(detailText);
    }
    if (pickupRes.status === 422) {
      const detail =
        (pickupRes.json as { detail?: unknown } | null)?.detail ??
        'Add at least one social media link to your profile before accepting booking requests.';
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    if (pickupRes.status < 200 || pickupRes.status >= 300) {
      throw buildBackendError(path, pickupRes.status, pickupRes.json);
    }

    return mapAppointmentRaw(pickupRes.json as AppointmentRaw);
  },

  /** Psychologist accepts one of the client's preferred schedules. */
  acceptPreferredSlot: async (input: {
    bookingId: string;
    slotId: string;
  }): Promise<BookingRequest> => {
    const raw = await liveRequest<AppointmentRaw>(
      `/appointments/${assertUuid(input.bookingId, 'bookingId')}/accept-preferred-slot`,
      {
        method: 'POST',
        body: JSON.stringify({ slot_id: assertUuid(input.slotId, 'slotId') }),
      }
    );
    return mapAppointmentRaw(raw);
  },

  /** Psychologist offers exactly one nearest/earliest alternative. */
  counterOffer: async (input: {
    bookingId: string;
    dateTime: string;
  }): Promise<BookingRequest> => {
    const raw = await liveRequest<AppointmentRaw>(
      `/appointments/${assertUuid(input.bookingId, 'bookingId')}/counter-offer`,
      {
        method: 'POST',
        body: JSON.stringify(toSlotPreference(input.dateTime)),
      }
    );
    return mapAppointmentRaw(raw);
  },

  /** Client accepts the psychologist's counter-offer. */
  acceptCounterSlot: async (input: {
    bookingId: string;
    slotId: string;
  }): Promise<BookingRequest> => {
    const raw = await liveRequest<AppointmentRaw>(
      `/appointments/${assertUuid(input.bookingId, 'bookingId')}/accept-slot`,
      {
        method: 'POST',
        body: JSON.stringify({ slot_id: assertUuid(input.slotId, 'slotId') }),
      }
    );
    return mapAppointmentRaw(raw);
  },

  /** Client submits a fresh set of preferred schedules. */
  replacePreferredSlots: async (input: {
    bookingId: string;
    preferredSlots: string[];
  }): Promise<BookingRequest> => {
    if (input.preferredSlots.length < 3) {
      throw new Error('Choose at least 3 preferred schedules.');
    }
    const raw = await liveRequest<AppointmentRaw>(
      `/appointments/${assertUuid(input.bookingId, 'bookingId')}/preferred-slots`,
      {
        method: 'POST',
        body: JSON.stringify({
          slots: input.preferredSlots.map(toSlotPreference),
        }),
      }
    );
    return mapAppointmentRaw(raw);
  },

  /** Pay for an already-agreed slot. Contact unlocks only after confirmation. */
  payBooking: async (bookingId: string): Promise<BookingRequest> => {
    const path = `/appointments/${assertUuid(bookingId, 'bookingId')}/payment`;
    const payRes = await liveFetch(path, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (payRes.status < 200 || payRes.status >= 300) {
      throw buildBackendError(path, payRes.status, payRes.json);
    }
    const payment = payRes.json as PaymentRaw | null;

    if (
      payment?.checkout_url &&
      payment.status !== 'paid'
    ) {
      let safeCheckoutUrl: string | null = null;
      try {
        const parsed = new URL(payment.checkout_url);
        const isPayMongo =
          parsed.protocol === 'https:' &&
          (parsed.hostname === 'checkout.paymongo.com' ||
            parsed.hostname.endsWith('.paymongo.com'));
        if (isPayMongo) {
          safeCheckoutUrl = parsed.toString();
        }
      } catch {
        safeCheckoutUrl = null;
      }

      if (!safeCheckoutUrl) {
        throw new Error('Invalid payment checkout URL returned by server.');
      }

      if (typeof window !== 'undefined') {
        window.location.assign(safeCheckoutUrl);
        return {
          id: bookingId,
          clientId: '',
          profileId: '',
          profileType: 'self',
          profileLabel: '',
          serviceId: '',
          serviceTitle: '',
          serviceDuration: '',
          serviceDurationMinutes: 0,
          serviceGuardrail: '',
          concernsSummary: '',
          submittedAt: new Date().toISOString(),
          status: 'awaiting-payment',
          proposedSlots: [],
          schedulingTurn: 'client',
          schedulingRound: 1,
          contactUnlocked: false,
          reminders: { reminder24h: 'pending', reminder1h: 'pending' },
        };
      }
      const appointment = await liveRequest<AppointmentRaw>(
        `/appointments/${bookingId}`
      );
      return mapAppointmentRaw(appointment);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const appointment = await liveFetch(`/appointments/${bookingId}`);
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

  invitePsychologist: async (email: string): Promise<PsychologistInvitation> => {
    const raw = await liveRequest<{
      invitation_id: string;
      email: string;
      invitation_url: string;
      expires_at: string;
      created_at: string;
    }>('/admin/psychologist-invitations', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    return {
      invitationId: raw.invitation_id,
      email: raw.email,
      invitationUrl: raw.invitation_url,
      expiresAt: raw.expires_at,
      createdAt: raw.created_at,
    };
  },

  /**
   * Live CMS Content (Vision, Mission, Clinic Overview, Impact Narrative) & Testimonials API.
   */
  getCmsContent: async (): Promise<CmsContent> => {
    const raw = await liveRequest<{
      vision: string;
      mission: string;
      clinic_overview: string;
      impact_narrative: string;
      updated_at: string;
      testimonials: Array<{
        testimonial_id: string;
        quote: string;
        author_label: string;
        service_category: string;
        is_active: boolean;
        display_order: number;
        created_at: string;
      }>;
    }>('/cms');
    return {
      vision: raw.vision,
      mission: raw.mission,
      clinicOverview: raw.clinic_overview,
      impactNarrative: raw.impact_narrative,
      updatedAt: raw.updated_at,
      testimonials: (raw.testimonials ?? []).map((t) => ({
        id: t.testimonial_id,
        quote: t.quote,
        authorLabel: t.author_label,
        serviceCategory: t.service_category,
        isActive: t.is_active,
        displayOrder: t.display_order,
        createdAt: t.created_at,
      })),
    };
  },

  getAdminCmsContent: async (): Promise<CmsContent> => {
    const raw = await liveRequest<{
      vision: string;
      mission: string;
      clinic_overview: string;
      impact_narrative: string;
      updated_at: string;
      testimonials: Array<{
        testimonial_id: string;
        quote: string;
        author_label: string;
        service_category: string;
        is_active: boolean;
        display_order: number;
        created_at: string;
      }>;
    }>('/cms/admin');
    return {
      vision: raw.vision,
      mission: raw.mission,
      clinicOverview: raw.clinic_overview,
      impactNarrative: raw.impact_narrative,
      updatedAt: raw.updated_at,
      testimonials: (raw.testimonials ?? []).map((t) => ({
        id: t.testimonial_id,
        quote: t.quote,
        authorLabel: t.author_label,
        serviceCategory: t.service_category,
        isActive: t.is_active,
        displayOrder: t.display_order,
        createdAt: t.created_at,
      })),
    };
  },

  updateCmsContent: async (payload: {
    vision: string;
    mission: string;
    clinicOverview: string;
    impactNarrative: string;
  }): Promise<CmsContent> => {
    const raw = await liveRequest<{
      vision: string;
      mission: string;
      clinic_overview: string;
      impact_narrative: string;
      updated_at: string;
      testimonials: Array<{
        testimonial_id: string;
        quote: string;
        author_label: string;
        service_category: string;
        is_active: boolean;
        display_order: number;
        created_at: string;
      }>;
    }>('/cms', {
      method: 'PUT',
      body: JSON.stringify({
        vision: payload.vision.trim(),
        mission: payload.mission.trim(),
        clinic_overview: payload.clinicOverview.trim(),
        impact_narrative: payload.impactNarrative.trim(),
      }),
    });
    return {
      vision: raw.vision,
      mission: raw.mission,
      clinicOverview: raw.clinic_overview,
      impactNarrative: raw.impact_narrative,
      updatedAt: raw.updated_at,
      testimonials: (raw.testimonials ?? []).map((t) => ({
        id: t.testimonial_id,
        quote: t.quote,
        authorLabel: t.author_label,
        serviceCategory: t.service_category,
        isActive: t.is_active,
        displayOrder: t.display_order,
        createdAt: t.created_at,
      })),
    };
  },

  createTestimonial: async (payload: {
    quote: string;
    authorLabel: string;
    serviceCategory: string;
    isActive?: boolean;
    displayOrder?: number;
  }): Promise<TestimonialItem> => {
    const raw = await liveRequest<{
      testimonial_id: string;
      quote: string;
      author_label: string;
      service_category: string;
      is_active: boolean;
      display_order: number;
      created_at: string;
    }>('/cms/testimonials', {
      method: 'POST',
      body: JSON.stringify({
        quote: payload.quote.trim(),
        author_label: payload.authorLabel.trim(),
        service_category: payload.serviceCategory.trim(),
        is_active: payload.isActive ?? true,
        display_order: payload.displayOrder ?? 0,
      }),
    });
    return {
      id: raw.testimonial_id,
      quote: raw.quote,
      authorLabel: raw.author_label,
      serviceCategory: raw.service_category,
      isActive: raw.is_active,
      displayOrder: raw.display_order,
      createdAt: raw.created_at,
    };
  },

  updateTestimonial: async (
    testimonialId: string,
    payload: {
      quote?: string;
      authorLabel?: string;
      serviceCategory?: string;
      isActive?: boolean;
      displayOrder?: number;
    }
  ): Promise<TestimonialItem> => {
    const body: Record<string, unknown> = {};
    if (payload.quote !== undefined) body.quote = payload.quote.trim();
    if (payload.authorLabel !== undefined) body.author_label = payload.authorLabel.trim();
    if (payload.serviceCategory !== undefined) {
      body.service_category = payload.serviceCategory.trim();
    }
    if (payload.isActive !== undefined) body.is_active = payload.isActive;
    if (payload.displayOrder !== undefined) body.display_order = payload.displayOrder;

    const raw = await liveRequest<{
      testimonial_id: string;
      quote: string;
      author_label: string;
      service_category: string;
      is_active: boolean;
      display_order: number;
      created_at: string;
    }>(`/cms/testimonials/${testimonialId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return {
      id: raw.testimonial_id,
      quote: raw.quote,
      authorLabel: raw.author_label,
      serviceCategory: raw.service_category,
      isActive: raw.is_active,
      displayOrder: raw.display_order,
      createdAt: raw.created_at,
    };
  },

  deleteTestimonial: async (testimonialId: string): Promise<void> => {
    await liveRequest<void>(`/cms/testimonials/${testimonialId}`, {
      method: 'DELETE',
    });
  },
};
