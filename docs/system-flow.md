# System Flow — PsychAvenuePH (Canonical: Official Queue Flow)

> Flow Conflict: See at system-flow-conflict.md
> Note: Flow A (Admin-Guided: admin assigns psychologist, pay-then-schedule) is retained as legacy in `system-flow-conflict.md`. It is **not** canonical.

## Overview

This document describes the **official canonical booking & coordination flow** for PsychAvenuePH.

**Canonical choice: Official Queue Flow (Flow C) — Client-Initiated Booking → Psychologist Pick-Up with 3 proposed times → Client selects 1 + pays to finalize.**

Source: revised official plan pasted 2026-09-27 (supersedes Flow A). Deck additions (`site-map.md`, `services-catalog.md`) still apply; personal names/quotes stay out of docs.

Related docs:
- `overview.md` — project objective, target users/roles
- `requirements.md` — core features, guardrails
- `system-flow-conflict.md` — Flow A (legacy admin-assign) vs Flow B vs Flow C
- `site-map.md` — public page tree + permanent external Book-a-session fallback
- `services-catalog.md` — service durations/descriptions

---

## Official Flow — Client-Initiated Queue (Canonical)

### C.1 Psychologist Directory View

- A list of available psychologists where clients can view each one's specialization, spoken languages, and general availability.
- Psychologist accounts remain hidden from the public roster and cannot pick up appointment requests until the System Administrator manually reviews and approves their credentials.

### C.2 Steps

**Step 1 — Profile Selection & Booking**

- The client initiates booking by selecting a Patient Profile (Persona) — themselves or a dependent.
- Client completes booking form (personal info, primary concerns, specific needs).
- Model mapping: `users -> client_profiles -> persona -> forms`.

**Step 2 — Request Submission & Routing**

- Upon submission, the system logs the appointment request as `appointments(status=pending)`.
- Official text keeps two routing statements: booking forms go to the admin dashboard for preliminary assessment, and the request enters a pending queue visible to available psychologists.
- Available psychologists are notified of the new pending request (email/in-app). Admin submission alert is legacy Flow A behavior; official alert target is psychologists.

**Step 3 — Psychologist Pick-Up & Proposal**

- A psychologist picks up a pending request, sets the session price, and proposes exactly 3 candidate date/time options.
- Model mapping: `appointments.psychologist_id` set by pick-up actor; `appointments.price` set here; 3 rows in `proposed_slots` per `appointment_id`.
- Gate: unverified psychologists cannot pick up.

**Step 4 — Client Selection & Payment**

- Client reviews the 3 proposed times, selects one (`appointments.selected_slot_id`), and completes payment.
- Appointment is only finalized once payment succeeds (`payments(status=paid)` → `appointments(status=paid/confirmed)`).
- Order: **schedule-then-pay**.

**Step 5 — Notifications**

- New Request Alerts → available psychologists on queue entry.
- Slot Proposal Alert → client by email/in-app to select + pay.
- Payment Confirmation → both client and psychologist; session locked in.
- Automated Reminders: SMS/email/in-app 24h and 1h before session.
- Status Updates: real-time for cancellations, rescheduling, admin announcements.

**Step 6 — Confirmation & Connection**

- Once payment is verified, system finalizes booking and unlocks psychologist's direct contact info for the client.
- Both parties receive final confirmation for coordination.

### C.3 Text Diagram (Official)

```text
Client selects Persona + completes Booking Form (forms)
  -> Submits Request (appointments: pending) -> pending queue (+ admin preliminary view)
  -> Available psychologists notified
  -> Psychologist picks up (psychologist_id) + sets price + proposes 3 slots (proposed_slots x3)
  -> Client notified (proposal ready)
  -> Client selects 1 of 3 (selected_slot_id) + pays (payments: pending -> paid)
  -> Finalized only on payment success -> contact unlock + confirmations + 24h/1h reminders
```

### C.4 Roles (Official)

- **Patients (Clients):** Search verified psychologists, book/manage across all linked personas, view services, receive proposal/payment/reminder notifications. Own booking history only.
- **Psychologists (Providers):** View pending queue (if verified), pick up requests, set price, propose 3 times, manage own schedules. Only schedules/details of clients/personas booked under them.
- **System Administrator (Admin):** Verify credentials (unhide roster + enable pick-up), manage user roles / approvals / CMS content. No access to private consultation details or session notes.
- **Authentication:** AWS Cognito; role membership (client / psychologist / admin) via Cognito Groups, verified on every request.

### Flow A note (legacy, where appropriate)

- Flow A differed: request → admin dashboard → admin assigns psychologist → email payment link → pay → pick schedule (pay-then-schedule, admin assigns).
- Retained in `system-flow-conflict.md` for traceability. Do not implement alongside Flow C.

---

## Placeholders for Missing Diagrams

- Original `image1`-`image8` (table design, workflow) were base64 blobs, not recoverable. See Miro ERD / Canva links in `project-management.md`.
- Deck sitemap screenshots are transcribed in `site-map.md`; do not re-embed.

---

## Sources

- Official revised plan (2026-09-27 paste): INTRODUCTION, TARGET USERS, CORE FEATURES #1-4 (queue + 3-slot + Cognito Groups).
- Deck: `site-map.md`, `services-catalog.md` (structure/services only; no personal names).
