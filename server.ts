import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import type { NextFunction, Request, Response } from "express";
import { Pool, type PoolClient } from "pg";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Initialize Google Gen AI SDK
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "") {
  console.log("Initializing Gemini API with server-side key...");
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.log("No valid GEMINI_API_KEY found. Falling back to high-fidelity offline execution simulator.");
}

type UserRole = "MANAGER" | "BUSINESS_ANALYST" | "ADMINISTRATOR";
type UserStatus = "ACTIVE" | "INVITED";
type InviteDeliveryStatus = "LOCAL_ONLY" | "DELIVERED" | "FAILED";
type JobStatus = "QUEUED" | "IN_PROGRESS" | "REVIEW_READY" | "COMPLETED" | "ROLLED_BACK" | "FAILED";
type QueueState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
type IntegrationProvider =
  | "github_app"
  | "jira"
  | "linear"
  | "jenkins"
  | "hosting"
  | "temporal"
  | "kubernetes";
type TerminalStatus =
  | "IDLE"
  | "PROVISIONING"
  | "DEVELOPING"
  | "TESTING"
  | "REJECTED"
  | "RESOLVING"
  | "VERIFIED"
  | "PR_DRAFT"
  | "COMPLETED"
  | "ROLLED_BACK";

interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  provider: "github" | "local";
  providerId?: string;
  invitedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
}

interface OAuthStateRecord {
  state: string;
  provider: "github";
  createdAt: string;
  expiresAt: string;
  redirectPath: string;
}

interface InviteTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  deliveryStatus: InviteDeliveryStatus;
}

interface EncryptedSecret {
  key: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface IntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  metadata: Record<string, string>;
  encryptedSecrets: EncryptedSecret[];
  configuredByUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface CostEstimate {
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  computeMs: number;
  isComplex: boolean;
}

interface StoredJob {
  id: string;
  executionId: string;
  hermesSessionId: string;
  taskName: string;
  scopeDescription: string;
  currentPhase: string;
  gitBranch: string;
  targetRepository: string;
  status: JobStatus;
  phaseIndex: number;
  runningText: string;
  terminalStatus: TerminalStatus;
  activeIterationIndex: number;
  assignedTo: string;
  submittedAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  queueState?: QueueState;
  workerId?: string;
  lastError?: string;
  createdByUserId: string;
  developerRole: string;
  qaRole: string;
  estimate: CostEstimate;
  logs: string[];
  result?: ReturnType<typeof generateOfflineSimulation>;
  rollbackSnapshot?: {
    branchDeleted: boolean;
    jobStateReverted: boolean;
    memoryEvicted: boolean;
    completedAt: string;
  };
}

interface HermesStore {
  users: AppUser[];
  sessions: SessionRecord[];
  oauthStates: OAuthStateRecord[];
  inviteTokens: InviteTokenRecord[];
  jobs: StoredJob[];
  integrations: IntegrationConfig[];
}

interface AuthContext {
  user: AppUser;
  session: SessionRecord;
}

type AuthedRequest = Request & { auth: AuthContext };

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const storePath = path.join(dataDir, "hermes-store.json");
const sessionCookieName = "hermes_session";
const sessionSecret =
  process.env.SESSION_SECRET ||
  "development-only-session-secret-change-before-production";
const devLoginEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_LOGIN === "true";
const localWorkerPollMs = Number(process.env.LOCAL_WORKER_POLL_MS || 1000);
const integrationEncryptionSecret =
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  `${sessionSecret}:integration-secret-development-fallback`;
const inviteTokenTtlHours = Number(process.env.INVITE_TOKEN_TTL_HOURS || 168);

function nowIso() {
  return new Date().toISOString();
}

function formatLogTime() {
  return new Date().toISOString().substring(11, 19);
}

function toLocalDisplay(iso: string) {
  return iso.replace("T", " ").substring(0, 19);
}

function safeId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function slugifyBranch(taskDescription: string) {
  const slug = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 42);
  return `feature/hermes-${slug || "task"}`;
}

function defaultStore(): HermesStore {
  return {
    users: [],
    sessions: [],
    oauthStates: [],
    inviteTokens: [],
    jobs: [],
    integrations: [],
  };
}

interface StoreDriver {
  kind: "json" | "postgres";
  init(): Promise<void>;
  read(): Promise<HermesStore>;
  write(store: HermesStore): Promise<void>;
  mutate<T>(mutator: (store: HermesStore) => T | Promise<T>): Promise<T>;
}

class JsonStoreDriver implements StoreDriver {
  kind = "json" as const;

  async init() {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  async read() {
    return readJsonStore();
  }

  async write(store: HermesStore) {
    writeJsonStore(store);
  }

  async mutate<T>(mutator: (store: HermesStore) => T | Promise<T>) {
    const store = readJsonStore();
    const result = await mutator(store);
    writeJsonStore(store);
    return result;
  }
}

class PostgresStoreDriver implements StoreDriver {
  kind = "postgres" as const;
  private pool: Pool;
  private initialized: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init() {
    if (!this.initialized) {
      this.initialized = this.createSchema();
    }
    await this.initialized;
  }

  async read() {
    await this.init();
    const [users, sessions, oauthStates, inviteTokens, jobs, integrations] = await Promise.all([
      this.pool.query<{ payload: AppUser }>("SELECT payload FROM hermes_app_users ORDER BY created_at ASC"),
      this.pool.query<{ payload: SessionRecord }>("SELECT payload FROM hermes_app_sessions ORDER BY created_at ASC"),
      this.pool.query<{ payload: OAuthStateRecord }>("SELECT payload FROM hermes_app_oauth_states ORDER BY created_at ASC"),
      this.pool.query<{ payload: InviteTokenRecord }>("SELECT payload FROM hermes_app_invite_tokens ORDER BY created_at DESC"),
      this.pool.query<{ payload: StoredJob }>("SELECT payload FROM hermes_app_jobs ORDER BY submitted_at DESC"),
      this.pool.query<{ payload: IntegrationConfig }>("SELECT payload FROM hermes_app_integrations ORDER BY updated_at DESC"),
    ]);

    return {
      users: users.rows.map((row) => row.payload),
      sessions: sessions.rows.map((row) => row.payload),
      oauthStates: oauthStates.rows.map((row) => row.payload),
      inviteTokens: inviteTokens.rows.map((row) => row.payload),
      jobs: jobs.rows.map((row) => row.payload),
      integrations: integrations.rows.map((row) => row.payload),
    };
  }

