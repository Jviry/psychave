# Requirements — PsychAvenuePH (Official)

> Canonical flow: Official Queue Flow (Flow C) in `system-flow.md`. Flow A (admin-assign) is legacy; see `system-flow-conflict.md`.

## 1. Appointment & Scheduling System

### 1.1 Psychologist Directory View

- A list of available psychologists where clients can view each one's specialization, spoken languages, and general availability.

### 1.2 Client-Initiated Booking Workflow (Official — Flow C)

- A client submits a booking request, optionally on behalf of a specific persona under their account (e.g. themselves or a dependent).
- The request enters a pending queue visible to available psychologists.
- Official routing note: booking forms are also routed to the admin dashboard for preliminary assessment. Pending-queue visibility is the normative path; admin view is preliminary (read-only unless specified).
- See `system-flow.md` for step-by-step. Flow A (admin assigns) is legacy; see `system-flow-conflict.md`.

### 1.3 Psychologist Pick-Up & Proposal (Official)

- A verified psychologist picks up a pending request, sets the session price, and proposes exactly 3 candidate date/time options.
- Gate: hidden roster + no pick-up until admin approves credentials.

### 1.4 Client Selection & Payment (Official)

- The client reviews the 3 proposed times, selects one, and completes payment to confirm the session.
- The appointment is only finalized once payment succeeds.

### 1.5 Booking / Personas / Forms

- Client selects a Patient Profile (Persona) — self or dependent.
- Each persona has forms the client must complete (personal info, concerns, appointment details).
- System records request and forwards booking for review.
- Explicit requirement mentions: Admin Page, Psychology dashboard, Payment Gateway, Calendar.

## 1.6 Book a Session (External, Permanent Fallback)

- Deck specifies `Book a session` as external content only: Facebook page + `Email us to set an appointment psychaveph.info@gmail.com`.
- Treat as permanent fallback alongside official in-app queue flow. See `site-map.md`.

## 2. Notification & Reminder (Official)

- **New Request Alerts:** Available psychologists notified when a new booking request enters the pending queue.
- **Slot Proposal Alert:** Client notified by email/in-app once a psychologist has proposed session times; prompt to select one and pay.
- **Payment Confirmation:** Both client and psychologist receive confirmation once payment is processed and the session is locked in.
- **Automated Reminders:** SMS, email, or in-app alerts 24h and 1h before session.
- **Status Updates:** Real-time notifications for cancellations, rescheduling, or administrative announcements.

## 3. Psychiatric Services & Information Hub

- **About PsychAvenuePH (Main Page):** Landing page introducing mission, purpose connecting clients with trusted local specialists, and overview of scheduling system. About Us children per sitemap: resident roster section, Vision & Mission (copy pending), Clinic Overview and Impact (copy pending). See `site-map.md`.
- **Doctor Profiles:** Roster section only in docs (individual profiles omitted). Each verified profile shows specialization, spoken languages, and general availability; visible publicly only after admin verification.
- **Service Catalog:** Canonical details live in `services-catalog.md` — Consultation 45min (screening, not full therapy), Individual 1hr, Couples 1.5hr (15-min breakouts), Family/Group 2hr (psychologist autonomy), Life Coaching (not a therapy substitute), Clinical Supervision (internal + external), Academic & Research (thesis supervision + data analysis, no full-write). Admin CMS manages catalog entries (official plan also lists teleconsultation / face-to-face / evaluations / prescription refills as examples; deck catalog is normative).
- **Testimonials:** Section exists per deck; personal quotes omitted from docs. CMS must support add/hide with consent flag.

## 4. Platform Security & Guardrails (Official)

- **Credential Verification Gate:** Psychologist accounts remain hidden from public roster and cannot pick up appointment requests until the System Administrator manually reviews and approves credentials.
- **Tiered Access Control:**
  - Clients can only view their own booking history across all personas linked to their account.
  - Psychologists can only access schedules and details of clients/personas booked under them.
  - Administrators manage user roles, psychologist approvals, and platform CMS content — without accessing private consultation details or session notes.
- **Authentication:** Identity and login via AWS Cognito; role membership (client / psychologist / admin) enforced through Cognito Groups and verified on every request.

## 5. Functional Requirements Summary (Official)

- FR-1: Client can submit booking for self or persona; booking forms recorded; request enters pending queue.
- FR-2: Verified psychologist can pick up pending request, set price, propose exactly 3 times. Unverified cannot pick up.
- FR-3: Client can review 3 proposals, select 1, complete payment; appointment finalized only on payment success.
- FR-4: System sends new-request → psychologists, proposal → client, payment confirmation → both; 24h/1h reminders; real-time status updates.
- FR-5: Psychologist sees only own picked-up/booked schedules; client sees only own history across personas.
- FR-6: Public sees landing, services, verified roster section only.
- FR-7: Admin verifies credentials to unhide roster + enable pick-up; manages roles/CMS without session-note access.
- FR-8: Auth via Cognito Groups verified per request.
- FR-9: Contact info unlock only after verified payment.
- FR-10: Public Book-a-session fallback shows Facebook link + `psychaveph.info@gmail.com` (permanent, external). See `site-map.md`.
- Legacy Flow A note: FR-2/FR-3 previously described admin review/assign + email pay link (pay-then-schedule). Superseded by FR-2/FR-3 above.

## 6. Non-Functional / Guardrails

- Secure handling of booking forms and consultation details per tiered access; no admin session-note access.
- Auditability of pick-up/approvals/assignments (currently missing in models — see conflict doc).
- Usability goal from Sept 9: make it easier for both client and admins; visible history; clinic info; easier booking/payment; calendar.

## Sources

Official revised plan 2026-09-27 (INTRODUCTION, TARGET USERS, CORE FEATURES #1-4), plus `Site Map & Details` deck (structure/services only; personal names and testimonial quotes omitted).
