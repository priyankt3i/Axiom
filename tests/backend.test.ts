import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "axiom-backend-test-"));

process.env.NODE_ENV = "test";
process.env.AXIOM_DISABLE_AUTOSTART = "true";
process.env.ENABLE_DEV_LOGIN = "true";
process.env.GEMINI_API_KEY = "MY_GEMINI_API_KEY";
process.env.DATA_DIR = dataDir;
process.env.STORAGE_PROVIDER = "json";
process.env.LOCAL_WORKER_POLL_MS = "50";
process.env.INVITE_TOKEN_TTL_HOURS = "168";
process.env.APP_URL = "";
delete process.env.DATABASE_URL;

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

async function closeServer() {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
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
  await closeServer();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("backend auth, RBAC, and queue integration", async () => {
  let response = await fetch(`${baseUrl}/api/auth/session`);
  let session = await readJson<{ authenticated: boolean }>(response);
  assert.equal(response.status, 200);
  assert.equal(session.authenticated, false);

  response = await fetch(`${baseUrl}/api/estimate-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskDescription: "unauthenticated estimate" }),
  });
  assert.equal(response.status, 401);

  response = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@test.local",
      fullName: "Admin User",
    }),
  });
  const adminCookie = cookieFrom(response);
  const adminLogin = await readJson<{
    csrfToken: string;
    user: { id: string; role: string; status: string };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(adminLogin.user.role, "ADMINISTRATOR");
  assert.equal(adminLogin.user.status, "ACTIVE");

  response = await fetch(`${baseUrl}/api/estimate-cost`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({ taskDescription: "Implement verified backend queue tests" }),
  });
  const estimate = await readJson<{ estimatedCost: number }>(response);
  assert.equal(response.status, 200);
  assert.ok(estimate.estimatedCost > 0);

  response = await fetch(`${baseUrl}/api/estimate-cost`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ taskDescription: "missing csrf" }),
  });
  assert.equal(response.status, 403);

  response = await fetch(`${baseUrl}/api/users/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      email: "analyst@test.local",
      fullName: "Analyst User",
      role: "BUSINESS_ANALYST",
    }),
  });
  const invite = await readJson<{
    user: { id: string; role: string; status: string };
    invite: { url: string; status: string; expiresAt: string };
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(invite.user.role, "BUSINESS_ANALYST");
  assert.equal(invite.user.status, "INVITED");
  assert.equal(invite.invite.status, "PENDING");
  assert.ok(invite.invite.expiresAt);
  const inviteUrl = new URL(invite.invite.url);
  assert.equal(inviteUrl.origin, baseUrl);
  const inviteToken = inviteUrl.searchParams.get("invite");
  assert.ok(inviteToken, "expected invite URL to contain an invite token");

  response = await fetch(`${baseUrl}/api/invitations/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: inviteToken }),
  });
  const analystCookie = cookieFrom(response);
  const acceptedInvite = await readJson<{
    csrfToken: string;
    user: { id: string; role: string; status: string };
    invitation: { status: string; acceptedAt?: string };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(acceptedInvite.user.id, invite.user.id);
  assert.equal(acceptedInvite.user.role, "BUSINESS_ANALYST");
  assert.equal(acceptedInvite.user.status, "ACTIVE");
  assert.equal(acceptedInvite.invitation.status, "ACCEPTED");
  assert.ok(acceptedInvite.csrfToken);
  assert.ok(analystCookie);

  response = await fetch(`${baseUrl}/api/invitations/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: inviteToken }),
  });
  assert.equal(response.status, 409);

  response = await fetch(`${baseUrl}/api/users/${invite.user.id}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({ role: "MANAGER" }),
  });
  const roleUpdate = await readJson<{ user: { role: string } }>(response);
  assert.equal(response.status, 200);
  assert.equal(roleUpdate.user.role, "MANAGER");

  response = await fetch(`${baseUrl}/api/integrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      provider: "github_app",
      displayName: "GitHub App Test",
      metadata: { reference: "installation-123" },
      secrets: { private_key: "super-secret-value" },
    }),
  });
  const integrationCreate = await readJson<{
    integration: {
      id: string;
      provider: string;
      displayName: string;
      metadata: Record<string, string>;
      secretKeys: string[];
    };
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(integrationCreate.integration.provider, "github_app");
  assert.deepEqual(integrationCreate.integration.secretKeys, ["private_key"]);
  assert.equal(JSON.stringify(integrationCreate).includes("super-secret-value"), false);

  response = await fetch(`${baseUrl}/api/settings`, {
    headers: { Cookie: adminCookie },
  });
  const settings = await readJson<{
    invitations: Array<{ id: string; email: string; status: string }>;
    integrationConfigs: Array<{ id: string; secretKeys: string[] }>;
    integrations: { secretStorageConfigured: boolean };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(settings.invitations.length, 1);
  assert.equal(settings.invitations[0].email, "analyst@test.local");
  assert.equal(settings.invitations[0].status, "ACCEPTED");
  assert.equal(settings.integrationConfigs.length, 1);
  assert.deepEqual(settings.integrationConfigs[0].secretKeys, ["private_key"]);
  assert.equal(JSON.stringify(settings).includes("super-secret-value"), false);
  assert.equal(JSON.stringify(settings).includes(inviteToken), false);

  response = await fetch(`${baseUrl}/api/users/${adminLogin.user.id}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({ role: "MANAGER" }),
  });
  const lastAdmin = await readJson<{ error: string }>(response);
  assert.equal(response.status, 409);
  assert.equal(lastAdmin.error, "At least one active administrator is required");

  response = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "ba@test.local",
      fullName: "BA User",
      role: "BUSINESS_ANALYST",
    }),
  });
  const baCookie = cookieFrom(response);
  const baLogin = await readJson<{ csrfToken: string; user: { role: string; status: string } }>(response);
  assert.equal(response.status, 200);
  assert.equal(baLogin.user.role, "BUSINESS_ANALYST");
  assert.equal(baLogin.user.status, "ACTIVE");

  response = await fetch(`${baseUrl}/api/ledger`, {
    headers: { Cookie: baCookie },
  });
  assert.equal(response.status, 403);

  response = await fetch(`${baseUrl}/api/integrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: baCookie,
      "X-CSRF-Token": baLogin.csrfToken,
    },
    body: JSON.stringify({
      provider: "linear",
      displayName: "Linear",
      secrets: { token: "not-allowed" },
    }),
  });
  assert.equal(response.status, 403);

  response = await fetch(`${baseUrl}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({ taskDescription: "Verify durable queue worker dispatch" }),
  });
  const created = await readJson<{
    job: {
      id: string;
      status: string;
      queueState: string;
      pipelineState: { terminalStatus: string };
    };
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(created.job.status, "QUEUED");
  assert.equal(created.job.queueState, "PENDING");

  let latest = created.job;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    response = await fetch(`${baseUrl}/api/jobs/${created.job.id}`, {
      headers: { Cookie: adminCookie },
    });
    const body = await readJson<typeof created>(response);
    latest = body.job;
    if (latest.status === "REVIEW_READY") break;
  }

  assert.equal(latest.status, "REVIEW_READY");
  assert.equal(latest.queueState, "COMPLETED");
  assert.equal(latest.pipelineState.terminalStatus, "PR_DRAFT");
});
