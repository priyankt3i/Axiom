-- ============================================================================
-- HERMES APP-STATE POSTGRES ADAPTER
-- RDBMS: PostgreSQL v15+
-- Description:
--   Runtime persistence tables used by server.ts when DATABASE_URL is set.
--   These tables preserve the current backend API contract with JSONB payloads
--   while exposing indexed relational columns for auth, sessions, and jobs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS hermes_app_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS hermes_app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES hermes_app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hermes_app_sessions_user_id
  ON hermes_app_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_hermes_app_sessions_expires_at
  ON hermes_app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS hermes_app_oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hermes_app_oauth_states_expires_at
  ON hermes_app_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS hermes_app_invite_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES hermes_app_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hermes_app_invite_tokens_user_id
  ON hermes_app_invite_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_hermes_app_invite_tokens_email
  ON hermes_app_invite_tokens(email);

CREATE INDEX IF NOT EXISTS idx_hermes_app_invite_tokens_expires_at
  ON hermes_app_invite_tokens(expires_at);

CREATE TABLE IF NOT EXISTS hermes_app_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  current_phase TEXT NOT NULL,
  queue_state TEXT,
  worker_id TEXT,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hermes_app_jobs_status
  ON hermes_app_jobs(status);

CREATE INDEX IF NOT EXISTS idx_hermes_app_jobs_queue_state
  ON hermes_app_jobs(queue_state);

CREATE INDEX IF NOT EXISTS idx_hermes_app_jobs_submitted_at
  ON hermes_app_jobs(submitted_at DESC);

CREATE TABLE IF NOT EXISTS hermes_app_integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  configured_by_user_id TEXT NOT NULL REFERENCES hermes_app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hermes_app_integrations_provider
  ON hermes_app_integrations(provider);

CREATE INDEX IF NOT EXISTS idx_hermes_app_integrations_updated_at
  ON hermes_app_integrations(updated_at DESC);
