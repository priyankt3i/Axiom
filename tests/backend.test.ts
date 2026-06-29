import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer, type Server } from "node:http";

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
process.env.GITHUB_CLIENT_ID = "test-client";
process.env.GITHUB_CLIENT_SECRET = "test-secret";
process.env.DEFAULT_TARGET_REPOSITORY = "acme/widgets";
delete process.env.DATABASE_URL;

let server: Server;
let webhookServer: Server;
let githubApiServer: Server;
let baseUrl = "";
let inviteWebhookUrl = "";
let githubApiUrl = "";
const inviteWebhookPayloads: unknown[] = [];
const githubApiRequests: Array<{ method: string; url: string; authorization?: string; body?: string }> = [];
const { privateKey: githubAppPrivateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const githubAppPrivateKeyPem = githubAppPrivateKey.export({ type: "pkcs8", format: "pem" }).toString();

githubApiServer = createServer((req, res) => {
  const requestRecord = {
    method: req.method || "",
    url: req.url || "",
    authorization: req.headers.authorization,
  };
  githubApiRequests.push(requestRecord);

  if (req.method === "POST" && req.url === "/app/installations/67890/access_tokens") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      token: "ghs_do_not_return",
      expires_at: "2030-01-01T00:00:00Z",
      repository_selection: "selected",
      permissions: {
        contents: "write",
        pull_requests: "write",
      },
    }));
    return;
  }

  if (req.method === "GET" && req.url === "/repos/acme/widgets") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      full_name: "acme/widgets",
      default_branch: "main",
      private: true,
      permissions: {
        admin: false,
        push: true,
        pull: true,
      },
    }));
    return;
  }

  if (req.method === "GET" && req.url === "/repos/acme/widgets/git/ref/heads/main") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ref: "refs/heads/main",
      object: {
        sha: "abc123def456",
        type: "commit",
      },
    }));
    return;
  }

  if (req.method === "POST" && req.url === "/repos/acme/widgets/git/refs") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      requestRecord.body = Buffer.concat(chunks).toString("utf8");
      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        ref: "refs/heads/feature/hermes-real-branch",
        object: {
          sha: "abc123def456",
          type: "commit",
        },
      }));
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ message: "not found" }));
});
await new Promise<void>((resolve, reject) => {
  githubApiServer.listen(0, "127.0.0.1");
  githubApiServer.once("listening", resolve);
  githubApiServer.once("error", reject);
});
const githubApiAddress = githubApiServer.address();
assert.ok(githubApiAddress && typeof githubApiAddress === "object");
githubApiUrl = `http://127.0.0.1:${githubApiAddress.port}`;
process.env.GITHUB_API_BASE_URL = githubApiUrl;

