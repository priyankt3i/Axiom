// @ts-nocheck
/**
 * @file workflow.ts
 * @description Deterministic Temporal Workflow and Activities orchestrating the multi-agent
 * software engineering lifecycle including development, sandboxed QA validation, and rollback.
 */

import { proxyActivities, sleep, defineSignal, defineQuery, setHandler } from "@temporalio/workflow";

// Types matching relational database models
export type JobPhase =
  | "INGESTION_PLANNING"
  | "DISPATCHED_TO_QUEUE"
  | "DEVELOPER_LOOP"
  | "QA_VERIFICATION"
  | "NEGOTIATION_FEEDBACK"
  | "PULL_REQUEST_OPEN"
  | "COMPLETED_MERGED"
  | "ROLLED_BACK";

export interface TaskScope {
  id: string;
  scopeDescription: string;
  targetRepository: string;
}

export interface ExecutionResult {
  success: boolean;
  gitBranch: string;
  pullRequestUrl?: string;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
  computeMs: number;
}

// Defining Signals and Queries for Temporal Workflow Interaction
export const rollbackSignal = defineSignal("rollbackSignal");
export const approveMergeSignal = defineSignal("approveMergeSignal");
export const getWorkflowStateQuery = defineQuery<JobPhase>("getWorkflowState");

// Import target Activity definitions
const {
  updateJobPhaseInDb,
  estimateCosts,
  dispatchHermesSession,
  runDeveloperAgentLoop,
  runQASandboxVerification,
  openPullRequest,
  evictAgentMemoryBuffer,
  executeGitBranchRevert,
  recordFinancialLedger,
  recordQALogs,
} = proxyActivities({
  startToCloseTimeout: "15 minutes",
  retry: {
    initialInterval: "5 seconds",
    maximumInterval: "1 minute",
    backoffCoefficient: 2,
    nonRetryableErrorTypes: ["GitBranchConflictError", "DatabaseConnectionError"],
  },
});

/**
 * The core orchestration workflow representing the Multi-Agent engineering task lifecycle.
 */
