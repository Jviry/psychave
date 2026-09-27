# System Flow Conflict — Flow A vs Flow B

Companion to `system-flow.md`. `system-flow.md` uses **Flow A as canonical** per instruction.

## TL;DR

- **Flow A — Admin-Guided (canonical):** Client → Admin approves + assigns psychologist → Email payment link → Client pays → Client picks schedule.
- **Flow B — Psychologist-Review (alternative, matches current DB shape better):** Client → Psychologist reviews intake → Proposes slots + price → Client selects slot → Pays → Gets contact info.
- Both flows appear verbatim in the source notes. They disagree on who approves, who proposes schedule/price, payment order, and who assigns the psychologist.

---

## Flow A — Admin-Guided Booking Workflow (Canonical)

Source: `CORE FEATURES #1 Appointment & Scheduling System` + `Notification & Reminder`.

1. Client views Psychologist Directory (specialization, languages, availability).
2. Client submits booking request → routed **directly to admin dashboard**.
3. Admin reviews, approves, **assigns a specific psychiatrist/psychologist**.
4. Client receives direct email with payment link.
5. Once payment is processed, client finalizes/selects schedule on interactive calendar.
6. Instant alerts + 24h/1h reminders + status updates for changes/cancellations.

Key property: **pay-then-schedule, admin assigns.**

## Flow B — Psychologist-Review / Current Workflow (Alternative)

Source: `Workflow — The Booking & Coordination 1-6` + `System Flow Notes — Client user flow 1-6`.

1. **Profile Selection & Intake:** Client selects Patient Profile (Persona, self or dependent), completes intake form (personal info, concerns, needs).
2. **Request Submission & Routing:** System logs request, forwards intake forms — in one version to admin dashboard for preliminary assessment, in another version directly to selected psychologist for review.
3. **Psychologist Review & Proposal:** Psychologist reviews intake for fit. Upon approval, psychologist generates proposal with available dates, time slots, and price.
4. **Schedule Confirmation:** Client reviews proposed schedule on dashboard and locks in preferred slot.
5. **Secure Payment Processing:** Client pays via payment gateway. System updates transaction status, marks appointment as `Paid`.
6. **Confirmation & Connection:** Once verified, system unlocks psychologist's direct contact info. Both parties get final confirmation.

Condensed chain from notes:

```text
Client completes forms → Submits appointment request → Psychologist approves
and provides slots + price → Client selects date/time → Client pays
→ Client receives psychologist contact information.
```

Key property: **schedule-then-pay, psychologist proposes.**

---

## Point-by-Point Conflict

| # | Decision | Flow A says | Flow B says | Impact |
|---|---|---|---|---|
| 1 | Who approves? | Admin reviews + approves | Psychologist reviews intake for fit | Different dashboard permissions, different `status` transitions |
| 2 | Who assigns psychologist? | Admin assigns specific psychologist | Client selects / psychologists discuss among themselves (`kinsa na client i take`) | Sept 9 notes explicitly say `Admin don't decide which Therapist the Client is assigned to` — directly contradicts Flow A |
| 3 | Who proposes slots + price? | Unspecified; calendar selection after payment | Psychologist generates proposal with dates/slots/price | Changes whether `proposed_slots` + `price` are created before or after payment |
| 4 | Payment order | Email payment link → pay → pick schedule | Pick schedule → pay → get contact | State machine for `appointments` / `payments` flips |
| 5 | Contact unlock | Not specified in A | Contact unlocked only after `Paid` | Privacy/guardrail rule only defined in B |
| 6 | Routing target | Always admin dashboard | Ambiguous: admin dashboard in one paragraph, selected psychologist in another | Same section contradicts itself |

---

## Why It Matters for Code

Current backend models (`backend/src/models/`):

- `Appointment: persona_id FK, psychologist_id? FK, selected_slot_id? FK->proposed_slots, price?, requested_datetime?, status=pending`
- `ProposedSlot: appointment_id FK->appointments, session_date, start_time, end_time?` (circular FK with `selected_slot_id`)
- `Payment: appointment_id FK, amount, status=pending`
- `PsychologistProfile.approval_status=pending, approved_by FK->admin_profiles`

This shape fits **Flow B** more naturally (psychologist creates `proposed_slots` + sets `price` per appointment, client picks `selected_slot_id`, then `payments` flips to paid).

To fully support **Flow A as canonical**, the following are still missing / need decisions:

- Admin approval audit on `appointments` (who approved, when) — currently only psychologist approval fields exist.
- Assignment action (`admin_id -> appointments.psychologist_id`) with authorization check.
- Email payment-link token/state (pay-before-schedule) — no column/state for `payment_link_sent`.
- Calendar availability source (per-psychologist availability vs per-appointment `proposed_slots`) — Sept 9 notes want Calendly-like availability + NowServing-style queue; neither is modeled yet.
- Contact-unlock rule enforcement if keeping B's Step 6.

No code changes were made in this docs task.

---

## Recommendation

1. Keep `system-flow.md` (Flow A) as the stakeholder-facing canonical flow.
2. Treat Flow B as `Alternative / Legacy — do not implement until resolved`.
3. Resolve with team (Naza flowchart / Sept 9 attendees): confirm whether admin assigns or therapists self-claim, and whether payment comes before or after slot selection.
4. Once resolved, update `system-flow.md` and add the corresponding `status` state machine + missing columns via a new Alembic migration.

---

## Sources

- Flow A: `CORE FEATURES #1-2`, `TARGET USERS AND ROLES`
- Flow B: `Workflow — Current Workflow 1-6`, `System Flow Notes 1-6`
- Constraints: `Platform Security & Guardrails`, `Minutes Sept 9, 2026` (therapist specialization, admin-doesn't-decide, Calendly-like calendar, automated email waiting→approval→payment)
