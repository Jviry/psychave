# Overview — PsychAvenuePH

## Project Name

**PsychAvenuePH**

## Primary Objective

Develop a secure, user-centric web-based platform that streamlines mental health accessibility by connecting individuals with verified psychologists. It aims to modernize the traditional consultation process through efficient appointment scheduling and real-time notification systems, while serving as a comprehensive information hub that showcases specialized psychiatric services and fosters mental health awareness.

## Target Users and Roles

### Patients (Clients)

- Search for verified psychologists.
- Book or manage appointments.
- View services.
- Receive real-time schedule notifications.
- Access rule: can only view their own booking history.

### Psychologists (Providers)

- Manage their consultation schedules.
- Update their profile and services.
- Pick up pending booking requests (if verified), set price, propose exactly 3 times.
- Access rule: can only access schedules and details of patients booked under them.

### System Administrator (Admin)

- Verify psychologists' credentials (unhide roster + enable pick-up).
- Manage user roles, psychologist approvals, and CMS content.
- Ensure the platform runs smoothly and securely.
- No access to private consultation details or session notes.
- Authentication: AWS Cognito with Cognito Groups (client / psychologist / admin), verified on every request.

## Contact & External Booking (permanent fallback)

- Email: `psychaveph.info@gmail.com` — `Email us to set an appointment`.
- Facebook page (external link, URL pending).
- Per decision, external email/Facebook booking is a permanent fallback alongside official queue flow, not interim. See `site-map.md`.

## About Us Scope

- Resident psychologists roster section (individual profiles omitted from docs).
- Vision & Mission (copy pending from stakeholders).
- Clinic Overview and Impact (copy pending from stakeholders).

## Canonical Flow Pointer

- Canonical booking flow: see `system-flow.md` (Official Queue Flow — Flow C).
- Legacy Flow A (admin-assign) noted in `system-flow-conflict.md` where appropriate.
- Public site structure: see `site-map.md`.
- Service details: see `services-catalog.md`.

## Sources

Condensed from official revised plan 2026-09-27 plus `Site Map & Details` deck (sitemap/contact only; no personal names included).
