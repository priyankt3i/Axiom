import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer, type Server } from "node:http";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "axiom-backend-test-"));
const fakePodmanPath = path.join(dataDir, "fake-podman");
const fakePodmanLogPath = path.join(dataDir, "fake-podman.log");
const fakeGitPath = path.join(dataDir, "fake-git");
const fakeGitLogPath = path.join(dataDir, "fake-git.log");

await fs.writeFile(
  fakePodmanPath,
  `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_PODMAN_LOG"
if [ "$1" = "--version" ]; then
  echo "podman version 5.0.0"
  exit 0
fi
if [ "$1" = "run" ]; then
  workspace=""
  previous=""
  for arg in "$@"; do
    if [ "$previous" = "-v" ]; then
      workspace="\${arg%%:*}"
    fi
    previous="$arg"
  done
  case "$*" in
    *sandbox-exec-ready*)
      if [ -n "$workspace" ]; then
        printf "sandbox-exec-ready" > "$workspace/artifact.txt"
      fi
      printf "sandbox-input\\nsandbox-exec-ready"
      exit 0
      ;;
    *axiom-sandbox-run.sh*)
      if [ -n "$workspace" ]; then
        cat "$workspace/axiom-sandbox-run.sh" >> "$FAKE_PODMAN_LOG"
        mkdir -p "$workspace/artifacts"
        printf "install:PASS\\nbuild:PASS\\ntest:PASS\\nstatic-analysis:PASS\\nsandbox-command-manifest-ready\\n" > "$workspace/artifacts/summary.txt"
        printf "install-ok\\nbuild-ok\\ntest-ok\\nlint-ok\\n" > "$workspace/artifacts/stdout.log"
        : > "$workspace/artifacts/stderr.log"
        printf '<testsuites name="Axiom Sandbox Manifest" tests="1" failures="0"></testsuites>' > "$workspace/artifacts/junit.xml"
        cat "$workspace/input.json"
        printf "\\n"
        cat "$workspace/artifacts/summary.txt"
      else
        printf "missing-workspace" >&2
        exit 3
      fi
      exit 0
      ;;
  esac
  printf "sandbox-ready"
  exit 0
fi
echo "unexpected fake podman args: $*" >&2
exit 2
`,
  { mode: 0o755 },
);

