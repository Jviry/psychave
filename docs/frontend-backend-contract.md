# Frontend ↔ Backend Contract

> Status: operational data is live and authenticated. CMS and the public marketing roster are local-only because no backend table exists yet.

## 1. Runtime Contract (Current)

- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- `frontend/lib/api.ts` calls the backend directly; there is no mock mode, offline fallback, or role-switcher bypass.
- Auth always uses Cognito via `/auth/login`. Dashboard access is enforced by `RoleGate` in the UI and by the backend token/role dependencies.
- `GET /services/active` is public so the marketing home page loads before login. Auth flows, `/health`, and the payment webhook are public by necessity; every other endpoint requires a valid Cognito token, and `/admin/*` requires the `admin` group.
- Routing is native Next.js App Router (`next/link` + `next/navigation` `useRouter`/`usePathname`/`useParams`).

## 2. Endpoint Map (Frontend Uses → Backend)

| Frontend call | Backend |
|---|---|
| `GET /services/active` | Public active catalog. |
| `GET /services` | Public active catalog. |
| `POST /auth/*` | Cognito login, register, confirm, refresh, logout, password reset. |
| `GET/POST /personas`, `GET /personas/:id/review` | Authenticated persona and consent records. |
| `POST /appointments`, `GET /appointments`, `GET /appointments/:id` | Client/psychologist appointment reads and booking intake (with 3–5 client `preferred_slots`). |
| `GET /appointments/pending`, `GET /appointments/mine`, `POST /appointments/:id/pickup`, `POST /appointments/:id/accept-preferred-slot`, `POST /appointments/:id/counter-offer` | Psychologist queue (with `conflicting_slot_ids`), atomic pickup (`slot_id` or `counter_slot`), and multi-round schedule review. |
| `POST /appointments/:id/accept-slot`, `POST /appointments/:id/preferred-slots`, `POST /appointments/:id/payment`, `POST /appointments/:id/complete`, `DELETE /appointments/:id` | Client schedule negotiation, payment-gated finalization, completion, cancellation. |
| `GET/PATCH /psychologist-profile/me` | Authenticated psychologist profile. |
| `GET /admin/users`, `PATCH /admin/users/:id/role`, `POST /admin/users/:id/promote` | Admin-only user directory and role changes. |
| CMS (`getCmsContent`, `updateCmsContent`, `getRoster`, `updateServiceGuardrail`) | Local-only marketing preview. Not sent to the backend. |

## 3. Field Map (Frontend → Backend Column)

- Bookings: `BookingRequest.id` → `appointments.appointment_id`; `personaId` → `persona_id`; `psychologistId` → `psychologist_id`; `pricePhp` → `price`; `selectedSlotId` → `selected_slot_id`; `schedulingTurn` → `scheduling_turn` (`client | psychologist | null`); `schedulingRound` → `scheduling_round`; `paymentDeadline` → `payment_deadline`; `status: pending / awaiting-review / awaiting-client / awaiting-payment / paid-confirmed / completed / cancelled` → derived from backend `status` (`pending / awaiting_schedule / awaiting_payment / confirmed / completed / cancelled`) + `scheduling_turn`.
- Slots: frontend `ProposedSlot` (`id / slotNumber / isoDateTime / endIsoDateTime / proposedBy / status / round`) → backend `proposed_slots` (`slot_id / session_date / start_time / end_time / proposed_by / status / round`). Clients submit 3–5 distinct future preferred schedules (`proposed_by=client`); psychologists either accept one or offer 1 alternative (`proposed_by=psychologist`), enforced in both Zod (`bookingFormSchema`) and backend (`utils/scheduling.py`).
- Payments: frontend pay-success (`paidAt`, `contactUnlocked`, reminders `scheduled`) → backend `payments(amount, payment_method?, status, paid_at)`; `amount` ↔ `pricePhp`; method enum (`card_visa_4242 / gcash_paymongo_mock / maya_stripe_mock`) is mock-only.
- Personas: frontend `Persona.id / clientId / type self|dependent / label / ageGroup / relationshipToClient / preferredLanguage` → backend `persona.persona_id / client_id / full_name` only; extra UI fields have no backend column yet.
- Booking: frontend `concernsSummary / specificNeeds / preferredLanguage / serviceId` → backend `forms(persona_id)` only (content columns missing).
- Roster: frontend `ResidentPsychologist.id RP-01.. / anonymizedTitle / prcCredentialCode / visibleOnPublicRoster` → backend `psychologist_id (FK users) / full_name / license_number / specialization / bio / social_media_links`. Approval metadata was removed; admin promotion replaces it. The public roster remains a local marketing payload until a backend roster endpoint exists.
- Users/auth: backend `users(user_id, cognito_sub unique, email, role)`; Cognito Groups (`client` / `psychologist` / `admin`) are the access source of truth. Signup is client-only; admins promote clients via `/admin/users/:id/promote`.
- CMS/testimonials: frontend-only mock (`vision / mission / clinicOverview / impactMetrics / testimonialsConfig` with consent flags); no backend table.

