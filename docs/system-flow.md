# System Flow — PsychAvenuePH (Canonical: Official Queue Flow)

> Flow Conflict: See at system-flow-conflict.md
> Note: Flow A (Admin-Guided: admin assigns psychologist, pay-then-schedule) is retained as legacy in `system-flow-conflict.md`. It is **not** canonical.

## Overview

This document describes the **official canonical booking & coordination flow** for PsychAvenuePH.

**Canonical choice: Client-First Scheduling — Client submits intake + at least 3 preferred schedules → Psychologist picks up, accepts one preferred time or offers one nearest alternative → both agree → payment deadline → confirmed.**

Source: revised official plan pasted 2026-09-27 (supersedes Flow A), updated by the booking-process deck (client-first scheduling + payment deadline). Deck additions (`site-map.md`, `services-catalog.md`) still apply; personal names/quotes stay out of docs.

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
- Psychologist accounts are created when an administrator promotes an existing client and supplies their psychologist profile. Only promoted psychologists appear in the practitioner roster and can pick up appointment requests.

### C.2 Steps

**Step 1 — Profile Selection & Booking**

- The client initiates booking by selecting a Patient Profile (Persona) — themselves or a dependent.
- Client completes the intake form (primary concerns, specific needs) and submits **at least 3 preferred date/time schedules** (3–5 allowed).
- Model mapping: `users -> client_profiles -> persona -> forms`; preferred times are `proposed_slots` rows with `proposed_by=client`, `status=proposed`, `round=1`.

**Step 2 — Request Submission & Routing**

- Upon submission, the system logs the appointment request as `appointments(status=pending, scheduling_turn=null, scheduling_round=1)`.
- The request and all client-preferred schedules enter the pending queue visible to every verified psychologist.
- The queue annotates each preferred slot with per-psychologist conflicts (`conflicting_slot_ids`) using that psychologist's own `awaiting_payment` and `confirmed` appointments before pickup.
- Available psychologists are notified of the new pending request (email/in-app). Admin submission alert is legacy Flow A behavior; official alert target is psychologists.

**Step 3 — Psychologist Pick-Up & Schedule Agreement**

- In a single atomic pickup transaction, the first psychologist to claim the request sets `appointments.psychologist_id`, sets the session price, and either:
  - **accepts one client-preferred slot**, moving the appointment directly to `awaiting_payment` with `selected_slot_id` and `payment_deadline`, or
  - **offers exactly one nearest/earliest alternative**, moving the appointment to `awaiting_schedule` with `scheduling_turn=client` and `scheduling_round=2`.
- If the client later submits new preferred schedules (`scheduling_turn=psychologist`), the assigned psychologist reviews them on `My Schedule` using the dedicated `accept-preferred-slot` / `counter-offer` endpoints.
- Before accepting or countering, the backend rejects any time that overlaps the psychologist's own `awaiting_payment` or `confirmed` appointments (rolling back the pickup if triggered during Round 1).
- Gate: only accounts promoted by an administrator can pick up.

**Step 4 — Client Response & Payment Deadline**

- If the psychologist counters, the client accepts the alternative or submits a fresh set of 3–5 preferred schedules; the negotiation repeats until both sides agree.
- On agreement, the accepted slot becomes `selected_slot_id`, other slots in that round are `declined`, and the appointment moves to `awaiting_payment`.
- Payment deadline is `agreed_session_datetime - 24h`. If that is already past at agreement, the deadline is `min(agreed_session_datetime, now + 15 minutes)` and the UI shows “Pay now.”
- If payment is missed, the agreed slot is marked `expired`, `selected_slot_id` is cleared, and scheduling restarts from the client (`scheduling_turn=client`).

**Step 5 — Notifications**

- New Request Alerts → available psychologists on queue entry.
- Schedule Action Alert → client when a preferred time is accepted or an alternative is offered.
- Payment Confirmation → both client and psychologist; session locked in.
- Automated Reminders: SMS/email/in-app 24h and 1h before session.
- Status Updates: real-time for cancellations, rescheduling, admin announcements.

**Step 6 — Confirmation & Connection**

- Once payment is verified, system finalizes booking (`appointments(status=confirmed)`) and unlocks the psychologist's direct contact info for the client.
- Both parties receive final confirmation for coordination.

### C.3 Text Diagram (Official)

```text
Client selects Persona + completes intake + submits 3-5 preferred schedules
  -> appointments(pending) + proposed_slots(proposed_by=client, round=1)
  -> Pending queue visible to all psychologists (+ per-psychologist conflict annotations)
  -> First psychologist atomically picks up (psychologist_id + price) AND decides schedule:
       -> accept preferred slot: agreed -> awaiting_payment
       -> counter one alternative: proposed_slots(proposed_by=psychologist, round=2), awaiting_schedule(scheduling_turn=client)
  -> Client accepts counter OR submits new preferred schedules (scheduling_turn=psychologist -> Round 2+ accept/counter)
  -> Agreement -> selected_slot_id + payment_deadline = agreed - 24h (or pay-now grace)
  -> Client pays (payments: pending -> paid) -> appointments(confirmed)
  -> Contact unlock + confirmations + 24h/1h reminders
  -> Missed deadline -> slot expired, scheduling restarts from client
```

### C.4 Roles (Official)

- **Patients (Clients):** Search promoted psychologists, book/manage across all linked personas, view services, submit preferred schedules, respond to counters, and pay within the deadline. Own booking history only.
- **Psychologists (Providers):** Once promoted by an admin, view the pending queue with client-preferred schedules, pick up requests, set price, accept one preferred time or offer one alternative, and manage own schedules. Only schedules/details of clients/personas booked under them.
- **System Administrator (Admin):** Promote client accounts to psychologists (supplying the psychologist profile), manage user roles / CMS content. No access to private consultation details or session notes.
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
