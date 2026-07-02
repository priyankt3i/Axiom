# Hermes Multi-Agent Orchestrator

Enterprise-grade multi-agent software engineering task scheduler, pipeline orchestrator, sandbox verification environment, and audit log ledger.

The app now has a real Express backend boundary for authentication, RBAC, encrypted integration credentials, persisted task records, durable queue state, audit state, and ledger state. The long-running agent execution still uses the local durable queue worker until Temporal, the real Hermes agent loop, sandbox-backed execution, and automatic GitHub workflow wiring are connected.

## Project Structure

- `src/App.tsx`: React shell that authenticates users, calls backend APIs, polls active jobs, and renders the Dispatcher, Pipeline, Audit Trail, Ledger, History, Settings, and Schema views.
- `src/operational-code/schema.sql`: Full PostgreSQL domain schema defining Users, Roles, Jobs, JobExecutions, FinancialLedger, and QALogs.
- `src/operational-code/app_state_postgres.sql`: Runtime app-state tables used by the active `server.ts` PostgreSQL storage adapter.
- `src/workflows/engineeringWorkflow.ts`: Temporal workflow definition that orchestrates the job ingestion, developer loop, QA verification, PR creation, and rollback state machine.
- `src/agents/hermesConfig.ts`: System prompts and tool configurations for the Developer Agent (Hermes-Dev-01) and QA Agent (Hermes-SDET-01).
- `architecture/DATA_FLOW.md`: Detailed system architecture and data flowchart.
- `server.ts`: Express backend handling signed sessions, GitHub OAuth callback flow, local development login, CSRF protection, RBAC, signed invitation links, encrypted integration secret storage, JSON or PostgreSQL storage, dynamic cost estimation, job APIs, ledger APIs, settings APIs, durable local queue worker, approve/merge, rollback, and local workflow execution.

## Production Readiness

The UI is no longer the owner of the task simulation. Jobs, logs, review state, approval, rollback, history, users, and ledger rows are now backend-owned and persisted under `.data/hermes-store.json` by default.

**Implemented Backend Foundation:**
1. **OAuth and Sessions**: GitHub OAuth is available when `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `APP_URL` are configured. Local admin login is available in development. In production, GitHub OAuth admits existing/invited users by default; new OAuth users must match `GITHUB_ALLOWED_EMAIL_DOMAINS`, `GITHUB_ALLOWED_ORGS`, or `GITHUB_ALLOWED_TEAMS`. If `ENABLE_DEV_LOGIN=true` is ever used in production, `DEV_LOGIN_TOKEN` is required and must be sent as `X-Dev-Login-Token`.
2. **RBAC and User Administration**: Administrator and Manager roles can approve or rollback; Business Analyst users can dispatch and monitor tasks but cannot access ledger or review actions. Business Analyst job responses redact actual execution costs, token counts, raw diffs, stdout, and test XML. Administrators can invite users with signed one-time links and change roles from Settings.
3. **Persistent App State**: Users, sessions, OAuth state, jobs, logs, rollback markers, and ledger data are persisted through a storage provider. Local development uses `.data/hermes-store.json`; production can use PostgreSQL by setting `DATABASE_URL`.
4. **Backend-Owned Workflow State**: The UI creates jobs through `/api/jobs` and polls backend state instead of running its own timed workflow.
5. **Operational APIs**: `/api/auth/session`, `/api/invitations/accept`, `/api/jobs`, `/api/jobs/active`, `/api/ledger`, `/api/settings`, `/api/estimate-cost`, approve, and rollback endpoints are implemented.
6. **PostgreSQL Adapter**: When `DATABASE_URL` is configured, the backend creates and uses `hermes_app_*` PostgreSQL tables with indexed columns and JSONB payloads for the current app-state contract.
7. **Durable Local Queue**: Job dispatch persists `QUEUED` records first; a backend worker claims pending jobs, marks queue state, and requeues interrupted local work on restart. In production this local simulation runner is disabled by default unless `ENABLE_LOCAL_WORKFLOW_RUNNER=true`.
8. **Encrypted Integration Secrets**: Administrators can store provider credentials from Settings. Secret values are AES-256-GCM encrypted before persistence and are never returned by the API. Stored GitHub App credentials are decrypted server-side for readiness validation so the app can verify `app_id`, `installation_id`, and `private_key` prerequisites before live GitHub App automation is implemented.
9. **GitHub App Repository Baseline**: Administrators can verify installation-token exchange, repository/default-branch access, create/delete a feature branch, commit UTF-8 file content to a branch, open a pull request, read PR status, merge a PR, and approve or rollback jobs with persisted PR/branch metadata without exposing the installation token to clients.
10. **Podman Sandbox Execution Baseline**: When `SANDBOX_PROVIDER=podman` is configured, administrators can run a no-network container sentinel check through `/api/sandbox/verify` and a fixed workspace artifact smoke command through `/api/sandbox/execute-smoke`.

**Still Pending Production Adapters:**
1. **Temporal Worker Runtime**: `src/workflows/engineeringWorkflow.ts` is still a typed workflow definition, not yet wired to a live worker.
2. **PostgreSQL Domain ORM**: A PostgreSQL app-state adapter exists, but the full normalized `schema.sql` domain model still needs a Prisma/Drizzle migration and repository layer.
3. **Sandboxed Agent Execution**: Podman verification can prove a local no-network container can run, the Podman command adapter can execute workspace commands with artifact round-trip, and queued jobs attach a job-scoped Podman QA proof when `SANDBOX_PROVIDER=podman`. Server-owned install/build/test/static-analysis commands, optional Git workspace checkout, and GitHub App-authenticated checkout can be configured for the Podman QA proof, but agent-authored file execution is still pending.
4. **GitHub App Automation**: OAuth sign-in, credential readiness, sanitized installation-token verification, repository/default-branch access verification, branch creation/deletion, single-file commits, PR creation, PR status lookup, PR merge, PR-backed job approval, and GitHub/Hermes-backed job rollback are implemented; automatic workflow PR metadata wiring, retryable rollback compensations, and merged-PR revert handling still need repository-operation integration.
5. **Real Agent Loop**: Agent prompts and artifacts are structured, but the Developer/QA loop still uses the local artifact generator unless a real agent provider is connected.

## Getting Started

1. Copy `.env.example` to `.env` and fill in any desired providers.
2. Run `npm run dev`.
3. Open `http://localhost:3000`.
4. Use **Continue as Local Admin** in development, or configure GitHub OAuth and use **Continue with GitHub**.
5. See `BUILD_PLAN.md` for the remaining production adapter work.

