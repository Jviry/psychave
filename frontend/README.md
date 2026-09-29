# PSYCHAVE PH (`PsychAvenuePH`) — Frontend Prototype (`frontend/`)

Clickable Next.js (App Router) + TypeScript frontend prototype for **PsychAvenuePH**, implementing **Official Booking Flow C**, tiered AWS Cognito Groups role views (`client` / `psychologist` / `admin`), React Hook Form + Zod validation, Zustand state, and TanStack Query with automatic mock fallback in `frontend/lib/api.ts`.

---

## Quick Start (`npm install && npm run dev`)

1. Copy the `frontend/` directory into the root of your repository alongside `backend/`.
2. Configure environment variables (or rely on built-in mock defaults):

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AUTH_MODE=mock
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
│   ├── personas/page.tsx           # /personas (Manage personas + 4-step wizard modal + Flow C Intake Form)
│   │                               Wizard: components/PersonaWizardModal.tsx + stores/usePersonaWizardStore.ts
│   │                               (single POST /personas at final submit; draft in sessionStorage).
│   │                               Legacy quick-add form kept temporarily in a collapsed disclosure until
│   │                               backend POST /personas supports the persona+consent payload — then remove it.
│   ├── bookings/page.tsx           # /bookings (Client bookings, status chips, contact unlock, reminders)
│   ├── proposal/[id]/page.tsx      # /proposal/[id] (3 radio slots picker + Stripe payment finalization)
│   ├── psych/
│   │   ├── queue/page.tsx          # /psych/queue (Pending queue + verified pick-up + 3-slot proposal)
│   │   └── schedule/page.tsx       # /psych/schedule (Booked-under-them only + private clinical notes)
│   └── admin/
│       ├── verifications/page.tsx  # /admin/verifications (Approve/Hide roster, session notes redacted)
│       └── cms/page.tsx            # /admin/cms (Payload CMS editors for services, roster, testimonials, Vision/Mission)
├── components/
│   ├── SiteHeader.tsx              # Brand wordmark, public nav, Cognito role switcher, demo banner
│   ├── SiteFooter.tsx              # Quiet clinical footer
│   ├── TestimonialsConsentSection.tsx # Empty testimonial cards + consent-flag governance note
│   └── ui/primitives.tsx           # Shadcn-style accessible primitives
├── lib/
│   ├── api.ts                      # Single API client hitting NEXT_PUBLIC_API_URL with mock fallback
│   ├── navigation.tsx              # Universal App Router navigation wrapper
│   ├── schemas.ts                  # Zod validation schemas for Persona, Intake, 3-Slot Proposal, Payment, CMS
│   └── types.ts                    # Domain TypeScript interfaces
└── stores/
    └── useAppStore.ts              # Zustand store for Cognito role switch, intake draft, and Flow C events
```
