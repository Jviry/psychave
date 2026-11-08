# PSYCHAVE PH (`PsychAvenuePH`) — Frontend Prototype (`frontend/`)

Next.js (App Router) + TypeScript frontend for **PsychAvenuePH**, implementing **Official Booking Flow C**, tiered AWS Cognito Groups role views (`client` / `psychologist` / `admin`), React Hook Form + Zod validation, Zustand state, and TanStack Query against the authenticated FastAPI backend.

---

## Quick Start (`npm install && npm run dev`)

1. Copy the `frontend/` directory into the root of your repository alongside `backend/`.
2. Configure environment variables:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Install dependencies and start the development server:

```bash
cd frontend
npm install && npm run dev
```

---

## Directory Structure

```text
frontend/
├── app/
│   ├── layout.tsx                  # Root layout + QueryClientProvider + Header/Footer
│   ├── page.tsx                    # / Home (Hero, Flow C 5-Step Walkthrough, Services, Testimonials)
│   ├── services/page.tsx           # /services (7 canonical services + durations & guardrails)
│   ├── about/page.tsx              # /about (Anonymized Roster without names, Vision/Mission, Overview)
│   ├── book/page.tsx               # /book (Flow C launcher + Facebook & psychaveph.info@gmail.com fallback)
│   ├── personas/page.tsx           # /personas (Manage personas + 4-step wizard modal + Flow C Booking Form)
│   │                               Wizard: components/PersonaWizardModal.tsx + stores/usePersonaWizardStore.ts
│   │                               (single POST /personas at final submit; draft in sessionStorage).
│   │                               Consent copy: lib/consent.ts, CONSENT_VERSION=v2, sourced from the
│   │                               firm's booking forms (informed consent + scope/overseas blocks).
│   │                               Legacy quick-add form kept temporarily in a collapsed disclosure until
│   │                               backend POST /personas supports the persona+consent payload — then remove it.
│   ├── bookings/page.tsx           # /bookings (Client bookings, status chips, contact unlock, reminders)
│   ├── proposal/[id]/page.tsx      # /proposal/[id] (3 radio slots picker + Stripe payment finalization)
│   ├── psych/
│   │   ├── queue/page.tsx          # /psych/queue (Pending queue + verified pick-up + 3-slot proposal)
│   │   └── schedule/page.tsx       # /psych/schedule (Booked-under-them only + private clinical notes)
│   └── admin/
│       ├── users/page.tsx          # /admin/users (Authenticated user directory + role changes)
│       └── cms/page.tsx            # /admin/cms (local-only CMS preview until a backend exists)
├── components/
│   ├── SiteHeader.tsx              # Brand wordmark, public nav, authenticated workspace links
│   ├── SiteFooter.tsx              # Quiet clinical footer
│   ├── TestimonialsConsentSection.tsx # Empty testimonial cards + consent-flag governance note
│   └── ui/primitives.tsx           # Shadcn-style accessible primitives
├── lib/
│   ├── api.ts                      # Single authenticated API client hitting NEXT_PUBLIC_API_URL
│   ├── navigation.tsx              # Universal App Router navigation wrapper
│   ├── schemas.ts                  # Zod validation schemas for Persona, Booking, 3-Slot Proposal, Payment, CMS
│   └── types.ts                    # Domain TypeScript interfaces
└── stores/
    └── useAppStore.ts              # Zustand store for booking draft and Flow C events
```