await fs.writeFile(
  fakeGitPath,
  `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_GIT_LOG"
clone_seen=""
for arg in "$@"; do
  if [ "$arg" = "clone" ]; then
    clone_seen="true"
  fi
done
if [ "$clone_seen" = "true" ]; then
  destination=""
  for arg in "$@"; do
    destination="$arg"
  done
  mkdir -p "$destination"
  printf '{"scripts":{"test":"echo test-ok"}}\\n' > "$destination/package.json"
  printf 'checked-out\\n' > "$destination/README.md"
  exit 0
fi
echo "unexpected fake git args: $*" >&2
exit 2
`,
  { mode: 0o755 },
);

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
process.env.SANDBOX_PROVIDER = "podman";
process.env.PODMAN_BIN = fakePodmanPath;
process.env.PODMAN_IMAGE = "axiom-test-sandbox:latest";
process.env.PODMAN_MEMORY = "128m";
process.env.PODMAN_CPUS = "0.5";
process.env.SANDBOX_TIMEOUT_MS = "1000";
process.env.SANDBOX_INSTALL_COMMAND = "printf install-ok";
process.env.SANDBOX_BUILD_COMMAND = "printf build-ok";
process.env.SANDBOX_TEST_COMMAND = "printf test-ok";
process.env.SANDBOX_STATIC_ANALYSIS_COMMAND = "printf lint-ok";
process.env.SANDBOX_CHECKOUT_PROVIDER = "git";
process.env.SANDBOX_CHECKOUT_AUTH_PROVIDER = "github_app";
process.env.SANDBOX_REPOSITORY_URL = "https://github.example/acme/widgets.git";
process.env.SANDBOX_CHECKOUT_REF = "feature/hermes-real-branch";
process.env.GIT_BIN = fakeGitPath;
process.env.GIT_CLONE_TIMEOUT_MS = "1000";
process.env.FAKE_PODMAN_LOG = fakePodmanLogPath;
process.env.FAKE_GIT_LOG = fakeGitLogPath;
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
    body: undefined as string | undefined,
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

  if (req.method === "GET" && req.url === "/repos/acme/widgets/git/ref/heads/feature%2Fhermes-real-branch") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ref: "refs/heads/feature/hermes-real-branch",
      object: {
        sha: "branch789abc",
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

  if (req.method === "PUT" && req.url === "/repos/acme/widgets/contents/src/generated/agent-proof.txt") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      requestRecord.body = Buffer.concat(chunks).toString("utf8");
      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        content: {
          path: "src/generated/agent-proof.txt",
          sha: "blob456def",
          html_url: "https://github.example/acme/widgets/blob/feature/hermes-real-branch/src/generated/agent-proof.txt",
        },
        commit: {
          sha: "commit123abc",
          html_url: "https://github.example/acme/widgets/commit/commit123abc",
          message: "test: commit sandbox proof",
        },
      }));
    });
    return;
  }

  if (req.method === "POST" && req.url === "/repos/acme/widgets/pulls") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      requestRecord.body = Buffer.concat(chunks).toString("utf8");
      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        number: 42,
        html_url: "https://github.example/acme/widgets/pull/42",
        state: "open",
        draft: false,
        title: "feat: autonomous sandbox proof",
        body: "Proof generated by the production GitHub App path.",
        head: {
          ref: "feature/hermes-real-branch",
          sha: "branch789abc",
        },
        base: {
          ref: "main",
          sha: "abc123def456",
        },
      }));
    });
    return;
  }

  if (req.method === "GET" && req.url === "/repos/acme/widgets/pulls/42") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      number: 42,
      html_url: "https://github.example/acme/widgets/pull/42",
      state: "open",
      draft: false,
      merged: false,
      mergeable: true,
      mergeable_state: "clean",
      title: "feat: autonomous sandbox proof",
      body: "Proof generated by the production GitHub App path.",
      head: {
        ref: "feature/hermes-real-branch",
        sha: "branch789abc",
      },
      base: {
        ref: "main",
        sha: "abc123def456",
      },
      user: {
        login: "hermes-app[bot]",
      },
    }));
    return;
  }

  if (req.method === "PUT" && req.url === "/repos/acme/widgets/pulls/42/merge") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      requestRecord.body = Buffer.concat(chunks).toString("utf8");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        sha: "merge123abc",
        merged: true,
        message: "Pull Request successfully merged",
      }));
    });
    return;
  }

  if (req.method === "DELETE" && req.url === "/repos/acme/widgets/git/refs/heads/feature%2Fhermes-real-branch") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      requestRecord.body = Buffer.concat(chunks).toString("utf8");
      res.statusCode = 204;
      res.end();
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

  response = await fetch(`${baseUrl}/api/health`);
  const health = await readJson<{ providers: { sandbox: string } }>(response);
  assert.equal(response.status, 200);
  assert.equal(health.providers.sandbox, "podman-configured");

  response = await fetch(`${baseUrl}/api/sandbox/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
  });
  const sandboxVerify = await readJson<{
    ok: boolean;
    provider: string;
    status: string;
    version: string;
    image: string;
    network: string;
    memory: string;
    cpus: string;
    stdout: string;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(sandboxVerify.ok, true);
  assert.equal(sandboxVerify.provider, "podman");
  assert.equal(sandboxVerify.status, "ready");
  assert.equal(sandboxVerify.version, "podman version 5.0.0");
  assert.equal(sandboxVerify.image, "axiom-test-sandbox:latest");
  assert.equal(sandboxVerify.network, "none");
  assert.equal(sandboxVerify.memory, "128m");
  assert.equal(sandboxVerify.cpus, "0.5");
  assert.equal(sandboxVerify.stdout, "sandbox-ready");
  const fakePodmanLog = await fs.readFile(fakePodmanLogPath, "utf8");
  assert.match(fakePodmanLog, /^--version/m);
  assert.match(fakePodmanLog, /run --rm --network none --pull never --memory 128m --cpus 0\.5 axiom-test-sandbox:latest/);

  response = await fetch(`${baseUrl}/api/sandbox/execute-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
  });
  const sandboxExecution = await readJson<{
    ok: boolean;
    provider: string;
    status: string;
    image: string;
    network: string;
    memory: string;
    cpus: string;
    stdout: string;
    artifactCreated: boolean;
    artifact: string;
    workspaceMounted: boolean;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(sandboxExecution.ok, true);
  assert.equal(sandboxExecution.provider, "podman");
  assert.equal(sandboxExecution.status, "executed");
  assert.equal(sandboxExecution.image, "axiom-test-sandbox:latest");
  assert.equal(sandboxExecution.network, "none");
  assert.equal(sandboxExecution.memory, "128m");
  assert.equal(sandboxExecution.cpus, "0.5");
  assert.equal(sandboxExecution.stdout, "sandbox-input\nsandbox-exec-ready");
  assert.equal(sandboxExecution.artifactCreated, true);
  assert.equal(sandboxExecution.artifact, "sandbox-exec-ready");
  assert.equal(sandboxExecution.workspaceMounted, true);

  const fakePodmanSmokeLog = await fs.readFile(fakePodmanLogPath, "utf8");
  assert.match(fakePodmanSmokeLog, /run --rm --network none --pull never --memory 128m --cpus 0\.5 --pids-limit 256 --cap-drop all --security-opt no-new-privileges --read-only --tmpfs \/tmp:rw,noexec,nosuid,size=64m/);
  assert.match(fakePodmanSmokeLog, /-v .*\/sandbox-smoke-[^ ]+:\/workspace:rw,Z --workdir \/workspace axiom-test-sandbox:latest sh -lc printf sandbox-exec-ready > artifact\.txt && cat input\.txt && cat artifact\.txt/);

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

  response = await fetch(`${baseUrl}/api/integrations/github-app/branches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      repository: "acme/widgets",
      branchName: "feature/hermes-real-branch",
    }),
  });
  const branchCreate = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    sourceBranch: string;
    sourceSha: string;
    branchName: string;
    ref: string;
    branchSha: string;
    branchObjectType: string;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(branchCreate.ok, true);
  assert.equal(branchCreate.credentialStatus, "ready");
  assert.equal(branchCreate.repository, "acme/widgets");
  assert.equal(branchCreate.sourceBranch, "main");
  assert.equal(branchCreate.sourceSha, "abc123def456");
  assert.equal(branchCreate.branchName, "feature/hermes-real-branch");
  assert.equal(branchCreate.ref, "refs/heads/feature/hermes-real-branch");
  assert.equal(branchCreate.branchSha, "abc123def456");
  assert.equal(branchCreate.branchObjectType, "commit");
  assert.equal(branchCreate.tokenReceived, true);
  assert.equal(JSON.stringify(branchCreate).includes("ghs_do_not_return"), false);
  const branchRequest = githubApiRequests.at(-1);
  assert.equal(branchRequest?.method, "POST");
  assert.equal(branchRequest?.url, "/repos/acme/widgets/git/refs");
  assert.ok(branchRequest?.authorization?.startsWith("Bearer ghs_do_not_return"));
  assert.deepEqual(JSON.parse(branchRequest?.body || "{}"), {
    ref: "refs/heads/feature/hermes-real-branch",
    sha: "abc123def456",
  });

  response = await fetch(`${baseUrl}/api/integrations/github-app/file-commits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      repository: "acme/widgets",
      branchName: "feature/hermes-real-branch",
      filePath: "src/generated/agent-proof.txt",
      content: "sandbox proof\n",
      commitMessage: "test: commit sandbox proof",
    }),
  });
  const fileCommit = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    branchName: string;
    branchSha: string;
    branchObjectType: string;
    path: string;
    contentSha: string;
    contentUrl: string;
    commitSha: string;
    commitUrl: string;
    commitMessage: string;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(fileCommit.ok, true);
  assert.equal(fileCommit.credentialStatus, "ready");
  assert.equal(fileCommit.repository, "acme/widgets");
  assert.equal(fileCommit.branchName, "feature/hermes-real-branch");
  assert.equal(fileCommit.branchSha, "branch789abc");
  assert.equal(fileCommit.branchObjectType, "commit");
  assert.equal(fileCommit.path, "src/generated/agent-proof.txt");
  assert.equal(fileCommit.contentSha, "blob456def");
  assert.equal(fileCommit.commitSha, "commit123abc");
  assert.equal(fileCommit.commitMessage, "test: commit sandbox proof");
  assert.equal(fileCommit.tokenReceived, true);
  assert.equal(JSON.stringify(fileCommit).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-3)?.url, "/app/installations/67890/access_tokens");
  assert.equal(githubApiRequests.at(-2)?.url, "/repos/acme/widgets/git/ref/heads/feature%2Fhermes-real-branch");
  const fileCommitRequest = githubApiRequests.at(-1);
  assert.equal(fileCommitRequest?.method, "PUT");
  assert.equal(fileCommitRequest?.url, "/repos/acme/widgets/contents/src/generated/agent-proof.txt");
  assert.ok(fileCommitRequest?.authorization?.startsWith("Bearer ghs_do_not_return"));
  assert.deepEqual(JSON.parse(fileCommitRequest?.body || "{}"), {
    message: "test: commit sandbox proof",
    content: Buffer.from("sandbox proof\n", "utf8").toString("base64"),
    branch: "feature/hermes-real-branch",
  });

  response = await fetch(`${baseUrl}/api/integrations/github-app/pull-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      repository: "acme/widgets",
      branchName: "feature/hermes-real-branch",
      title: "feat: autonomous sandbox proof",
      body: "Proof generated by the production GitHub App path.",
    }),
  });
  const pullRequestCreate = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    branchName: string;
    branchSha: string;
    branchObjectType: string;
    baseBranch: string;
    baseSha: string;
    defaultBranch: string;
    pullRequestNumber: number;
    pullRequestUrl: string;
    pullRequestState: string;
    draft: boolean;
    title: string;
    body: string;
    headRef: string;
    headSha: string;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 201);
  assert.equal(pullRequestCreate.ok, true);
  assert.equal(pullRequestCreate.credentialStatus, "ready");
  assert.equal(pullRequestCreate.repository, "acme/widgets");
  assert.equal(pullRequestCreate.branchName, "feature/hermes-real-branch");
  assert.equal(pullRequestCreate.branchSha, "branch789abc");
  assert.equal(pullRequestCreate.branchObjectType, "commit");
  assert.equal(pullRequestCreate.baseBranch, "main");
  assert.equal(pullRequestCreate.baseSha, "abc123def456");
  assert.equal(pullRequestCreate.defaultBranch, "main");
  assert.equal(pullRequestCreate.pullRequestNumber, 42);
  assert.equal(pullRequestCreate.pullRequestUrl, "https://github.example/acme/widgets/pull/42");
  assert.equal(pullRequestCreate.pullRequestState, "open");
  assert.equal(pullRequestCreate.draft, false);
  assert.equal(pullRequestCreate.title, "feat: autonomous sandbox proof");
  assert.equal(pullRequestCreate.body, "Proof generated by the production GitHub App path.");
  assert.equal(pullRequestCreate.headRef, "feature/hermes-real-branch");
  assert.equal(pullRequestCreate.headSha, "branch789abc");
  assert.equal(pullRequestCreate.tokenReceived, true);
  assert.equal(JSON.stringify(pullRequestCreate).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-5)?.url, "/app/installations/67890/access_tokens");
  assert.equal(githubApiRequests.at(-4)?.url, "/repos/acme/widgets");
  assert.equal(githubApiRequests.at(-3)?.url, "/repos/acme/widgets/git/ref/heads/main");
  assert.equal(githubApiRequests.at(-2)?.url, "/repos/acme/widgets/git/ref/heads/feature%2Fhermes-real-branch");
  const pullRequest = githubApiRequests.at(-1);
  assert.equal(pullRequest?.method, "POST");
  assert.equal(pullRequest?.url, "/repos/acme/widgets/pulls");
  assert.ok(pullRequest?.authorization?.startsWith("Bearer ghs_do_not_return"));
  assert.deepEqual(JSON.parse(pullRequest?.body || "{}"), {
    title: "feat: autonomous sandbox proof",
    head: "feature/hermes-real-branch",
    base: "main",
    body: "Proof generated by the production GitHub App path.",
    draft: false,
  });

  response = await fetch(`${baseUrl}/api/integrations/github-app/pull-requests/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      repository: "acme/widgets",
      pullRequestNumber: 42,
    }),
  });
  const pullRequestStatus = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    pullRequestNumber: number;
    pullRequestUrl: string;
    pullRequestState: string;
    draft: boolean;
    merged: boolean;
    mergeable: boolean;
    mergeableState: string;
    title: string;
    body: string;
    headRef: string;
    headSha: string;
    baseRef: string;
    baseSha: string;
    authorLogin: string;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(pullRequestStatus.ok, true);
  assert.equal(pullRequestStatus.credentialStatus, "ready");
  assert.equal(pullRequestStatus.repository, "acme/widgets");
  assert.equal(pullRequestStatus.pullRequestNumber, 42);
  assert.equal(pullRequestStatus.pullRequestState, "open");
  assert.equal(pullRequestStatus.draft, false);
  assert.equal(pullRequestStatus.merged, false);
  assert.equal(pullRequestStatus.mergeable, true);
  assert.equal(pullRequestStatus.mergeableState, "clean");
  assert.equal(pullRequestStatus.headRef, "feature/hermes-real-branch");
  assert.equal(pullRequestStatus.headSha, "branch789abc");
  assert.equal(pullRequestStatus.baseRef, "main");
  assert.equal(pullRequestStatus.baseSha, "abc123def456");
  assert.equal(pullRequestStatus.authorLogin, "hermes-app[bot]");
  assert.equal(pullRequestStatus.tokenReceived, true);
  assert.equal(JSON.stringify(pullRequestStatus).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-2)?.url, "/app/installations/67890/access_tokens");
  const pullRequestStatusRequest = githubApiRequests.at(-1);
  assert.equal(pullRequestStatusRequest?.method, "GET");
  assert.equal(pullRequestStatusRequest?.url, "/repos/acme/widgets/pulls/42");
  assert.ok(pullRequestStatusRequest?.authorization?.startsWith("Bearer ghs_do_not_return"));

  response = await fetch(`${baseUrl}/api/integrations/github-app/pull-requests/merge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      repository: "acme/widgets",
      pullRequestNumber: 42,
      mergeMethod: "squash",
      commitTitle: "feat: autonomous sandbox proof",
      commitMessage: "Verified through the GitHub App merge adapter.",
    }),
  });
  const pullRequestMerge = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    pullRequestNumber: number;
    merged: boolean;
    mergeSha: string;
    mergeMessage: string;
    mergeMethod: string;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(pullRequestMerge.ok, true);
  assert.equal(pullRequestMerge.credentialStatus, "ready");
  assert.equal(pullRequestMerge.repository, "acme/widgets");
  assert.equal(pullRequestMerge.pullRequestNumber, 42);
  assert.equal(pullRequestMerge.merged, true);
  assert.equal(pullRequestMerge.mergeSha, "merge123abc");
  assert.equal(pullRequestMerge.mergeMessage, "Pull Request successfully merged");
  assert.equal(pullRequestMerge.mergeMethod, "squash");
  assert.equal(pullRequestMerge.tokenReceived, true);
  assert.equal(JSON.stringify(pullRequestMerge).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-2)?.url, "/app/installations/67890/access_tokens");
  const pullRequestMergeRequest = githubApiRequests.at(-1);
  assert.equal(pullRequestMergeRequest?.method, "PUT");
  assert.equal(pullRequestMergeRequest?.url, "/repos/acme/widgets/pulls/42/merge");
  assert.ok(pullRequestMergeRequest?.authorization?.startsWith("Bearer ghs_do_not_return"));
  assert.deepEqual(JSON.parse(pullRequestMergeRequest?.body || "{}"), {
    merge_method: "squash",
    commit_title: "feat: autonomous sandbox proof",
    commit_message: "Verified through the GitHub App merge adapter.",
  });

  response = await fetch(`${baseUrl}/api/integrations/github-app/branches/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": adminLogin.csrfToken,
    },
    body: JSON.stringify({
      repository: "acme/widgets",
      branchName: "feature/hermes-real-branch",
    }),
  });
  const branchDelete = await readJson<{
    ok: boolean;
    credentialStatus: string;
    repository: string;
    defaultBranch: string;
    branchName: string;
    ref: string;
    branchSha: string;
    branchObjectType: string;
    deleted: boolean;
    tokenReceived: boolean;
  }>(response);
  assert.equal(response.status, 200);
  assert.equal(branchDelete.ok, true);
  assert.equal(branchDelete.credentialStatus, "ready");
  assert.equal(branchDelete.repository, "acme/widgets");
  assert.equal(branchDelete.defaultBranch, "main");
  assert.equal(branchDelete.branchName, "feature/hermes-real-branch");
  assert.equal(branchDelete.ref, "refs/heads/feature/hermes-real-branch");
  assert.equal(branchDelete.branchSha, "branch789abc");
  assert.equal(branchDelete.branchObjectType, "commit");
  assert.equal(branchDelete.deleted, true);
  assert.equal(branchDelete.tokenReceived, true);
  assert.equal(JSON.stringify(branchDelete).includes("ghs_do_not_return"), false);
  assert.equal(githubApiRequests.at(-5)?.url, "/app/installations/67890/access_tokens");
  assert.equal(githubApiRequests.at(-4)?.url, "/repos/acme/widgets");
  assert.equal(githubApiRequests.at(-3)?.url, "/repos/acme/widgets/git/ref/heads/main");
  assert.equal(githubApiRequests.at(-2)?.url, "/repos/acme/widgets/git/ref/heads/feature%2Fhermes-real-branch");
  const branchDeleteRequest = githubApiRequests.at(-1);
  assert.equal(branchDeleteRequest?.method, "DELETE");
  assert.equal(branchDeleteRequest?.url, "/repos/acme/widgets/git/refs/heads/feature%2Fhermes-real-branch");
  assert.ok(branchDeleteRequest?.authorization?.startsWith("Bearer ghs_do_not_return"));

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
  assert.equal(baSettings.runtime.sandboxProvider, "podman-configured");

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
  const tokenExchangeCountBeforeJob = githubApiRequests.filter(
    (request) => request.url === "/app/installations/67890/access_tokens",
  ).length;

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
        iterations: Array<{
          codeDiff: string;
          stdout: string;
          testResultsXml: string;
          sandboxProof?: {
            provider: string;
            mode: string;
            image: string;
            network: string;
            artifact: string;
            checkout?: {
              provider: string;
              authProvider: string;
              repository: string;
              ref: string;
              depth: number;
            };
            steps: string[];
            stdoutCaptured: boolean;
            stderrCaptured: boolean;
            junitXmlCaptured: boolean;
          };
        }>;
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
  assert.match(adminJob.job.result.iterations[1].stdout, /\[Axiom Sandbox Execution\]/);
  assert.match(adminJob.job.result.iterations[1].stdout, /sandbox-command-manifest-ready/);
  assert.match(adminJob.job.result.iterations[1].stdout, /\[Sandbox stdout artifact\]/);
  assert.match(adminJob.job.result.iterations[1].stdout, /install-ok/);
  assert.match(adminJob.job.result.iterations[1].stdout, /lint-ok/);
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.provider, "podman");
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.mode, "configured-command-manifest");
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.image, "axiom-test-sandbox:latest");
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.network, "none");
  assert.match(adminJob.job.result.iterations[1].sandboxProof?.artifact || "", /install:PASS/);
  assert.match(adminJob.job.result.iterations[1].sandboxProof?.artifact || "", /static-analysis:PASS/);
  assert.match(adminJob.job.result.iterations[1].sandboxProof?.artifact || "", /sandbox-command-manifest-ready/);
  assert.deepEqual(adminJob.job.result.iterations[1].sandboxProof?.checkout, {
    provider: "git",
    authProvider: "github_app",
    repository: "acme/widgets",
    ref: "feature/hermes-real-branch",
    depth: 1,
  });
  assert.equal(JSON.stringify(adminJob).includes("ghs_do_not_return"), false);
  assert.deepEqual(adminJob.job.result.iterations[1].sandboxProof?.steps, [
    "install",
    "build",
    "test",
    "static-analysis",
  ]);
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.stdoutCaptured, true);
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.stderrCaptured, false);
  assert.equal(adminJob.job.result.iterations[1].sandboxProof?.junitXmlCaptured, true);
  assert.ok(adminJob.job.pipelineState.logs.some((line) => line.includes("Podman job workspace proof executed")));
  assert.ok(adminJob.job.pipelineState.logs.some((line) => line.includes("Artifact captured from mounted workspace: install:PASS")));

  const fakePodmanJobLog = await fs.readFile(fakePodmanLogPath, "utf8");
  assert.match(fakePodmanJobLog, /-v .*\/job-.*-sandbox-[^ ]+\/repo:\/workspace:rw,Z --workdir \/workspace axiom-test-sandbox:latest sh -lc sh axiom-sandbox-run\.sh/);
  assert.match(fakePodmanJobLog, /run_step 'install' 'printf install-ok'/);
  assert.match(fakePodmanJobLog, /run_step 'build' 'printf build-ok'/);
  assert.match(fakePodmanJobLog, /run_step 'test' 'printf test-ok'/);
  assert.match(fakePodmanJobLog, /run_step 'static-analysis' 'printf lint-ok'/);

  const fakeGitLog = await fs.readFile(fakeGitLogPath, "utf8");
  assert.match(fakeGitLog, /-c http\.extraHeader=Authorization: Bearer ghs_do_not_return clone --depth 1 --branch feature\/hermes-real-branch https:\/\/github\.example\/acme\/widgets\.git .*\/job-.*-sandbox-[^ ]+\/repo/);
  const tokenExchangeCountAfterJob = githubApiRequests.filter(
    (request) => request.url === "/app/installations/67890/access_tokens",
  ).length;
  assert.equal(tokenExchangeCountAfterJob, tokenExchangeCountBeforeJob + 1);

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