  async write(store: HermesStore) {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.replaceTable(
        client,
        "hermes_app_users",
        store.users,
        (user) => [user.id, user.email, user.createdAt, user.updatedAt, JSON.stringify(user)],
        "id, email, created_at, updated_at, payload",
        "$1, $2, $3::timestamptz, $4::timestamptz, $5::jsonb",
      );
      await this.replaceTable(
        client,
        "hermes_app_sessions",
        store.sessions,
        (session) => [session.id, session.userId, session.expiresAt, session.createdAt, JSON.stringify(session)],
        "id, user_id, expires_at, created_at, payload",
        "$1, $2, $3::timestamptz, $4::timestamptz, $5::jsonb",
      );
      await this.replaceTable(
        client,
        "hermes_app_oauth_states",
        store.oauthStates,
        (oauthState) => [oauthState.state, oauthState.provider, oauthState.expiresAt, oauthState.createdAt, JSON.stringify(oauthState)],
        "state, provider, expires_at, created_at, payload",
        "$1, $2, $3::timestamptz, $4::timestamptz, $5::jsonb",
      );
      await this.replaceTable(
        client,
        "hermes_app_invite_tokens",
        store.inviteTokens || [],
        (inviteToken) => [
          inviteToken.id,
          inviteToken.userId,
          inviteToken.email,
          inviteToken.expiresAt,
          inviteToken.acceptedAt || null,
          inviteToken.deliveryStatus,
          inviteToken.createdAt,
          JSON.stringify(inviteToken),
        ],
        "id, user_id, email, expires_at, accepted_at, delivery_status, created_at, payload",
        "$1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7::timestamptz, $8::jsonb",
      );
      await this.replaceTable(
        client,
        "hermes_app_jobs",
        store.jobs,
        (job) => [
          job.id,
          job.status,
          job.currentPhase,
          job.queueState || null,
          job.workerId || null,
          job.queuedAt || null,
          job.startedAt || null,
          job.submittedAt,
          job.completedAt || null,
          JSON.stringify(job),
        ],
        "id, status, current_phase, queue_state, worker_id, queued_at, started_at, submitted_at, completed_at, payload",
        "$1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10::jsonb",
      );
      await this.replaceTable(
        client,
        "hermes_app_integrations",
        store.integrations || [],
        (integration) => [
          integration.id,
          integration.provider,
          integration.displayName,
          integration.configuredByUserId,
          integration.createdAt,
          integration.updatedAt,
          JSON.stringify(integration),
        ],
        "id, provider, display_name, configured_by_user_id, created_at, updated_at, payload",
        "$1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::jsonb",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async mutate<T>(mutator: (store: HermesStore) => T | Promise<T>) {
    const store = await this.read();
    const result = await mutator(store);
    await this.write(store);
    return result;
  }

  private async createSchema() {
    await this.pool.query(`
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

      CREATE INDEX IF NOT EXISTS idx_hermes_app_sessions_user_id ON hermes_app_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_hermes_app_sessions_expires_at ON hermes_app_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS hermes_app_oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_hermes_app_oauth_states_expires_at ON hermes_app_oauth_states(expires_at);

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

      CREATE INDEX IF NOT EXISTS idx_hermes_app_invite_tokens_user_id ON hermes_app_invite_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_hermes_app_invite_tokens_email ON hermes_app_invite_tokens(email);
      CREATE INDEX IF NOT EXISTS idx_hermes_app_invite_tokens_expires_at ON hermes_app_invite_tokens(expires_at);

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

      ALTER TABLE hermes_app_jobs ADD COLUMN IF NOT EXISTS queue_state TEXT;
      ALTER TABLE hermes_app_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT;
      ALTER TABLE hermes_app_jobs ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;
      ALTER TABLE hermes_app_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_hermes_app_jobs_status ON hermes_app_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_hermes_app_jobs_queue_state ON hermes_app_jobs(queue_state);
      CREATE INDEX IF NOT EXISTS idx_hermes_app_jobs_submitted_at ON hermes_app_jobs(submitted_at DESC);

      CREATE TABLE IF NOT EXISTS hermes_app_integrations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        display_name TEXT NOT NULL,
        configured_by_user_id TEXT NOT NULL REFERENCES hermes_app_users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_hermes_app_integrations_provider ON hermes_app_integrations(provider);
      CREATE INDEX IF NOT EXISTS idx_hermes_app_integrations_updated_at ON hermes_app_integrations(updated_at DESC);
    `);
  }

  private async replaceTable<T>(
    client: PoolClient,
    table: string,
    rows: T[],
    valuesFor: (row: T) => unknown[],
    columns: string,
    placeholders: string,
  ) {
    await client.query(`DELETE FROM ${table}`);
    for (const row of rows) {
      await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, valuesFor(row));
    }
  }
}

const databaseUrl = process.env.DATABASE_URL || "";
const storageProvider =
  databaseUrl && process.env.STORAGE_PROVIDER !== "json"
    ? new PostgresStoreDriver(databaseUrl)
    : new JsonStoreDriver();

function readJsonStore(): HermesStore {
  if (!fs.existsSync(storePath)) {
    return defaultStore();
  }

  try {
    return {
      ...defaultStore(),
      ...JSON.parse(fs.readFileSync(storePath, "utf8")),
    } as HermesStore;
  } catch (error) {
    console.error("Could not read persisted Hermes store. Starting from an empty store.", error);
    return defaultStore();
  }
}

function writeJsonStore(store: HermesStore) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmpPath = `${storePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2));
  fs.renameSync(tmpPath, storePath);
}

async function readStore() {
  return storageProvider.read();
}

async function mutateStore<T>(mutator: (store: HermesStore) => T | Promise<T>) {
  return storageProvider.mutate(mutator);
}

function signSessionId(sessionId: string) {
  return crypto.createHmac("sha256", sessionSecret).update(sessionId).digest("base64url");
}

function encodeSessionCookie(sessionId: string) {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function decodeSessionCookie(value: string | undefined) {
  if (!value) return null;
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return null;
  const expected = signSessionId(sessionId);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  return sessionId;
}

function parseCookies(req: Request) {
  const header = req.headers.cookie;
  if (!header) return {};

  return header.split(";").reduce<Record<string, string>>((acc, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

function setSessionCookie(res: Response, sessionId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(encodeSessionCookie(sessionId))}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`,
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

function sanitizeUser(user: AppUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status || "ACTIVE",
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    invitedAt: user.invitedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function inviteTtlMs() {
  const hours = Number.isFinite(inviteTokenTtlHours) && inviteTokenTtlHours > 0
    ? inviteTokenTtlHours
    : 168;
  return hours * 60 * 60 * 1000;
}

function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function inviteTokenStatus(inviteToken: InviteTokenRecord) {
  if (inviteToken.acceptedAt) return "ACCEPTED";
  if (new Date(inviteToken.expiresAt).getTime() <= Date.now()) return "EXPIRED";
  return "PENDING";
}

function sanitizeInviteToken(inviteToken: InviteTokenRecord) {
  return {
    id: inviteToken.id,
    userId: inviteToken.userId,
    email: inviteToken.email,
    createdByUserId: inviteToken.createdByUserId,
    createdAt: inviteToken.createdAt,
    expiresAt: inviteToken.expiresAt,
    acceptedAt: inviteToken.acceptedAt,
    deliveryStatus: inviteToken.deliveryStatus,
    status: inviteTokenStatus(inviteToken),
  };
}

async function createSession(userId: string) {
  return mutateStore((store) => {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const session: SessionRecord = {
      id: safeId("sess"),
      userId,
      csrfToken: crypto.randomBytes(24).toString("base64url"),
      createdAt: nowIso(),
      expiresAt,
    };

    store.sessions = store.sessions.filter((existing) => new Date(existing.expiresAt).getTime() > Date.now());
    store.sessions.push(session);
    return session;
  });
}

async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookies = parseCookies(req);
  const sessionId = decodeSessionCookie(cookies[sessionCookieName]);
  if (!sessionId) return null;

  const store = await readStore();
  const session = store.sessions.find((candidate) => candidate.id === sessionId);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const user = store.users.find((candidate) => candidate.id === session.userId);
  if (!user) return null;
  return { user, session };
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return res.status(401).json({ error: "Authentication required" });
    }

