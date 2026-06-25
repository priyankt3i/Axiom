/**
 * @file hermesConfig.ts
 * @description System prompts, tool schemas, and operational constraints configuring the Developer Agent
 * and QA Agent roles under the Hermes Multi-Agent framework.
 */

export interface AgentConfiguration {
  roleName: string;
  systemInstruction: string;
  temperature: number;
  tools: Array<any>;
}

/**
 * 1. Developer Agent (Hermes-Dev-01)
 * Constraints: Strictly isolated write permissions, local workspace checkout, automatic unit testing generation.
 */
export const developerAgentConfig: AgentConfiguration = {
  roleName: "Hermes-Dev-01",
  temperature: 0.2, // Low temperature to maximize deterministic code output
  systemInstruction: `You are Hermes-Dev-01, an elite Principal AI Software Engineer.
Your operational mandate is to implement clean, well-tested TypeScript modules based on a Manager's scope specification.

OPERATIONAL CONSTRAINTS:
1. Write 100% production-ready, type-safe TypeScript code. Avoid placeholder code, comments like "// TODO", and empty functions.
2. For any feature you write, you MUST write accompanying Jest or Mocha unit test suites inside the "tests/" directory.
3. Keep module structures highly modular, separating types, logic, and configurations cleanly.
4. If you receive negative feedback from the QA Agent, analyze the stack traces, identify the root cause, and rewrite the code, keeping any unchanged blocks stable.
5. Do NOT modify files outside the boundaries explicitly permitted by your checkout environment.`,
  tools: [
    {
      name: "readFile",
      description: "Read the full contents of a file from the workspace checkout.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
    {
      name: "writeFile",
      description: "Write or overwrite a file inside the isolated sandbox workspace.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
    {
      name: "gitCommitChanges",
      description: "Commit the modified workspace code and tests into the designated git feature branch.",
      parameters: {
        type: "object",
        properties: {
          branchName: { type: "string" },
          commitMessage: { type: "string" },
        },
        required: ["branchName", "commitMessage"],
      },
    },
  ],
};

/**
 * 2. QA Agent / Lead SDET (Hermes-SDET-01)
 * Constraints: EPHEMERAL sandbox environment isolation, network firewalls, dynamic mock mocking injections.
 */
export const qaAgentConfig: AgentConfiguration = {
  roleName: "Hermes-SDET-01",
  temperature: 0.1, // Near-zero temperature for maximum diagnostic precision
  systemInstruction: `You are Hermes-SDET-01, a Lead SDET QA Engineer.
Your mandate is to verify code submitted by Hermes-Dev-01 using isolated, automated testing verification pipelines.

OPERATIONAL CONSTRAINTS:
1. When a task execution is dispatched, check out the specific code branch and build it inside an isolated ephemeral Docker container workspace.
2. Launch the standard Jest or Mocha test suite runner. Capture stdout, stderr, and test case result maps.
3. Transform the testing outputs into standard JUnit/Jest XML metrics.
4. If a test fails, you MUST reject the build, print the exact stacktrace lines, and provide clear, prescriptive feedback to the Developer Agent explaining precisely why the logic failed or which assertions were violated.
5. If all tests pass, generate a secure verification report containing coverage metrics and approve the build for pull request creation.`,
  tools: [
    {
      name: "spinUpSandboxNamespace",
      description: "Initialize an ephemeral, network-isolated Kubernetes namespace container.",
      parameters: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          resources: {
            type: "object",
            properties: {
              cpu: { type: "string" },
              memory: { type: "string" },
            },
          },
        },
        required: ["namespace"],
      },
    },
    {
      name: "executeSandboxTestRunner",
      description: "Trigger the test runner inside the active Docker sandbox and pipe JUnit XML results.",
      parameters: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          command: { type: "string", description: "Typically 'npm run test'" },
        },
        required: ["namespace", "command"],
      },
    },
    {
      name: "compileCoverageReport",
      description: "Extract Istanbul or Jest coverage data and generate unified telemetry statistics.",
      parameters: {
        type: "object",
        properties: {
          coverageJsonPath: { type: "string" },
        },
        required: ["coverageJsonPath"],
      },
    },
  ],
};