export async function executeEngineeringTaskWorkflow(task: TaskScope): Promise<ExecutionResult> {
  let currentPhase: JobPhase = "INGESTION_PLANNING";
  let branchName = `feature/hermes-task-${task.id}`;
  let iteration = 1;
  const maxIterations = 3;
  let testSuitePassed = false;
  let latestDiff = "";
  let rollbackTriggered = false;
  let mergeApproved = false;

  // Track financial metrics
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalComputeMs = 0;
  let totalCost = 0.0;

  // Configure Temporal Queries to fetch runtime workflow status
  setHandler(getWorkflowStateQuery, () => currentPhase);

  // Configure Signal handler for Rollback operation
  setHandler(rollbackSignal, async () => {
    rollbackTriggered = true;
  });

  // Configure Signal handler for approving PR
  setHandler(approveMergeSignal, async () => {
    mergeApproved = true;
  });

  try {
    // Phase 1: Ingestion & Planning Cost estimation
    currentPhase = "INGESTION_PLANNING";
    await updateJobPhaseInDb(task.id, currentPhase);
    const estimation = await estimateCosts(task.scopeDescription);
    totalCost += estimation.estimatedCost;

    // Phase 2: Dispatch to the Queue and Initialize Hermes Session
    currentPhase = "DISPATCHED_TO_QUEUE";
    await updateJobPhaseInDb(task.id, currentPhase);
    const hermesSessionId = await dispatchHermesSession(task.id, branchName);

    // Initial Database snapshots stored during dispatch
    await recordFinancialLedger(hermesSessionId, estimation.estimatedCost, 0, 0, 0);

    // Loop until Sandbox Tests Pass or Max Negotiation Iterations are breached
    while (iteration <= maxIterations && !testSuitePassed && !rollbackTriggered) {
      
      // Phase 3: Developer Agent Loop
      currentPhase = "DEVELOPER_LOOP";
      await updateJobPhaseInDb(task.id, currentPhase);
      
      const devOutput = await runDeveloperAgentLoop({
        scopeDescription: task.scopeDescription,
        branchName,
        hermesSessionId,
        feedback: iteration > 1 ? "The test suite failed. Review prior QA execution logs and address code assertions." : "",
        iteration,
      });

      latestDiff = devOutput.codeDiff;
      totalInputTokens += devOutput.tokensUsed.input;
      totalOutputTokens += devOutput.tokensUsed.output;
      totalComputeMs += devOutput.computeMs;

      if (rollbackTriggered) break;

      // Phase 4: QA & Sandboxed Verification (Ephemeral Kubernetes isolation container)
      currentPhase = "QA_VERIFICATION";
      await updateJobPhaseInDb(task.id, currentPhase);

      const qaOutput = await runQASandboxVerification({
        jobId: task.id,
        branchName,
        codeDiff: latestDiff,
        namespace: `hermes-sandbox-pod-${task.id}-${iteration}`,
      });

      totalComputeMs += qaOutput.computeMs;

      // Record QA execution records, stdout logs, and Jest/JUnit XML test metrics in relational DB
      await recordQALogs({
        jobId: task.id,
        hermesSessionId,
        iterationCount: iteration,
        testResultsXml: qaOutput.testResultsXml,
        stdout: qaOutput.stdout,
        stderr: qaOutput.stderr,
        k8sNamespace: qaOutput.k8sNamespace,
      });

      if (qaOutput.passed) {
        testSuitePassed = true;
      } else {
        // Phase 5: Negotiation and Rejection Loop Feedback
        currentPhase = "NEGOTIATION_FEEDBACK";
        await updateJobPhaseInDb(task.id, currentPhase);
        iteration++;
        // Short backoff before starting negotiation feedback loop
        await sleep("2 seconds");
      }
    }

    if (rollbackTriggered) {
      return await handleRollbackState(task.id, branchName, hermesSessionId);
    }

    if (!testSuitePassed) {
      throw new Error(`Orchestration execution terminated. QA sandbox tests failed to pass after ${maxIterations} negotiation iterations.`);
    }

    // Phase 6: Proof of Work & Pull Request Delivery
    currentPhase = "PULL_REQUEST_OPEN";
    await updateJobPhaseInDb(task.id, currentPhase);
    
    const prDetails = await openPullRequest({
      branchName,
      repository: task.targetRepository,
      diff: latestDiff,
    });

    // Record total micro-economic ledger expenses
    totalCost = (totalInputTokens * 0.000000075) + (totalOutputTokens * 0.0000003) + (totalComputeMs * 0.000016);
    await recordFinancialLedger(hermesSessionId, estimation.estimatedCost, totalCost, totalInputTokens, totalOutputTokens);

    // Dynamic Wait: Hold the workflow execution until a Human Manager approves merge or triggers rollback
    while (!mergeApproved && !rollbackTriggered) {
      await sleep("5 seconds"); // Check state loop
    }

    if (rollbackTriggered) {
      return await handleRollbackState(task.id, branchName, hermesSessionId);
    }

    // Phase 7: Complete and Merge Delivery
    currentPhase = "COMPLETED_MERGED";
    await updateJobPhaseInDb(task.id, currentPhase);

    return {
      success: true,
      gitBranch: branchName,
      pullRequestUrl: prDetails.pullRequestUrl,
      actualCost: parseFloat(totalCost.toFixed(5)),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      computeMs: totalComputeMs,
    };

  } catch (error: any) {
    // Graceful recovery and marking state failed
    await updateJobPhaseInDb(task.id, "ROLLED_BACK");
    throw error;
  }
}

/**
 * Deterministic 1-Click Rollback State Machine
 * Executes branch revert, context eviction, and resets PostgreSQL states.
 */
async function handleRollbackState(jobId: string, branchName: string, hermesSessionId: string): Promise<ExecutionResult> {
  console.log(`[Rollback Triggered] Initiating atomic rollback protocol for Job ${jobId}`);

  // 1. Execute Git revert on branch and delete isolated origin reference
  await executeGitBranchRevert(branchName);

  // 2. Evict Hermes short term memory contexts to avoid agent hallucinations on subsequent runs
  await evictAgentMemoryBuffer(hermesSessionId);

  // 3. Mark database tracking logs as ROLLED_BACK
  await updateJobPhaseInDb(jobId, "ROLLED_BACK");

  return {
    success: false,
    gitBranch: branchName,
    actualCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    computeMs: 0,
  };
}
