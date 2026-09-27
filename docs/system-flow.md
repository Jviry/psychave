# System Flow — PsychAvenuePH (Canonical: Flow A)

> Flow Conflict: See at system-flow-conflict.md

## Overview

This document describes the **current canonical booking & coordination flow** for PsychAvenuePH.

**Canonical choice: Flow A — Admin-Guided Booking Workflow.**

Flow A is taken from `CORE FEATURES AND FUNCTIONALITIES #1 — Appointment & Scheduling System` in the source notes. An alternative flow (Flow B — Psychologist-Review) exists in the notes and is preserved for reference in `system-flow-conflict.md`. Do not implement both without resolving the conflict first.

Related docs (planned):
- `overview.md` — project objective, target users/roles
- `requirements.md` — core features, guardrails
- `tech-stack.md` — frontend/backend/db
- `project-management.md` — links, todos, minutes

---

## Flow A — Admin-Guided Booking Workflow (Canonical)

### A.1 Psychologist Directory View

- A straightforward list of all 5 psychologists.
- Each entry shows: specialization, spoken languages, and general availability.
- Psychologist accounts remain hidden from the public roster until the System Administrator manually verifies credentials (see Security section in requirements).

### A.2 Steps

**Step 1 — Profile Selection & Intake**

- The client initiates booking by selecting a Patient Profile (Persona).
- Allows booking for self or on behalf of a dependent.
- Client completes a comprehensive intake form detailing personal information, primary concerns, and specific needs.
- Model mapping: `users -> client_profiles -> persona -> forms`.

**Step 2 — Request Submission & Routing**

- Upon submission, the system logs the appointment request as `appointments(status=pending)`.
- Request is routed **directly to the admin dashboard** for review (not directly to a psychologist).
- Admin gets an instant booking-submission alert (email / in-app).

**Step 3 — Admin Review, Approval & Assignment**

- Administrator reviews and approves the request.
- Administrator assigns a specific psychiatrist/psychologist to the client.
- Assignment should consider specialization and availability, per Sept 9 notes.
- Model mapping: `appointments.psychologist_id` set by admin action.

**Step 4 — Email Payment Link & Scheduling**

- Upon admin approval, the client receives a direct email at their registered account containing a link to complete payment.
- Once payment is processed, the client proceeds to finalize and select their consultation schedule on the interactive calendar.
- Order in Flow A: **pay-then-schedule** (payment link first, calendar second).
- Model mapping: `payments(appointment_id, amount, status)` → then `proposed_slots` → `appointments.selected_slot_id`.

**Step 5 — Notification & Reminders**

- Instant Booking & Payment Alerts: admin notified on submission; client emailed on approval.
- Automated Reminders: SMS, email, or in-app alerts 24 hours and 1 hour before session.
- Status Updates: real-time notifications for schedule changes, cancellations, or admin announcements.

**Step 6 — Confirmation & Connection**

- Once payment is verified, the system finalizes the booking and marks `appointments(status=paid/confirmed)`.
- Both parties receive final confirmation for coordination before the session.
- Per Flow B notes (kept for parity): unlocking psychologist direct contact info happens only after `payments(status=paid)`.

### A.3 Text Diagram (Flow A)

```text
Client selects Persona + completes Intake Form (forms)
  -> Submits Appointment Request (appointments: pending)
  -> Admin Dashboard (instant alert)
  -> Admin approves + assigns Psychologist (appointments.psychologist_id)
  -> Client receives Email Payment Link
  -> Client pays (payments: pending -> paid)
  -> Client selects schedule on Calendar (proposed_slots -> selected_slot_id)
  -> Confirmation + Reminders (24h / 1h) + Status updates
```

### A.4 Roles in Flow A

- **Patients (Clients):** Search verified psychologists, book/manage appointments, view services, receive real-time notifications. Can only view their own booking history.
- **Psychologists (Providers):** Manage consultation schedules, update profile/services, accept or modify bookings assigned to them. Can only access schedules/details of patients booked under them.
- **System Administrator (Admin):** Verify psychologist credentials, review/approve requests, assign psychologist, manage website content, ensure smooth/secure operation. Manages roles without accessing private consultation details.

---

## Placeholders for Missing Diagrams

The source notes referenced embedded images that were not recoverable as files (base64 blobs `image1`, `image4`, `image5`, `image6`):

- `[Workflow diagram — image4]` — missing. See Miro ERD / Canva links in project-management docs.
- `[Current Workflow diagram — image5]` — missing.
- `[Client user flow diagram — image6]` — missing.

Do not delete this section; replace with exported PNGs when available.

---

## Sources

Condensed from pasted project notes: `PsychAvenue Main — INTRODUCTION`, `TARGET USERS AND ROLES`, `CORE FEATURES #1-2`, `Workflow — Current Workflow`, `System Flow Notes`, `Minutes Sept 9, 2026`.
