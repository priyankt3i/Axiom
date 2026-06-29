import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "axiom-production-guard-test-"));

process.env.NODE_ENV = "production";
process.env.AXIOM_DISABLE_AUTOSTART = "true";
process.env.ENABLE_DEV_LOGIN = "true";
process.env.DEV_LOGIN_TOKEN = "production-guard-dev-login-token";
delete process.env.ENABLE_LOCAL_WORKFLOW_RUNNER;
delete process.env.ENABLE_LOCAL_REVIEW_ACTIONS;
process.env.GEMINI_API_KEY = "MY_GEMINI_API_KEY";
process.env.DATA_DIR = dataDir;
process.env.STORAGE_PROVIDER = "json";
process.env.APP_URL = "http://127.0.0.1";
process.env.SESSION_SECRET = "production-guard-test-session-secret";
process.env.INTEGRATION_ENCRYPTION_KEY = "production-guard-test-integration-secret";
delete process.env.DATABASE_URL;

const interruptedJobId = "job_interrupted";
const queuedJobId = "job_queued";
const reviewJobId = "job_review";
const submittedAt = new Date().toISOString();

function storedJob(id: string, status: "IN_PROGRESS" | "QUEUED" | "REVIEW_READY") {
  return {
    id,
    executionId: `exec_${id}`,
    hermesSessionId: `hermes_${id}`,
    taskName: `Recover ${id}`,
    scopeDescription: `Recover ${id}`,
    currentPhase:
      status === "IN_PROGRESS"
        ? "DEVELOPER_LOOP"
        : status === "REVIEW_READY"
          ? "PULL_REQUEST_OPEN"
          : "DISPATCHED_TO_QUEUE",
    gitBranch: `feature/${id}`,
    targetRepository: "local/workspace",
    status,
    phaseIndex: status === "IN_PROGRESS" ? 3 : status === "REVIEW_READY" ? 6 : 2,
    runningText:
      status === "IN_PROGRESS"
        ? "Local worker running"
        : status === "REVIEW_READY"
          ? "Pending manager review"
          : "Queued for local worker",
    terminalStatus: status === "IN_PROGRESS" ? "DEVELOPING" : status === "REVIEW_READY" ? "PR_DRAFT" : "PROVISIONING",
    activeIterationIndex: 1,
    assignedTo: "Local Workflow Worker",
    submittedAt,
    queuedAt: submittedAt,
    queueState: status === "IN_PROGRESS" ? "RUNNING" : status === "REVIEW_READY" ? "COMPLETED" : "PENDING",
    workerId: status === "IN_PROGRESS" ? "local-worker-test" : undefined,
    createdByUserId: "usr_seed",
    developerRole: "Developer",
    qaRole: "QA",
    estimate: {
      estimatedCost: 0.01,
      inputTokens: 100,
      outputTokens: 200,
      computeMs: 1000,
      isComplex: false,
    },
    logs: ["seeded recovery fixture"],
  };
}

await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(
  path.join(dataDir, "hermes-store.json"),
  JSON.stringify({
    users: [],
    sessions: [],
    oauthStates: [],
    inviteTokens: [],
    integrations: [],
    jobs: [
      storedJob(interruptedJobId, "IN_PROGRESS"),
      storedJob(queuedJobId, "QUEUED"),
      storedJob(reviewJobId, "REVIEW_READY"),
    ],
  }, null, 2),
);

const { startServer } = await import("../server.ts");

let server: Server;
let baseUrl = "";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

function cookieFrom(response: Response) {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "expected response to include a session cookie");
  return cookie;
}

