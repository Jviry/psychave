# System Flow Conflict — Flow C (Official) vs Flow A (Legacy) vs Flow B

Companion to `system-flow.md`. `system-flow.md` uses **Flow C (Official Queue Flow) as canonical** per 2026-09-27 instruction. Flow A is retained as legacy wherever appropriate.

## TL;DR

- **Flow C — Official (canonical):** Client submits (persona) → pending queue visible to psychologists → verified psychologist picks up + sets price + proposes exactly 3 times → client selects 1 + pays → finalized only on payment success → contact unlock.
- **Flow A — Admin-Guided (legacy):** Client → Admin approves + assigns psychologist → Email payment link → Client pays → Client picks schedule (pay-then-schedule, admin assigns). Superseded; kept for traceability.
- **Flow B — Psychologist-Review / early Current Workflow (legacy):** Psychologist reviews → proposes slots + price (count unspecified) → client picks → pays → contact unlock. Absorbed into Flow C except for the exact-3 rule and queue semantics.

---

## Flow C — Official Queue Flow (Canonical)

Source: revised official plan 2026-09-27.

1. Directory view (specialization, languages, availability); hidden until admin verifies credentials.
2. Client submits booking request, optionally for a persona (self/dependent); enters pending queue visible to available psychologists; booking also routed to admin dashboard for preliminary assessment (both statements kept from official text).
3. Verified psychologist picks up, sets price, proposes exactly 3 candidate times.
4. Client reviews 3, selects 1 (`selected_slot_id`), completes payment; finalized only on `payments(status=paid)`.
5. Notifications: new-request → psychologists; proposal → client; payment confirmation → both; 24h/1h reminders; real-time status updates.
6. Contact unlock after verified payment + final confirmations.
7. Auth: AWS Cognito with Cognito Groups (client/psychologist/admin), verified every request.

Key properties: **queue pick-up, exactly 3 proposals, schedule-then-pay, payment-gated finalization.**

## Flow A — Admin-Guided (Legacy, noted where appropriate)

Source: original `CORE FEATURES #1` + early `system-flow.md`.

1. Client views directory.
2. Client submits → routed directly to admin dashboard.
3. Admin reviews, approves, assigns specific psychologist.
4. Client receives email payment link; pays; then picks schedule on calendar.
5. Admin notified on submission; client emailed on approval; 24h/1h reminders.

Key property: **pay-then-schedule, admin assigns.** Superseded by Flow C steps 2-4.

## Flow B — Psychologist-Review (Legacy)

Source: early `Workflow — The Booking & Coordination 1-6`.

Same shape as Flow C except: proposal count unspecified, no explicit pending-queue semantics, routing ambiguous (admin vs psychologist). Flow C resolves these with queue + exactly-3 rule.

---

## Point-by-Point: C vs A

| # | Decision | Flow C (official) | Flow A (legacy) |
|---|---|---|---|
| 1 | Queue entry | Pending queue visible to available psychologists (+ admin preliminary view) | Directly to admin dashboard only |
| 2 | Who assigns | Verified psychologist self-picks-up | Admin assigns specific psychologist |
| 3 | Proposal | Exactly 3 candidate times + price set at pick-up | Unspecified; calendar after payment |
| 4 | Payment order | Select 1 of 3 → pay → finalized only on success | Pay via email link → pick schedule |
| 5 | Alerts | New request → psychologists; proposal → client; confirmation → both | Submit → admin; approval → client |
| 6 | Gate | Unverified cannot pick up (explicit) | Hidden roster only (implicit) |
| 7 | Auth | Cognito Groups verified every request (explicit) | Cognito implied by `cognito_sub` only |

---

## Why It Matters for Code

Current backend models (`backend/src/models/`):

- `Appointment: persona_id FK, psychologist_id? FK, selected_slot_id? FK->proposed_slots, price?, requested_datetime?, status=pending`
- `ProposedSlot: appointment_id FK->appointments, session_date, start_time, end_time?` (circular FK with `selected_slot_id`)
- `Payment: appointment_id FK, amount, status=pending`
- `PsychologistProfile.approval_status=pending, approved_by FK->admin_profiles`

Flow C fits these models with two added constraints (no schema change yet):

- Enforce exactly 3 `proposed_slots` rows per `appointment_id` at proposal time (application rule).
- Gate pick-up (`psychologist_id` set) on `approval_status=approved`; gate finalization on `payments(status=paid)`.
- Still missing / needs decision: pending-queue visibility query (available psychologists scope), proposal expiry / re-proposal, no-show of unpicked requests, admin preliminary-assessment write vs read-only, Cognito Groups → app role mapping + per-request verification, contact-unlock enforcement.

No code changes were made in this docs task.

---

## Sources

- Flow C: official revised plan 2026-09-27 (INTRODUCTION, TARGET USERS, CORE FEATURES #1-4).
- Flow A: original `CORE FEATURES #1` + early `system-flow.md` (legacy).
- Flow B: early `Workflow — Current Workflow 1-6` (legacy).
- Deck: `site-map.md`, `services-catalog.md` (structure/services only; no personal names).
