import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Cpu,
  Database,
  Code,
  ShieldCheck,
  Layers,
  Play,
  RotateCcw,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  ChevronRight,
  GitPullRequest,
  DollarSign,
  AlertCircle,
  GitBranch,
  FileCode,
  Clock,
  User,
  Check,
  Plus,
  ArrowRight,
  Search,
  Server,
  Settings,
  List
} from "lucide-react";

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

import { TestResult, FinalPr, PipelineJob } from "./types";

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<"dispatcher" | "pipeline" | "audit" | "ledger" | "schemas" | "settings" | "history">("dispatcher");
  const [taskInput, setTaskInput] = useState<string>("Implement Stripe Webhook Validation");
  const [devRoleInput, setDevRoleInput] = useState<string>(
    "You are Hermes-Dev-01. Write clean TypeScript code and robust Jest unit tests. Ensure raw body parser buffers are preserved."
  );
  const [qaRoleInput, setQaRoleInput] = useState<string>(
    "You are Hermes-SDET-01. Spin up ephemeral container, run test runner, check for signature verification failures, output JUnit metrics."
  );

  // Financial Estimates & Running Costs State
  const [estimatedCost, setEstimatedCost] = useState({
    estimatedCost: 0.14250,
    inputTokens: 18400,
    outputTokens: 4500,
    computeMs: 14500,
    isComplex: true
  });
  const [jobHistoryData, setJobHistoryData] = useState<Array<{
    id: string;
    task: string;
    status: "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "ROLLED_BACK" | "FAILED";
    submittedAt: string;
    completedAt?: string;
    phase: string;
    assignedTo: string;
  }>>([
    {
      id: "7f82c-9902-hms",
      task: "Refactor User Authentication Flow",
      status: "QUEUED",
      submittedAt: "2026-06-25 14:15:00",
      phase: "Awaiting Dispatch",
      assignedTo: "Auto-Routing",
    },
    {
      id: "7f82d-9903-hms",
      task: "Implement Stripe Webhook Validation",
      status: "IN_PROGRESS",
      submittedAt: "2026-06-25 14:00:00",
      phase: "QA Verification (Iter 2)",
      assignedTo: "Hermes-SDET-01",
    },
    {
      id: "7f82b-9901-hms",
      task: "Optimize Spanner Read Query Indexes",
      status: "COMPLETED",
      submittedAt: "2026-06-24 09:30:00",
      completedAt: "2026-06-24 09:42:15",
      phase: "Merged",
      assignedTo: "Hermes-Dev-01",
    },
    {
      id: "6e41a-8801-hms",
      task: "Migrate Redis Cache to Memorystore",
      status: "ROLLED_BACK",
      submittedAt: "2026-06-23 16:20:00",
      completedAt: "2026-06-23 16:35:00",
      phase: "Rollback Complete",
      assignedTo: "Hermes-Dev-01",
    }
  ]);
  const [searchHistory, setSearchHistory] = useState("");

  const [ledgerData, setLedgerData] = useState<Array<{
    id: string;
    task: string;
    branch: string;
    status: string;
    estimatedCost: number;
    actualCost: number;
    tokens: string;
    date: string;
  }>>([
    {
      id: "7f82b-9901-hms",
      task: "Optimize Spanner Read Query Indexes",
      branch: "feat/spanner-index-tuning",
      status: "COMPLETED",
      estimatedCost: 0.08540,
      actualCost: 0.07210,
      tokens: "12.4k / 4.1k",
      date: "2026-06-24",
    },
    {
      id: "a391c-1456-hms",
      task: "JWT Session Access Control Setup",
      branch: "feat/auth-jwt-refresh",
      status: "COMPLETED",
      estimatedCost: 0.11200,
      actualCost: 0.10500,
      tokens: "16.8k / 5.2k",
      date: "2026-06-25",
    },
    {
      id: "f3041-8890-hms",
      task: "Secure Kubernetes Ingress Routing",
      branch: "feat/k8s-secured-ingress",
      status: "ROLLED_BACK",
      estimatedCost: 0.22500,
      actualCost: 0.01500,
      tokens: "2.1k / 0.4k",
      date: "2026-06-25",
    }
  ]);

  // Current Running Pipeline State
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [pipelineState, setPipelineState] = useState<{
    phaseIndex: number; // 0 to 6
    runningText: string;
    jobData: PipelineJob | null;
    activeIterationIndex: number;
    logs: string[];
    terminalStatus: "IDLE" | "PROVISIONING" | "DEVELOPING" | "TESTING" | "REJECTED" | "RESOLVING" | "VERIFIED" | "PR_DRAFT" | "COMPLETED" | "ROLLED_BACK";
  }>({
    phaseIndex: 0,
    runningText: "READY FOR DISPATCH",
    jobData: null,
    activeIterationIndex: 1,
    logs: ["[System State]: Ready to launch multi-agent platform context..."],
    terminalStatus: "IDLE"
  });

  const [systemHealth, setSystemHealth] = useState<{temporal: string, k8s: string}>({
    temporal: "TEMPORAL CLUSTER SECURED",
    k8s: "K8S VERIFICATION POD ONLINE"
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        if (data.status === "healthy") {
          setSystemHealth({
            temporal: "TEMPORAL CLUSTER SECURED",
            k8s: "K8S VERIFICATION POD ONLINE"
          });
        } else {
          setSystemHealth({
            temporal: "TEMPORAL CLUSTER OFFLINE",
            k8s: "K8S VERIFICATION POD OFFLINE"
          });
        }
      })
      .catch(() => {
        setSystemHealth({
          temporal: "TEMPORAL CLUSTER UNREACHABLE",
          k8s: "K8S VERIFICATION POD UNREACHABLE"
        });
      });
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [pipelineState.logs]);

  // Trigger Live Estimation on input change
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEstimate();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [taskInput]);

  const fetchEstimate = async () => {
    try {
      const res = await fetch("/api/estimate-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDescription: taskInput })
      });
      if (res.ok) {
        const data = await res.json();
        setEstimatedCost(data);
      }
    } catch (e) {
      console.error("Could not fetch cost estimates", e);
    }
  };

  // Dispatch Multi-Agent Platform Workflow
  const handleDispatchJob = async () => {
    setIsDispatching(true);
    setActiveTab("pipeline");
    
    // Reset Pipeline States
    setPipelineState({
      phaseIndex: 1,
      runningText: "Phase 1: Ingestion & Micro-Economic Cost Estimator Initialization",
      jobData: null,
      activeIterationIndex: 1,
      logs: [
        "[08:11:21] [INIT] Hermes Platform Ingestion initiated.",
        `[08:11:22] [ESTIMATOR] Expected Input Tokens: ${estimatedCost.inputTokens}`,
        `[08:11:22] [ESTIMATOR] Expected Output Tokens: ${estimatedCost.outputTokens}`,
        `[08:11:22] [ESTIMATOR] Target compute-ms constraint: ${estimatedCost.computeMs}ms`,
        `[08:11:23] [ESTIMATOR] Total cost estimated at $${estimatedCost.estimatedCost.toFixed(5)} USD.`
      ],
      terminalStatus: "PROVISIONING"
    });

    // Step 2: Queue Dispatch Simulation Delay
    await delay(1200);
    setPipelineState(prev => ({
      ...prev,
      phaseIndex: 2,
      runningText: "Phase 2: Temporal Orchestration Queue & Git Initialization",
      logs: [
        ...prev.logs,
        `[08:11:24] [QUEUE] Enqueued Job specification into Temporal state machine.`,
        `[08:11:24] [QUEUE] Decoupling client request. Initializing Hermes Engine session.`,
        `[08:11:25] [GIT] Provisioning new clean checkout branch: feature/hermes-sandbox-pipeline`
      ]
    }));

    // Trigger Server API dispatch
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: taskInput,
          developerRole: devRoleInput,
          qaRole: qaRoleInput
        })
      });

      if (!response.ok) {
        throw new Error("Dispatch server-side execution failed.");
      }

      const jobResult: PipelineJob = await response.json();

      // Step 3: Run Developer Loop 1 (Fail status)
      await delay(1500);
      setPipelineState(prev => ({
        ...prev,
        phaseIndex: 3,
        runningText: "Phase 3: Developer Agent (Iteration 1) Code Synthesis",
        terminalStatus: "DEVELOPING",
        logs: [
          ...prev.logs,
          `[08:11:26] [AGENT-DEV] Hermes-Dev-01 online.`,
          `[08:11:27] [AGENT-DEV] ${jobResult.developerAgentPrompt.substring(0, 80)}...`,
          `[08:11:28] [AGENT-DEV] Writing file updates inside sandbox workspace...`,
          `[08:11:29] [AGENT-DEV] Commit triggered: "feat: initial autonomous implementation of ${jobResult.taskName}"`,
          `[08:11:30] [GIT] Pushed feature branch: ${jobResult.gitBranch} to remote origin.`
        ]
      }));

      // Step 4: Run QA Verification 1 (Fail status)
      await delay(1500);
      const it1 = jobResult.iterations[0];
      setPipelineState(prev => ({
        ...prev,
        phaseIndex: 4,
        runningText: "Phase 4: QA Ephemeral Sandbox Verification (Iteration 1)",
        terminalStatus: "TESTING",
        logs: [
          ...prev.logs,
          `[08:11:31] [AGENT-QA] Hermes-SDET-01 online.`,
          `[08:11:32] [K8S-SANDBOX] ${it1.qaAction}`,
          `[08:11:33] [K8S-SANDBOX] Booting restricted Docker layer mapping. Node execution sandbox live.`,
          `[08:11:34] [JEST] Launching Jest environment tests...`,
          ...it1.stdout.split("\n").map(l => `[JEST-STDOUT] ${l}`)
        ]
      }));

      // Step 5: Fail and Negotiate Feedback
      await delay(2000);
      setPipelineState(prev => ({
        ...prev,
        phaseIndex: 5,
        runningText: "Phase 5: Automated SDET Rejection & Negotiation Feedback",
        terminalStatus: "REJECTED",
        logs: [
          ...prev.logs,
          `[08:11:38] [AGENT-QA] Verification Suite: FAILED.`,
          `[08:11:39] [AGENT-QA] Rejection issued to Developer Context.`,
          `[08:11:40] [AGENT-QA] Critique Payload: ${it1.feedbackToDeveloper}`
        ]
      }));

      // Step 6: Developer Rewrite (Iteration 2 - Fixed)
      await delay(1800);
      const it2 = jobResult.iterations[1];
      setPipelineState(prev => ({
        ...prev,
        phaseIndex: 3,
        activeIterationIndex: 2,
        runningText: "Phase 3: Developer Agent (Iteration 2) Remediation",
        terminalStatus: "RESOLVING",
        logs: [
          ...prev.logs,
          `[08:11:41] [AGENT-DEV] Pulling rejection critique context.`,
          `[08:11:42] [AGENT-DEV] Analyzing error trace: Preserving body buffer formatting.`,
          `[08:11:43] [AGENT-DEV] Writing corrected middleware hooks and fixing test mocks...`,
          `[08:11:44] [AGENT-DEV] Commit triggered: "fix: resolve signature validation logic under express sandbox environment"`,
          `[08:11:45] [GIT] Updated branch: ${jobResult.gitBranch}`
        ]
      }));

      // Step 7: QA Verification 2 (Pass status)
      await delay(1500);
      setPipelineState(prev => ({
        ...prev,
        phaseIndex: 4,
        runningText: "Phase 4: QA Ephemeral Sandbox Verification (Iteration 2)",
        terminalStatus: "TESTING",
        logs: [
          ...prev.logs,
          `[08:11:46] [AGENT-QA] Container recycled.`,
          `[08:11:47] [K8S-SANDBOX] ${it2.qaAction}`,
          `[08:11:48] [JEST] Rerunning suite...`,
          ...it2.stdout.split("\n").map(l => `[JEST-STDOUT] ${l}`),
          `[08:11:50] [AGENT-QA] All 2 assertions passed cleanly! Test Coverage: ${jobResult.finalPr.testCoverage}%`
        ]
      }));

      // Step 8: Proof of Work PR Creation
      await delay(1500);
      setPipelineState(prev => ({
        ...prev,
        phaseIndex: 6,
        runningText: "Phase 6: Pull Request Generated - Pending Manager Audit",
        terminalStatus: "PR_DRAFT",
        jobData: jobResult,
        logs: [
          ...prev.logs,
          `[08:11:51] [GITHUB] Compiling final source difference blocks.`,
          `[08:11:52] [GITHUB] Pull Request generated successfully.`,
          `[08:11:52] [GITHUB] Draft PR: ${jobResult.finalPr.prTitle}`,
          `[08:11:53] [AUDIT] Standby for Manager review or Rollback approval.`
        ]
      }));

    } catch (err: any) {
      console.error(err);
      setPipelineState(prev => ({
        ...prev,
        runningText: "Workflow Error",
        terminalStatus: "REJECTED",
        logs: [...prev.logs, `[ERROR] Execution failed: ${err.message}`]
      }));
    } finally {
      setIsDispatching(false);
    }
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // State machine rollback handler
  const handleRollback = async () => {
    if (!pipelineState.jobData) return;
    const currentLogs = [...pipelineState.logs];
    
    setPipelineState(prev => ({
      ...prev,
      terminalStatus: "ROLLED_BACK",
      runningText: "DETERMINISTIC ROLLBACK TRIGGERED",
      logs: [
        ...currentLogs,
        `[08:12:01] [ROLLBACK-SYSTEM] Initiating atomic, 1-click rollback recovery.`,
        `[08:12:02] [GIT] Issuing recursive git branch removal on ${pipelineState.jobData?.gitBranch}... SUCCESS.`,
        `[08:12:03] [HERMES] Evicting procedural context buffer inside MEMORY.md to prevent AI hallucinations...`,
        `[08:12:04] [POSTGRES] Reverting all Job state boundaries to ROLLED_BACK.`,
        `[08:12:05] [ROLLBACK-SYSTEM] Rollback complete. Environment restored to safe pre-task snapshot.`
      ]
    }));

    // Update history tracker
    const newRecord = {
      id: Math.random().toString(36).substring(2, 7) + "-hms",
      task: pipelineState.jobData.taskName,
      branch: pipelineState.jobData.gitBranch,
      status: "ROLLED_BACK",
      estimatedCost: pipelineState.jobData.estimatedCost,
      actualCost: 0.01500, // Minimal cleanup cost
      tokens: `${Math.round(pipelineState.jobData.finalPr.inputTokens * 0.15)}k / 0.2k`,
      date: new Date().toISOString().split("T")[0]
    };
    setLedgerData(prev => [newRecord, ...prev]);
  };

  // State machine approve merge handler
  const handleApproveMerge = () => {
    if (!pipelineState.jobData) return;
    const currentLogs = [...pipelineState.logs];

    setPipelineState(prev => ({
      ...prev,
      phaseIndex: 6,
      terminalStatus: "COMPLETED",
      runningText: "JOB MERGED & COMPLETED SUCCESS",
      logs: [
        ...currentLogs,
        `[08:12:10] [MERGE-SUITE] Merging ${pipelineState.jobData?.gitBranch} into master branch.`,
        `[08:12:11] [DATABASE] Updating status field inside "jobs" table to COMPLETED_MERGED.`,
        `[08:12:12] [LEDGER] Final actual micro-economic cost recorded: $${pipelineState.jobData?.finalPr.actualCost} USD.`,
        `[08:12:13] [SYSTEM] Session complete. Ephemeral sandbox namespace recycled.`
      ]
    }));

    // Update history ledger
    const newRecord = {
      id: "9f" + Math.random().toString(36).substring(2, 5) + "-hms",
      task: pipelineState.jobData.taskName,
      branch: pipelineState.jobData.gitBranch,
      status: "COMPLETED",
      estimatedCost: pipelineState.jobData.estimatedCost,
      actualCost: pipelineState.jobData.finalPr.actualCost,
      tokens: `${(pipelineState.jobData.finalPr.inputTokens / 1000).toFixed(1)}k / ${(pipelineState.jobData.finalPr.outputTokens / 1000).toFixed(1)}k`,
      date: new Date().toISOString().split("T")[0]
    };
    setLedgerData(prev => [newRecord, ...prev]);
  };

  return (
    <div className="flex flex-col h-screen bg-[#FFFFFF] text-[#0F172A] font-sans antialiased overflow-hidden">
      
      <Header />

      {/* Main Content Pane */}
      <div className="flex-1 flex overflow-hidden">
        
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} pipelineState={pipelineState} />

        {/* Dynamic Center Workstation */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          
          {/* Dispatcher Form Tab */}
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
              isDispatching={isDispatching}
              handleDispatchJob={handleDispatchJob}
            />
          )}

          {/* Pipeline Tab */}
          {activeTab === "pipeline" && (
            <PipelineTab
              taskInput={taskInput}
              pipelineState={pipelineState}
              setPipelineState={setPipelineState}
              handleRollback={handleRollback}
              handleApproveMerge={handleApproveMerge}
              handleDispatchJob={handleDispatchJob}
              isDispatching={isDispatching}
              logsEndRef={logsEndRef}
              setActiveTab={setActiveTab}
            />
          )}

          {/* Audit Trail Tab */}
          {activeTab === "audit" && pipelineState.jobData && (
            <AuditTab 
              jobData={pipelineState.jobData} 
              onRollback={handleRollback} 
              onApproveMerge={handleApproveMerge} 
            />
          )}

          {/* History / Queue Tab */}
          {activeTab === "history" && <HistoryTab jobHistoryData={jobHistoryData} />}

          {/* Financial Ledger Tab */}
          {activeTab === "ledger" && <LedgerTab ledgerData={ledgerData} />}

          {/* Schemas view */}
          {activeTab === "schemas" && <SchemasTab />}

          {activeTab === "settings" && <SettingsTab />}

        </main>

        <RightSidebar pipelineState={pipelineState} />

      </div>

      {/* Footer Audit Status Indicators */}
      <footer className="px-6 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center font-mono">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${systemHealth.temporal.includes("SECURED") ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-bold text-slate-700">{systemHealth.temporal.replace('TEMPORAL CLUSTER SECURED', 'WORKFLOW SERVER ONLINE')}</span>
          </div>
          <div className="h-3 w-px bg-[#E2E8F0]"></div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${systemHealth.k8s.includes("ONLINE") ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-bold text-slate-700">{systemHealth.k8s.replace('K8S VERIFICATION POD ONLINE', 'TEST RUNNER ONLINE')}</span>
          </div>
        </div>
        <div className="text-[10px] text-[#475569]">
          Session ID: <span className="font-bold text-slate-800">7f82b-9901-hms</span>
        </div>
      </footer>

    </div>
  );
}
