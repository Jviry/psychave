# Project Management — PsychAvenuePH

## Links

- **PsychAvenue Devs Tracker:** https://docs.google.com/spreadsheets/d/1ArUewr5mSh6bDdvNaRYe4EYPGgBpefF25PD55TwEz9k/edit?pli=1&gid=0#gid=0
- **PsychAvenue Forms Link:** https://forms.gle/fZFiCUEaxsBAfdyQ6
- **Canva Link:** https://www.canva.com/design/DAG6-QESfMM/RNbbDrpfCt6gxvDQtPUXsQ/edit?utm_content=DAG6-QESfMM&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton
- **ERD (Miro):** https://miro.com/welcomeonboard/MHNaY2orRGxMTEdoU0ZFNGViZHNtTHB3Q0poR2VTZDFPTDBQcGJHVVl2ZFc1dnFUQ1F3dXdOM1dYck0zWnhYOWszK0tCZ2xwcXM5anZSc1hrWS8rdk9RNHBPdmJsT1dFcnhvMERWQXUvVW9rRURaem1GdzBnbXh2SzlPSCthWUV0R2lncW1vRmFBVnlLcVJzTmdFdlNRPT0hdjE=?share_link_id=684426152450

## To Do This Week (as given)

- [x] Setup AWS Account — sol
- [ ] CI/CD — sol
- [ ] Finalize flowchart / User flow — naza
- [x] Initial database — jv
- [ ] Docs for backend — sol
- [ ] Landing page — gen
- [ ] Auth — jv
- [x] ERD — all
- [ ] Repository architecture — sol

## Todos — Week 1 | June 12, 2026 - June 18, 2026

- Document — Carlos
- ERD/UML — Sol and Carlos
- UI/UX — Carlos
- DynamoDB Structure — Sol
- Github Repo Structure — Carlos and Sol
- CI/CD Pipelines — Sol

> Note: DynamoDB is listed here but current backend uses PostgreSQL/Supabase. Kept verbatim; needs clarification if DynamoDB is still in scope.

## Minutes

### June 12, 2026 Meeting — Docs outline

- About / Description
  - Name
  - Objective
  - Target Users and Roles
- Functional Requirements
  - Table Design
  - Core Features
  - Workflow
- FrontEnd (Like what is in the interface)
- TechStack
- Minimum Viable Product
- Tracker

### June 19, 2026 Meeting

- (No notes provided in source.)

### Sept 9, 2026 Meeting

- Introduction and Agenda Introduction
- User Flow Presentation
- User → Forms → Admin Dashboard → Payment
- It depends on the Therapist Specialization and Availability
- Selection of Client is Dependent on the Forms
- Therapist can tackle/handle all clients, but some Therapist has specializations
- Admin don't decide which Therapist the Client is assigned to
- Therapists discuss with each other kinsa na client i take
- Check NowServing App for inspo
- Link → forms → payment → generate link
- Therapists could see all the client forms, then therapist could select (?)
- Plato platform
- Calendar → availability → like calendly
- The main point of website → make it easier for both client and admins
- Mmakita nila ang history and stuff
- They can check info of clinic
- Booking easier for the client
- Make Payment easier
- Calendar
- Automated Email → waiting for approval → admin approval → payment

> Conflict note: `Admin don't decide` here contradicts Flow A (admin assigns). Preserved verbatim; see `system-flow-conflict.md`.

## Quick Notes

**Meeting Next Week Agenda**

- Clarification of flow of consultation

## Table Design Placeholders

Source notes referenced `Table Design (image2)` and `Alternative where the website has its own messaging feature (image3)` — images not recoverable. See ERD Miro link above for current source of truth. Backend tables are listed in `proj-specs.md`.
