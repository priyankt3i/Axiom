# Build Plan & Project Tracking

This document stores all information about what has been completed and what needs to be done to achieve the end goal from the original prompt.

## ✅ Phase 1: Core Architecture & UI Delivery (Completed)
- [x] **Product Vision & Task Lifecycle Mapping**: Implemented UI tracking for all 7 phases (Ingestion to Merge/Rollback).
- [x] **Strict UI/UX Specification**: Achieved minimalist monochrome palette, technical utility aesthetics, and all four core React views (Dispatcher, Pipeline, Audit Trail, Ledger).
- [x] **Architecture Flowchart**: Delivered `architecture/DATA_FLOW.md`.
- [x] **Database Schema**: Delivered `src/operational-code/schema.sql`.
- [x] **Temporal Workflow Code**: Delivered `src/workflows/engineeringWorkflow.ts`.
- [x] **Hermes Agent Configuration**: Delivered `src/agents/hermesConfig.ts`.
- [x] **Backend Cost Estimator**: Implemented dynamic estimation logic in `server.ts`.
- [x] **Simulated Sandbox Pipeline**: Created high-fidelity dummy outputs for the AI iterations to showcase the UI state changes.

## ✅ Phase 1.5: UI Refactoring & Modularization (Completed)
- [x] **Component Modularity**: Refactored monolithic `App.tsx` into multiple dedicated modular components (`DispatcherTab.tsx`, `PipelineTab.tsx`, `AuditTab.tsx`, etc.).
- [x] **Terminology De-jargonification**: Cleaned up excessive technical labels in the UI, enforcing literal and humble naming conventions (e.g., "Developer AI" instead of "Hermes-Dev-01", "Task History" instead of "Job History & Active Queue").
- [x] **Live Drop-In Functionality**: Added a "Drop-In" modal during task dispatching that lets the user inspect a virtual browser view and agent terminal execution in real-time.

