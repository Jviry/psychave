# Requirements — PsychAvenuePH

## 1. Appointment & Scheduling System

### 1.1 Psychologist Directory View

- Straightforward list of all 5 psychologists.
- Each doctor shows: specialization, spoken languages, general availability.

### 1.2 Admin-Guided Booking Workflow (Canonical — Flow A)

- When a client submits a booking request, it is routed directly to the admin dashboard.
- Administrator reviews and approves the request, then assigns a specific psychiatrist/psychologist to the client.
- See `system-flow.md` for step-by-step. Conflict with psychologist-review variant is documented in `system-flow-conflict.md`.

### 1.3 Email Payment Link & Scheduling

- Upon admin approval, client receives direct email at registered account with payment link.
- Once payment is processed, client finalizes/selects consultation schedule on interactive calendar.

### 1.4 Intake / Personas / Forms

- Client selects a Patient Profile (Persona) — self or dependent.
- Each persona has forms the client must complete (personal info, concerns, appointment details).
- System records request and forwards intake for review.
- Explicit requirement mentions: Admin Page, Psychology dashboard, Payment Gateway, Calendar.

## 2. Notification & Reminder

- **Instant Booking & Payment Alerts:** Immediate notification to administrators on booking submission; email link to client once approved to proceed with payment/scheduling.
- **Automated Reminders:** SMS, email, or in-app alerts 24h and 1h before session to reduce no-shows.
- **Status Updates:** Real-time notifications for sudden schedule changes, cancellations, or admin announcements.
- Sept 9 note: Automated Email chain — waiting for approval → admin approval → payment.

## 3. Psychiatric Services & Information Hub

- **About PsychAvenuePH (Main Page):** Core landing page introducing mission, purpose in bridging patients with trusted local specialists, and overview of scheduling system.
- **Doctor Profiles:** Individual profiles displaying medical license number, sub-specialties (e.g., child psychiatry, trauma, anxiety), professional background.
- **Service Catalog:** Clear breakdown of services (e.g., teleconsultation, face-to-face clinic visits, psychological evaluations, prescription refills).

## 4. Platform Security & Guardrails

- **Credential Verification Gate:** Psychologist accounts remain hidden from public roster until System Administrator manually reviews/verifies medical credentials.
- **Tiered Access Control:**
  - Patients can only view their own booking history.
  - Psychologists can only access schedules/details of patients booked under them.
  - Administrators manage user roles and platform maintenance without accessing private consultation details.

## 5. Functional Requirements Summary

- FR-1: Client can create persona, complete intake forms, submit appointment request.
- FR-2: Admin can review/approve requests and assign psychologist (Flow A canonical).
- FR-3: System sends email payment link on approval; records payment transaction.
- FR-4: Client can select/confirm schedule slot; system marks appointment Paid/Confirmed.
- FR-5: Psychologist can view assigned schedules, propose/accept/modify bookings (see conflict doc for proposal ownership).
- FR-6: System sends 24h/1h reminders and real-time status updates.
- FR-7: Public can view landing, services, verified doctor profiles only.
- FR-8: Admin can verify psychologist credentials to unhide profile.
- FR-9: Contact info unlock only after verified payment (from Flow B Step 6 — keep unless explicitly dropped).

## 6. Non-Functional / Guardrails

- Secure handling of intake forms and consultation details per tiered access.
- Auditability of approvals/assignments (currently missing in models — see conflict doc).
- Usability goal from Sept 9: make it easier for both client and admins; visible history; clinic info; easier booking/payment; calendar.

## Sources

Condensed from `CORE FEATURES AND FUNCTIONALITIES`, `Requirements: Admin Page / Psychology dashboard / Payment Gateway / Calendar`, `System Flow Notes`, `Minutes Sept 9, 2026`.
