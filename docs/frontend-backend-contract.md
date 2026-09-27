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