## ✅ Phase 2.1: Backend, Auth, RBAC, and Persistence Foundation (Completed)
- [x] **Server-Owned Application State**: Moved job creation, pipeline progress, audit logs, approval, rollback, history, and ledger updates behind Express APIs instead of React-only timed state.
- [x] **Persistent Local Store**: Added server-side JSON persistence under `.data/hermes-store.json` for users, sessions, OAuth state, jobs, logs, and ledger rows.
- [x] **OAuth Entry Point**: Added GitHub OAuth authorization and callback routes driven by `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `APP_URL`.
- [x] **Development Login**: Added a local admin login path for non-production development.
- [x] **Session Security**: Added signed HTTP-only cookies and CSRF tokens for mutating API requests.
- [x] **RBAC**: Added Administrator, Manager, and Business Analyst role enforcement. Managers/Admins can approve or rollback; Business Analysts can dispatch and monitor but cannot approve or view ledger data.
- [x] **Backend-Aware UI**: Rewired the React shell to authenticate first, poll backend jobs, display persisted history/ledger/settings, and gate review actions by role.
- [x] **Provider Status UI**: Replaced static settings/system-status claims with runtime status for GitHub OAuth, Gemini, Temporal, Postgres, and Kubernetes providers.
- [x] **PostgreSQL App-State Adapter**: Added a `pg`-backed storage provider selected by `DATABASE_URL`, automatic `hermes_app_*` table initialization, and `src/operational-code/app_state_postgres.sql` for runtime app-state persistence.
- [x] **Configurable Server Port**: Added `PORT` support so dev, staging, and production deployments are not hard-coded to port 3000.
- [x] **User Invitation & Role Admin**: Added admin-only invite and role-change APIs, invited/active user status, last-active-admin protection, and Settings UI controls for user administration.
- [x] **Durable Local Queue Worker**: Changed dispatch to persist `QUEUED` jobs, added queue metadata, worker claiming, queue-state persistence, configurable polling, and startup requeue recovery for interrupted local work.
- [x] **Backend Integration Tests**: Added `npm run test:backend` with coverage for auth/session, CSRF, RBAC, invitations, role changes, ledger denial, and durable queue completion.
- [x] **Integration Secret Storage**: Added admin-only encrypted provider credential storage, sanitized settings payloads, Settings UI controls, and backend integration test coverage.
- [x] **Signed Invitation Links**: Added hashed one-time invite tokens, invite acceptance sessions, Settings link copy/status UI, PostgreSQL app-state support, and backend integration coverage.
- [x] **Production Auth Hardening Baseline**: Added production startup validation for session/encryption secrets, sanitized OAuth redirect targets, restricted production GitHub OAuth self-provisioning to configured email domains, configured GitHub organizations, or existing invited users, and defaulted new production OAuth users to Business Analyst.
- [x] **Settings Metadata RBAC Baseline**: Stopped non-administrator sessions from receiving user lists, invitation history, integration metadata, or stored secret key names from `/api/settings`.
- [x] **Provider Status Truthfulness Baseline**: Changed runtime provider labels so Temporal and Kubernetes environment flags no longer imply that real Temporal/Kubernetes execution is active while jobs still run through the local provider path.
- [x] **Integration Documentation Reconciliation**: Updated `doc/INTEGRATIONS.md` to separate implemented credential/status behavior from pending GitHub App, Jira, Linear, Jenkins, Temporal, Kubernetes, and invite-email adapters.
- [x] **Legacy Dispatch Quarantine**: Disabled the old `/api/dispatch` simulation endpoint in production unless `ENABLE_LEGACY_DISPATCH=true` is explicitly set. The primary UI path remains `/api/jobs`.
- [x] **PostgreSQL Mutation Serialization Baseline**: Wrapped PostgreSQL app-state mutations in a transaction-scoped advisory lock so concurrent server instances serialize read-modify-write updates instead of overwriting each other's state.
- [x] **Invite Email Webhook Delivery Baseline**: Added optional `INVITE_EMAIL_WEBHOOK_URL` delivery so signed invite links can be handed to an external email service and persisted as `DELIVERED` or `FAILED`.
- [x] **GitHub Team Admission Controls**: Added optional `GITHUB_ALLOWED_TEAMS` checks using `org/team-slug` entries, requested `read:org` during OAuth when teams are configured, and admitted production OAuth users only after active team membership is verified.
- [x] **Production Simulation Execution Guard**: Disabled the local/offline workflow runner in production by default, made `/api/jobs` return `WORKFLOW_PROVIDER_NOT_CONFIGURED` without an explicit `ENABLE_LOCAL_WORKFLOW_RUNNER=true`, and exposed the state through health/settings APIs.
- [x] **Production Escape-Hatch Hardening**: Required `DEV_LOGIN_TOKEN` for production dev-login, rejected missing/invalid dev-login tokens, and changed startup recovery to fail interrupted or queued local-runner jobs when the production local runner is disabled.
- [x] **Job Artifact RBAC Redaction Baseline**: Redacted actual execution cost, token counts, raw diffs, stdout, and test XML from Business Analyst job responses while preserving full review payloads for Managers and Administrators.
- [x] **Production Review Action Guard**: Disabled local state-only approve/rollback in production by default, made review endpoints return `REVIEW_ADAPTER_NOT_CONFIGURED` without `ENABLE_LOCAL_REVIEW_ACTIONS=true`, and exposed review-action status through health/settings APIs.
- [x] **GitHub App Credential Readiness Baseline**: Added decrypted credential consumption for stored `github_app` integrations, validated `app_id`, `installation_id`, and `private_key`, generated a signed GitHub App JWT locally to prove installation-token prerequisites, merged incremental secret updates by key, and surfaced readiness in Settings.
- [x] **GitHub App Installation Token Verification Baseline**: Added an admin-only endpoint that exchanges the signed GitHub App JWT for an installation access token through the GitHub API, returns sanitized verification metadata, and never returns the token to clients.
- [x] **GitHub App Repository Access Verification Baseline**: Added an admin-only endpoint that uses the installation token server-side to verify target repository access, read the default branch, and return sanitized branch/ref metadata without exposing the token.

## 🔄 Phase 2.2: Production Infrastructure Integration (Pending)
The following tasks are required to move from the local backend provider layer into live production infrastructure.

- [ ] **Temporal Cluster Setup**: Deploy a self-hosted Temporal Cluster or connect to Temporal Cloud. Link `engineeringWorkflow.ts` to actual Temporal Workers.
- [ ] **PostgreSQL Domain ORM**: Convert the richer `schema.sql` domain model to Prisma/Drizzle migrations and repositories. The current PostgreSQL adapter persists app state in `hermes_app_*` tables with JSONB payloads; the full normalized domain model is still pending.
- [ ] **Kubernetes Agent Sandbox**: Write the underlying Docker build pipelines and Kubernetes job definitions that the QA Agent (Hermes-SDET-01) will spin up via the Temporal activities.
- [ ] **Hermes Engine Implementation**: Connect `hermesConfig.ts` system prompts and tool schemas to a real agent execution framework (like Langchain or a custom agent loop), and execute real LLM loops during the `DEVELOPER_LOOP` and `QA_VERIFICATION` Temporal activities.
- [ ] **GitHub App Automation**: Extend the current OAuth, credential-readiness, installation-token verification, and repository-access verification foundation with branch creation, commits, PR creation, approve-and-merge, and rollback.
- [ ] **Provider-Specific Invite Email Templates**: Add first-class email provider adapters/templates beyond the current generic invite delivery webhook.
- [ ] **Provider Adapter Consumption**: Wire encrypted provider credentials into live GitHub App, Jira, Linear, Jenkins, Temporal, and Kubernetes adapter implementations. GitHub App credentials are now decrypted and validated for readiness, but live API operations are still pending.
- [ ] **Frontend & E2E Test Suite**: Add frontend interaction tests and browser-level workflow tests. Backend integration coverage now exists via `npm run test:backend`.
- [ ] **Provider Health Checks**: Add real Temporal and Kubernetes live health checks once execution adapters exist, and surface configured-vs-active status separately in the API and UI.
- [ ] **PostgreSQL Row-Level Repositories**: Replace the whole-store JSONB rewrite strategy with row-level repositories and migrations after the normalized domain ORM is introduced.
- [ ] **Simulation Retirement**: Remove `generateOfflineSimulation()` from the `/api/jobs` execution path once real Temporal, GitHub, agent, and sandbox adapters are live. Production no longer runs it by default, but the code path remains for non-production and explicitly enabled demo/staging runs.

## Goal Check
- Did we implement 100% of the requested elements? **No. The frontend-only mock has been replaced with a real backend foundation, OAuth entry point, RBAC/user administration, signed invite links, invite email webhook delivery, encrypted integration secret storage, GitHub App credential readiness, installation-token verification, and repository-access verification, JSON/PostgreSQL app-state persistence, a durable local queue worker, backend-owned workflow state, baseline production auth/settings/status hardening, reconciled integration documentation, hardened production escape hatches, job artifact RBAC redaction, production quarantine for legacy/local simulation execution and review actions, GitHub team admission controls, and serialized PostgreSQL app-state mutations, but the live Temporal/Kubernetes/GitHub App/Hermes repository-operation adapters, provider-specific invite email templates, normalized domain ORM, live provider health checks, row-level Postgres repositories, and removal of the local artifact generator from `/api/jobs` are still pending.**
- Do we have the production code ready to switch to prod? **Partially. The app now has production-shaped backend boundaries, but production infrastructure adapters still need to be implemented and tested.**