## Integration Secrets

Administrators can configure provider credentials in Settings -> Integration Secrets. The backend stores only encrypted secret payloads and returns sanitized metadata with secret key names.

Set `SESSION_SECRET` and `INTEGRATION_ENCRYPTION_KEY` in production. Production startup fails when either value is missing or left at the documented placeholder. Local development can derive an integration encryption key from `SESSION_SECRET`; this is useful for development but should not be treated as production-grade key management.

For GitHub App readiness, store `app_id`, `installation_id`, and `private_key` on the `github_app` integration. Existing provider secrets are merged by key, so these values can be added incrementally. Readiness validates numeric IDs, parses the private key, and signs a local GitHub App JWT.

Administrators can call `POST /api/integrations/github-app/verify` to perform a live installation-token exchange. The API returns sanitized expiration, repository-selection, and permission metadata, but never returns the access token. Set `GITHUB_API_BASE_URL` only when targeting a GitHub Enterprise-compatible API.

Administrators can call `POST /api/integrations/github-app/repository/verify` with `{ "repository": "owner/repo" }` to verify that the installation token can access a target repository and read its default branch ref. If `repository` is omitted, the server uses `DEFAULT_TARGET_REPOSITORY`.

Administrators can call `POST /api/integrations/github-app/branches` with `{ "repository": "owner/repo", "branchName": "feature/name" }` to create a branch from the verified default branch ref. The response returns sanitized branch metadata and never returns the installation token.

Administrators can call `POST /api/integrations/github-app/branches/delete` with `{ "repository": "owner/repo", "branchName": "feature/name" }` to delete a non-default branch ref through the GitHub App. The response returns sanitized deletion metadata and never returns the installation token.

Administrators can call `POST /api/integrations/github-app/file-commits` with `{ "repository": "owner/repo", "branchName": "feature/name", "filePath": "path/to/file.ts", "content": "...", "commitMessage": "..." }` to commit UTF-8 file content to the target branch. The response returns sanitized commit/blob metadata and never returns the installation token.

