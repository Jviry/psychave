# Graph Report - psychave  (2026-11-08)

## Corpus Check
- 85 files · ~81,148 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1412 nodes · 3330 edges · 75 communities (49 shown, 26 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 338 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Authentication Controller & Endpoints
- Admin Controller & Profiles
- Persona & Forms Data Models
- User Role & Profile Models
- Appointment Controller & Booking API
- Frontend API Client & Anonymization
- Auth Service Interface & Groups
- Alembic Migrations & DB Runtime
- Ephemeral Test Database Setup
- Appointment Repository & Transitions
- Service Catalog Model & Repo
- Cognito Service & User Operations
- Registration Page & Password Strength
- CMS & Persona Booking Pages
- Auth Layout & Login Modals
- Appointment Status & Scheduling Models
- Payment Status & Models
- Domain Exceptions & Validation
- Appointment Core Models & Proposals
- Client Bookings UI & Deadlines
- Proposed Slot Models & Enums
- Fake Auth Service Mock
- Persona Wizard Modal & Consent
- CI/CD Workflows & Backend Architecture
- Appointment Schema & Request Validation
- Cognito JWKS & Token Validation
- Authentication Interface & DTOs
- Frontend Form Schemas & Zod
- Psychologist Slot Conflict Handling
- Psychologist Controller & Actions
- Dashboard Layouts & Navigation
- Marketing Homepage & Services Grid
- TypeScript Configuration
- Admin User Management UI
- Persona Controller & Handlers
- Payment Provider Webhook Events
- Consent & Persona Constants
- FastAPI Auth Dependencies
- Package Config & Test Setup
- PayMongo Payment Provider Tests
- Dev Dependencies & Testing Tools
- FastAPI App Router & Lifespan
- Database Schema & Engine Scoping
- Frontend Auth API Client
- Admin & API Integration Tests
- Forbidden & Auth Domain Exceptions
- Payment Provider Interface
- Frontend Dependencies & React
- Global Exception Handlers
- Auth Request Schemas & DTOs
- PayMongo Payment Integration
- Psychologist Queue UI
- Ephemeral PR Schema Cleanup
- Frontend Auth Store & Tests
- Auth Controller Integration Tests
- Site Layout & Footer Component
- Persona Wizard Form Handlers
- Package Scripts & Build
- Role-Based Access Control Architecture
- Services Catalog Endpoints
- Scheduling Enum Migrations
- Payment Webhook Controller
- Vercel Deployment Configuration
- Platform Overview & Specifications
- Brand Tokens & Visual Identity
- Project Management Tracker
- Event-Driven Notifications
- Brand Favicon Asset
- Brand Logo Asset

## God Nodes (most connected - your core abstractions)
1. `AuthService` - 36 edges
2. `react` - 35 edges
3. `AppointmentRepo` - 35 edges
4. `PsychologistUsecase` - 34 edges
5. `AuthUsecase` - 32 edges
6. `Appointment` - 30 edges
7. `CognitoService` - 29 edges
8. `AppointmentUsecase` - 28 edges
9. `FakeAuthService` - 28 edges
10. `PsychologistRepo` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Serverless Database NullPool Strategy` --semantically_similar_to--> `Ephemeral Environment Deploy and Test Workflow`  [INFERRED] [semantically similar]
  backend/README.md → .github/workflows/ephemeral.yml
- `Client Persona Wizard & Multi-Step Intake` --implements--> `Official Queue Flow C (Canonical)`  [INFERRED]
  frontend/README.md → docs/system-flow.md
- `Deploy Dev GitHub Actions Workflow` --references--> `PsychAve Backend Architecture & Tech Stack`  [INFERRED]
  .github/workflows/deploy-dev.yml → backend/README.md
- `Cognito Gateway and Token Verification Architecture` --implements--> `Tiered Role-Based Access Control and Security Guardrails`  [INFERRED]
  backend/README.md → docs/requirements.md
- `Platform User Roles and Access Hierarchy` --shares_data_with--> `Admin Role Management and Psychologist Promotion`  [INFERRED]
  docs/overview.md → backend/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **AWS and OpenTofu CI/CD Deployment Automation** — _github_workflows_deploy_dev_deploy_job, _github_workflows_ephemeral_deploy_and_test_job, _github_workflows_ephemeral_destroy_job [EXTRACTED 1.00]
- **Flow C Client-First Scheduling and Finalization Flow** — docs_system_flow_official_flow_c, docs_system_flow_negotiation_state_machine, docs_system_flow_payment_gated_unlock, docs_frontend_backend_contract_endpoint_map [EXTRACTED 1.00]
- **Cognito Group-Based Tiered Access Control** — backend_readme_auth_architecture, backend_readme_role_management, docs_requirements_tiered_access_control, docs_overview_role_hierarchy [EXTRACTED 1.00]

## Communities (75 total, 26 thin omitted)

### Community 0 - "Authentication Controller & Endpoints"
Cohesion: 0.07
Nodes (22): confirm_forgot_password(), confirm_user(), create_user(), delete_user(), get_user(), login_user(), logout_user(), refresh_access_token() (+14 more)

### Community 1 - "Admin Controller & Profiles"
Cohesion: 0.07
Nodes (5): list_users(), promote_psychologist(), update_user_role(), UserRepository, AdminUsecase

### Community 2 - "Persona & Forms Data Models"
Cohesion: 0.09
Nodes (16): Forms, ContactMode, Persona, PersonaRelation, PersonaRepo, _calculate_age(), ConsentCreate, ConsentRead (+8 more)

### Community 3 - "User Role & Profile Models"
Cohesion: 0.07
Nodes (30): AdminProfile, ClientProfile, User, UserRole, AdminUserPage, AdminUserRead, PromotePsychologistRequest, UpdateUserRoleRequest (+22 more)

### Community 4 - "Appointment Controller & Booking API"
Cohesion: 0.08
Nodes (14): accept_counter_slot(), cancel_appointment(), create_appointment(), get_appointment(), get_payments(), get_slots(), initiate_payment(), list_appointments() (+6 more)

### Community 5 - "Frontend API Client & Anonymization"
Cohesion: 0.06
Nodes (44): AdminUserPageRaw, AdminUserRaw, anonymizedCodeByUuid, anonymizedPsychCode(), AppointmentRaw, buildBackendError(), durationLabel(), fetchServices() (+36 more)

### Community 7 - "Alembic Migrations & DB Runtime"
Cohesion: 0.06
Nodes (15): run_migrations_offline(), run_migrations_online(), downgrade(), upgrade(), upgrade(), upgrade(), downgrade(), upgrade() (+7 more)

### Community 8 - "Ephemeral Test Database Setup"
Cohesion: 0.09
Nodes (16): ensure_test_database(), api_url(), authenticated_user_factory(), _create_and_login(), aws_region(), cognito_client(), cognito_user_pool_id(), create_client_persona() (+8 more)

### Community 10 - "Service Catalog Model & Repo"
Cohesion: 0.11
Nodes (9): Service, ServiceRepo, seed_services(), _service_id(), ServiceUsecase, _create(), test_list_active_services_filtering(), test_list_all_services() (+1 more)

### Community 12 - "Registration Page & Password Strength"
Cohesion: 0.13
Nodes (27): ConfirmStep(), PasswordStrengthBar(), RegisterPage(), ResendCodeButton(), STRENGTH_CONFIG, BookFallbackPage(), ForgotPasswordModal(), ForgotPasswordModalProps (+19 more)

### Community 13 - "CMS & Persona Booking Pages"
Cohesion: 0.11
Nodes (22): EMPTY_SLOTS, manilaInputMin(), PersonasAndBookingPage(), PersonaWizardModal, PsychologistDashboardLayout(), SOCIAL_PLATFORMS, ButtonProps, modalMaxWidth (+14 more)

### Community 14 - "Auth Layout & Login Modals"
Cohesion: 0.09
Nodes (11): ForgotPasswordModal, LoginPage(), bodyFont, headingFont, metadata, RootLayout(), Providers(), ToastProps (+3 more)

### Community 15 - "Appointment Status & Scheduling Models"
Cohesion: 0.17
Nodes (5): AppointmentStatus, SchedulingTurn, test_book_appointment_end_to_end(), test_cancel_appointment(), test_slot_selection_lifecycle()

### Community 16 - "Payment Status & Models"
Cohesion: 0.11
Nodes (8): Payment, PaymentStatus, PaymentRepo, PaymentInitiateRequest, PaymentRead, PaymentWebhookRequest, ServiceRead, test_initiate_payment_persists_in_supabase()

### Community 17 - "Domain Exceptions & Validation"
Cohesion: 0.17
Nodes (11): DomainError, ValidationError, now_manila(), payment_deadline_for(), slot_end(), slot_start(), interval_for(), intervals_overlap() (+3 more)

### Community 18 - "Appointment Core Models & Proposals"
Cohesion: 0.16
Nodes (4): Appointment, ProposedSlot, PsychologistProfile, PsychologistRepo

### Community 19 - "Client Bookings UI & Deadlines"
Cohesion: 0.20
Nodes (21): ClientBookingsPage(), FILTER_TABS, PreferredScheduleList(), DeadlineNotice(), ScheduleAgreementPage(), formatForManilaInput(), PsychologistSchedulePage(), ScheduleTab (+13 more)

### Community 20 - "Proposed Slot Models & Enums"
Cohesion: 0.16
Nodes (11): SlotProposer, SlotStatus, AppointmentCreate, PreferredSlotsUpdate, ProposedSlotRead, SlotInput, SlotSelect, PickupRequest (+3 more)

### Community 22 - "Persona Wizard Modal & Consent"
Cohesion: 0.13
Nodes (22): DEFAULT_DRAFT_SNAPSHOT, Errors, STEP_TITLES, FINAL_CONSENT_STATEMENT, INFORMED_CONSENT_TEXT, isFutureDob(), isValidPhone(), normalizeName() (+14 more)

### Community 23 - "CI/CD Workflows & Backend Architecture"
Cohesion: 0.10
Nodes (19): Deploy Dev GitHub Actions Workflow, Ephemeral Environment Deploy and Test Workflow, Ephemeral Environment Teardown and Cleanup Workflow, PsychAve Backend Architecture & Tech Stack, Backend Pinned Dependencies, Frontend to Backend Endpoint Map, Frontend to Backend Field & Schema Mapping, Backend Implementation Order Roadmap (+11 more)

### Community 24 - "Appointment Schema & Request Validation"
Cohesion: 0.22
Nodes (3): BadRequestError, NotFoundError, AppointmentUsecase

### Community 25 - "Cognito JWKS & Token Validation"
Cohesion: 0.12
Nodes (6): get_jwks(), verify_token(), get_settings(), Settings, get_payment_provider(), _init_provider()

### Community 26 - "Authentication Interface & DTOs"
Cohesion: 0.17
Nodes (3): AuthTokens, AuthUser, SignUpResult

### Community 27 - "Frontend Form Schemas & Zod"
Cohesion: 0.10
Nodes (19): bookingFormSchema, BookingFormValues, CmsOverviewFormValues, cmsOverviewSchema, PersonaWizardPayloadValues, pickupResponseSchema, PickupResponseValues, preferredScheduleSchema (+11 more)

### Community 28 - "Psychologist Slot Conflict Handling"
Cohesion: 0.31
Nodes (4): ConflictError, AppointmentRead, PendingAppointmentRead, PsychologistUsecase

### Community 29 - "Psychologist Controller & Actions"
Cohesion: 0.22
Nodes (8): accept_preferred_slot(), complete_appointment(), counter_offer(), get_my_profile(), list_my_appointments(), list_pending_appointments(), pickup_appointment(), update_my_profile()

### Community 30 - "Dashboard Layouts & Navigation"
Cohesion: 0.17
Nodes (11): AdminDashboardLayout(), navLinks, ClientBookingsLayout(), ClientBookingFlowLayout(), ClientProposalLayout(), RoleGate(), replace, hydrationSnapshot (+3 more)

### Community 31 - "Marketing Homepage & Services Grid"
Cohesion: 0.19
Nodes (16): HomePage(), SERVICE_SUBTEXTS, SERVICE_TINTS, AboutGrid(), AboutTint, CardHeading(), ClinicCard(), RosterCard() (+8 more)

### Community 32 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 34 - "Admin User Management UI"
Cohesion: 0.14
Nodes (12): AdminUsersPage(), formatDate(), roleLabels, RoleTag(), AdminUser, AuthState, AuthStore, AuthUser (+4 more)

### Community 35 - "Persona Controller & Handlers"
Cohesion: 0.23
Nodes (6): create_persona(), delete_persona(), get_persona(), get_persona_for_review(), list_personas(), update_persona()

### Community 36 - "Payment Provider Webhook Events"
Cohesion: 0.14
Nodes (4): WebhookEvent, FakePaymentProvider, DummyProvider, TestPaymentController

### Community 37 - "Consent & Persona Constants"
Cohesion: 0.17
Nodes (16): CONSENT_VERSION, LAST_USED_PERSONA_KEY, PreferredContactMode, RelationToAccountHolder, TermsSignerRelation, WIZARD_DRAFT_KEY, clearWizardDraftStorage(), DEFAULT_WIZARD_DRAFT (+8 more)

### Community 38 - "FastAPI Auth Dependencies"
Cohesion: 0.20
Nodes (6): get_auth_service(), get_claims(), get_current_psychologist(), get_current_user(), _init_auth_service(), require_role()

### Community 39 - "Package Config & Test Setup"
Cohesion: 0.12
Nodes (14): name, private, version, jsdom, react-dom, tailwindcss, @tailwindcss/postcss, @testing-library/jest-dom (+6 more)

### Community 41 - "Dev Dependencies & Testing Tools"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom, tailwindcss, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node (+5 more)

### Community 44 - "Frontend Auth API Client"
Cohesion: 0.18
Nodes (8): API_BASE_URL, authApi, ConfirmCredentials, ForgotPasswordConfirmCredentials, LoginCredentials, LoginResponse, MessageResponse, RegisterCredentials

### Community 45 - "Admin & API Integration Tests"
Cohesion: 0.18
Nodes (5): mockFetch, mockFetch, mockFetch, @vitejs/plugin-react, vitest

### Community 46 - "Forbidden & Auth Domain Exceptions"
Cohesion: 0.20
Nodes (3): ForbiddenError, UnauthenticatedError, UserNotFoundError

### Community 48 - "Frontend Dependencies & React"
Cohesion: 0.20
Nodes (10): dependencies, @hookform/resolvers, lucide-react, next, react, react-dom, react-hook-form, @tanstack/react-query (+2 more)

### Community 50 - "Auth Request Schemas & DTOs"
Cohesion: 0.36
Nodes (6): ConfirmUserRequest, ForgotPasswordConfirm, RefreshTokenRequest, ResetPasswordRequest, UserCreate, UserLogin

### Community 52 - "Psychologist Queue UI"
Cohesion: 0.39
Nodes (8): displayValue(), formatForManilaInput(), formatReviewDate(), PsychologistQueuePage(), reviewAge(), ReviewField(), ScheduleAction, yesNo()

### Community 55 - "Frontend Auth Store & Tests"
Cohesion: 0.29
Nodes (3): AuthStore, importAuthStore(), seededPayload

### Community 56 - "Auth Controller Integration Tests"
Cohesion: 0.38
Nodes (3): client(), fake_auth(), session()

### Community 57 - "Site Layout & Footer Component"
Cohesion: 0.48
Nodes (5): SiteLayout(), FooterLink(), SiteFooter(), WORKSPACE_LINKS, SiteHeader()

### Community 58 - "Persona Wizard Form Handlers"
Cohesion: 0.43
Nodes (6): FieldError(), PersonaWizardModal(), focusFirstError(), goNext(), handleSubmit(), validateStep()

### Community 59 - "Package Scripts & Build"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:run

### Community 60 - "Role-Based Access Control Architecture"
Cohesion: 0.40
Nodes (6): Cognito Gateway and Token Verification Architecture, Admin Role Management and Psychologist Promotion, Cognito ID Token Verification Contract, Platform User Roles and Access Hierarchy, Tiered Role-Based Access Control and Security Guardrails, Payment-Gated Contact Information Unlock

### Community 64 - "Vercel Deployment Configuration"
Cohesion: 0.50
Nodes (3): framework, ignoreCommand, $schema

## Knowledge Gaps
- **27 isolated node(s):** `jsdom`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `@testing-library/user-event` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 475 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BadRequestError` connect `Appointment Schema & Request Validation` to `External Provider Seams`, `PayMongo Payment Provider Tests`, `Domain Exceptions & Validation`, `PayMongo Payment Integration`, `Psychologist Slot Conflict Handling`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `AuthService` (e.g. with `get_auth_service()` and `get_claims()`) actually correct?**
  _`AuthService` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `jsdom`, `react-dom`, `tailwindcss` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Authentication Controller & Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.073224043715847 - nodes in this community are weakly interconnected._
- **Why does `UserRepository` connect `Admin Controller & Profiles` to `Authentication Controller & Endpoints`, `FastAPI Auth Dependencies`, `Appointment Repository & Transitions`, `Appointment Status & Scheduling Models`, `Authentication Interface & DTOs`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `AppointmentRepo` (e.g. with `PsychologistRepo` and `AppointmentUsecase`) actually correct?**
  _`AppointmentRepo` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Admin Controller & Profiles` be split into smaller, more focused modules?**
  _Cohesion score 0.06578947368421052 - nodes in this community are weakly interconnected._