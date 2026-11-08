# Graph Report - psychave  (2026-11-08)

## Corpus Check
- 203 files · ~80,624 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 5, .ini 3, .example 2)

## Summary
- 1326 nodes · 3720 edges · 74 communities (44 shown, 30 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 558 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Persona Wizard Modal & Form Validation
- Persona Management Controller & Handlers
- Appointment & Proposed Slot Models
- Frontend API Client & Anonymization
- Frontend Dependencies & Libraries
- Services Catalog Controller & Endpoints
- Alembic Migrations & DB Runtime
- Auth & CMS Pages
- Frontend Layout & Typography
- Client Bookings & Scheduling UI
- Auth Store & State Management
- User Registration & Strength UI
- Authentication Controller & Cognito API
- Psychologist Dashboard & Appointment Controller
- Appointment Management & Payments API
- Marketing Homepage & About Grid
- Authentication Errors & Token Lifecycle
- Authentication Dependencies & Profiles
- Cognito User Attributes & Management
- Admin User Management & Promotion
- Test Suite Authentication Fixtures
- Cognito Identity Provider Service
- Domain Exceptions & HTTP Handlers
- Authentication Service Interface & DTOs
- Time Utilities & Payment Deadlines
- Ephemeral Test Database Setup
- CI/CD Workflows & Backend Architecture
- PayMongo Payment Provider
- User Filtering & Pagination Models
- User Model & Role Enum
- Appointment Scheduling Negotiation Enums
- Client-First Scheduling Specifications
- Test Configuration & Mocks
- Frontend Primitives & UI Components
- Services Catalog & Durations
- Client-Psychologist Negotiation Flow
- Scheduling Status & Turn Models
- PayMongo Payment Unit Tests
- Payment Repository & Transactions
- Auth Usecase & User Provisioning
- App Router & Payment Schemas
- Ephemeral Preferred Scheduling Integration Tests
- Application Settings & Configuration
- Database Engine & Schema Scoping
- Payment Webhook Handler
- Auth Controller Integration Tests
- Ephemeral PR Schema Cleanup
- Supabase End-to-End Booking Tests
- Role-Based Access Control Architecture
- Cognito JWKS & Token Validation
- Scheduling Enum Migrations
- Role Enforcement Middleware
- User Not Found Domain Exceptions
- Mock Payment Provider
- Vercel Deployment Configuration
- Client Persona Test Helpers
- Platform Overview & Specifications
- Brand Tokens & Visual Identity
- Project Management Tracker
- Event-Driven Notifications
- Brand Favicon Asset
- Brand Logo Asset

## God Nodes (most connected - your core abstractions)
1. `UserRole` - 70 edges
2. `User` - 61 edges
3. `Appointment` - 51 edges
4. `AppointmentRepo` - 48 edges
5. `PsychologistUsecase` - 44 edges
6. `NotFoundError` - 39 edges
7. `AuthService` - 38 edges
8. `AppointmentUsecase` - 36 edges
9. `react` - 34 edges
10. `AppointmentStatus` - 32 edges

## Surprising Connections (you probably didn't know these)
- `Serverless Database NullPool Strategy` --semantically_similar_to--> `Ephemeral Environment Deploy and Test Workflow`  [INFERRED] [semantically similar]
  backend/README.md → .github/workflows/ephemeral.yml
- `Client Persona Wizard & Multi-Step Intake` --implements--> `Official Queue Flow C (Canonical)`  [INFERRED]
  frontend/README.md → docs/system-flow.md
- `confirm_forgot_password()` --uses--> `ForgotPasswordConfirm`  [INFERRED]
  backend/src/usecase/auth_usecase.py → backend/src/schemas/auth_model.py
- `Deploy Dev GitHub Actions Workflow` --references--> `PsychAve Backend Architecture & Tech Stack`  [INFERRED]
  .github/workflows/deploy-dev.yml → backend/README.md
- `Cognito Gateway and Token Verification Architecture` --implements--> `Tiered Role-Based Access Control and Security Guardrails`  [INFERRED]
  backend/README.md → docs/requirements.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flow C Client-First Scheduling and Finalization Flow** — docs_system_flow_official_flow_c, docs_system_flow_negotiation_state_machine, docs_system_flow_payment_gated_unlock, docs_frontend_backend_contract_endpoint_map [EXTRACTED 1.00]
- **Cognito Group-Based Tiered Access Control** — backend_readme_auth_architecture, backend_readme_role_management, docs_requirements_tiered_access_control, docs_overview_role_hierarchy [EXTRACTED 1.00]
- **AWS and OpenTofu CI/CD Deployment Automation** — _github_workflows_deploy_dev_deploy_job, _github_workflows_ephemeral_deploy_and_test_job, _github_workflows_ephemeral_destroy_job [EXTRACTED 1.00]

## Communities (74 total, 30 thin omitted)

### Community 0 - "Persona Wizard Modal & Form Validation"
Cohesion: 0.05
Nodes (64): DEFAULT_DRAFT_SNAPSHOT, Errors, FieldError(), PersonaWizardModal(), focusFirstError(), goNext(), handleSubmit(), STEP_TITLES (+56 more)

### Community 1 - "Persona Management Controller & Handlers"
Cohesion: 0.09
Nodes (21): create_persona(), delete_persona(), get_persona(), get_persona_for_review(), list_personas(), update_persona(), Forms, ContactMode (+13 more)

### Community 2 - "Appointment & Proposed Slot Models"
Cohesion: 0.09
Nodes (6): Appointment, ProposedSlot, AppointmentRepo, PsychologistRepo, _create(), _create()

### Community 3 - "Frontend API Client & Anonymization"
Cohesion: 0.06
Nodes (41): AdminUserPageRaw, anonymizedCodeByUuid, anonymizedPsychCode(), AppointmentRaw, buildBackendError(), durationLabel(), fetchServices(), fetchWithTimeout() (+33 more)

### Community 4 - "Frontend Dependencies & Libraries"
Cohesion: 0.04
Nodes (44): dependencies, @hookform/resolvers, lucide-react, next, react, react-dom, react-hook-form, @tanstack/react-query (+36 more)

### Community 5 - "Services Catalog Controller & Endpoints"
Cohesion: 0.09
Nodes (11): list_services(), list_services_active(), Service, ServiceRepo, seed_services(), _service_id(), ServiceUsecase, _create() (+3 more)

### Community 6 - "Alembic Migrations & DB Runtime"
Cohesion: 0.06
Nodes (15): run_migrations_offline(), run_migrations_online(), downgrade(), upgrade(), upgrade(), upgrade(), downgrade(), upgrade() (+7 more)

### Community 7 - "Auth & CMS Pages"
Cohesion: 0.14
Nodes (29): LoginPage(), ConfirmStep(), RegisterPage(), AdminCmsPage(), AdminUsersPage(), formatDate(), roleLabels, RoleTag() (+21 more)

### Community 8 - "Frontend Layout & Typography"
Cohesion: 0.09
Nodes (19): bodyFont, headingFont, metadata, RootLayout(), Providers(), AdminDashboardLayout(), navLinks, BookFallbackPage() (+11 more)

### Community 9 - "Client Bookings & Scheduling UI"
Cohesion: 0.17
Nodes (31): ClientBookingsPage(), FILTER_TABS, PreferredScheduleList(), DeadlineNotice(), ScheduleAgreementPage(), displayValue(), formatForManilaInput(), formatReviewDate() (+23 more)

### Community 10 - "Auth Store & State Management"
Cohesion: 0.08
Nodes (22): SiteLayout(), AuthState, AuthStore, AuthUser, globalForAuth, LoginPayload, ROLE_DASHBOARD, useAuthStore (+14 more)

### Community 11 - "User Registration & Strength UI"
Cohesion: 0.09
Nodes (29): PasswordStrengthBar(), ResendCodeButton(), STRENGTH_CONFIG, authApi, ConfirmCredentials, ForgotPasswordConfirmCredentials, LoginCredentials, LoginResponse (+21 more)

### Community 12 - "Authentication Controller & Cognito API"
Cohesion: 0.12
Nodes (12): confirm_forgot_password(), confirm_user(), create_user(), delete_user(), get_user(), login_user(), logout_user(), refresh_access_token() (+4 more)

### Community 13 - "Psychologist Dashboard & Appointment Controller"
Cohesion: 0.13
Nodes (15): accept_preferred_slot(), complete_appointment(), counter_offer(), get_my_profile(), list_my_appointments(), list_pending_appointments(), pickup_appointment(), update_my_profile() (+7 more)

### Community 14 - "Appointment Management & Payments API"
Cohesion: 0.22
Nodes (13): accept_counter_slot(), cancel_appointment(), create_appointment(), get_appointment(), get_payments(), get_slots(), initiate_payment(), list_appointments() (+5 more)

### Community 15 - "Marketing Homepage & About Grid"
Cohesion: 0.15
Nodes (21): HomePage(), SERVICE_SUBTEXTS, SERVICE_TINTS, AboutGrid(), AboutTint, CardHeading(), ClinicCard(), RosterCard() (+13 more)

### Community 16 - "Authentication Errors & Token Lifecycle"
Cohesion: 0.12
Nodes (4): NotFoundError, UnauthenticatedError, AuthTokens, FakeAuthService

### Community 17 - "Authentication Dependencies & Profiles"
Cohesion: 0.18
Nodes (7): get_current_psychologist(), get_current_user(), AdminProfile, ClientProfile, PsychologistProfile, User, UserRepository

### Community 18 - "Cognito User Attributes & Management"
Cohesion: 0.12
Nodes (3): AuthUser, CognitoService, _handle_cognito_errors()

### Community 19 - "Admin User Management & Promotion"
Cohesion: 0.14
Nodes (6): list_users(), promote_psychologist(), update_user_role(), AdminUserPage, PromotePsychologistRequest, UpdateUserRoleRequest

### Community 20 - "Test Suite Authentication Fixtures"
Cohesion: 0.17
Nodes (17): get_claims(), auth_override(), client(), create_admin_user(), _create(), create_appointment(), create_client_user(), _create() (+9 more)

### Community 22 - "Domain Exceptions & HTTP Handlers"
Cohesion: 0.22
Nodes (4): BadRequestError, ConflictError, DomainError, PsychologistUsecase

### Community 23 - "Authentication Service Interface & DTOs"
Cohesion: 0.14
Nodes (5): SignUpResult, ConfirmUserRequest, ForgotPasswordConfirm, RefreshTokenRequest, ResetPasswordRequest

### Community 24 - "Time Utilities & Payment Deadlines"
Cohesion: 0.23
Nodes (10): ValidationError, now_manila(), payment_deadline_for(), slot_end(), slot_start(), interval_for(), intervals_overlap(), slot_interval() (+2 more)

### Community 25 - "Ephemeral Test Database Setup"
Cohesion: 0.14
Nodes (9): ensure_test_database(), api_url(), authenticated_user_factory(), _create_and_login(), aws_region(), cognito_client(), cognito_user_pool_id(), future_slot_inputs() (+1 more)

### Community 26 - "CI/CD Workflows & Backend Architecture"
Cohesion: 0.10
Nodes (19): Deploy Dev GitHub Actions Workflow, Ephemeral Environment Deploy and Test Workflow, Ephemeral Environment Teardown and Cleanup Workflow, PsychAve Backend Architecture & Tech Stack, Backend Pinned Dependencies, Frontend to Backend Endpoint Map, Frontend to Backend Field & Schema Mapping, Backend Implementation Order Roadmap (+11 more)

### Community 27 - "PayMongo Payment Provider"
Cohesion: 0.11
Nodes (4): WebhookEvent, PayMongoPaymentProvider, DummyProvider, TestPaymentController

### Community 28 - "User Filtering & Pagination Models"
Cohesion: 0.21
Nodes (3): UserRole, AdminUserRead, AdminUsecase

### Community 29 - "User Model & Role Enum"
Cohesion: 0.22
Nodes (14): UserCreate, UserLogin, auth_usecase(), fake_auth(), session(), test_confirm_user_and_sync(), test_create_user_admin_not_allowed(), test_create_user_client_success() (+6 more)

### Community 30 - "Appointment Scheduling Negotiation Enums"
Cohesion: 0.16
Nodes (5): get_payment_provider(), _init_provider(), InitiatedPayment, PaymentProvider, FakePaymentProvider

### Community 31 - "Client-First Scheduling Specifications"
Cohesion: 0.15
Nodes (8): botocore_error_handler(), cognito_error_handler(), domain_error_handler(), forbidden_handler(), health_check(), unauthenticated_handler(), unhandled_exception_handler(), user_not_found_handler()

### Community 32 - "Test Configuration & Mocks"
Cohesion: 0.18
Nodes (3): PaymentStatus, test_initiate_payment_persists_in_supabase(), test_payment_webhook_fulfillment_confirms_appointment()

### Community 33 - "Frontend Primitives & UI Components"
Cohesion: 0.13
Nodes (5): test_client_isolation_access_denied(), test_update_persona(), test_api_integration_with_supabase(), test_supabase_db_connection(), test_transactional_isolation_rollback()

### Community 34 - "Services Catalog & Durations"
Cohesion: 0.20
Nodes (3): PaymentUsecase, TestPaymentUsecase, db_get()

### Community 35 - "Client-Psychologist Negotiation Flow"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 36 - "Scheduling Status & Turn Models"
Cohesion: 0.28
Nodes (5): AppointmentStatus, SchedulingTurn, SlotProposer, SlotStatus, ProposedSlotRead

### Community 39 - "Auth Usecase & User Provisioning"
Cohesion: 0.16
Nodes (6): confirm_forgot_password(), confirm_user(), _ensure_local_user(), _ensure_role_profile(), role_from_groups(), _sync_user()

### Community 40 - "App Router & Payment Schemas"
Cohesion: 0.27
Nodes (5): get_db(), PaymentInitiateRequest, PaymentRead, PaymentWebhookRequest, ServiceRead

### Community 41 - "Ephemeral Preferred Scheduling Integration Tests"
Cohesion: 0.30
Nodes (6): _first_active_service(), test_booking_preferred_slots_validation(), test_direct_pickup_payment_conflict_and_completion_flow(), test_multi_round_negotiation_and_cancel_flow(), test_health_check(), test_public_services_catalog_unauthenticated()

### Community 47 - "Auth Controller Integration Tests"
Cohesion: 0.32
Nodes (3): client(), fake_auth(), session()

### Community 49 - "Supabase End-to-End Booking Tests"
Cohesion: 0.29
Nodes (3): test_book_appointment_end_to_end(), test_cancel_appointment(), test_slot_selection_lifecycle()

### Community 50 - "Role-Based Access Control Architecture"
Cohesion: 0.40
Nodes (6): Cognito Gateway and Token Verification Architecture, Admin Role Management and Psychologist Promotion, Cognito ID Token Verification Contract, Platform User Roles and Access Hierarchy, Tiered Role-Based Access Control and Security Guardrails, Payment-Gated Contact Information Unlock

### Community 53 - "Role Enforcement Middleware"
Cohesion: 0.50
Nodes (3): ForbiddenError, require_role(), role_checker()

### Community 56 - "Vercel Deployment Configuration"
Cohesion: 0.50
Nodes (3): framework, ignoreCommand, $schema

## Knowledge Gaps
- **27 isolated node(s):** `react-dom`, `@tailwindcss/postcss`, `@testing-library/user-event`, `@types/node`, `@types/react` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 415 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UserRole` connect `User Filtering & Pagination Models` to `Test Configuration & Mocks`, `Persona Management Controller & Handlers`, `Frontend Primitives & UI Components`, `Services Catalog Controller & Endpoints`, `Auth Usecase & User Provisioning`, `Authentication Controller & Cognito API`, `Appointment Management & Payments API`, `Authentication Dependencies & Profiles`, `Supabase End-to-End Booking Tests`, `Admin User Management & Promotion`, `Test Suite Authentication Fixtures`, `Role Enforcement Middleware`, `User Model & Role Enum`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 50 inferred relationships involving `UserRole` (e.g. with `list_users()` and `promote_psychologist()`) actually correct?**
  _`UserRole` has 50 INFERRED edges - model-reasoned connections that need verification._
- **What connects `react-dom`, `@tailwindcss/postcss`, `@testing-library/user-event` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Persona Wizard Modal & Form Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.0505175983436853 - nodes in this community are weakly interconnected._
- **Why does `CognitoService` connect `Cognito Identity Provider Service` to `Cognito User Attributes & Management`, `Admin User Management & Promotion`, `User Filtering & Pagination Models`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 38 inferred relationships involving `User` (e.g. with `list_users()` and `promote_psychologist()`) actually correct?**
  _`User` has 38 INFERRED edges - model-reasoned connections that need verification._
- **Should `Persona Management Controller & Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.08531746031746032 - nodes in this community are weakly interconnected._