# System Integrations & Setup Guide

This guide describes the integration behavior that exists today and the adapter work still required before Hermes can run as a fully production-connected orchestration platform.

The current Settings view can store encrypted provider credentials and show runtime configuration status. Those stored credentials are not yet consumed by live GitHub App, Jira, Linear, Jenkins, Temporal, or Kubernetes adapters.

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

### Pending
- Branch creation.
- Agent-authored commits and pushes.
- Pull request creation and PR status tracking.
- Real approve-and-merge behavior.
- Real rollback behavior that reverts/deletes branches.
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
- In production, approve/rollback local state-only actions are disabled by default; those endpoints return `REVIEW_ADAPTER_NOT_CONFIGURED` unless `ENABLE_LOCAL_REVIEW_ACTIONS=true` is explicitly set for a controlled demo or staging run.
- Administrators can store encrypted Jenkins, Temporal, and Kubernetes credentials from Settings.

### Pending
- Temporal worker runtime connected to `src/workflows/engineeringWorkflow.ts`.
- Kubernetes or Docker sandbox creation for real QA builds.
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
- Workflow and sandbox runtime labels remain local while the local queue and local artifact provider handle job execution.
- Temporal and Kubernetes environment settings do not imply active production execution until real adapters are connected.

### Pending
- Live Temporal health checks.
- Live Kubernetes health checks.
- Provider-specific adapter health and last-run diagnostics.