test.before(async () => {
  server = await startServer({
    port: 0,
    host: "127.0.0.1",
    serveClient: false,
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("production rejects local simulation job execution by default", async () => {
  let response = await fetch(`${baseUrl}/api/health`);
  const health = await readJson<{
    providers: { workflow: string; sandbox: string };
    execution: {
      jobDispatchEnabled: boolean;
      reviewActionsEnabled: boolean;
      localWorkflowRunnerEnabled: boolean;
      localReviewActionsEnabled: boolean;
    };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(health.providers.workflow, "disabled-production-local-runner");
  assert.equal(health.providers.sandbox, "disabled-production-local-provider");
  assert.equal(health.execution.jobDispatchEnabled, false);
  assert.equal(health.execution.reviewActionsEnabled, false);
  assert.equal(health.execution.localWorkflowRunnerEnabled, false);
  assert.equal(health.execution.localReviewActionsEnabled, false);

  response = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@production.test",
      fullName: "Production Admin",
    }),
  });
  assert.equal(response.status, 403);

  response = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Login-Token": process.env.DEV_LOGIN_TOKEN!,
    },
    body: JSON.stringify({
      email: "admin@production.test",
      fullName: "Production Admin",
    }),
  });
  const adminCookie = cookieFrom(response);
  const adminLogin = await readJson<{ csrfToken: string }>(response);
  assert.equal(response.status, 200);

  const recoveredStore = JSON.parse(await fs.readFile(path.join(dataDir, "hermes-store.json"), "utf8")) as {
    jobs: Array<{ id: string; status: string; queueState: string; lastError?: string; workerId?: string }>;
  };
  const interruptedJob = recoveredStore.jobs.find((job) => job.id === interruptedJobId);
  const queuedJob = recoveredStore.jobs.find((job) => job.id === queuedJobId);
  assert.equal(interruptedJob?.status, "FAILED");
  assert.equal(interruptedJob?.queueState, "FAILED");
  assert.equal(interruptedJob?.workerId, undefined);
  assert.match(interruptedJob?.lastError || "", /local workflow runner is disabled/i);
  assert.equal(queuedJob?.status, "FAILED");
  assert.equal(queuedJob?.queueState, "FAILED");
  assert.equal(queuedJob?.workerId, undefined);

  response = await fetch(`${baseUrl}/api/settings`, {
    headers: { Cookie: adminCookie },
  });
  const settings = await readJson<{
    runtime: {
      workflowProvider: string;
      sandboxProvider: string;
      reviewActionProvider: string;
      jobDispatchEnabled: boolean;
      reviewActionsEnabled: boolean;
      localWorkflowRunnerEnabled: boolean;
      localReviewActionsEnabled: boolean;
    };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(settings.runtime.workflowProvider, "disabled-production-local-runner");
  assert.equal(settings.runtime.sandboxProvider, "disabled-production-local-provider");
  assert.equal(settings.runtime.reviewActionProvider, "disabled-production-no-review-adapter");
  assert.equal(settings.runtime.jobDispatchEnabled, false);
  assert.equal(settings.runtime.reviewActionsEnabled, false);
  assert.equal(settings.runtime.localWorkflowRunnerEnabled, false);
  assert.equal(settings.runtime.localReviewActionsEnabled, false);

  response = await fetch(`${baseUrl}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({ taskDescription: "Attempt production simulation execution" }),
  });
  const rejected = await readJson<{ code: string; error: string }>(response);
  assert.equal(response.status, 503);
  assert.equal(rejected.code, "WORKFLOW_PROVIDER_NOT_CONFIGURED");
  assert.match(rejected.error, /local simulation runner is disabled/i);

  response = await fetch(`${baseUrl}/api/jobs/${reviewJobId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
  });
  const approveRejected = await readJson<{ code: string; error: string }>(response);
  assert.equal(response.status, 503);
  assert.equal(approveRejected.code, "REVIEW_ADAPTER_NOT_CONFIGURED");
  assert.match(approveRejected.error, /approve-and-merge requires a live github app adapter/i);

  response = await fetch(`${baseUrl}/api/jobs/${reviewJobId}/rollback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
  });
  const rollbackRejected = await readJson<{ code: string; error: string }>(response);
  assert.equal(response.status, 503);
  assert.equal(rollbackRejected.code, "REVIEW_ADAPTER_NOT_CONFIGURED");
  assert.match(rollbackRejected.error, /rollback requires live github app and hermes memory adapters/i);

  const finalStore = JSON.parse(await fs.readFile(path.join(dataDir, "hermes-store.json"), "utf8")) as {
    jobs: Array<{ id: string; status: string }>;
  };
  assert.equal(finalStore.jobs.find((job) => job.id === reviewJobId)?.status, "REVIEW_READY");
});