## 4. Frontend-Fits-Backend Rules Already Applied in UI

- Local marketing roster uses anonymized codes (`RP-01`). Live psychologist access is granted by admin promotion, with no separate approval status.
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

- `getPublicServices` → `GET /services/active` (public) and `getServices` → `GET /services` (public). Success: `ServiceItem[]` (`id / indexNumber / title / categoryGroup / durationLabel / durationMinutes / guardrailTitle / guardrailNotice / description / clinicalFormat / isStandaloneConsultation?`). Errors: surface the backend message to the UI.
- `updateServiceGuardrail` → `PATCH /api/v1/services/:serviceId`. Auth: admin. Request: `{ durationLabel, guardrailTitle, guardrailNotice, description }` (all strings; durations like `45 mins`, `1 hr (60 mins)`, `1.5 hrs (90 mins)`, `2 hrs (120 mins)` per `services-catalog.md`). Success: updated `ServiceItem[]`. Errors: 403 non-admin; 404 unknown service id; 422 empty guardrail text.

### 6.2 Roster & Psychologist Promotion

- `getRoster(includeHiddenForAdmin)` is a local marketing helper, not a backend request. Success: `ResidentPsychologist[]` (`id / anonymizedTitle / prcCredentialCode / specialization / serviceEligibility[] / languages[] / yearsPractice / visibleOnPublicRoster`). `psychologist_profiles` stores the real profile (`psychologist_id`, `full_name`, `license_number`, `specialization`, `bio`, `social_media_links`); a public roster endpoint is future work.
- `getAdminUsers({search, role, page, pageSize})` → `GET /admin/users?search=&role=&page=&page_size=`. Auth: admin. Success: `{items: AdminUser[], total, page, page_size}` where `AdminUser = {user_id, email, role, full_name, created_at}`. Search matches email plus psychologist/admin names; `role` is optional; `page_size` is capped at 100. UI types live in `lib/types.ts` (`AdminUser`, `AdminUserPage`) and are mapped at the API boundary.
- `updateAdminUserRole(userId, {role, fullName})` → `PATCH /admin/users/:id/role`. Auth: admin. Request: `{role: client|psychologist|admin, full_name?}`. `full_name` is required when assigning psychologist without an existing profile name. Success: updated `AdminUser`. Errors: 403 non-admin; 404 unknown user/Cognito account; 409 self-change, last-admin demotion, or same-role conflict; 422 missing psychologist name.
- Admin role changes replace the removed credential-approval flow: `GET /admin/users?search=` to find the account, then either `PATCH /admin/users/:id/role` or `POST /admin/users/:id/promote` with `{ full_name (required), license_number?, specialization?, bio?, social_media_links? }`. Both swap the Cognito group, update `users.role`, and create/update the profile. Errors: 403 non-admin; 404 unknown user/Cognito account; 409 self-change/last-admin/not a client or already a psychologist.

