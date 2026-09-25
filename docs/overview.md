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
- Accept or modify patient bookings.
- Access rule: can only access schedules and details of patients booked under them.

### System Administrator (Admin)

- Verify psychologists' credentials.
- Manage website content.
- Ensure the platform runs smoothly and securely.
- Manages user roles and platform maintenance without accessing private consultation details.

## Canonical Flow Pointer

- Canonical booking flow: see `system-flow.md` (Flow A — Admin-Guided).
- Known flow conflict: see `system-flow-conflict.md`.

## Sources

Condensed from `PsychAvenue Main — INTRODUCTION` and `TARGET USERS AND ROLES` notes.
