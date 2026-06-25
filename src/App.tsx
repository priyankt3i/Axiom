import React, { useCallback, useEffect, useRef, useState } from "react";
import { Github, ShieldCheck } from "lucide-react";

import { SettingsTab } from "./components/SettingsTab";
import { HistoryTab } from "./components/HistoryTab";
import { SchemasTab } from "./components/SchemasTab";
import { LedgerTab } from "./components/LedgerTab";
import { AuditTab } from "./components/AuditTab";
import { DispatcherTab } from "./components/DispatcherTab";
import { PipelineTab } from "./components/PipelineTab";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { RightSidebar } from "./components/RightSidebar";

import {
  ApiJob,
  AuthSession,
  CostEstimate,
  JobHistory,
  LedgerEntry,
  LedgerSummary,
  PipelineState,
  SettingsPayload,
  IntegrationProvider,
  InviteCreateResult,
  UserRole,
} from "./types";

type AppTab = "dispatcher" | "pipeline" | "audit" | "ledger" | "schemas" | "settings" | "history";

const emptyPipelineState: PipelineState = {
  phaseIndex: 0,
  runningText: "READY FOR DISPATCH",
  jobData: null,
  activeIterationIndex: 1,
  logs: ["[System State]: Ready to launch backend-owned workflow..."],
  terminalStatus: "IDLE",
};

const defaultEstimate: CostEstimate = {
  estimatedCost: 0.1425,
  inputTokens: 18400,
  outputTokens: 4500,
  computeMs: 14500,
  isComplex: true,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected request failure";
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || response.statusText);
  }
  return data as T;
}

function inviteTokenFromLocation() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("invite") || "";
}