### 6.3 Personas

- `getPersonas` → `GET /api/v1/personas`. Auth: client (own `clientId` only). Success: `Persona[]` (`id / clientId / type: self|dependent / label / ageGroup / relationshipToClient / preferredLanguage / createdAt`). Backend mapping: `persona_id / client_id / full_name` only — `type`, `label`, `ageGroup`, `relationshipToClient`, `preferredLanguage` need new columns or a companion profile (see §7.3).
- `createPersona` → `POST /api/v1/personas`. Auth: client. Request: `personaSchema` (`type / label 3–60 chars / ageGroup / relationshipToClient 2+ chars / preferredLanguage 2+ chars`; UI tolerates partial input with safe defaults). Success: created `Persona` with server `id/clientId/createdAt`. Errors: 401 unauthenticated; 422 schema failure (label too short, missing age group).

### 6.4 Bookings — Booking & Queue

- `getBookingsForRole(role)` → client calls `GET /appointments`; psychologist calls `GET /appointments/pending` + `GET /appointments/mine` (`PendingAppointmentRead` includes per-psychologist `conflicting_slot_ids`). Auth: derived strictly from the Cognito token.
- `getBookingById` → `GET /appointments/:bookingId`. Auth: role-scoped (`404` for unassigned psychologists or other clients).
- `submitBookingRequest` → `POST /appointments`. Auth: client. Request: `{ persona_id, service_id, presenting_concern, preferred_slots: [{ session_date, start_time }] (3..5) }`. Success: `BookingRequest` with `status=pending`, 3–5 `proposedSlots` (`proposedBy='client'`, `round=1`), `contactUnlocked=false`. Errors: 401; 404 unknown persona; 400/422 duplicate/past/cross-midnight or out-of-range preferred schedules.

### 6.5 Bookings — Atomic Pickup, Schedule Negotiation, Payment, Lifecycle

- `pickUpBooking` → `POST /appointments/:bookingId/pickup`. Auth: promoted psychologist (with ≥1 social media link). Request: `{ price, slot_id? | counter_slot?: { session_date, start_time } }` (exactly one of `slot_id` or `counter_slot`). Success: if `slot_id`, moves atomically to `awaiting_payment` with `selected_slot_id` and `payment_deadline`; if `counter_slot`, moves atomically to `awaiting_schedule` (`scheduling_turn='client'`, `scheduling_round=2`). Errors: 403 non-psychologist; 404 unknown booking; 409 already claimed or overlaps psychologist's held/confirmed session; 422 missing social media link or invalid slot/price.
- `acceptPreferredSlot` / `counterOffer` → `POST /appointments/:id/accept-preferred-slot` (`{ slot_id }`) and `POST /appointments/:id/counter-offer` (`{ session_date, start_time }`). Auth: assigned psychologist when `status=awaiting_schedule` and `scheduling_turn='psychologist'`.
- `acceptCounterSlot` / `replacePreferredSlots` → `POST /appointments/:id/accept-slot` (`{ slot_id }`) and `POST /appointments/:id/preferred-slots` (`{ slots: [{ session_date, start_time }] (3..5) }`). Auth: owning client when `status=awaiting_schedule` and `scheduling_turn='client'`.
- `payBooking` → `POST /appointments/:id/payment` (`{}`). Auth: client (own booking in `awaiting_payment` before `payment_deadline`). Success: the appointment becomes `confirmed` after the provider webhook marks the active pending payment paid; contact unlocks only then. If `payment_deadline` expires before payment completes, the held slot becomes `expired`, pending checkouts are marked `failed`, and the booking returns to `awaiting_schedule` (`scheduling_turn='client'`) for fresh preferred schedules.
- `cancelBooking` / `completeAppointment` → `DELETE /appointments/:id` (client, pre-confirmation) and `POST /appointments/:id/complete` (assigned psychologist, `confirmed` → `completed`).

### 6.6 CMS

