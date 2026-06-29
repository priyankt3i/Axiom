# Changelog

## [Unreleased] - Production Pending Work Audit

### Added
- Production startup validation for required `SESSION_SECRET` and `INTEGRATION_ENCRYPTION_KEY` values.
- `GITHUB_ALLOWED_EMAIL_DOMAINS` configuration for controlled production GitHub OAuth self-provisioning.
- `GITHUB_ALLOWED_ORGS` configuration for controlled production GitHub OAuth self-provisioning by GitHub organization membership.
- `GITHUB_ALLOWED_TEAMS` configuration for controlled production GitHub OAuth self-provisioning by active GitHub team membership.
- `ENABLE_LEGACY_DISPATCH` escape hatch for explicitly exposing the legacy simulation dispatch endpoint in production.
- `ENABLE_LOCAL_WORKFLOW_RUNNER` escape hatch for explicitly allowing the local/offline workflow runner in controlled production demos or staging runs.
- `ENABLE_LOCAL_REVIEW_ACTIONS` escape hatch for explicitly allowing local state-only approve/rollback in controlled production demos or staging runs.
- `DEV_LOGIN_TOKEN` requirement for production dev-login when `ENABLE_DEV_LOGIN=true`.
- `INVITE_EMAIL_WEBHOOK_URL`, `INVITE_EMAIL_WEBHOOK_TOKEN`, and `INVITE_EMAIL_WEBHOOK_TIMEOUT_MS` settings for optional invite email webhook delivery.
- Backend integration coverage for OAuth redirect sanitization, organization/team-scope OAuth authorization, and non-admin settings metadata filtering.
- Backend integration coverage proving production rejects local simulation job execution by default.
- Backend integration coverage proving production dev-login requires a token and disabled local-runner recovery fails stranded jobs.
- Backend integration coverage proving Business Analyst job responses redact actual cost, token counts, raw diffs, stdout, and test XML while admin responses retain them.
- Backend integration coverage proving production approve/rollback reject without a real review adapter or explicit local-review escape hatch.
- Backend integration coverage proving GitHub App credentials are consumed from encrypted storage, merged by secret key, and validated as installation-token prerequisites.
- Backend integration coverage proving GitHub App installation-token verification calls the GitHub API with a signed JWT and does not return the token to clients.
- Backend integration coverage proving GitHub App repository-access verification uses the installation token server-side and returns sanitized default-branch metadata without returning the token.
- Backend integration coverage for invite webhook delivery status and payload shape.
- Transaction-scoped PostgreSQL advisory lock around app-state mutations to serialize cross-instance read-modify-write updates.

### Changed
- Expanded `BUILD_PLAN.md` Phase 2.2 tracking with production hardening items found during repo review: OAuth admission control, production secret enforcement, settings metadata RBAC, truthful provider health/status reporting, concurrency-safe PostgreSQL repositories, simulation retirement, and integration documentation reconciliation.
- Production GitHub OAuth now blocks uninvited self-provisioning unless the email domain is explicitly allowed, and newly admitted production OAuth users default to Business Analyst.
- Production GitHub OAuth can also admit new users by verified membership in a configured GitHub organization or team.
- OAuth redirect targets are normalized to safe local paths before persistence.
- `/api/settings` now withholds user lists, invitation history, integration metadata, and stored secret key names from non-administrator sessions.
- Runtime provider labels now report the local durable queue and local sandbox provider until real Temporal/Kubernetes execution adapters are active.
- `doc/INTEGRATIONS.md` now distinguishes implemented OAuth, encrypted credential storage, local workflow execution, and manual invite links from pending production adapters.
- `/api/dispatch` now returns `410 Gone` in production unless `ENABLE_LEGACY_DISPATCH=true`; `/api/jobs` remains the primary backend-owned workflow entry point.
- `/api/jobs` now returns `503 WORKFLOW_PROVIDER_NOT_CONFIGURED` in production unless `ENABLE_LOCAL_WORKFLOW_RUNNER=true`, preventing the local artifact generator from running as implicit production execution.
- Startup recovery now marks interrupted or queued local-runner jobs failed when the production local runner is disabled, instead of requeueing work to an inactive worker.
- Job APIs now serialize job artifacts by caller role so Business Analysts can monitor task state without receiving manager-only review artifacts or actual ledger fields.
- Approve and rollback endpoints now return `503 REVIEW_ADAPTER_NOT_CONFIGURED` in production unless `ENABLE_LOCAL_REVIEW_ACTIONS=true`, preventing simulated Git/Hermes review actions from being recorded as production work.
- Stored integration updates now merge secret keys for an existing provider instead of replacing the full secret set, allowing multi-key provider credentials to be added incrementally.
- Settings now reports GitHub App credential readiness after decrypting stored `app_id`, `installation_id`, and `private_key` values and signing a local GitHub App JWT.
- Added admin-only GitHub App installation-token verification using `GITHUB_API_BASE_URL`, returning sanitized expiration, repository-selection, and permission metadata without exposing the access token.
- Added admin-only GitHub App repository-access verification for `owner/repo` targets, including default branch ref lookup and sanitized repository permissions.

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