Administrators can call `POST /api/integrations/github-app/pull-requests` with `{ "repository": "owner/repo", "branchName": "feature/name", "title": "feat: title", "body": "..." }` to open a pull request from the feature branch to the default branch. `baseBranch` and `draft` are optional. The response returns sanitized PR metadata and never returns the installation token.

Administrators can call `POST /api/integrations/github-app/pull-requests/status` with `{ "repository": "owner/repo", "pullRequestNumber": 123 }` to read sanitized PR state, mergeability, head/base refs, and author metadata. `POST /api/integrations/github-app/pull-requests/merge` merges the PR with optional `mergeMethod`, `commitTitle`, `commitMessage`, and `expectedHeadSha`.

Set `ENABLE_GITHUB_APP_REVIEW_ACTIONS=true` to make production `POST /api/jobs/:jobId/approve` merge the job's persisted pull request metadata through the GitHub App adapter. Without persisted PR metadata on the job, production approval rejects with `PULL_REQUEST_METADATA_REQUIRED`.

Set `ENABLE_GITHUB_APP_ROLLBACK_ACTIONS=true` and `HERMES_MEMORY_EVICTION_WEBHOOK_URL` to make production `POST /api/jobs/:jobId/rollback` delete the job's persisted non-default feature branch through the GitHub App adapter, call the Hermes memory eviction webhook, persist `ROLLED_BACK` state, and return the rollback snapshot. `HERMES_MEMORY_EVICTION_WEBHOOK_TOKEN` adds a bearer token, and `HERMES_MEMORY_EVICTION_WEBHOOK_TIMEOUT_MS` controls delivery timeout.

`ENABLE_DEV_LOGIN` is intended for local development. Production startup requires `DEV_LOGIN_TOKEN` when this escape hatch is enabled, and `/api/auth/dev-login` rejects requests that do not include the token in `X-Dev-Login-Token`.

## Sandbox Runtime

Set `SANDBOX_PROVIDER=podman` to use the local Podman verification provider. Configure `PODMAN_BIN`, `PODMAN_IMAGE`, `PODMAN_MEMORY`, `PODMAN_CPUS`, and `SANDBOX_TIMEOUT_MS` as needed.

Administrators can call `POST /api/sandbox/verify` to run `podman --version` and then execute a no-network container command that must return `sandbox-ready`. The endpoint uses `--pull never`, so the configured image must already be available locally.

Administrators can call `POST /api/sandbox/execute-smoke` to run a fixed workspace smoke command through the reusable Podman execution adapter. The adapter uses `--network none`, `--pull never`, memory/CPU limits, `--pids-limit 256`, dropped capabilities, `no-new-privileges`, a read-only root filesystem, a tmpfs `/tmp`, and a mounted `/workspace` volume. The smoke verifies that artifacts written in the container workspace are visible to the backend.

Set `SANDBOX_INSTALL_COMMAND`, `SANDBOX_BUILD_COMMAND`, `SANDBOX_TEST_COMMAND`, and `SANDBOX_STATIC_ANALYSIS_COMMAND` to define the server-owned command manifest for job QA verification. Non-empty commands run in order inside the Podman workspace and capture stdout, stderr, summary, and JUnit artifacts. Keep these commands deterministic and compatible with `--network none`; images should already contain required dependencies or use a pre-populated mounted workspace.

Set `SANDBOX_CHECKOUT_PROVIDER=git` to clone a repository into the Podman workspace before the command manifest runs. `SANDBOX_REPOSITORY_URL` can override the job target repository URL, `SANDBOX_CHECKOUT_REF` can override the job branch/ref, and `GIT_BIN`/`GIT_CLONE_TIMEOUT_MS` control the local clone command. Set `SANDBOX_CHECKOUT_AUTH_PROVIDER=github_app` to mint a GitHub App installation token from the stored `github_app` integration and pass it to Git as an authorization header. Job responses report that GitHub App checkout auth was used but never return the token.

This proves the sandbox can materialize a Git workspace and execute bounded workspace commands; the actual Developer/QA agent loop still needs to be wired into agent-authored files before production autonomous execution is complete.

When `SANDBOX_PROVIDER=podman` is active, the local workflow QA retry phase also runs the configured command manifest, or a fixed job-scoped proof when no manifest commands are configured, and records the resulting artifact metadata on the manager-visible QA iteration. This is a bridge into the job pipeline; it is not yet a replacement for real repository checkout or agent-authored file execution.