- `getCmsContent` → `GET /api/v1/cms`. Auth: public (published copy). Success: `CmsContent` (`vision / mission / clinicOverview / impactNarrative / impactMetrics[] / testimonialsConfig { sectionTitle / consentFlagBanner / ethicalStandardRef / emptyCards[] }`). Backend: no CMS tables today — owner confirms Payload-owned vs DB tables (see §7.6).
- `updateCmsContent` → `PATCH /api/v1/cms`. Auth: admin. Request: partial `CmsContent` validated by `cmsOverviewSchema` (vision/mission 20+, overview 30+, impact 20+, consent banner required). Success: merged `CmsContent`. Errors: 403 non-admin; 422 validation failure. Consent rule: testimonial cards stay structural (no personal quotes/names) regardless of CMS input.

## 7. Backend Implementation Order (Checklist For Owners)

- [ ] **7.1 Auth first.** Cognito Groups (`client / psychologist / admin`) verified on every request; map to `users(role, cognito_sub)`. NOTE: teammate-slimmed `backend/requirements.txt` removed `python-jose` (+ `cryptography`, `rsa`, `ecdsa`) — owner must re-add a JWT verifier or choose a replacement before this step. Done when: unauthenticated calls 401; wrong-group calls 403; `role`/`psychId` query params are derived from the token, not trusted client input.
- [x] **7.2 Roster promotion (replaces verification).** Admin-only `GET /admin/users` + `POST /admin/users/:id/promote` implemented; `approval_status` / `approved_by` / `approved_at` removed by migration. Promotion requires only `full_name`. Remaining: decide where `visibleOnPublicRoster`, anonymized display codes, languages, and service eligibility live. Done when: public roster lists promoted psychologists and non-psychologists get 403 on pick-up.
- [ ] **7.3 Personas + booking content.** Add missing persona detail columns (or companion table) and `forms` content columns for `concernsSummary/specificNeeds/preferredLanguage/serviceId`; enforce `personaSchema`/`bookingFormSchema` limits server-side. Done when: `POST /personas` and `POST /bookings/intake` round-trip without data loss in real (non-mock) mode.
- [ ] **7.4 Queue + propose-3.** Implement pending-queue scope (which psychologists see which pending rows), pick-up race rule (first psychologist pick-up wins → 409 for others), and exactly-3 distinct slots + price range enforcement mapping ISO datetimes to `session_date/start_time/end_time` via service durations. Done when: two psychologists racing one request yields one `proposed` + one 409.
- [ ] **7.5 Pay-gated finalization + lifecycle.** Implement `payments` write, `selected_slot_id` set, contact unlock, reminders scheduling, and the `cancel / request-reschedule / dispatch-reminders` transitions (including the cancel-after-paid policy). Done when: failed payment leaves booking `proposed` with contact locked; success flips to `paid-confirmed` exactly once (idempotent on retry).
- [ ] **7.6 Redaction + CMS.** Enforce `privateClinicalNote` visibility (assigned psychologist only) in both single and list reads; confirm CMS ownership (Payload vs new tables) for services/roster-structure/testimonials/Vision/Mission/Clinic Overview. Done when: client/admin payloads never contain private notes; CMS edits persist.

## 8. Flip-to-Real Runbook (When Backend Is Ready)

1. Set `NEXT_PUBLIC_API_URL` to the backend URL, ensure PostgreSQL is running, and run the Alembic migrations/seeds. Restart: `npm run dev`.
2. Log in with a real Cognito account. Check the browser network tab for authenticated requests; an absent/invalid token returns 401.
3. Smoke in order: public catalog → submit booking → queue visible to psychologist → pick-up + 3 slots → client selects 1 + pays → paid-confirmed + contact unlock → completion.
4. Admin smoke: `GET /admin/users` without a token returns 401; with an `admin` token it returns the paginated directory. Role changes require the admin group, cannot target the caller, and cannot demote the last admin.
5. CMS remains a local preview until a CMS backend is implemented; it is not part of the auth/API smoke test.
