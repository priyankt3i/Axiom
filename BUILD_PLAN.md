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

## 🔄 Phase 2.2: Production Infrastructure Integration (Pending)
The following tasks are required to move from the local backend provider layer into live production infrastructure.

- [ ] **Temporal Cluster Setup**: Deploy a self-hosted Temporal Cluster or connect to Temporal Cloud. Link `engineeringWorkflow.ts` to actual Temporal Workers.
- [ ] **PostgreSQL Domain ORM**: Convert the richer `schema.sql` domain model to Prisma/Drizzle migrations and repositories. The current PostgreSQL adapter persists app state in `hermes_app_*` tables with JSONB payloads; the full normalized domain model is still pending.
- [ ] **Kubernetes Agent Sandbox**: Write the underlying Docker build pipelines and Kubernetes job definitions that the QA Agent (Hermes-SDET-01) will spin up via the Temporal activities.
- [ ] **Hermes Engine Implementation**: Connect `hermesConfig.ts` system prompts and tool schemas to a real agent execution framework (like Langchain or a custom agent loop), and execute real LLM loops during the `DEVELOPER_LOOP` and `QA_VERIFICATION` Temporal activities.
- [ ] **GitHub App Automation**: Extend the current OAuth foundation with GitHub App installation tokens to automatically checkout branches, commit code, and open PRs.
- [ ] **Email Delivery for Invites**: Connect signed invitation creation to an email provider so administrators do not need to manually copy local invite links.
- [ ] **Provider Adapter Consumption**: Wire the encrypted provider credentials into GitHub App, Jira, Linear, Jenkins, Temporal, and Kubernetes adapter implementations.
- [ ] **Frontend & E2E Test Suite**: Add frontend interaction tests and browser-level workflow tests. Backend integration coverage now exists via `npm run test:backend`.

## Goal Check
- Did we implement 100% of the requested elements? **No. The frontend-only mock has been replaced with a real backend foundation, OAuth entry point, RBAC/user administration, signed invite links, encrypted integration secret storage, JSON/PostgreSQL app-state persistence, a durable local queue worker, and backend-owned workflow state, but the live Temporal/Kubernetes/GitHub App/Hermes adapters, provider credential consumption, email delivery, and normalized domain ORM are still pending.**
- Do we have the production code ready to switch to prod? **Partially. The app now has production-shaped backend boundaries, but production infrastructure adapters still need to be implemented and tested.**
