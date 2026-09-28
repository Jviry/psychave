# Frontend ↔ Backend Contract — Mock-First (Initial UI Only)

> Status: mock-first. `frontend/` runs on built-in mocks (`NEXT_PUBLIC_AUTH_MODE=mock`). **No backend code was added or changed.** Missing backend endpoints are listed as future work only.

## 1. Runtime Contract (Current)

- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`, `NEXT_PUBLIC_AUTH_MODE=mock`.
- `frontend/lib/api.ts` tries `NEXT_PUBLIC_API_URL` first with short timeout, then falls back to in-memory mocks. With no backend endpoints, every screen works offline.
- Auth is a header role switcher (`client / psychologist / admin`); no real Cognito verification in the UI prototype.

## 2. Endpoint Map (Frontend Expects → Backend Has)

| Frontend call | Backend today |
|---|---|
| `GET /api/v1/services` | Missing — only `GET /health` exists. Mock: 7 services in `lib/api.ts`. |
| `GET /api/v1/roster` | Missing. Backend has `psychologist_profiles` table only, no controller. |
| `GET/POST /api/v1/personas` | Missing. Backend has `persona` table only. |
| `POST /api/v1/bookings/intake`, `POST /:id/propose`, `POST /:id/pay`, `PATCH /:id/lifecycle`, `GET /api/v1/bookings?role=` | Missing. Backend has `appointments / proposed_slots / payments / forms` tables only. |
| `GET/PATCH /api/v1/cms`, `PATCH /api/v1/admin/verifications/:id` | Missing. No CMS table; verification is `psychologist_profiles.approval_status`. |

Do not implement these in this task (initial UI only).

## 3. Field Map (Frontend Mock → Backend Column, for Future Wiring)

- Bookings: `BookingRequest.id` → `appointments.appointment_id`; `personaId` → `persona_id`; `psychologistId` → `psychologist_id`; `pricePhp` → `price`; `selectedSlotId` → `selected_slot_id`; `status: pending / proposed / paid-confirmed / cancelled` → backend `status` string (frontend has 2 extra UI states: `reschedule-requested`; backend has no enum constraint).
- Slots: frontend `ProposedSlot.id / isoDateTime / slotNumber 1|2|3` → backend `slot_id / session_date + start_time (+end_time)`; official rule “exactly 3 rows per proposal” is enforced in UI (`proposalFormSchema` distinct-slots check) and must later be enforced server-side.
- Payments: frontend pay-success (`paidAt`, `contactUnlocked`, reminders `scheduled`) → backend `payments(amount, payment_method?, status, paid_at)`; `amount` ↔ `pricePhp`; method enum (`card_visa_4242 / gcash_paymongo_mock / maya_stripe_mock`) is mock-only.
- Personas: frontend `Persona.id / clientId / type self|dependent / label / ageGroup / relationshipToClient / preferredLanguage` → backend `persona.persona_id / client_id / full_name` only; extra UI fields have no backend column yet.
- Intake: frontend `concernsSummary / specificNeeds / preferredLanguage / serviceId` → backend `forms(persona_id)` only (content columns missing).
- Roster: frontend `ResidentPsychologist.id RP-01.. / anonymizedTitle / prcCredentialCode / verificationStatus verified|waiting_approval / visibleOnPublicRoster` → backend `psychologist_id (FK users) / full_name / liscence_number [typo] / specialization / approval_status / approved_by / approved_at`; no `visibleOnPublicRoster` column; IDs are UUIDs, not `RP-01`.
- Users/auth: frontend mock role switch → backend `users(user_id, cognito_sub unique, email, role)`; official Cognito Groups verification is future backend work.
- CMS/testimonials: frontend-only mock (`vision / mission / clinicOverview / impactMetrics / testimonialsConfig` with consent flags); no backend table.

## 4. Frontend-Fits-Backend Rules Already Applied in UI

- Roster uses anonymized codes (`RP-01`), hidden-until-verified, unverified `RP-04` blocked from pick-up — matches `approval_status` gate.
- No personal names/quotes in docs or UI mocks (consent-flag empty cards).
- Contact unlock + reminders only on pay success; tiered redaction (`privateClinicalNote` hidden from client/admin in `getBookingsForRole`/`getBookingById`).
- Service durations/guardrails match `docs/services-catalog.md`.

## 5. Explicit Non-Goals (This Task)

- No new backend routes, models, migrations, or auth code.
- No Stripe/Cognito/Payload wiring; payment methods and CMS edits stay in-memory.
- No `image1-8` recovery; sitemap/services deck detail stays in `site-map.md` / `services-catalog.md`.

## 6. Per-Endpoint Spec (For Backend Implementers)

Conventions for every row below: `api.ts` function → HTTP method + path the UI calls; Auth = required Cognito Group; Request = JSON body the UI sends (with Zod schema + backend column mapping); Success = JSON the UI consumes; Errors = status + UI behavior. UI-only fields (form acknowledgements, mock toggles) are flagged and must NOT become backend columns. Mock IDs in the UI (`BK-2026-*`, `RP-01`, `persona-self-01`) are placeholders; real IDs are UUIDs per backend models.

### 6.1 Services

- `getServices` → `GET /api/v1/services`. Auth: public. Request: none. Success: `ServiceItem[]` (`id / indexNumber / title / categoryGroup / durationLabel / durationMinutes / guardrailTitle / guardrailNotice / description / clinicalFormat / isStandaloneConsultation?`). Backend: no services table today — owner decides (new table vs Payload CMS read-through). Errors: 5xx → UI keeps last-known list (mock fallback).
- `updateServiceGuardrail` → `PATCH /api/v1/services/:serviceId`. Auth: admin. Request: `{ durationLabel, guardrailTitle, guardrailNotice, description }` (all strings; durations like `45 mins`, `1 hr (60 mins)`, `1.5 hrs (90 mins)`, `2 hrs (120 mins)` per `services-catalog.md`). Success: updated `ServiceItem[]`. Errors: 403 non-admin; 404 unknown service id; 422 empty guardrail text.

### 6.2 Roster & Verification

- `getRoster(includeHiddenForAdmin)` → `GET /api/v1/roster`. Auth: public (filtered) vs admin (full). Request: none (`includeHiddenForAdmin` is a UI-side filter today). Success: `ResidentPsychologist[]` (`id / anonymizedTitle / prcCredentialCode / specialization / serviceEligibility[] / languages[] / yearsPractice / verificationStatus: verified|waiting_approval / visibleOnPublicRoster / assignedBookingsCount`). Backend mapping: `psychologist_id (UUID, FK users) / full_name / liscence_number [typo — see §7.2] / specialization / approval_status / approved_by / approved_at`; `visibleOnPublicRoster`, `anonymizedTitle`, `prcCredentialCode` format, `serviceEligibility`, `languages`, `yearsPractice`, `assignedBookingsCount` have no columns yet. Errors: 5xx → UI keeps mock roster.
- `updatePsychologistVerification` → `PATCH /api/v1/admin/verifications/:psychId`. Auth: admin. Request: `{ verificationStatus?: verified|waiting_approval, visibleOnPublicRoster?: boolean }` (partial; at least one key). Success: updated roster row. Errors: 403 non-admin; 404 unknown psychologist; 422 invalid status value.

### 6.3 Personas

- `getPersonas` → `GET /api/v1/personas`. Auth: client (own `clientId` only). Success: `Persona[]` (`id / clientId / type: self|dependent / label / ageGroup / relationshipToClient / preferredLanguage / createdAt`). Backend mapping: `persona_id / client_id / full_name` only — `type`, `label`, `ageGroup`, `relationshipToClient`, `preferredLanguage` need new columns or a companion profile (see §7.3).
- `createPersona` → `POST /api/v1/personas`. Auth: client. Request: `personaSchema` (`type / label 3–60 chars / ageGroup / relationshipToClient 2+ chars / preferredLanguage 2+ chars`; UI tolerates partial input with safe defaults). Success: created `Persona` with server `id/clientId/createdAt`. Errors: 401 unauthenticated; 422 schema failure (label too short, missing age group).

### 6.4 Bookings — Intake & Queue

- `getBookingsForRole(role, psychologistId)` → `GET /api/v1/bookings?role=client|psychologist|admin&psychId=`. Auth: per role. Success: `BookingRequest[]` filtered server-side — client: own `clientId` only with `privateClinicalNote` stripped; psychologist: `status=pending` queue rows plus rows where `psychologist_id` = caller; admin: all rows metadata-only with `privateClinicalNote` stripped. Errors: 403 cross-client/psychologist access.
- `getBookingById` → `GET /api/v1/bookings/:bookingId`. Auth: role-scoped as above (`privateClinicalNote` only for assigned psychologist). Success: `BookingRequest | null`. Errors: 404 unknown id; 403 unassigned psychologist / other client.
- `submitIntakeRequest` → `POST /api/v1/bookings/intake`. Auth: client. Request: `intakeFormSchema` minus UI-only `guardrailAcknowledged` → `{ personaId / serviceId / preferredLanguage / concernsSummary 20–1200 chars / specificNeeds 5–600 chars }`. Success: `BookingRequest` with `status=pending`, empty `proposedSlots`, `contactUnlocked=false`, reminders `pending/pending`. Backend mapping: `appointments(persona_id, status=pending)` + `forms(persona_id)`; `concernsSummary/specificNeeds/preferredLanguage/serviceId` have no `forms` content columns yet (see §7.3). Errors: 401; 422 intake too short / unknown persona or service.

### 6.5 Bookings — Proposal, Payment, Lifecycle

- `pickUpAndProposeSlots` → `POST /api/v1/bookings/:bookingId/propose`. Auth: psychologist, must be verified. Request: `proposalFormSchema` + ids → `{ bookingId / psychologistId / pricePhp 500–25000 / slot1DateTime / slot2DateTime / slot3DateTime (ISO, all distinct) / clinicalPrepNote 10–500 chars }`. Success: booking `status=proposed`, `psychologist_id` set, `price` set, exactly 3 `proposed_slots` rows (`slotNumber 1|2|3`, `isoDateTime` → `session_date + start_time/end_time` from service `durationMinutes`). Errors: 403 unverified psychologist (guardrail); 404 unknown booking; 409 already picked-up by another psychologist; 422 non-distinct slots / price out of range.
- `confirmSlotAndPay` → `POST /api/v1/bookings/:bookingId/pay`. Auth: client (own booking). Request: `{ bookingId / selectedSlotId }` plus UI-only `paymentMethodLabel` (`card_visa_4242 / gcash_paymongo_mock / maya_stripe_mock`, mock-only) and `acknowledgeFinalizationRule` (UI-only) and `simulateFailure` (mock-only test toggle). Success: `status=paid-confirmed`, `selected_slot_id` set, `payments(amount=price, status=paid, paid_at)` written, `contactUnlocked=true` with `unlockedContact { teletherapyUrl / coordinationEmail=psychaveph.info@gmail.com / sessionReferenceCode / emergencyProtocolNote }`, reminders `scheduled/scheduled`. Finalization is payment-gated: nothing unlocks on failure. Errors: 402 payment declined (booking stays `proposed`, contact locked); 404 unknown booking/slot; 409 already finalized; 422 `selectedSlotId` not one of the 3 proposed.
- `updateBookingLifecycleStatus` → `PATCH /api/v1/bookings/:bookingId/lifecycle`. Auth: role-scoped (client owns booking; psychologist assigned; admin announcements). Request: `{ bookingId / action: cancel | request-reschedule | dispatch-reminders }`. Success: `cancel → status=cancelled`; `request-reschedule → status=reschedule-requested`; `dispatch-reminders → reminders=dispatched/dispatched`. Errors: 403 unauthorized role; 404 unknown booking; 409 illegal transition (e.g. cancel after `paid-confirmed` per policy decision in §7.5).
- `updatePrivatePsychNote` → `PATCH /api/v1/bookings/:bookingId/private-note`. Auth: assigned psychologist only. Request: `{ bookingId / privateClinicalNote }`. Success: note stored, never returned to client/admin tiers. Errors: 403 all other roles.

### 6.6 CMS

- `getCmsContent` → `GET /api/v1/cms`. Auth: public (published copy). Success: `CmsContent` (`vision / mission / clinicOverview / impactNarrative / impactMetrics[] / testimonialsConfig { sectionTitle / consentFlagBanner / ethicalStandardRef / emptyCards[] }`). Backend: no CMS tables today — owner confirms Payload-owned vs DB tables (see §7.6).
- `updateCmsContent` → `PATCH /api/v1/cms`. Auth: admin. Request: partial `CmsContent` validated by `cmsOverviewSchema` (vision/mission 20+, overview 30+, impact 20+, consent banner required). Success: merged `CmsContent`. Errors: 403 non-admin; 422 validation failure. Consent rule: testimonial cards stay structural (no personal quotes/names) regardless of CMS input.

## 7. Backend Implementation Order (Checklist For Owners)

- [ ] **7.1 Auth first.** Cognito Groups (`client / psychologist / admin`) verified on every request; map to `users(role, cognito_sub)`. NOTE: teammate-slimmed `backend/requirements.txt` removed `python-jose` (+ `cryptography`, `rsa`, `ecdsa`) — owner must re-add a JWT verifier or choose a replacement before this step. Done when: unauthenticated calls 401; wrong-group calls 403; `role`/`psychId` query params are derived from the token, not trusted client input.
- [ ] **7.2 Roster verification.** Implement `PATCH /admin/verifications/:id` on `psychologist_profiles(approval_status, approved_by, approved_at)`; decide the `liscence_number` typo fix (rename needs migration); decide where `visibleOnPublicRoster`, anonymized display codes, languages, and service eligibility live. Done when: unverified psychologists get 403 on pick-up; public roster hides unapproved rows.
- [ ] **7.3 Personas + intake content.** Add missing persona detail columns (or companion table) and `forms` content columns for `concernsSummary/specificNeeds/preferredLanguage/serviceId`; enforce `personaSchema`/`intakeFormSchema` limits server-side. Done when: `POST /personas` and `POST /bookings/intake` round-trip without data loss in real (non-mock) mode.
- [ ] **7.4 Queue + propose-3.** Implement pending-queue scope (which psychologists see which pending rows), pick-up race rule (first verified pick-up wins → 409 for others), and exactly-3 distinct slots + price range enforcement mapping ISO datetimes to `session_date/start_time/end_time` via service durations. Done when: two psychologists racing one request yields one `proposed` + one 409.
- [ ] **7.5 Pay-gated finalization + lifecycle.** Implement `payments` write, `selected_slot_id` set, contact unlock, reminders scheduling, and the `cancel / request-reschedule / dispatch-reminders` transitions (including the cancel-after-paid policy). Done when: failed payment leaves booking `proposed` with contact locked; success flips to `paid-confirmed` exactly once (idempotent on retry).
- [ ] **7.6 Redaction + CMS.** Enforce `privateClinicalNote` visibility (assigned psychologist only) in both single and list reads; confirm CMS ownership (Payload vs new tables) for services/roster-structure/testimonials/Vision/Mission/Clinic Overview. Done when: client/admin payloads never contain private notes; CMS edits persist.

## 8. Flip-to-Real Runbook (When Backend Is Ready)

1. Point the UI at the real API: set `NEXT_PUBLIC_API_URL` to the dev backend URL and `NEXT_PUBLIC_AUTH_MODE` to the real mode agreed with backend owners (mock header switcher is then bypassed by real Cognito tokens). Restart: `npm run dev`.
2. Confirm mocks are off: `api.ts` `requestWithMockFallback` should return live JSON (short-timeout fallback only triggers when the backend is unreachable). Check browser network tab for real `/api/v1/*` calls.
3. Smoke in §7 order: submit intake → queue visible to psychologist → pick-up + 3 slots → client selects 1 + pays → paid-confirmed + contact unlock → reminders dispatch. While endpoints are still missing, expect 404s with mock fallback — owners check off §7 rows as each turns green.
4. Rollback any time: set `NEXT_PUBLIC_AUTH_MODE=mock` and restart — full offline prototype returns.