## Verification

- `npm run lint`: TypeScript compile check.
- `npm run build`: Production frontend and backend bundle.
- `npm run test:backend`: Backend integration test covering session auth, CSRF, signed admin invites, invite acceptance, role changes, last-admin protection, encrypted integration secrets, Podman sandbox verification, smoke command execution, Git checkout workspace materialization, job-scoped QA command manifests, GitHub App branch creation/deletion/file commits/PR creation/status/merge, GitHub-backed job approval/rollback, Hermes memory eviction webhook delivery, Business Analyst ledger denial, and durable queue execution.

## Workflow Queue

`POST /api/jobs` now persists a queued job and returns immediately. The local worker polls storage, claims pending jobs, marks them `RUNNING`, and advances the stored pipeline state. If the server restarts while local work is in progress, startup recovery returns those jobs to `QUEUED` so the worker can retry them.

`LOCAL_WORKER_POLL_MS` controls the local worker polling interval. Temporal remains the target production workflow runtime.

In production, `/api/jobs` rejects new work with `WORKFLOW_PROVIDER_NOT_CONFIGURED` unless `ENABLE_LOCAL_WORKFLOW_RUNNER=true` is explicitly set. This prevents the remaining local artifact generator from masquerading as production execution while the real Temporal, agent, GitHub App, and sandbox adapters are still being built.

On startup, interrupted or queued local-runner jobs are marked failed when the production local runner is disabled, rather than being requeued to a worker that is not active.

Production approve actions reject with `REVIEW_ADAPTER_NOT_CONFIGURED` unless `ENABLE_GITHUB_APP_REVIEW_ACTIONS=true` or `ENABLE_LOCAL_REVIEW_ACTIONS=true` is explicitly set. Production rollback rejects with `ROLLBACK_ADAPTER_NOT_CONFIGURED` unless `ENABLE_GITHUB_APP_ROLLBACK_ACTIONS=true` and `HERMES_MEMORY_EVICTION_WEBHOOK_URL` are configured, or `ENABLE_LOCAL_REVIEW_ACTIONS=true` is explicitly set. Prefer the GitHub App and Hermes adapters for production; the local review action path is only for controlled staging or demo runs.

The older `/api/dispatch` simulation endpoint is disabled in production unless `ENABLE_LEGACY_DISPATCH=true` is set. The primary UI and backend-owned workflow path use `/api/jobs`.

## Users and Roles

Roles are enforced server-side:

- `ADMINISTRATOR`: Can invite users, change roles, approve/rollback work, view ledger, dispatch tasks, and manage settings.
- `MANAGER`: Can approve/rollback work, view ledger, and dispatch tasks.
- `BUSINESS_ANALYST`: Can dispatch and monitor tasks, but cannot approve, rollback, or view ledger data.

Business Analyst job API responses expose task state and safe PR summary metadata, but redact manager-review artifacts and actual execution ledger fields.

Invited users are persisted with `INVITED` status and receive a one-time signed invite URL. Accepting the URL activates the user and creates a signed session. OAuth sign-in with the invited email still activates invited users as a compatibility path. The backend prevents removing the final active administrator.

## Invitations

Administrators create invites from Settings. The backend stores only a SHA-256 hash of each invite token, returns the raw token once inside the generated URL, and exposes sanitized invitation status in `/api/settings`.

`INVITE_TOKEN_TTL_HOURS` controls invite link lifetime. Set `INVITE_EMAIL_WEBHOOK_URL` to POST invite email payloads to an external email service; when it is unset, administrators copy the generated link from Settings. `INVITE_EMAIL_WEBHOOK_TOKEN` adds a bearer token for that webhook, and `INVITE_EMAIL_WEBHOOK_TIMEOUT_MS` controls delivery timeout.

## Storage

By default, the app uses the JSON storage provider at `.data/hermes-store.json`.

To use PostgreSQL, set:

```bash
DATABASE_URL="postgres://user:password@host:5432/hermes"
STORAGE_PROVIDER="postgres"
DATABASE_SSL="true" # only when your provider requires SSL
```

On startup, `server.ts` creates the `hermes_app_*` tables described in `src/operational-code/app_state_postgres.sql`.

PostgreSQL app-state mutations use a transaction-scoped advisory lock to serialize read-modify-write updates across server instances. The normalized domain ORM and row-level repository layer remain pending production work.
