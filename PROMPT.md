# Consolidated Prompt

## Original Manifest Prompt
System Role & Objective:
You are a Principal Software Architect, Lead SDET, and Senior DevOps Engineer building a groundbreaking Multi-Agent Engineering Task Orchestration Platform.

Your objective is to generate a comprehensive, production-ready system architecture, database schema, and core operational code for this platform. This is not a toy project or a "vibe-coded" wrapper; it is an enterprise-grade system designed for Managers and Business Analysts to confidently schedule, dispatch, and review software engineering jobs executed autonomously by AI agents.

1. The Product Vision & Task Lifecycle:
The platform operates on a strict, trackable workflow:
* Phase 1: Ingestion & Planning: A Manager or BA creates a bounded task (e.g., "Implement Stripe Webhook"). The platform estimates the micro-economic cost (token usage + compute time).
* Phase 2: Dispatch: The task is routed to the Hermes orchestrator.
* Phase 3: Development Loop: The "Developer Agent" checks out a new Git branch, writes the implementation code, and writes the unit tests.
* Phase 4: QA & Sandboxed Verification: The "QA Agent" takes over. It spins up an ephemeral Kubernetes pod, builds the code, runs the test suite, and performs static analysis.
* Phase 5: The Negotiation: If tests fail, the QA agent rejects the build, sending logs and feedback back to the Developer Agent for a rewrite. This loop continues until tests pass or a timeout is reached.
* Phase 6: Proof of Work & Review: Once successful, the agent opens a Pull Request. The Manager's dashboard updates with the PR link, immutable build logs, test coverage reports, and actual token/compute costs.
* Phase 7: Merge or Rollback: The Manager clicks "Approve & Merge" or "Rollback" (which reverting all DB states, Git branches, and agent memory buffers).

2. Strict UI/UX System Design Specification:
* Aesthetic: Maximum information density. Minimalist monochrome palette: Pure Whites (#FFFFFF), Slate Greys (#F8FAFC, #E2E8F0, #475569), Charcoal text (#0F172A). 1px solid borders, no shadows, no gradients.
* Typography: Clean geometric sans-serif for UI, monospace (JetBrains Mono) for logs and code.
* Core Views (Next.js/React):
    * The Dispatcher: Form to define task boundaries and assign sub-agents.
    * The Pipeline: Linear-style Kanban board tracking the lifecycle phases.
    * The Audit Trail (Proof of Work): A split-pane view showing the final PR diff alongside raw test execution logs.
    * The Ledger: Financial dashboard tracking estimated vs. actual micro-economic costs (daily, weekly, YTD) via data tables and line charts.

3. Infrastructure & DevOps Architecture:
* Backend & Queue: Node.js backend utilizing Temporal (or BullMQ) for deterministic, long-running workflow orchestration. HTTP requests cannot handle 10-minute agent loops; an event-driven queue is mandatory.
* Agent Sandboxing: Implement dynamic Kubernetes namespace isolation. When the QA agent runs, it must execute within a highly restricted, network-isolated Docker container, outputting standard JUnit/Jest XML test results back to the backend.
* Hermes Orchestration: Utilize the Hermes framework to manage procedural memory (`MEMORY.md`) and sub-agent delegation.

4. Data Store & Flawless Schema Design (PostgreSQL/Prisma):
Define the complete relational schema, including:
* `Users` & `Roles` (Manager, BA, Admin).
* `Jobs` (id, scope, current_phase, git_branch).
* `JobExecutions` (id, job_id, hermes_session_id, pre_task_snapshot).
* `FinancialLedger` (id, execution_id, est_cost, actual_cost, input_tokens, output_tokens, compute_ms).
* `QALogs` (id, execution_id, test_results_xml, stdout, stderr, iteration_count).

5. Deterministic Rollback State Machine:
Define the precise logic for the 1-Click Rollback. It must simultaneously:
1. Execute a Git revert/delete on the specific feature branch.
2. Transition the PostgreSQL `Job` state to `ROLLED_BACK`.
3. Evict the specific context from the Hermes agent's short-term memory to prevent hallucination on the next attempt.

Expected Output Requirements (Zero Pseudocode):
1. Architecture Flowchart Description: Detailed data flow from UI -> Queue -> Hermes -> Kubernetes Sandbox -> DB.
2. Database Schema: Complete SQL DDL or Prisma schema file.
3. Temporal/Queue Workflow Code: TypeScript code defining the asynchronous job execution, the Developer-to-QA negotiation loop, and the Rollback handler.
4. Hermes Agent Configuration: The system prompts and tool-calling definitions that constrain the Developer and QA agents to their specific roles.

---

## Phase 1.5 Updates (Component Refactoring & UI Refinement)
Based on subsequent feedback and improvements, the following modifications have been implemented and should be preserved:

1. **Component Modularity**: 
The monolithic React structure has been refactored into modular components. 
- The tabs have been broken down into separate files: `DispatcherTab.tsx`, `PipelineTab.tsx`, `AuditTab.tsx`, `LedgerTab.tsx`, `HistoryTab.tsx`, and `SchemasTab.tsx`.
- Reusable UI elements have been separated: `Sidebar.tsx`, `RightSidebar.tsx`, `Header.tsx`.

2. **Terminology Clean-Up**:
Excessive "tech-larping" and overly aggressive sci-fi terminology has been removed to adhere to the requested clean, human-readable UI constraints.
- "Hermes-Dev-01" was renamed to "Developer AI".
- "Temporal Orchestration Workflow" was simplified to "Start Task".
- "Job History & Active Queue" was simplified to "Task History".

3. **Live Drop-In Session Modal**:
A "Live Drop-In" feature was added to the Pipeline tab. While a task is in progress (dispatching), users can click a "LIVE DROP-IN" button to open a modal overlay. This overlay simulates:
- A virtual browser view (waiting for the agent to render UI components).
- A real-time agent terminal/editor view executing commands (like `npm run test:e2e` via Playwright).
This allows users to monitor the exact real-time execution of the agent as it works within the sandbox.

---

## Phase 2 (Production Goal - Pending)
Going forward, the project aims to integrate with live production infrastructure:
- Connect to a real Temporal Cluster.
- Deploy the database schema to AWS RDS/GCP Cloud SQL using an ORM like Drizzle or Prisma.
- Implement real Kubernetes container sandboxing.
- Integrate real Langchain/agent execution loops.
- Integrate real GitHub App tokens for automated PR tracking.
- Add Role-Based Access Control (RBAC).