export default function App() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [inviteToken, setInviteToken] = useState(inviteTokenFromLocation);
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>("dispatcher");
  const [taskInput, setTaskInput] = useState("Implement Stripe Webhook Validation");
  const [devRoleInput, setDevRoleInput] = useState(
    "You are Developer AI. Write clean TypeScript code and robust unit tests. Preserve raw request body buffers when webhook verification requires it.",
  );
  const [qaRoleInput, setQaRoleInput] = useState(
    "You are QA Tester AI. Run isolated verification, inspect test output, and reject changes with actionable feedback when the suite fails.",
  );
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate>(defaultEstimate);

  const [currentJob, setCurrentJob] = useState<ApiJob | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState>(emptyPipelineState);
  const [jobHistoryData, setJobHistoryData] = useState<JobHistory[]>([]);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary>({
    totalActualCost: 0,
    completedJobs: 0,
    totalJobs: 0,
    successRate: 0,
  });
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [systemHealth, setSystemHealth] = useState({
    workflow: "LOCAL BACKEND RUNNER",
    sandbox: "LOCAL TEST PROVIDER",
  });
  const [isDispatching, setIsDispatching] = useState(false);
  const [apiError, setApiError] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      const method = (init.method || "GET").toUpperCase();
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(method) && auth?.csrfToken) {
        headers.set("X-CSRF-Token", auth.csrfToken);
      }

      const response = await fetch(url, {
        ...init,
        headers,
      });

      if (response.status === 401) {
        setAuth((previous) => previous ? { ...previous, authenticated: false, user: null, csrfToken: null } : previous);
      }

      return response;
    },
    [auth?.csrfToken],
  );

  const syncJob = useCallback((job: ApiJob | null) => {
    setCurrentJob(job);
    if (job) {
      setPipelineState(job.pipelineState);
      setTaskInput(job.taskName);
    } else {
      setPipelineState(emptyPipelineState);
    }
  }, []);

  const loadAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/session");
      const data = await readJson<AuthSession>(response);
      setAuth(data);
      setAuthError("");
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!auth?.authenticated) return;

    try {
      const [jobsResponse, activeResponse, settingsResponse, healthResponse] = await Promise.all([
        apiFetch("/api/jobs"),
        apiFetch("/api/jobs/active"),
        apiFetch("/api/settings"),
        fetch("/api/health"),
      ]);

      const jobsData = await readJson<{ history: JobHistory[] }>(jobsResponse);
      const activeData = await readJson<{ job: ApiJob | null }>(activeResponse);
      const settingsData = await readJson<SettingsPayload>(settingsResponse);
      const healthData = await readJson<{
        providers: { workflow: string; sandbox: string };
      }>(healthResponse);

      setJobHistoryData(jobsData.history);
      syncJob(activeData.job);
      setSettings(settingsData);
      setSystemHealth({
        workflow: healthData.providers.workflow.toUpperCase(),
        sandbox: healthData.providers.sandbox.toUpperCase(),
      });

      if (auth.user?.role !== "BUSINESS_ANALYST") {
        const ledgerResponse = await apiFetch("/api/ledger");
        const ledgerPayload = await readJson<{ ledger: LedgerEntry[]; summary: LedgerSummary }>(ledgerResponse);
        setLedgerData(ledgerPayload.ledger);
        setLedgerSummary(ledgerPayload.summary);
      }

      setApiError("");
    } catch (error) {
      setApiError(getErrorMessage(error));
    }
  }, [apiFetch, auth?.authenticated, auth?.user?.role, syncJob]);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [pipelineState.logs]);

  const fetchEstimate = useCallback(async () => {
    if (!auth?.authenticated || !taskInput.trim()) return;

    try {
      const response = await apiFetch("/api/estimate-cost", {
        method: "POST",
        body: JSON.stringify({ taskDescription: taskInput }),
      });
      const data = await readJson<CostEstimate>(response);
      setEstimatedCost(data);
      setApiError("");
    } catch (error) {
      setApiError(getErrorMessage(error));
    }
  }, [apiFetch, auth?.authenticated, taskInput]);

  useEffect(() => {
    const delayDebounce = window.setTimeout(() => {
      void fetchEstimate();
    }, 400);
    return () => window.clearTimeout(delayDebounce);
  }, [fetchEstimate]);

  useEffect(() => {
    if (!auth?.authenticated || !currentJob) return;
    if (!["QUEUED", "IN_PROGRESS", "REVIEW_READY"].includes(currentJob.status)) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await apiFetch(`/api/jobs/${currentJob.id}`);
        const data = await readJson<{ job: ApiJob }>(response);
        syncJob(data.job);
        if (data.job.status !== "IN_PROGRESS" && data.job.status !== "QUEUED") {
          await loadDashboard();
        }
      } catch (error) {
        setApiError(getErrorMessage(error));
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [apiFetch, auth?.authenticated, currentJob, loadDashboard, syncJob]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setAuthError("");
    setAcceptingInvite(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
      const data = await readJson<Pick<AuthSession, "authenticated" | "user" | "csrfToken">>(response);
      setAuth({
        authenticated: data.authenticated,
        user: data.user,
        csrfToken: data.csrfToken,
        authProviders: auth?.authProviders || {
          githubOAuthConfigured: false,
          devLoginEnabled: false,
        },
      });
      setInviteToken("");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAcceptingInvite(false);
    }
  };

  const handleDevLogin = async () => {
    setAuthError("");
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await readJson<Pick<AuthSession, "authenticated" | "user" | "csrfToken">>(response);
      setAuth({
        authenticated: data.authenticated,
        user: data.user,
        csrfToken: data.csrfToken,
        authProviders: auth?.authProviders || {
          githubOAuthConfigured: false,
          devLoginEnabled: true,
        },
      });
    } catch (error) {
      setAuthError(getErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    if (!auth?.csrfToken) return;

    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAuth({
        authenticated: false,
        user: null,
        csrfToken: null,
        authProviders: auth.authProviders,
      });
      syncJob(null);
    }
  };

  const handleDispatchJob = async () => {
    if (!auth?.authenticated) return;
    setIsDispatching(true);
    setApiError("");
    setActiveTab("pipeline");

    try {
      const response = await apiFetch("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          taskDescription: taskInput,
          developerRole: devRoleInput,
          qaRole: qaRoleInput,
        }),
      });
      const data = await readJson<{ job: ApiJob }>(response);
      syncJob(data.job);
      await loadDashboard();
    } catch (error) {
      setApiError(getErrorMessage(error));
      setPipelineState((previous) => ({
        ...previous,
        runningText: "Workflow Error",
        terminalStatus: "REJECTED",
        logs: [...previous.logs, `[ERROR] ${getErrorMessage(error)}`],
      }));
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRollback = async () => {
    if (!currentJob) return;
    setApiError("");

    try {
      const response = await apiFetch(`/api/jobs/${currentJob.id}/rollback`, { method: "POST" });
      const data = await readJson<{ job: ApiJob }>(response);
      syncJob(data.job);
      await loadDashboard();
    } catch (error) {
      setApiError(getErrorMessage(error));
    }
  };

  const handleApproveMerge = async () => {
    if (!currentJob) return;
    setApiError("");

    try {
      const response = await apiFetch(`/api/jobs/${currentJob.id}/approve`, { method: "POST" });
      const data = await readJson<{ job: ApiJob }>(response);
      syncJob(data.job);
      await loadDashboard();
    } catch (error) {
      setApiError(getErrorMessage(error));
    }
  };

  const handleInviteUser = async (input: { email: string; fullName: string; role: UserRole }) => {
    setApiError("");
    try {
      const response = await apiFetch("/api/users/invite", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const data = await readJson<InviteCreateResult>(response);
      await loadDashboard();
      return data;
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  };

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    setApiError("");
    try {
      const response = await apiFetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await readJson(response);
      await loadAuth();
      await loadDashboard();
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  };

  const handleSaveIntegration = async (input: {
    provider: IntegrationProvider;
    displayName: string;
    metadata: Record<string, string>;
    secrets: Record<string, string>;
  }) => {
    setApiError("");
    try {
      const response = await apiFetch("/api/integrations", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await readJson(response);
      await loadDashboard();
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    setApiError("");
    try {
      const response = await apiFetch(`/api/integrations/${integrationId}`, {
        method: "DELETE",
      });
      await readJson(response);
      await loadDashboard();
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  };

  const workflowRunning = currentJob?.status === "IN_PROGRESS" || currentJob?.status === "QUEUED";
  const canReview = auth?.user?.role === "ADMINISTRATOR" || auth?.user?.role === "MANAGER";
  const canManageUsers = auth?.user?.role === "ADMINISTRATOR";

  if (authLoading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center text-sm font-mono text-slate-500">
        Loading secure session...
      </div>
    );
  }

  if (!auth?.authenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-[#E2E8F0] bg-white p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-[#0F172A] text-white flex items-center justify-center font-mono font-bold">
              H
            </div>
            <div>
              <h1 className="text-lg font-bold">Hermes Sign In</h1>
              <p className="text-xs text-slate-500">OAuth-backed access for managers, analysts, and administrators.</p>
            </div>
          </div>

          <div className="space-y-3">
            {inviteToken && (
              <button
                onClick={handleAcceptInvite}
                disabled={acceptingInvite}
                className="w-full px-4 py-2.5 bg-[#0F172A] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:bg-slate-400"
              >
                <ShieldCheck className="w-4 h-4" />
                {acceptingInvite ? "Accepting Invite..." : "Accept Secure Invite"}
              </button>
            )}

            {auth?.authProviders.githubOAuthConfigured && (
              <a
                href="/api/auth/github"
                className="w-full px-4 py-2.5 bg-[#0F172A] text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <Github className="w-4 h-4" />
                Continue with GitHub
              </a>
            )}

            {auth?.authProviders.devLoginEnabled && (
              <button
                onClick={handleDevLogin}
                className="w-full px-4 py-2.5 border border-[#0F172A] text-[#0F172A] text-sm font-bold flex items-center justify-center gap-2 bg-white hover:bg-slate-50"
              >
                <ShieldCheck className="w-4 h-4" />
                Continue as Local Admin
              </button>
            )}
          </div>

          {!auth?.authProviders.githubOAuthConfigured && (
            <div className="mt-5 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
              GitHub OAuth is not configured yet. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `APP_URL` to enable the production OAuth flow.
            </div>
          )}

          {authError && (
            <div className="mt-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-mono">
              {authError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#FFFFFF] text-[#0F172A] font-sans antialiased overflow-hidden">
      <Header user={auth.user} ledgerSummary={ledgerSummary} onLogout={handleLogout} />

      {apiError && (
        <div className="px-6 py-2 border-b border-red-200 bg-red-50 text-xs font-mono text-red-700">
          {apiError}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} pipelineState={pipelineState} />

        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {activeTab === "dispatcher" && (
            <DispatcherTab
              taskInput={taskInput}
              setTaskInput={setTaskInput}
              devRoleInput={devRoleInput}
              setDevRoleInput={setDevRoleInput}
              qaRoleInput={qaRoleInput}
              setQaRoleInput={setQaRoleInput}
              estimatedCost={estimatedCost}
              fetchEstimate={fetchEstimate}
              isDispatching={isDispatching || workflowRunning}
              handleDispatchJob={handleDispatchJob}
            />
          )}

          {activeTab === "pipeline" && (
            <PipelineTab
              taskInput={currentJob?.taskName || taskInput}
              branchName={currentJob?.gitBranch}
              pipelineState={pipelineState}
              setPipelineState={setPipelineState}
              handleRollback={handleRollback}
              handleApproveMerge={handleApproveMerge}
              handleDispatchJob={handleDispatchJob}
              isDispatching={isDispatching || workflowRunning}
              logsEndRef={logsEndRef}
              setActiveTab={setActiveTab}
              canReview={canReview}
            />
          )}

          {activeTab === "audit" && pipelineState.jobData && (
            <AuditTab
              jobData={pipelineState.jobData}
              onRollback={handleRollback}
              onApproveMerge={handleApproveMerge}
              canReview={canReview}
            />
          )}

          {activeTab === "history" && <HistoryTab jobHistoryData={jobHistoryData} onRefresh={loadDashboard} />}

          {activeTab === "ledger" && (
            <LedgerTab ledgerData={ledgerData} summary={ledgerSummary} canView={auth.user?.role !== "BUSINESS_ANALYST"} />
          )}

          {activeTab === "schemas" && <SchemasTab />}

          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              currentUser={auth.user}
              canManageUsers={canManageUsers}
              onInviteUser={handleInviteUser}
              onChangeUserRole={handleChangeUserRole}
              onSaveIntegration={handleSaveIntegration}
              onDeleteIntegration={handleDeleteIntegration}
            />
          )}
        </main>

        <RightSidebar pipelineState={pipelineState} settings={settings} />
      </div>

      <footer className="px-6 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center font-mono">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-700">
              WORKFLOW: {systemHealth.workflow.replace(/-/g, " ")}
            </span>
          </div>
          <div className="h-3 w-px bg-[#E2E8F0]"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-bold text-slate-700">
              SANDBOX: {systemHealth.sandbox.replace(/-/g, " ")}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-[#475569]">
          Session ID: <span className="font-bold text-slate-800">{currentJob?.hermesSessionId || "no-active-job"}</span>
        </div>
      </footer>
    </div>
  );
}
