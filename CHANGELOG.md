# Changelog

## [1.8.0] - Signed Invitation Links

### Added
- One-time signed invitation links for administrator-created users.
- Public invitation accept endpoint that activates invited users and issues a signed session plus CSRF token.
- SHA-256 invite token hashing so raw invite tokens are not persisted.
- Sanitized invitation summaries in `/api/settings`.
- Settings UI display for the latest generated invite URL and invitation status history.
- `INVITE_TOKEN_TTL_HOURS` environment setting.
- PostgreSQL app-state table support for `hermes_app_invite_tokens`.

### Changed
- Admin invite creation now returns a copyable signed URL instead of relying only on later OAuth sign-in by email.
- Backend integration tests now verify invite link creation, acceptance, replay rejection, and token non-disclosure in settings.

## [1.7.0] - Encrypted Integration Secret Storage

### Added
- Admin-only `POST /api/integrations` endpoint for creating or replacing encrypted provider credentials.
- Admin-only `DELETE /api/integrations/:integrationId` endpoint for removing stored provider credentials.
- AES-256-GCM encryption for provider secret values before persistence.
- Sanitized integration summaries in `/api/settings` that expose metadata and secret key names without returning secret values.
- Integration secret controls in Settings.
- `INTEGRATION_ENCRYPTION_KEY` environment setting.
- PostgreSQL app-state table support for `hermes_app_integrations`.

### Changed
- Backend integration tests now verify encrypted integration secret creation, sanitized settings output, and RBAC denial for non-admin users.

## [1.6.0] - Backend Integration Test Harness

### Added
- `npm run test:backend` script using Node's built-in test runner and `tsx`.
- Backend integration test covering unauthenticated access, CSRF enforcement, development login, admin invitations, role updates, last-active-admin protection, Business Analyst ledger denial, and durable queue execution.

### Changed
- `server.ts` now exports `app` and `startServer()` for in-process tests and controlled startup.
- `startServer()` now resolves after the HTTP server is actually listening and returns the server instance.
- Added `AXIOM_DISABLE_AUTOSTART` support so tests can import `server.ts` without binding a port at module load.
- Local queue worker interval no longer keeps the process alive on its own.

## [1.5.0] - Durable Local Workflow Queue

### Added
- Durable local queue metadata on jobs: queued/start timestamps, queue state, worker ID, and last error.
- Local workflow worker that polls storage, claims `QUEUED` jobs, and executes work outside the request path.
- Startup recovery that requeues interrupted `IN_PROGRESS` local jobs instead of marking them failed.
- Queue state columns and index in the PostgreSQL app-state schema.
- `LOCAL_WORKER_POLL_MS` environment setting.

### Changed
- `POST /api/jobs` now persists a `QUEUED` job and returns immediately instead of directly invoking the workflow runner.
- Health/settings provider labels now report the local durable queue when Temporal is not configured.

## [1.4.0] - User Invitation and Role Administration

### Added
- Admin-only `POST /api/users/invite` endpoint for creating invited users with assigned roles.
- Admin-only `PATCH /api/users/:userId/role` endpoint for changing roles.
- `ACTIVE` and `INVITED` user status tracking, including invited timestamp and login activation.
- Last-active-administrator protection when changing roles.
- Settings UI invite form and inline role selectors for administrators.

### Changed
- Settings user table now displays full name, status, provider, and role-management controls.
- Auth/user payloads now include status metadata.

## [1.3.0] - PostgreSQL App-State Storage Adapter

### Added
- `pg` PostgreSQL driver and TypeScript types.
- Storage provider abstraction in `server.ts` with JSON fallback and PostgreSQL implementation.
- Automatic PostgreSQL initialization for `hermes_app_users`, `hermes_app_sessions`, `hermes_app_oauth_states`, and `hermes_app_jobs`.
- `src/operational-code/app_state_postgres.sql` documenting the runtime app-state table schema.
- `PORT`, `DATABASE_SSL`, and `STORAGE_PROVIDER` environment settings.
- API error handler for storage/provider failures.

### Changed
- Converted backend auth, session, OAuth, jobs, ledger, settings, and workflow mutations to async storage operations.
- Updated health/settings responses to report the active storage provider.
- Made the Express server port configurable instead of hard-coded to `3000`.

## [1.2.0] - Backend Foundation, OAuth, RBAC, and Persisted State

### Added
- GitHub OAuth authorization and callback routes, configurable with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `APP_URL`.
- Signed HTTP-only session cookies and CSRF tokens for protected mutating API calls.
- Local development admin login for non-production environments.
- Role-based access control for Administrator, Manager, and Business Analyst users.
- Server-side JSON persistence for users, sessions, OAuth state, jobs, logs, rollback markers, and ledger data.
- Backend APIs for jobs, active job polling, cost estimates, ledger data, settings/runtime status, approval, and rollback.
- Backend-owned local workflow runner so the UI no longer performs its own timed task lifecycle simulation.
- Runtime settings view showing actual provider status for GitHub OAuth, Gemini, Temporal, Postgres, and Kubernetes.

### Changed
- Rewired `src/App.tsx` to authenticate users, hydrate dashboard data from the backend, poll job status, and render backend-owned pipeline state.
- Updated Header, Pipeline, Audit, History, Ledger, Settings, and Right Sidebar components to use real backend data and role permissions.
- Corrected documentation to distinguish the completed backend foundation from pending Temporal/Postgres/Kubernetes/GitHub App/Hermes production adapters.

## [1.1.0] - UI Refactoring and Component Modularization

### Added
- **Component Modularity**: Extracted monolithic `App.tsx` into highly modular React components for improved token-limit management and code maintainability:
  - `DispatcherTab.tsx`, `PipelineTab.tsx`, `AuditTab.tsx`, `LedgerTab.tsx`, `HistoryTab.tsx`, `SchemasTab.tsx`
  - `Sidebar.tsx`, `RightSidebar.tsx`, `Header.tsx`
- **Terminology Update**: Streamlined UI copy to remove excessive "tech-larping" (e.g., replaced "Hermes-Dev-01" with "Developer AI", simplified "Temporal Orchestration Workflow" to "Start Task") to adhere to clean, literal, human-readable design constraints.
- **Live Drop-In**: Implemented an interactive live drop-in session overlay in `PipelineTab.tsx` that simulates viewing a virtual browser and agent terminal in real-time while a task is dispatching.

## [1.0.0] - Initial Platform Setup

### Added
- **UI/UX Design**: Implemented strict monochrome, maximum information density design per specifications, featuring JetBrains Mono typography and Technical Utility layout.
- **Core Views**: Developed the Dispatcher, Live Pipeline, Audit Trail (Proof of Work), and Financial Ledger tabs.
- **Backend Simulation**: Built Express backend in `server.ts` to dynamically estimate task costs and simulate real-time agent output logs, test results, and XML.
- **Database Schema**: Created `src/operational-code/schema.sql` defining enterprise schemas for Users, Jobs, JobExecutions, FinancialLedger, and QALogs with rollback constraints.
- **Workflow Engine**: Added `src/workflows/engineeringWorkflow.ts` defining the complete Temporal Workflow lifecycle and rollback state machine.
- **Agent Tooling**: Added `src/agents/hermesConfig.ts` with strict system instructions, tool constraints, and prompt designs for Hermes-Dev-01 and Hermes-SDET-01.
- **Architecture**: Created `architecture/DATA_FLOW.md` outlining ASCII architectural components and data lifecycles.
- **Project Documentation**: Added `README.md`, `CHANGELOG.md`, `BUILD_PLAN.md`, and `manifest.json`.