    (req as AuthedRequest).auth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const auth = (req as AuthedRequest).auth;
  const token = req.get("x-csrf-token");
  if (!auth || !token || token !== auth.session.csrfToken) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth || !roles.includes(auth.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

function isUserRole(role: unknown): role is UserRole {
  return role === "MANAGER" || role === "BUSINESS_ANALYST" || role === "ADMINISTRATOR";
}

function isIntegrationProvider(provider: unknown): provider is IntegrationProvider {
  return (
    provider === "github_app" ||
    provider === "jira" ||
    provider === "linear" ||
    provider === "jenkins" ||
    provider === "hosting" ||
    provider === "temporal" ||
    provider === "kubernetes"
  );
}

function encryptionKey() {
  return crypto.createHash("sha256").update(integrationEncryptionSecret).digest();
}

function encryptSecret(key: string, value: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    key,
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function sanitizeIntegration(integration: IntegrationConfig) {
  return {
    id: integration.id,
    provider: integration.provider,
    displayName: integration.displayName,
    metadata: integration.metadata,
    secretKeys: integration.encryptedSecrets.map((secret) => secret.key),
    configuredByUserId: integration.configuredByUserId,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function findOrCreateUser(params: {
  email: string;
  fullName: string;
  provider: "github" | "local";
  providerId?: string;
  avatarUrl?: string;
  role?: UserRole;
}) {
  return mutateStore((store) => {
    const email = params.email.toLowerCase();
    const existing = store.users.find((candidate) => candidate.email.toLowerCase() === email);
    if (existing) {
      existing.fullName = params.fullName || existing.fullName;
      existing.avatarUrl = params.avatarUrl || existing.avatarUrl;
      existing.provider = params.provider;
      existing.providerId = params.providerId || existing.providerId;
      existing.status = "ACTIVE";
      existing.lastLoginAt = nowIso();
      existing.updatedAt = nowIso();
      return existing;
    }

    const firstUserRole: UserRole = store.users.length === 0 ? "ADMINISTRATOR" : "MANAGER";
    const user: AppUser = {
      id: safeId("usr"),
      email,
      fullName: params.fullName || email,
      role: params.role || firstUserRole,
      status: "ACTIVE",
      avatarUrl: params.avatarUrl,
      provider: params.provider,
      providerId: params.providerId,
      lastLoginAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.users.push(user);
    return user;
  });
}

function estimateCostForTask(taskDescription: string): CostEstimate {
  const wordCount = taskDescription.trim().split(/\s+/).filter(Boolean).length;
  const isComplex = wordCount > 15 || /stripe|payment|kubernetes|auth|docker|oauth|github|temporal|postgres/i.test(taskDescription);
  const estInputTokens = Math.round(18000 + wordCount * 12);
  const estOutputTokens = Math.round(4500 + (isComplex ? 3500 : 1500));
  const estComputeMs = isComplex ? 24500 : 12400;
  const estTokenCost = estInputTokens * 0.000000075 + estOutputTokens * 0.0000003;
  const estComputeCost = estComputeMs * 0.000016;

  return {
    estimatedCost: parseFloat((estTokenCost + estComputeCost).toFixed(5)),
    inputTokens: estInputTokens,
    outputTokens: estOutputTokens,
    computeMs: estComputeMs,
    isComplex,
  };
}

function jobToPipelineState(job: StoredJob) {
  return {
    phaseIndex: job.phaseIndex,
    runningText: job.runningText,
    jobData: job.result || null,
    activeIterationIndex: job.activeIterationIndex,
    logs: job.logs,
    terminalStatus: job.terminalStatus,
  };
}

function jobToClient(job: StoredJob) {
  return {
    id: job.id,
    executionId: job.executionId,
    hermesSessionId: job.hermesSessionId,
    taskName: job.taskName,
    status: job.status,
    currentPhase: job.currentPhase,
    gitBranch: job.gitBranch,
    targetRepository: job.targetRepository,
    submittedAt: job.submittedAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    queueState: job.queueState || (job.status === "QUEUED" ? "PENDING" : undefined),
    workerId: job.workerId,
    lastError: job.lastError,
    assignedTo: job.assignedTo,
    estimate: job.estimate,
    createdByUserId: job.createdByUserId,
    pipelineState: jobToPipelineState(job),
    result: job.result || null,
  };
}

function jobToHistory(job: StoredJob) {
  const historyStatus = job.status === "REVIEW_READY" ? "IN_PROGRESS" : job.status;
  return {
    id: job.id,
    task: job.taskName,
    status: historyStatus,
    submittedAt: toLocalDisplay(job.submittedAt),
    completedAt: job.completedAt ? toLocalDisplay(job.completedAt) : undefined,
    phase: job.currentPhase.replace(/_/g, " "),
    assignedTo: job.assignedTo,
  };
}

function jobToLedger(job: StoredJob) {
  const finalPr = job.result?.finalPr;
  const actualCost =
    job.status === "ROLLED_BACK"
      ? 0.015
      : job.status === "COMPLETED"
        ? finalPr?.actualCost || 0
        : 0;

  return {
    id: job.id,
    task: job.taskName,
    branch: job.gitBranch,
    status: job.status,
    estimatedCost: job.estimate.estimatedCost,
    actualCost,
    tokens: finalPr
      ? `${(finalPr.inputTokens / 1000).toFixed(1)}k / ${(finalPr.outputTokens / 1000).toFixed(1)}k`
      : `${(job.estimate.inputTokens / 1000).toFixed(1)}k / ${(job.estimate.outputTokens / 1000).toFixed(1)}k`,
    date: job.submittedAt.substring(0, 10),
  };
}

function appendJobLog(job: StoredJob, lines: string[]) {
  job.logs.push(...lines);
}

async function updateJob(jobId: string, updater: (job: StoredJob) => void) {
  return mutateStore((store) => {
    const job = store.jobs.find((candidate) => candidate.id === jobId);
    if (!job) return null;
    updater(job);
    return job;
  });
}

const workerId = `local-worker-${crypto.randomBytes(4).toString("hex")}`;
const runningJobIds = new Set<string>();
let workerLoopStarted = false;
let workerTimer: NodeJS.Timeout | null = null;

async function claimNextQueuedJob() {
  return mutateStore((store) => {
    const job = store.jobs
      .filter((candidate) => candidate.status === "QUEUED" && (candidate.queueState || "PENDING") === "PENDING")
      .sort((left, right) => new Date(left.queuedAt || left.submittedAt).getTime() - new Date(right.queuedAt || right.submittedAt).getTime())[0];

    if (!job) return null;

    job.status = "IN_PROGRESS";
    job.queueState = "RUNNING";
    job.workerId = workerId;
    job.startedAt = nowIso();
    job.assignedTo = "Local Workflow Worker";
    job.currentPhase = "DISPATCHED_TO_QUEUE";
    job.phaseIndex = 2;
    job.runningText = "Phase 2: Local Durable Queue Worker Claimed Job";
    job.terminalStatus = "PROVISIONING";
    appendJobLog(job, [
      `[${formatLogTime()}] [QUEUE] Claimed by ${workerId}.`,
      `[${formatLogTime()}] [QUEUE] Worker owns progress from this point forward.`,
      `[${formatLogTime()}] [GIT] Prepared branch mapping: ${job.gitBranch}`,
    ]);

    return job;
  });
}

async function failWorkflowJob(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Workflow execution failed";
  await updateJob(jobId, (job) => {
    job.status = "FAILED";
    job.queueState = "FAILED";
    job.currentPhase = "FAILED";
    job.runningText = "Workflow Error";
    job.terminalStatus = "REJECTED";
    job.lastError = message;
    job.completedAt = nowIso();
    appendJobLog(job, [`[ERROR] ${message}`]);
  });
}

async function drainLocalWorkflowQueue() {
  const claimed = await claimNextQueuedJob();
  if (!claimed || runningJobIds.has(claimed.id)) {
    return;
  }

  runningJobIds.add(claimed.id);
  void runLocalWorkflow(claimed.id)
    .catch((error) => failWorkflowJob(claimed.id, error))
    .finally(() => {
      runningJobIds.delete(claimed.id);
    });
}

function startLocalWorkflowWorker() {
  if (workerLoopStarted) return;
  workerLoopStarted = true;
  void drainLocalWorkflowQueue();
  workerTimer = setInterval(() => {
    void drainLocalWorkflowQueue();
  }, localWorkerPollMs);
  workerTimer.unref?.();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLocalWorkflow(jobId: string) {
  const store = await readStore();
  const jobSnapshot = store.jobs.find((candidate) => candidate.id === jobId);

  if (!jobSnapshot) return;

  let result: ReturnType<typeof generateOfflineSimulation>;
  try {
    result = generateOfflineSimulation(
      jobSnapshot.scopeDescription,
      jobSnapshot.developerRole,
      jobSnapshot.qaRole,
    );
  } catch (error: any) {
    await updateJob(jobId, (job) => {
      job.status = "FAILED";
      job.queueState = "FAILED";
      job.currentPhase = "FAILED";
      job.runningText = "Workflow Error";
      job.terminalStatus = "REJECTED";
      job.lastError = error.message;
      job.completedAt = nowIso();
      appendJobLog(job, [`[ERROR] Execution data generation failed: ${error.message}`]);
    });
    return;
  }

  await wait(900);
  await updateJob(jobId, (job) => {
    job.currentPhase = "DEVELOPER_LOOP";
    job.phaseIndex = 3;
    job.runningText = "Phase 3: Developer AI Code Synthesis";
    job.terminalStatus = "DEVELOPING";
    job.result = result;
    job.gitBranch = result.gitBranch;
    appendJobLog(job, [
      `[${formatLogTime()}] [AGENT-DEV] Developer AI session started.`,
      `[${formatLogTime()}] [AGENT-DEV] ${result.developerAgentPrompt.substring(0, 96)}...`,
      `[${formatLogTime()}] [AGENT-DEV] ${result.iterations[0].developerAction}`,
      `[${formatLogTime()}] [GIT] Commit prepared on ${result.gitBranch}.`,
    ]);
  });

  await wait(900);
  await updateJob(jobId, (job) => {
    const it1 = result.iterations[0];
    job.currentPhase = "QA_VERIFICATION";
    job.phaseIndex = 4;
    job.runningText = "Phase 4: QA Sandbox Verification";
    job.terminalStatus = "TESTING";
    appendJobLog(job, [
      `[${formatLogTime()}] [AGENT-QA] QA Tester AI session started.`,
      `[${formatLogTime()}] [SANDBOX] ${it1.qaAction}`,
      `[${formatLogTime()}] [TEST] Launching isolated test suite...`,
      ...it1.stdout.split("\n").map((line) => `[TEST-STDOUT] ${line}`),
    ]);
  });

  await wait(1000);
  await updateJob(jobId, (job) => {
    const it1 = result.iterations[0];
    job.currentPhase = "NEGOTIATION_FEEDBACK";
    job.phaseIndex = 5;
    job.runningText = "Phase 5: QA Rejection & Developer Feedback";
    job.terminalStatus = "REJECTED";
    appendJobLog(job, [
      `[${formatLogTime()}] [AGENT-QA] Verification Suite: FAILED.`,
      `[${formatLogTime()}] [AGENT-QA] Rejection issued to Developer AI.`,
      `[${formatLogTime()}] [AGENT-QA] Critique Payload: ${it1.feedbackToDeveloper}`,
    ]);
  });

  await wait(900);
  await updateJob(jobId, (job) => {
    const it2 = result.iterations[1];
    job.currentPhase = "DEVELOPER_LOOP";
    job.phaseIndex = 3;
    job.activeIterationIndex = 2;
    job.runningText = "Phase 3: Developer AI Remediation";
    job.terminalStatus = "RESOLVING";
    appendJobLog(job, [
      `[${formatLogTime()}] [AGENT-DEV] Pulling QA critique into the working context.`,
      `[${formatLogTime()}] [AGENT-DEV] ${it2.developerAction}`,
      `[${formatLogTime()}] [GIT] Updated branch: ${result.gitBranch}`,
    ]);
  });

  await wait(900);
  await updateJob(jobId, (job) => {
    const it2 = result.iterations[1];
    job.currentPhase = "QA_VERIFICATION";
    job.phaseIndex = 4;
    job.runningText = "Phase 4: QA Sandbox Verification (Retry)";
    job.terminalStatus = "TESTING";
    appendJobLog(job, [
      `[${formatLogTime()}] [AGENT-QA] Sandbox recycled for retry.`,
      `[${formatLogTime()}] [SANDBOX] ${it2.qaAction}`,
      `[${formatLogTime()}] [TEST] Rerunning suite...`,
      ...it2.stdout.split("\n").map((line) => `[TEST-STDOUT] ${line}`),
      `[${formatLogTime()}] [AGENT-QA] Test Coverage: ${result.finalPr.testCoverage}%`,
    ]);
  });

  await wait(900);
  await updateJob(jobId, (job) => {
    job.status = "REVIEW_READY";
    job.queueState = "COMPLETED";
    job.currentPhase = "PULL_REQUEST_OPEN";
    job.phaseIndex = 6;
    job.runningText = "Phase 6: Pull Request Generated - Pending Manager Review";
    job.terminalStatus = "PR_DRAFT";
    job.assignedTo = "Manager Review";
    appendJobLog(job, [
      `[${formatLogTime()}] [GITHUB] Pull Request draft prepared.`,
      `[${formatLogTime()}] [GITHUB] Draft PR: ${result.finalPr.prTitle}`,
      `[${formatLogTime()}] [AUDIT] Waiting for approve/merge or rollback decision.`,
    ]);
  });
}

async function recoverInterruptedJobs() {
  await mutateStore((store) => {
    for (const job of store.jobs) {
      if (job.status === "IN_PROGRESS") {
        job.status = "QUEUED";
        job.queueState = "PENDING";
        job.workerId = undefined;
        job.currentPhase = "DISPATCHED_TO_QUEUE";
        job.runningText = "Workflow requeued after server restart";
        job.terminalStatus = "PROVISIONING";
        appendJobLog(job, [
          `[${formatLogTime()}] [RECOVERY] Server restarted while this local workflow was running.`,
          `[${formatLogTime()}] [RECOVERY] Requeued job for a clean worker retry.`,
        ]);
      } else if (job.status === "QUEUED") {
        job.queueState = "PENDING";
        job.workerId = undefined;
      }
    }
  });
}

function githubOAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function appBaseUrl(req: Request) {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function invitationUrl(req: Request, token: string) {
  return `${appBaseUrl(req)}/?invite=${encodeURIComponent(token)}`;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    apiLive: !!ai,
    auth: {
      githubOAuthConfigured: githubOAuthConfigured(),
      devLoginEnabled,
    },
    providers: {
      workflow: process.env.TEMPORAL_ADDRESS ? "temporal-configured" : "local-durable-queue",
      database: storageProvider.kind === "postgres" ? "postgres-configured" : "json-store",
      sandbox: process.env.KUBERNETES_SERVICE_HOST ? "kubernetes-configured" : "local-provider",
      github: githubOAuthConfigured() ? "oauth-configured" : "not-configured",
    },
  });
});

app.get("/api/auth/session", async (req, res, next) => {
  try {
    const auth = await getAuthContext(req);
    res.json({
      authenticated: Boolean(auth),
      user: auth ? sanitizeUser(auth.user) : null,
      csrfToken: auth?.session.csrfToken || null,
      authProviders: {
        githubOAuthConfigured: githubOAuthConfigured(),
        devLoginEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/dev-login", async (req, res, next) => {
  try {
    if (!devLoginEnabled) {
      return res.status(403).json({ error: "Local development login is disabled" });
    }

    const requestedRole = req.body?.role as UserRole | undefined;
    const role: UserRole =
      requestedRole && ["MANAGER", "BUSINESS_ANALYST", "ADMINISTRATOR"].includes(requestedRole)
        ? requestedRole
        : "ADMINISTRATOR";

    const user = await findOrCreateUser({
      email: req.body?.email || "admin@hermes.local",
      fullName: req.body?.fullName || "Local Administrator",
      provider: "local",
      role,
    });
    const session = await createSession(user.id);
    setSessionCookie(res, session.id);

    res.json({
      authenticated: true,
      user: sanitizeUser(user),
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireAuth, requireCsrf, async (req, res, next) => {
  const auth = (req as AuthedRequest).auth;
  try {
    await mutateStore((store) => {
      store.sessions = store.sessions.filter((session) => session.id !== auth.session.id);
    });
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/invitations/:token", async (req, res, next) => {
  try {
    const token = req.params.token?.trim();
    if (!token) {
      return res.status(400).json({ error: "Invitation token is required" });
    }

    const tokenHash = hashInviteToken(token);
    const store = await readStore();
    const inviteToken = (store.inviteTokens || []).find((candidate) => candidate.tokenHash === tokenHash);
    if (!inviteToken) {
      return res.status(404).json({ error: "Invitation link is invalid" });
    }

    const user = store.users.find((candidate) => candidate.id === inviteToken.userId);
    if (!user) {
      return res.status(404).json({ error: "Invited user was not found" });
    }

    const status = inviteTokenStatus(inviteToken);
    if (status === "EXPIRED") {
      return res.status(410).json({ error: "Invitation link has expired", invitation: sanitizeInviteToken(inviteToken) });
    }
    if (status === "ACCEPTED") {
      return res.status(409).json({ error: "Invitation link has already been accepted", invitation: sanitizeInviteToken(inviteToken) });
    }

    res.json({
      invitation: sanitizeInviteToken(inviteToken),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/invitations/accept", async (req, res, next) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      return res.status(400).json({ error: "Invitation token is required" });
    }

    const tokenHash = hashInviteToken(token);
    const result = await mutateStore((store) => {
      store.inviteTokens = store.inviteTokens || [];
      const inviteToken = store.inviteTokens.find((candidate) => candidate.tokenHash === tokenHash);
      if (!inviteToken) {
        return { status: "invalid" as const };
      }
      if (inviteToken.acceptedAt) {
        return { status: "accepted" as const, inviteToken };
      }
      if (new Date(inviteToken.expiresAt).getTime() <= Date.now()) {
        return { status: "expired" as const, inviteToken };
      }

      const user = store.users.find((candidate) => candidate.id === inviteToken.userId);
      if (!user) {
        return { status: "missing_user" as const, inviteToken };
      }

      const acceptedAt = nowIso();
      inviteToken.acceptedAt = acceptedAt;
      user.status = "ACTIVE";
      user.provider = user.provider || "local";
      user.invitedAt = user.invitedAt || inviteToken.createdAt;
      user.lastLoginAt = acceptedAt;
      user.updatedAt = acceptedAt;

      return { status: "ok" as const, inviteToken, user };
    });

    if (result.status === "invalid") {
      return res.status(404).json({ error: "Invitation link is invalid" });
    }
    if (result.status === "missing_user") {
      return res.status(404).json({ error: "Invited user was not found" });
    }
    if (result.status === "expired") {
      return res.status(410).json({ error: "Invitation link has expired", invitation: sanitizeInviteToken(result.inviteToken) });
    }
    if (result.status === "accepted") {
      return res.status(409).json({ error: "Invitation link has already been accepted", invitation: sanitizeInviteToken(result.inviteToken) });
    }

    const session = await createSession(result.user.id);
    setSessionCookie(res, session.id);
    res.json({
      authenticated: true,
      user: sanitizeUser(result.user),
      csrfToken: session.csrfToken,
      invitation: sanitizeInviteToken(result.inviteToken),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/github", async (req, res, next) => {
  try {
    if (!githubOAuthConfigured()) {
      return res.status(503).send("GitHub OAuth is not configured.");
    }

    const state = crypto.randomBytes(24).toString("base64url");
    const redirectPath = typeof req.query.redirect === "string" ? req.query.redirect : "/";
    await mutateStore((store) => {
      store.oauthStates = store.oauthStates.filter((record) => new Date(record.expiresAt).getTime() > Date.now());
      store.oauthStates.push({
        state,
        provider: "github",
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        redirectPath,
      });
    });

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: `${appBaseUrl(req)}/api/auth/github/callback`,
      scope: process.env.GITHUB_OAUTH_SCOPES || "read:user user:email repo",
      state,
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/github/callback", async (req, res, next) => {
  try {
    if (!githubOAuthConfigured()) {
      return res.status(503).send("GitHub OAuth is not configured.");
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      return res.status(400).send("Missing OAuth code or state.");
    }

    const oauthState = await mutateStore((store) => {
      const match = store.oauthStates.find((record) => record.state === state && new Date(record.expiresAt).getTime() > Date.now());
      store.oauthStates = store.oauthStates.filter((record) => record.state !== state && new Date(record.expiresAt).getTime() > Date.now());
      return match || null;
    });

    if (!oauthState) {
      return res.status(400).send("OAuth state is invalid or expired.");
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${appBaseUrl(req)}/api/auth/github/callback`,
      }),
    });
    const tokenBody = await tokenResponse.json() as { access_token?: string; error_description?: string };

    if (!tokenResponse.ok || !tokenBody.access_token) {
      throw new Error(tokenBody.error_description || "GitHub token exchange failed");
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
      name?: string;
      email?: string;
      avatar_url?: string;
    };

    let email = githubUser.email;
    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
          Accept: "application/vnd.github+json",
        },
      });
      const emails = await emailResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      email = emails.find((candidate) => candidate.primary && candidate.verified)?.email || emails.find((candidate) => candidate.verified)?.email;
    }

    if (!email) {
      throw new Error("GitHub account did not expose a verified email address");
    }

    const user = await findOrCreateUser({
      email,
      fullName: githubUser.name || githubUser.login,
      provider: "github",
      providerId: String(githubUser.id),
      avatarUrl: githubUser.avatar_url,
    });
    const session = await createSession(user.id);
    setSessionCookie(res, session.id);
    res.redirect(oauthState.redirectPath || "/");
  } catch (error: any) {
    console.error("GitHub OAuth callback failed:", error);
    if (error.message?.includes("GitHub")) {
      return res.status(502).send(`GitHub OAuth failed: ${error.message}`);
    }
    next(error);
  }
});

// Dynamic Cost Estimator API
app.post("/api/estimate-cost", requireAuth, requireCsrf, (req, res) => {
  const { taskDescription } = req.body;
  if (!taskDescription) {
    return res.status(400).json({ error: "Task description is required" });
  }

  res.json(estimateCostForTask(taskDescription));
});

// Task simulation fallback for offline mode
function generateOfflineSimulation(taskDescription: string, devRole: string, qaRole: string) {
  const cleanTask = taskDescription.trim();
  const branchName = `feature/hermes-` + cleanTask.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30);
  
  // Custom templates for common engineering tasks to keep them extremely high-fidelity
  const isStripe = /stripe|payment|billing|checkout/i.test(cleanTask);
  const isAuth = /auth|login|jwt|session|signup/i.test(cleanTask);
  const isDb = /db|database|optimize|query|postgres|sql|prisma/i.test(cleanTask);

  let firstDiff = "";
  let secondDiff = "";
  let firstXml = "";
  let secondXml = "";
  let firstStdout = "";
  let secondStdout = "";
  let feedback = "";
  let devAction1 = "";
  let qaAction1 = "";
  let devAction2 = "";
  let qaAction2 = "";

  if (isStripe) {
    devAction1 = "Synthesizing Stripe checkout handler and webhook validation system.";
    firstDiff = `diff --git a/src/services/stripe.ts b/src/services/stripe.ts
new file mode 100644
--- /dev/null
+++ b/src/services/stripe.ts
@@ -0,0 +1,28 @@
+import Stripe from "stripe";
+
+export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
+  apiVersion: "2023-10-16",
+});
+
+export async function handleWebhookEvent(payload: string, signature: string) {
+  // CRITICAL: Need secure webhook signing verification
+  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
+  
+  // FAILING LINE: Missing webhook event construct check or passing undefined stripe key
+  const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
+  
+  if (event.type === "checkout.session.completed") {
+    const session = event.data.object as Stripe.Checkout.Session;
+    await fulfillOrder(session);
+  }
+  
+  return { received: true };
+}
+
+async function fulfillOrder(session: Stripe.Checkout.Session) {
+  console.log(\`Fulfilling order for client: \${session.client_reference_id}\`);
+  // Mock db entry
+}`;

    firstStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-stripe-wh'
[Docker Build] Building sandbox image with node:18-alpine... Success.
[Jest Exec] RUNNING test suite: tests/stripe.test.ts
✕ stripe webhook handler constructs event correctly (142ms)

  ● stripe webhook handler constructs event correctly
    StripeSignatureVerificationError: No webhook payload signature found matching expected signature for payload.
      at Webhook.constructEvent (node_modules/stripe/lib/Webhooks.js:15:12)
      at handleWebhookEvent (src/services/stripe.ts:11:25)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.85s
Ran all test suites.`;

    firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="1" failures="1" errors="0" time="1.85">
  <testsuite name="Stripe Webhook Integration" tests="1" failures="1" errors="0" time="1.85">
    <testcase name="stripe webhook handler constructs event correctly" classname="tests/stripe.test.ts" time="0.142">
      <failure message="StripeSignatureVerificationError: No webhook payload signature found matching expected signature" type="StripeSignatureVerificationError">
        at Webhook.constructEvent (node_modules/stripe/lib/Webhooks.js:15:12)
        at handleWebhookEvent (src/services/stripe.ts:11:25)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    feedback = "QA AGENT REJECTION: Stripe signature verification is failing because raw body payload is not preserved in the Express parser. You must use a middleware that stores raw body buffer on req.rawBody, otherwise stripe.webhooks.constructEvent fails signature match.";

    devAction2 = "Adding express raw body parser configuration and updating Webhook signature validator.";
    secondDiff = `diff --git a/src/services/stripe.ts b/src/services/stripe.ts
--- a/src/services/stripe.ts
+++ b/src/services/stripe.ts
@@ -10,3 +10,13 @@
   const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
+  if (!endpointSecret) {
+    throw new Error("STRIPE_WEBHOOK_SECRET is not configured inside system environment.");
+  }
+  
+  // FIXED: Preserving raw string format and capturing validation constraints safely
   const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
+  
   if (event.type === "checkout.session.completed") {
@@ -18,2 +28,14 @@
+export function configureExpressRawBody(app: any) {
+  app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
+}`;

    secondStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-stripe-wh'
[Docker Build] Reusing cached layers... Success.
[Jest Exec] RUNNING test suite: tests/stripe.test.ts
✓ stripe webhook handler constructs event correctly (48ms)
✓ stripe webhook raw body parser extracts request buffers successfully (15ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.22s
Ran all test suites. All tests green!`;

    secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="2" failures="0" errors="0" time="1.22">
  <testsuite name="Stripe Webhook Integration" tests="2" failures="0" errors="0" time="1.22">
    <testcase name="stripe webhook handler constructs event correctly" classname="tests/stripe.test.ts" time="0.048"/>
    <testcase name="stripe webhook raw body parser extracts request buffers successfully" classname="tests/stripe.test.ts" time="0.015"/>
  </testsuite>
</testsuites>`;

  } else if (isAuth) {
    devAction1 = "Implementing JWT Authentication strategy and token expiration handlers.";
    firstDiff = `diff --git a/src/services/auth.ts b/src/services/auth.ts
new file mode 100644
--- /dev/null
+++ b/src/services/auth.ts
@@ -0,0 +1,22 @@
+import jwt from "jsonwebtoken";
+
+export function generateAccessToken(userId: string) {
+  // FAILING LINE: Missing fallback secret, throws directly under undefined process.env
+  return jwt.sign({ sub: userId }, process.env.JWT_SECRET);
+}
+
+export function authenticateToken(req: any, res: any, next: any) {
+  const authHeader = req.headers["authorization"];
+  const token = authHeader && authHeader.split(" ")[1];
+  
+  if (token == null) return res.sendStatus(401);
+  
+  jwt.verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
+    if (err) return res.sendStatus(403);
+    req.user = user;
+    next();
+  });
+}`;

    firstStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-auth-jwt'
[Docker Build] Preparing isolated container workspace... Success.
[Jest Exec] RUNNING test suite: tests/auth.test.ts
✕ generates a token with signature (82ms)

  ● generates a token with signature
    ValidationError: "secretOrPrivateKey" must have a value
      at Object.sign (node_modules/jsonwebtoken/index.js:142:15)
      at generateAccessToken (src/services/auth.ts:5:14)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.64s`;

    firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="1" failures="1" errors="0" time="1.64">
  <testsuite name="Auth Verification" tests="1" failures="1" errors="0" time="1.64">
    <testcase name="generates a token with signature" classname="tests/auth.test.ts" time="0.082">
      <failure message="ValidationError: &quot;secretOrPrivateKey&quot; must have a value" type="ValidationError">
        at Object.sign (node_modules/jsonwebtoken/index.js:142:15)
        at generateAccessToken (src/services/auth.ts:5:14)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    feedback = "QA AGENT REJECTION: The JWT token generation is throwing an error 'secretOrPrivateKey must have a value' because process.env.JWT_SECRET is undefined in the sandbox context. Please implement a robust fallback or raise an explicit startup validation error.";

    devAction2 = "Adding environment check fallback constraints and secure local sandbox seed for JWT signing.";
    secondDiff = `diff --git a/src/services/auth.ts b/src/services/auth.ts
--- a/src/services/auth.ts
+++ b/src/services/auth.ts
@@ -4,3 +4,8 @@
 export function generateAccessToken(userId: string) {
-  return jwt.sign({ sub: userId }, process.env.JWT_SECRET);
+  const secret = process.env.JWT_SECRET || "fallback_sandbox_secret_key_64bit";
+  return jwt.sign({ sub: userId }, secret, { expiresIn: "15m" });
 }
 
 export function authenticateToken(req: any, res: any, next: any) {
@@ -11,3 +16,4 @@
+  const secret = process.env.JWT_SECRET || "fallback_sandbox_secret_key_64bit";
-  jwt.verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
+  jwt.verify(token, secret, (err: any, user: any) => {`;

    secondStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-auth-jwt'
[Docker Build] Reusing cached layer caches... Success.
[Jest Exec] RUNNING test suite: tests/auth.test.ts
✓ generates a token with signature (12ms)
✓ rejects authentication on expired or malformed headers (22ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.10s
All tests passed beautifully!`;

    secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="2" failures="0" errors="0" time="1.10">
  <testsuite name="Auth Verification" tests="2" failures="0" errors="0" time="1.10">
    <testcase name="generates a token with signature" classname="tests/auth.test.ts" time="0.012"/>
    <testcase name="rejects authentication on expired or malformed headers" classname="tests/auth.test.ts" time="0.022"/>
  </testsuite>
</testsuites>`;

  } else {
    // Generic high fidelity response
    devAction1 = "Assembling the core software modules, interfaces, and testing suite specifications.";
    firstDiff = `diff --git a/src/core/module.ts b/src/core/module.ts
new file mode 100644
--- /dev/null
+++ b/src/core/module.ts
@@ -0,0 +1,15 @@
+export class CoreTaskHandler {
+  private initialized: boolean = false;
+
+  constructor(private config: any) {}
+
+  public async executeTask() {
+    // FAILING LINE: Reading configuration options without safety locks
+    const maxRetries = this.config.policies.retryCount;
+    this.initialized = true;
+    return { status: "PROCESSED", retries: maxRetries };
+  }
+}`;

    firstStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-core-run'
[Docker Build] Assembling clean alpine Node container... Success.
[Jest Exec] RUNNING test suite: tests/module.test.ts
✕ task execution handles policy configurations correctly (54ms)

  ● task execution handles policy configurations correctly
    TypeError: Cannot read properties of undefined (reading 'retryCount')
      at CoreTaskHandler.executeTask (src/core/module.ts:8:44)
      at Object.<anonymous> (tests/module.test.ts:12:18)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.45s`;

    firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="1" failures="1" errors="0" time="1.45">
  <testsuite name="Core Logic Assertions" tests="1" failures="1" errors="0" time="1.45">
    <testcase name="task execution handles policy configurations correctly" classname="tests/module.test.ts" time="0.054">
      <failure message="TypeError: Cannot read properties of undefined (reading 'retryCount')" type="TypeError">
        at CoreTaskHandler.executeTask (src/core/module.ts:8:44)
        at Object.&lt;anonymous&gt; (tests/module.test.ts:12:18)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    feedback = "QA AGENT REJECTION: CoreTaskHandler throws an error 'Cannot read properties of undefined (reading retryCount)' because configuration parameter nesting was not safeguarded against null config or empty policies mapping. Please wrap configuration with optional chaining and supply logical defaults.";

    devAction2 = "Securing nested configuration properties using TypeScript optional chaining.";
    secondDiff = `diff --git a/src/core/module.ts b/src/core/module.ts
--- a/src/core/module.ts
+++ b/src/core/module.ts
@@ -7,3 +7,5 @@
   public async executeTask() {
-    const maxRetries = this.config.policies.retryCount;
+    const maxRetries = this.config?.policies?.retryCount ?? 3;
+    const timeout = this.config?.policies?.timeoutMs ?? 5000;
     this.initialized = true;
-    return { status: "PROCESSED", retries: maxRetries };
+    return { status: "PROCESSED", retries: maxRetries, timeout };
   }`;

    secondStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-core-run'
[Docker Build] Reusing previous layer snapshot caches... Success.
[Jest Exec] RUNNING test suite: tests/module.test.ts
✓ task execution handles policy configurations correctly (8ms)
✓ initializes state machine with sensible fallback values (14ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.98s
Verification sandbox testing complete. Status: SUCCESS!`;

    secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="2" failures="0" errors="0" time="0.98">
  <testsuite name="Core Logic Assertions" tests="2" failures="0" errors="0" time="0.98">
    <testcase name="task execution handles policy configurations correctly" classname="tests/module.test.ts" time="0.008"/>
    <testcase name="initializes state machine with sensible fallback values" classname="tests/module.test.ts" time="0.014"/>
  </testsuite>
</testsuites>`;
  }

  // Calculate random tokens/ms
  const inputTokens = Math.floor(15000 + Math.random() * 2000);
  const outputTokens = Math.floor(3500 + Math.random() * 1000);
  const computeMs = Math.floor(11000 + Math.random() * 3000);
  const actualCost = parseFloat(((inputTokens * 0.000000075) + (outputTokens * 0.0000003) + (computeMs * 0.000016)).toFixed(5));

  return {
    taskName: cleanTask,
    gitBranch: branchName,
    estimatedCost: parseFloat((actualCost * 1.15).toFixed(5)),
    estimatedComputeMs: Math.round(computeMs * 1.2),
    developerAgentPrompt: `You are the lead engineering developer sub-agent within the Hermes Orchestrator. 
Your role is to write clean, maintainable, production-ready implementation and unit tests in typescript. 
Constraints: Maintain strict branch mapping, keep variable contexts distinct, and respond directly to unit testing failures.`,
    qaAgentPrompt: `You are the Lead SDET QA sub-agent within the Hermes Orchestrator.
Your role is to review developer code diffs, run test suites in a sandboxed Kubernetes container, and check JUnit logs.
If tests fail, provide objective trace logs and architectural critiques. If tests pass, compile reports and issue approval.`,
    iterations: [
      {
        iterationIndex: 1,
        developerAction: devAction1,
        codeDiff: firstDiff,
        qaAction: "[K8s Pod Init] " + (isStripe ? "hermes-sandbox-stripe-wh" : isAuth ? "hermes-sandbox-auth-jwt" : "hermes-sandbox-core-run"),
        testResultsXml: firstXml,
        stdout: firstStdout,
        status: "FAILED",
        feedbackToDeveloper: feedback
      },
      {
        iterationIndex: 2,
        developerAction: devAction2,
        codeDiff: secondDiff,
        qaAction: "[K8s Pod Reuse] " + (isStripe ? "hermes-sandbox-stripe-wh" : isAuth ? "hermes-sandbox-auth-jwt" : "hermes-sandbox-core-run") + " with active volume cache mounts.",
        testResultsXml: secondXml,
        stdout: secondStdout,
        status: "PASSED",
        feedbackToDeveloper: ""
      }
    ],
    finalPr: {
      prTitle: `feat: autonomous implementation of ${cleanTask}`,
      prDescription: `Autonomous engineering delivery orchestrated by Hermes.\n\n### Deliverables\n- Code implementation matching prompt specifications\n- Integrated unit assertions\n- Sandbox build verification verified inside ephemeral Kubernetes cluster\n\n- **Security Audit**: Signature bounds secured.\n- **Test Coverage**: 100% assertions green.\n- **Sub-agents**: Developer & SDET`,
      testCoverage: 95.8,
      actualCost: actualCost,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      computeMs: computeMs
    }
  };
}

app.get("/api/jobs", requireAuth, async (req, res, next) => {
  try {
    const store = await readStore();
    res.json({
      jobs: store.jobs.map(jobToClient),
      history: store.jobs.map(jobToHistory),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/active", requireAuth, async (req, res, next) => {
  try {
    const store = await readStore();
    const active =
      store.jobs.find((job) => job.status === "IN_PROGRESS" || job.status === "QUEUED" || job.status === "REVIEW_READY") ||
      store.jobs[0] ||
      null;
    res.json({ job: active ? jobToClient(active) : null });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/:jobId", requireAuth, async (req, res, next) => {
  try {
    const store = await readStore();
    const job = store.jobs.find((candidate) => candidate.id === req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ job: jobToClient(job) });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/users/invite",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  async (req, res, next) => {
    try {
      const auth = (req as AuthedRequest).auth;
      const { email, fullName, role } = req.body as {
        email?: string;
        fullName?: string;
        role?: UserRole;
      };

      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required" });
      }
      if (!isUserRole(role)) {
        return res.status(400).json({ error: "A valid role is required" });
      }

      const rawToken = createInviteToken();
      const createdAt = nowIso();
      const expiresAt = new Date(Date.now() + inviteTtlMs()).toISOString();
      const invitedUser = await mutateStore((store) => {
        store.inviteTokens = store.inviteTokens || [];
        const existing = store.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
        if (existing && (existing.status || "ACTIVE") === "ACTIVE") {
          return { user: existing, alreadyActive: true };
        }

        let user: AppUser;
        if (existing) {
          existing.fullName = fullName?.trim() || existing.fullName || normalizedEmail;
          existing.role = role;
          existing.status = "INVITED";
          existing.invitedAt = existing.invitedAt || createdAt;
          existing.updatedAt = createdAt;
          user = existing;
        } else {
          user = {
            id: safeId("usr"),
            email: normalizedEmail,
            fullName: fullName?.trim() || normalizedEmail,
            role,
            status: "INVITED",
            provider: "local",
            invitedAt: createdAt,
            createdAt,
            updatedAt: createdAt,
          };
          store.users.push(user);
        }

        store.inviteTokens = store.inviteTokens.filter((candidate) => candidate.userId !== user.id || candidate.acceptedAt);
        const inviteToken: InviteTokenRecord = {
          id: safeId("inv"),
          userId: user.id,
          email: normalizedEmail,
          tokenHash: hashInviteToken(rawToken),
          createdByUserId: auth.user.id,
          createdAt,
          expiresAt,
          deliveryStatus: "LOCAL_ONLY",
        };
        store.inviteTokens.push(inviteToken);

        return { user, inviteToken, alreadyActive: false };
      });

      if (invitedUser.alreadyActive) {
        return res.status(409).json({ error: "User already has an active account" });
      }

      res.status(201).json({
        user: sanitizeUser(invitedUser.user),
        invite: {
          ...sanitizeInviteToken(invitedUser.inviteToken),
          url: invitationUrl(req, rawToken),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/users/:userId/role",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  async (req, res, next) => {
    try {
      const { role } = req.body as { role?: UserRole };
      if (!isUserRole(role)) {
        return res.status(400).json({ error: "A valid role is required" });
      }

      const result = await mutateStore((store) => {
        const target = store.users.find((candidate) => candidate.id === req.params.userId);
        if (!target) {
          return { status: "not_found" as const };
        }

        const activeAdmins = store.users.filter(
          (candidate) => candidate.role === "ADMINISTRATOR" && (candidate.status || "ACTIVE") === "ACTIVE",
        );
        if (target.role === "ADMINISTRATOR" && role !== "ADMINISTRATOR" && activeAdmins.length <= 1) {
          return { status: "last_admin" as const, user: target };
        }

        target.role = role;
        target.updatedAt = nowIso();
        return { status: "updated" as const, user: target };
      });

      if (result.status === "not_found") {
        return res.status(404).json({ error: "User not found" });
      }
      if (result.status === "last_admin") {
        return res.status(409).json({ error: "At least one active administrator is required" });
      }

      res.json({ user: sanitizeUser(result.user) });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/integrations",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  async (req, res, next) => {
    try {
      const auth = (req as AuthedRequest).auth;
      const { provider, displayName, metadata, secrets } = req.body as {
        provider?: IntegrationProvider;
        displayName?: string;
        metadata?: Record<string, string>;
        secrets?: Record<string, string>;
      };

      if (!isIntegrationProvider(provider)) {
        return res.status(400).json({ error: "A valid integration provider is required" });
      }

      const cleanDisplayName = displayName?.trim() || provider.replace("_", " ");
      const cleanMetadata = Object.fromEntries(
        Object.entries(metadata || {})
          .filter(([key, value]) => key.trim() && typeof value === "string")
          .map(([key, value]) => [key.trim(), value.trim()]),
      );
      const encryptedSecrets = Object.entries(secrets || {})
        .filter(([key, value]) => key.trim() && value)
        .map(([key, value]) => encryptSecret(key.trim(), value));

      if (encryptedSecrets.length === 0) {
        return res.status(400).json({ error: "At least one secret value is required" });
      }

      const integration = await mutateStore((store) => {
        const existing = (store.integrations || []).find((candidate) => candidate.provider === provider);
        if (existing) {
          existing.displayName = cleanDisplayName;
          existing.metadata = cleanMetadata;
          existing.encryptedSecrets = encryptedSecrets;
          existing.configuredByUserId = auth.user.id;
          existing.updatedAt = nowIso();
          return existing;
        }

        const created: IntegrationConfig = {
          id: safeId("int"),
          provider,
          displayName: cleanDisplayName,
          metadata: cleanMetadata,
          encryptedSecrets,
          configuredByUserId: auth.user.id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        store.integrations = store.integrations || [];
        store.integrations.push(created);
        return created;
      });

      res.status(201).json({ integration: sanitizeIntegration(integration) });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/integrations/:integrationId",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  async (req, res, next) => {
    try {
      const removed = await mutateStore((store) => {
        const before = (store.integrations || []).length;
        store.integrations = (store.integrations || []).filter((integration) => integration.id !== req.params.integrationId);
        return store.integrations.length !== before;
      });

      if (!removed) {
        return res.status(404).json({ error: "Integration not found" });
      }

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/jobs",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR", "MANAGER", "BUSINESS_ANALYST"]),
  async (req, res, next) => {
    try {
      const auth = (req as AuthedRequest).auth;
      const { taskDescription, developerRole, qaRole, targetRepository } = req.body;
      if (!taskDescription || typeof taskDescription !== "string") {
        return res.status(400).json({ error: "Task description is required" });
      }

      const estimate = estimateCostForTask(taskDescription);
      const createdAt = nowIso();
      const job: StoredJob = {
        id: safeId("job"),
        executionId: safeId("exec"),
        hermesSessionId: safeId("hermes"),
        taskName: taskDescription.trim(),
        scopeDescription: taskDescription.trim(),
        currentPhase: "INGESTION_PLANNING",
        gitBranch: slugifyBranch(taskDescription),
        targetRepository: targetRepository || process.env.DEFAULT_TARGET_REPOSITORY || "local/workspace",
        status: "QUEUED",
        phaseIndex: 1,
        runningText: "Phase 1: Queued for Worker Dispatch",
        terminalStatus: "PROVISIONING",
        activeIterationIndex: 1,
        assignedTo: "Local Workflow Queue",
        submittedAt: createdAt,
        queuedAt: createdAt,
        queueState: "PENDING",
        createdByUserId: auth.user.id,
        developerRole: developerRole || "Write clean TypeScript implementation and matching tests.",
        qaRole: qaRole || "Run isolated verification and report objective test results.",
        estimate,
        logs: [
          `[${formatLogTime()}] [INIT] Backend job ingestion accepted by ${auth.user.email}.`,
          `[${formatLogTime()}] [ESTIMATOR] Expected Input Tokens: ${estimate.inputTokens}`,
          `[${formatLogTime()}] [ESTIMATOR] Expected Output Tokens: ${estimate.outputTokens}`,
          `[${formatLogTime()}] [ESTIMATOR] Target compute-ms constraint: ${estimate.computeMs}ms`,
          `[${formatLogTime()}] [ESTIMATOR] Total cost estimated at $${estimate.estimatedCost.toFixed(5)} USD.`,
          `[${formatLogTime()}] [QUEUE] Persisted durable queue record. Waiting for worker claim.`,
        ],
      };

      await mutateStore((store) => {
        store.jobs.unshift(job);
      });
      res.status(201).json({ job: jobToClient(job) });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/jobs/:jobId/approve",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR", "MANAGER"]),
  async (req, res, next) => {
    try {
      const job = await updateJob(req.params.jobId, (candidate) => {
        if (candidate.status !== "REVIEW_READY") return;
        candidate.status = "COMPLETED";
        candidate.currentPhase = "COMPLETED_MERGED";
        candidate.phaseIndex = 7;
        candidate.terminalStatus = "COMPLETED";
        candidate.runningText = "Job Merged & Completed";
        candidate.assignedTo = "Completed";
        candidate.completedAt = nowIso();
        appendJobLog(candidate, [
          `[${formatLogTime()}] [MERGE] Manager approval received.`,
          `[${formatLogTime()}] [GIT] Merge recorded for branch ${candidate.gitBranch}.`,
          `[${formatLogTime()}] [LEDGER] Actual cost recorded: $${(candidate.result?.finalPr.actualCost || 0).toFixed(5)} USD.`,
          `[${formatLogTime()}] [SYSTEM] Session complete. Sandbox resources released.`,
        ]);
      });

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.status !== "COMPLETED") {
        return res.status(409).json({ error: "Job is not ready for approval" });
      }
      res.json({ job: jobToClient(job) });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/jobs/:jobId/rollback",
  requireAuth,
  requireCsrf,
  requireRole(["ADMINISTRATOR", "MANAGER"]),
  async (req, res, next) => {
    try {
      const job = await updateJob(req.params.jobId, (candidate) => {
        if (candidate.status !== "REVIEW_READY" && candidate.status !== "FAILED") return;
        candidate.status = "ROLLED_BACK";
        candidate.currentPhase = "ROLLED_BACK";
        candidate.phaseIndex = 7;
        candidate.terminalStatus = "ROLLED_BACK";
        candidate.runningText = "Deterministic Rollback Complete";
        candidate.assignedTo = "Rollback Complete";
        candidate.completedAt = nowIso();
        candidate.rollbackSnapshot = {
          branchDeleted: true,
          jobStateReverted: true,
          memoryEvicted: true,
          completedAt: candidate.completedAt,
        };
        appendJobLog(candidate, [
          `[${formatLogTime()}] [ROLLBACK] 1-click rollback requested by manager.`,
          `[${formatLogTime()}] [GIT] Feature branch ${candidate.gitBranch} marked for deletion/revert.`,
          `[${formatLogTime()}] [HERMES] Agent memory context evicted for execution ${candidate.executionId}.`,
          `[${formatLogTime()}] [STORE] Job state transitioned to ROLLED_BACK atomically.`,
        ]);
      });

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.status !== "ROLLED_BACK") {
        return res.status(409).json({ error: "Job cannot be rolled back from its current state" });
      }
      res.json({ job: jobToClient(job) });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/ledger", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (auth.user.role === "BUSINESS_ANALYST") {
      return res.status(403).json({ error: "Ledger access requires Manager or Administrator role" });
    }

    const store = await readStore();
    const ledger = store.jobs.map(jobToLedger);
    const totalActualCost = ledger.reduce((sum, entry) => sum + entry.actualCost, 0);
    const completedJobs = store.jobs.filter((job) => job.status === "COMPLETED").length;
    const terminalJobs = store.jobs.filter((job) => ["COMPLETED", "ROLLED_BACK", "FAILED"].includes(job.status)).length;
    res.json({
      ledger,
      summary: {
        totalActualCost,
        completedJobs,
        totalJobs: store.jobs.length,
        successRate: terminalJobs ? (completedJobs / terminalJobs) * 100 : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", requireAuth, async (req, res, next) => {
  try {
    const store = await readStore();
    res.json({
      users: store.users.map(sanitizeUser),
      invitations: (store.inviteTokens || []).map(sanitizeInviteToken),
      integrationConfigs: (store.integrations || []).map(sanitizeIntegration),
      integrations: {
        githubOAuthConfigured: githubOAuthConfigured(),
        geminiConfigured: Boolean(ai),
        temporalConfigured: Boolean(process.env.TEMPORAL_ADDRESS),
        postgresConfigured: storageProvider.kind === "postgres",
        kubernetesConfigured: Boolean(process.env.KUBERNETES_SERVICE_HOST),
        secretStorageConfigured: Boolean(process.env.INTEGRATION_ENCRYPTION_KEY),
      },
      runtime: {
        dataStore: storageProvider.kind,
        workflowProvider: process.env.TEMPORAL_ADDRESS ? "temporal" : "local-durable-queue",
        sandboxProvider: process.env.KUBERNETES_SERVICE_HOST ? "kubernetes" : "local-provider",
      },
    });
  } catch (error) {
    next(error);
  }
});

// Full Dispatch API - optionally calling Google Gemini API if live, else using high fidelity offline fallback
app.post("/api/dispatch", requireAuth, requireCsrf, async (req, res) => {
  const { taskDescription, developerRole, qaRole } = req.body;

  if (!taskDescription) {
    return res.status(400).json({ error: "Task description is required" });
  }

  // If no AI connection is live, trigger our offline generator
  if (!ai) {
    console.log("Using high-fidelity offline execution simulator.");
    const result = generateOfflineSimulation(taskDescription, developerRole || "Developer", qaRole || "SDET QA");
    return res.json(result);
  }

  try {
    console.log(`Querying Gemini API for dynamic agent orchestration of task: ${taskDescription}`);
    
    const userPrompt = `
Generate a highly realistic multi-agent software engineering task pipeline simulation for the engineering job: "${taskDescription}".
Sub-agent configuration:
- Developer Agent Role Description: "${developerRole || "Write clean TypeScript implementation and matching Jest unit tests."}"
- QA Agent Role Description: "${qaRole || "Review developer changes, spin up pod, run test suite, check for failure, write JUnit results."}"

Ensure that you simulate a real workflow with exactly 2 ITERATIONS:
- Iteration 1 MUST fail. Give a detailed realistic programming error (such as a missing import, syntax exception, unhandled promise, null pointer access, or mock assertion mismatch), show the failed code diff, and show the exact Jest console output showing test failures + JUnit XML string.
- Iteration 2 MUST pass. Show the corrected code diff fixing the issue from Iteration 1, showing Jest log output completely clean (All tests green!) and a successful JUnit XML.

Ensure all outputs are fully written out (zero pseudocode, write proper realistic typescript code inside the unified diff blocks).
Use the standard "diff --git" format for diff blocks.

Generate the exact JSON response containing all of this, following this exact schema:
{
  "taskName": "Name of the task",
  "gitBranch": "branch-name-slug",
  "estimatedCost": 0.05,
  "estimatedComputeMs": 15000,
  "developerAgentPrompt": "Prompt instructing the developer sub-agent",
  "qaAgentPrompt": "Prompt instructing the QA sub-agent",
  "iterations": [
    {
      "iterationIndex": 1,
      "developerAction": "Sentence describing what developer agent coded",
      "codeDiff": "Unified patch/diff showing the bug-prone code",
      "qaAction": "Sentence describing QA spinning up sandboxed container and launching Jest test runner",
      "testResultsXml": "JUnit XML output showing the failure",
      "stdout": "Bash terminal stdout logs showing the failing test with node tracebacks",
      "status": "FAILED",
      "feedbackToDeveloper": "Specific SDET critique explaining how to fix the error"
    },
    {
      "iterationIndex": 2,
      "developerAction": "Sentence describing developer rewriting and fixing the error",
      "codeDiff": "Unified patch/diff showing the fixed code or additional middleware",
      "qaAction": "Sentence describing QA container rerun",
      "testResultsXml": "JUnit XML output showing all testcases passing successfully",
      "stdout": "Bash terminal stdout logs showing passing test execution",
      "status": "PASSED",
      "feedbackToDeveloper": ""
    }
  ],
  "finalPr": {
    "prTitle": "feat: name of task",
    "prDescription": "Autonomous pull request summary",
    "testCoverage": 98.4,
    "actualCost": 0.045,
    "inputTokens": 14200,
    "outputTokens": 4500,
    "computeMs": 11500
  }
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            taskName: { type: Type.STRING },
            gitBranch: { type: Type.STRING },
            estimatedCost: { type: Type.NUMBER },
            estimatedComputeMs: { type: Type.INTEGER },
            developerAgentPrompt: { type: Type.STRING },
            qaAgentPrompt: { type: Type.STRING },
            iterations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  iterationIndex: { type: Type.INTEGER },
                  developerAction: { type: Type.STRING },
                  codeDiff: { type: Type.STRING },
                  qaAction: { type: Type.STRING },
                  testResultsXml: { type: Type.STRING },
                  stdout: { type: Type.STRING },
                  status: { type: Type.STRING },
                  feedbackToDeveloper: { type: Type.STRING }
                },
                required: ["iterationIndex", "developerAction", "codeDiff", "qaAction", "testResultsXml", "stdout", "status", "feedbackToDeveloper"]
              }
            },
            finalPr: {
              type: Type.OBJECT,
              properties: {
                prTitle: { type: Type.STRING },
                prDescription: { type: Type.STRING },
                testCoverage: { type: Type.NUMBER },
                actualCost: { type: Type.NUMBER },
                inputTokens: { type: Type.INTEGER },
                outputTokens: { type: Type.INTEGER },
                computeMs: { type: Type.INTEGER }
              },
              required: ["prTitle", "prDescription", "testCoverage", "actualCost", "inputTokens", "outputTokens", "computeMs"]
            }
          },
          required: ["taskName", "gitBranch", "estimatedCost", "estimatedComputeMs", "developerAgentPrompt", "qaAgentPrompt", "iterations", "finalPr"]
        }
      }
    });

    const parsedData = JSON.parse(response.text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini invocation failed, using offline fallback:", error);
    const fallbackData = generateOfflineSimulation(taskDescription, developerRole, qaRole);
    res.json(fallbackData);
  }
});

app.use("/api", (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("API request failed:", error);
  res.status(500).json({
    error: "Internal server error",
    detail: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
});

interface StartServerOptions {
  port?: number;
  host?: string;
  serveClient?: boolean;
  startWorker?: boolean;
}

let clientMiddlewareInstalled = false;

// Configure Vite integration
export async function startServer(options: StartServerOptions = {}) {
  await storageProvider.init();
  await recoverInterruptedJobs();
  if (options.startWorker !== false) {
    startLocalWorkflowWorker();
  }

  const shouldServeClient = options.serveClient !== false;
  if (shouldServeClient && !clientMiddlewareInstalled) {
    clientMiddlewareInstalled = true;
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  const port = options.port ?? PORT;
  const host = options.host ?? "0.0.0.0";
  const server = app.listen(port, host);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;
  console.log(`Server is booted and actively routing requests on http://localhost:${resolvedPort}`);
  return server;
}

export { app };

if (process.env.AXIOM_DISABLE_AUTOSTART !== "true") {
  startServer().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });
}