const { startServer } = await import("../server.ts");

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
  webhookServer = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const payloadText = Buffer.concat(chunks).toString("utf8");
      inviteWebhookPayloads.push(JSON.parse(payloadText));
      res.statusCode = 202;
      res.end("accepted");
    });
  });
  await new Promise<void>((resolve, reject) => {
    webhookServer.listen(0, "127.0.0.1");
    webhookServer.once("listening", resolve);
    webhookServer.once("error", reject);
  });
  const webhookAddress = webhookServer.address();
  assert.ok(webhookAddress && typeof webhookAddress === "object");
  inviteWebhookUrl = `http://127.0.0.1:${webhookAddress.port}/invite-email`;
  process.env.INVITE_EMAIL_WEBHOOK_URL = inviteWebhookUrl;

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
  if (webhookServer) {
    await new Promise<void>((resolve, reject) => {
      webhookServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (githubApiServer) {
    await new Promise<void>((resolve, reject) => {
      githubApiServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("backend auth, RBAC, and queue integration", async () => {
  let response = await fetch(`${baseUrl}/api/auth/session`);
  let session = await readJson<{ authenticated: boolean }>(response);
  assert.equal(response.status, 200);
  assert.equal(session.authenticated, false);

  response = await fetch(`${baseUrl}/api/auth/github?redirect=https://evil.example/phish`, {
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  const persistedStore = JSON.parse(await fs.readFile(path.join(dataDir, "hermes-store.json"), "utf8")) as {
    oauthStates: Array<{ redirectPath: string }>;
  };
  assert.equal(persistedStore.oauthStates.at(-1)?.redirectPath, "/");

  process.env.GITHUB_ALLOWED_ORGS = "openai";
  response = await fetch(`${baseUrl}/api/auth/github?redirect=/review?tab=pipeline`, {
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  const githubRedirect = new URL(response.headers.get("location") || "");
  assert.ok(githubRedirect.searchParams.get("scope")?.split(" ").includes("read:org"));
  const orgPersistedStore = JSON.parse(await fs.readFile(path.join(dataDir, "hermes-store.json"), "utf8")) as {
    oauthStates: Array<{ redirectPath: string }>;
  };
  assert.equal(orgPersistedStore.oauthStates.at(-1)?.redirectPath, "/review?tab=pipeline");
  delete process.env.GITHUB_ALLOWED_ORGS;

  process.env.GITHUB_ALLOWED_TEAMS = "openai/platform";
  response = await fetch(`${baseUrl}/api/auth/github?redirect=/team`, {
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  const teamGithubRedirect = new URL(response.headers.get("location") || "");
  assert.ok(teamGithubRedirect.searchParams.get("scope")?.split(" ").includes("read:org"));
  const teamPersistedStore = JSON.parse(await fs.readFile(path.join(dataDir, "hermes-store.json"), "utf8")) as {
    oauthStates: Array<{ redirectPath: string }>;
  };
  assert.equal(teamPersistedStore.oauthStates.at(-1)?.redirectPath, "/team");
  delete process.env.GITHUB_ALLOWED_TEAMS;

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
    invite: { url: string; status: string; expiresAt: string; deliveryStatus: string };
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(invite.user.role, "BUSINESS_ANALYST");
  assert.equal(invite.user.status, "INVITED");
  assert.equal(invite.invite.status, "PENDING");
  assert.equal(invite.invite.deliveryStatus, "DELIVERED");
  assert.ok(invite.invite.expiresAt);
  const inviteUrl = new URL(invite.invite.url);
  assert.equal(inviteUrl.origin, baseUrl);
  const inviteToken = inviteUrl.searchParams.get("invite");
  assert.ok(inviteToken, "expected invite URL to contain an invite token");
  assert.equal(inviteWebhookPayloads.length, 1);
  assert.equal((inviteWebhookPayloads[0] as { to: string; inviteUrl: string }).to, "analyst@test.local");
  assert.equal((inviteWebhookPayloads[0] as { to: string; inviteUrl: string }).inviteUrl, invite.invite.url);

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
    integrations: {
      secretStorageConfigured: boolean;
      githubAppCredentialReady: boolean;
      githubAppCredentialStatus: string;
    };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(settings.invitations.length, 1);
  assert.equal(settings.invitations[0].email, "analyst@test.local");
  assert.equal(settings.invitations[0].status, "ACCEPTED");
  assert.equal(settings.integrationConfigs.length, 1);
  assert.deepEqual(settings.integrationConfigs[0].secretKeys, ["private_key"]);
  assert.equal(settings.integrations.githubAppCredentialReady, false);
  assert.equal(settings.integrations.githubAppCredentialStatus, "incomplete");
  assert.equal(JSON.stringify(settings).includes("super-secret-value"), false);
  assert.equal(JSON.stringify(settings).includes(inviteToken), false);

  response = await fetch(`${baseUrl}/api/integrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      provider: "github_app",
      displayName: "GitHub App App ID Test",
      secrets: { app_id: "12345" },
    }),
  });
  const mergedIntegration = await readJson<{
    integration: {
      provider: string;
      secretKeys: string[];
    };
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(mergedIntegration.integration.provider, "github_app");
  assert.deepEqual([...mergedIntegration.integration.secretKeys].sort(), ["app_id", "private_key"]);

  response = await fetch(`${baseUrl}/api/integrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      provider: "github_app",
      displayName: "GitHub App Ready Test",
      secrets: { installation_id: "67890", private_key: githubAppPrivateKeyPem },
    }),
  });
  const readyIntegration = await readJson<{
    integration: {
      provider: string;
      secretKeys: string[];
    };
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(readyIntegration.integration.provider, "github_app");
  assert.deepEqual([...readyIntegration.integration.secretKeys].sort(), ["app_id", "installation_id", "private_key"]);
  assert.equal(JSON.stringify(readyIntegration).includes(githubAppPrivateKeyPem), false);

  response = await fetch(`${baseUrl}/api/settings`, {
    headers: { Cookie: adminCookie },
  });
  const readySettings = await readJson<typeof settings>(response);
  assert.equal(response.status, 200);
  assert.equal(readySettings.integrations.githubAppCredentialReady, true);
  assert.equal(readySettings.integrations.githubAppCredentialStatus, "ready");

  response = await fetch(`${baseUrl}/api/integrations/github-app/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
  });
  const githubAppVerify = await readJson<{
    ok: boolean;
    credentialStatus: string;
    installationId: string;
    expiresAt: string;
    repositorySelection: string;
    permissions: Record<string, string>;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(githubAppVerify.ok, true);
  assert.equal(githubAppVerify.credentialStatus, "ready");
  assert.equal(githubAppVerify.installationId, "67890");
  assert.equal(githubAppVerify.expiresAt, "2030-01-01T00:00:00Z");
  assert.equal(githubAppVerify.repositorySelection, "selected");
  assert.equal(githubAppVerify.permissions.contents, "write");
  assert.equal(githubAppVerify.tokenReceived, true);
  assert.equal(JSON.stringify(githubAppVerify).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-1)?.method, "POST");
  assert.equal(githubApiRequests.at(-1)?.url, "/app/installations/67890/access_tokens");
  assert.ok(githubApiRequests.at(-1)?.authorization?.startsWith("Bearer "));
  assert.equal(githubApiRequests.at(-1)?.authorization?.split(".").length, 3);

  response = await fetch(`${baseUrl}/api/integrations/github-app/repository/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({ repository: "acme/widgets" }),
  });
  const repositoryVerify = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    defaultBranch: string;
    defaultBranchSha: string;
    defaultBranchObjectType: string;
    private: boolean;
    permissions: Record<string, boolean>;
    installation: {
      installationId: string;
      repositorySelection: string;
      permissions: Record<string, string>;
    };
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(repositoryVerify.ok, true);
  assert.equal(repositoryVerify.credentialStatus, "ready");
  assert.equal(repositoryVerify.repository, "acme/widgets");
  assert.equal(repositoryVerify.defaultBranch, "main");
  assert.equal(repositoryVerify.defaultBranchSha, "abc123def456");
  assert.equal(repositoryVerify.defaultBranchObjectType, "commit");
  assert.equal(repositoryVerify.private, true);
  assert.equal(repositoryVerify.permissions.push, true);
  assert.equal(repositoryVerify.installation.installationId, "67890");
  assert.equal(repositoryVerify.installation.repositorySelection, "selected");
  assert.equal(repositoryVerify.installation.permissions.contents, "write");
  assert.equal(repositoryVerify.tokenReceived, true);
  assert.equal(JSON.stringify(repositoryVerify).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-3)?.url, "/app/installations/67890/access_tokens");
  assert.equal(githubApiRequests.at(-2)?.url, "/repos/acme/widgets");
  assert.equal(githubApiRequests.at(-1)?.url, "/repos/acme/widgets/git/ref/heads/main");
  assert.ok(githubApiRequests.at(-2)?.authorization?.startsWith("Bearer ghs_do_not_return"));
  assert.ok(githubApiRequests.at(-1)?.authorization?.startsWith("Bearer ghs_do_not_return"));

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

  response = await fetch(`${baseUrl}/api/settings`, {
    headers: { Cookie: baCookie },
  });
  const baSettings = await readJson<{
    users: unknown[];
    invitations: unknown[];
    integrationConfigs: unknown[];
    runtime: { workflowProvider: string; sandboxProvider: string };
  }>(response);
  assert.equal(response.status, 200);
  assert.deepEqual(baSettings.users, []);
  assert.deepEqual(baSettings.invitations, []);
  assert.deepEqual(baSettings.integrationConfigs, []);
  assert.equal(baSettings.runtime.workflowProvider, "local-durable-queue");
  assert.equal(baSettings.runtime.sandboxProvider, "local-provider");

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

  response = await fetch(`${baseUrl}/api/jobs/${created.job.id}`, {
    headers: { Cookie: adminCookie },
  });
  const adminJob = await readJson<{
    job: {
      result: {
        iterations: Array<{ codeDiff: string; stdout: string; testResultsXml: string }>;
        finalPr: { actualCost?: number; inputTokens?: number; outputTokens?: number; computeMs?: number };
      };
      pipelineState: {
        jobData: {
          iterations: Array<{ codeDiff: string }>;
          finalPr: { actualCost?: number };
        };
        logs: string[];
      };
    };
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(typeof adminJob.job.result.finalPr.actualCost, "number");
  assert.equal(typeof adminJob.job.result.finalPr.inputTokens, "number");
  assert.match(adminJob.job.result.iterations[0].codeDiff, /diff --git/);

  response = await fetch(`${baseUrl}/api/jobs/${created.job.id}`, {
    headers: { Cookie: baCookie },
  });
  const baJob = await readJson<typeof adminJob>(response);
  assert.equal(response.status, 200);
  assert.equal(baJob.job.result.finalPr.actualCost, undefined);
  assert.equal(baJob.job.result.finalPr.inputTokens, undefined);
  assert.equal(baJob.job.result.finalPr.outputTokens, undefined);
  assert.equal(baJob.job.result.finalPr.computeMs, undefined);
  assert.equal(baJob.job.pipelineState.jobData.finalPr.actualCost, undefined);
  assert.equal(baJob.job.result.iterations[0].codeDiff, "Restricted to Manager and Administrator roles.");
  assert.equal(baJob.job.result.iterations[0].stdout, "Restricted to Manager and Administrator roles.");
  assert.equal(baJob.job.result.iterations[0].testResultsXml, "Restricted to Manager and Administrator roles.");
});
