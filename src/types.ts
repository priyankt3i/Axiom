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
  status: string;
  estimatedCost: number;
  actualCost: number;
  tokens: string;
  date: string;
}

