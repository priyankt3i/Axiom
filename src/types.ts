export interface TestResult {
  iterationIndex: number;
  developerAction: string;
  codeDiff: string;
  qaAction: string;
  testResultsXml: string;
  stdout: string;
  status: "FAILED" | "PASSED";
  feedbackToDeveloper: string;
}

export interface FinalPr {
  prTitle: string;
  prDescription: string;
  testCoverage: number;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
  computeMs: number;
}

export interface PipelineJob {
  taskName: string;
  gitBranch: string;
  estimatedCost: number;
  estimatedComputeMs: number;
  developerAgentPrompt: string;
  qaAgentPrompt: string;
  iterations: TestResult[];
  finalPr: FinalPr;
}

export type UserRole = "MANAGER" | "BUSINESS_ANALYST" | "ADMINISTRATOR";
export type UserStatus = "ACTIVE" | "INVITED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED";
export type InviteDeliveryStatus = "LOCAL_ONLY" | "DELIVERED" | "FAILED";
export type QueueState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type IntegrationProvider =
  | "github_app"
  | "jira"
  | "linear"
  | "jenkins"
  | "hosting"
  | "temporal"
  | "kubernetes";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  provider: "github" | "local";
  invitedAt?: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
  csrfToken: string | null;
  authProviders: {
    githubOAuthConfigured: boolean;
    devLoginEnabled: boolean;
  };
}

export interface PipelineState {
  phaseIndex: number;
  runningText: string;
  jobData: PipelineJob | null;
  activeIterationIndex: number;
  logs: string[];
  terminalStatus:
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
}

export interface CostEstimate {
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  computeMs: number;
  isComplex: boolean;
}

export interface ApiJob {
  id: string;
  executionId: string;
  hermesSessionId: string;
  taskName: string;
  status: "QUEUED" | "IN_PROGRESS" | "REVIEW_READY" | "COMPLETED" | "ROLLED_BACK" | "FAILED";
  currentPhase: string;
  gitBranch: string;
  targetRepository: string;
  submittedAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  queueState?: QueueState;
  workerId?: string;
  lastError?: string;
  assignedTo: string;
  estimate: CostEstimate;
  createdByUserId: string;
  pipelineState: PipelineState;
  result: PipelineJob | null;
}

export interface JobHistory {
  id: string;
  task: string;
  status: "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "ROLLED_BACK" | "FAILED";
  submittedAt: string;
  completedAt?: string;
  phase: string;
  assignedTo: string;
}

export interface LedgerEntry {
  id: string;
  task: string;
  branch: string;
  status: "QUEUED" | "IN_PROGRESS" | "REVIEW_READY" | "COMPLETED" | "ROLLED_BACK" | "FAILED";
  estimatedCost: number;
  actualCost: number;
  tokens: string;
  date: string;
}

export interface LedgerSummary {
  totalActualCost: number;
  completedJobs: number;
  totalJobs: number;
  successRate: number;
}

export interface IntegrationConfigSummary {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  metadata: Record<string, string>;
  secretKeys: string[];
  configuredByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationSummary {
  id: string;
  userId: string;
  email: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  deliveryStatus: InviteDeliveryStatus;
  status: InvitationStatus;
}

export interface InviteCreateResult {
  user: AuthUser;
  invite: InvitationSummary & {
    url: string;
  };
}

export interface SettingsPayload {
  users: AuthUser[];
  invitations: InvitationSummary[];
  integrationConfigs: IntegrationConfigSummary[];
  integrations: {
    githubOAuthConfigured: boolean;
    geminiConfigured: boolean;
    temporalConfigured: boolean;
    postgresConfigured: boolean;
    kubernetesConfigured: boolean;
    secretStorageConfigured: boolean;
  };
  runtime: {
    dataStore: string;
    workflowProvider: string;
    sandboxProvider: string;
  };
}
