-- ============================================================================
-- HERMES PLATFORM SCHEMA DEFINITION
-- RDBMS: PostgreSQL v15+ (Enterprise Grade Relational Schema)
-- Description: Core operational ledger, job state boundaries, and audit logging.
-- ============================================================================

-- Enable UUID extension for cryptographic keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define job execution phase transitions enum
CREATE TYPE job_phase AS ENUM (
  'INGESTION_PLANNING',
  'DISPATCHED_TO_QUEUE',
  'DEVELOPER_LOOP',
  'QA_VERIFICATION',
  'NEGOTIATION_FEEDBACK',
  'PULL_REQUEST_OPEN',
  'COMPLETED_MERGED',
  'ROLLED_BACK'
);

-- Define user authorization roles
CREATE TYPE user_role AS ENUM (
  'MANAGER',
  'BUSINESS_ANALYST',
  'ADMINISTRATOR'
);

-- 1. Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'MANAGER',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Jobs (The core tasks submitted by Managers/BAs)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scope_description TEXT NOT NULL,
  current_phase job_phase NOT NULL DEFAULT 'INGESTION_PLANNING',
  git_branch VARCHAR(255) UNIQUE,
  target_repository VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexing for pipeline lookups
CREATE INDEX idx_jobs_phase ON jobs(current_phase);
CREATE INDEX idx_jobs_branch ON jobs(git_branch);

-- 3. JobExecutions (Logs the specific runs/sessions of a Job)
CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  hermes_session_id VARCHAR(255) UNIQUE NOT NULL,
  git_commit_sha VARCHAR(40),
  pull_request_url VARCHAR(512),
  pre_task_snapshot JSONB NOT NULL, -- Stores exact commit hash, branches, and database metadata
  post_task_snapshot JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_job_executions_job_id ON job_executions(job_id);

-- 4. FinancialLedger (Track micro-economic token compute expenses)
CREATE TABLE financial_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID REFERENCES job_executions(id) ON DELETE CASCADE NOT NULL,
  estimated_cost NUMERIC(10, 5) NOT NULL,
  actual_cost NUMERIC(10, 5) DEFAULT 0.00000,
  input_tokens INTEGER DEFAULT 0 NOT NULL,
  output_tokens INTEGER DEFAULT 0 NOT NULL,
  compute_ms INTEGER DEFAULT 0 NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ledger_execution ON financial_ledger(execution_id);

-- 5. QALogs (Detailed build logs, test logs, XML data from Sandboxed K8s pod)
CREATE TABLE qa_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID REFERENCES job_executions(id) ON DELETE CASCADE NOT NULL,
  iteration_count INTEGER DEFAULT 1 NOT NULL,
  test_results_xml TEXT, -- JUnit / Jest XML reports
  stdout TEXT,          -- Full build and terminal logging
  stderr TEXT,          -- Runtime stderr trace logs
  k8s_namespace VARCHAR(100) NOT NULL, -- Ephemeral K8s workspace
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_qa_logs_execution ON qa_logs(execution_id);

-- ============================================================================
-- AUDIT TRIGGERS FOR ROW CHANGE TRACKING
-- ============================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_jobs_modtime BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
