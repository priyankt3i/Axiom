# System Integrations & Setup Guide

This guide describes the integration behavior that exists today and the adapter work still required before Hermes can run as a fully production-connected orchestration platform.

The current Settings view can store encrypted provider credentials and show runtime configuration status. GitHub App credentials are consumed for installation-token exchange, repository verification, branch creation/deletion, file commits, pull request creation, PR status lookup, PR merge, PR-backed job approval, and rollback branch cleanup. Jira, Linear, Jenkins, Temporal, and Kubernetes credentials are still stored for future adapters.

## 1. Source Control

### Implemented Today
- GitHub OAuth sign-in is available when `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `APP_URL` are configured.
- Production GitHub OAuth admits existing or invited users by default. New OAuth users must match `GITHUB_ALLOWED_EMAIL_DOMAINS`, `GITHUB_ALLOWED_ORGS`, or `GITHUB_ALLOWED_TEAMS`.
- When `GITHUB_ALLOWED_ORGS` or `GITHUB_ALLOWED_TEAMS` is set, the OAuth authorization request includes `read:org` so the callback can verify organization or team membership.
- `GITHUB_ALLOWED_TEAMS` accepts comma-separated `org/team-slug` entries.
- Production dev-login requires `DEV_LOGIN_TOKEN` when `ENABLE_DEV_LOGIN=true`; requests must supply it with `X-Dev-Login-Token`.
- Administrators can store encrypted `github_app` integration secrets from Settings.
- Stored `github_app` credentials are decrypted server-side for readiness validation. The app checks `app_id`, `installation_id`, and `private_key`, signs a local GitHub App JWT, and reports readiness in Settings.
- Administrators can verify GitHub App installation-token exchange through `POST /api/integrations/github-app/verify`. The endpoint calls the GitHub API and returns sanitized token metadata without exposing the token.
- Administrators can verify repository access through `POST /api/integrations/github-app/repository/verify`; the endpoint uses the installation token server-side to read repository metadata and the default branch ref without exposing the token.
- Administrators can create a feature branch through `POST /api/integrations/github-app/branches`; the endpoint uses the installation token server-side and returns sanitized branch/ref metadata without exposing the token.
- Administrators can delete a non-default feature branch through `POST /api/integrations/github-app/branches/delete`; the endpoint uses the installation token server-side and returns sanitized deletion metadata without exposing the token.
- Administrators can commit UTF-8 file content through `POST /api/integrations/github-app/file-commits`; the endpoint uses the installation token server-side and returns sanitized commit/blob metadata without exposing the token.
- Administrators can open a pull request through `POST /api/integrations/github-app/pull-requests`; the endpoint verifies the source branch, targets the default or supplied base branch, and returns sanitized PR metadata without exposing the token.
- Administrators can read pull request status through `POST /api/integrations/github-app/pull-requests/status` and merge through `POST /api/integrations/github-app/pull-requests/merge`; both use the installation token server-side and return sanitized metadata.
- `ENABLE_GITHUB_APP_REVIEW_ACTIONS=true` makes production `POST /api/jobs/:jobId/approve` merge the job's persisted pull request metadata through the GitHub App adapter.
- `ENABLE_GITHUB_APP_ROLLBACK_ACTIONS=true` plus `HERMES_MEMORY_EVICTION_WEBHOOK_URL` makes production `POST /api/jobs/:jobId/rollback` delete the job's persisted non-default feature branch through the GitHub App adapter, call the Hermes memory eviction webhook, persist rollback state, and record audit logs.

### Pending
- Automatic workflow wiring that persists PR metadata from agent-created PRs without manual endpoint calls.
- Retryable rollback compensations, merged-PR revert commits, and workflow-created rollback metadata.
- GitLab integration.

## 2. Issue Tracking

### Implemented Today
- Administrators can store encrypted Jira and Linear credentials from Settings.
- The Dispatcher accepts manually entered task instructions.

### Pending
- Jira OAuth or API-token adapter.
- Linear API adapter.
- Issue/story ingestion into the task queue.
- Label or project based task sync.
- Mapping issue acceptance criteria into bounded task scopes.

## 3. CI/CD And Verification

### Implemented Today
- Jobs are persisted and claimed by the local durable queue worker.
- The local workflow runner advances backend-owned task state and generates local proof-of-work artifacts.
- In production, the local workflow runner is disabled by default; `/api/jobs` returns `WORKFLOW_PROVIDER_NOT_CONFIGURED` unless `ENABLE_LOCAL_WORKFLOW_RUNNER=true` is explicitly set for a controlled demo or staging run.
- Startup recovery marks interrupted or queued local-runner jobs failed when the local runner is disabled, instead of requeueing work to an inactive worker.
- In production, local state-only review actions are disabled by default. Approve requires `ENABLE_GITHUB_APP_REVIEW_ACTIONS=true` or an explicit local escape hatch; rollback requires `ENABLE_GITHUB_APP_ROLLBACK_ACTIONS=true` plus `HERMES_MEMORY_EVICTION_WEBHOOK_URL`, or an explicit local escape hatch.
- Administrators can store encrypted Jenkins, Temporal, and Kubernetes credentials from Settings.
- When `SANDBOX_PROVIDER=podman` is configured, administrators can call `POST /api/sandbox/verify` to check the Podman binary and run a no-network container sentinel command.
- Administrators can call `POST /api/sandbox/execute-smoke` to run a fixed no-network Podman workspace smoke command with resource limits, dropped capabilities, read-only root filesystem, and artifact round-trip.
- The local workflow QA retry phase can clone a configured Git repository/ref into the Podman workspace with local Git credentials or a GitHub App installation token, then call the Podman command adapter for a configured server-owned install/build/test/static-analysis command manifest, or a fixed job-scoped workspace proof when no commands are configured, and records sandbox proof metadata when `SANDBOX_PROVIDER=podman`.

### Pending
- Temporal worker runtime connected to `src/workflows/engineeringWorkflow.ts`.
- Podman/Kubernetes sandbox execution wired into Developer/QA agent-authored file runs.
- Actual test, static-analysis, JUnit, and coverage ingestion.
- Jenkins downstream build triggering after merge.
- Clear configured-vs-active provider health checks.

## 4. User And Role Management

### Implemented Today
- Roles are enforced server-side:
  - `ADMINISTRATOR`: invite users, change roles, manage integrations, approve/rollback work, view ledger, dispatch tasks.
  - `MANAGER`: approve/rollback work, view ledger, dispatch tasks.
  - `BUSINESS_ANALYST`: dispatch and monitor tasks.
- Administrators can generate signed one-time invite links.
- `INVITE_EMAIL_WEBHOOK_URL` can deliver signed invite payloads to an external email service.
- Invite tokens are stored as hashes, and raw invite URLs are returned only at creation time.
- Non-administrators do not receive user lists, invitation history, integration metadata, or secret key names from `/api/settings`.
- Business Analyst job responses redact manager-review artifacts and actual execution ledger fields while retaining task monitoring state.

### Pending
- Provider-specific invite email templates and adapters.
- More granular read-only settings policies, if needed.

## 5. Runtime Status

### Implemented Today
- Runtime status reports the active storage provider.
- Workflow and sandbox runtime labels report local, Podman-configured, or Kubernetes-configured-no-adapter state while the local queue and local artifact provider handle job execution.
- Temporal and Kubernetes environment settings do not imply active production execution until real adapters are connected.

### Pending
- Live Temporal health checks.
- Live Kubernetes health checks.
- Provider-specific adapter health and last-run diagnostics.
