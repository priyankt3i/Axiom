# Hermes Multi-Agent Engineering Task Orchestration Platform
## Enterprise System Architecture & Data Flowchart

This document details the secure, enterprise-grade architecture of the Hermes Orchestrator. The system is designed to schedule, dispatch, verify, and audit software engineering jobs autonomously using distributed multi-agent workflows.

---

### 1. System Architecture Flowchart (ASCII Representation)

```text
  +------------------+
  |  Manager Web UI  | <=============================================+
  +------------------+                                               |
           |                                                         |
  (REST APIs / WebSockets)                                           | 6. Rollback Signal
           |                                                         |    or PR Review
           v                                                         |
  +---------------------------+                                      |
  |   Node.js Backend Server  | <-------+                            |
  +---------------------------+         | 4. Update logs,            |
           |             |              |    schemata, and           v
    (Job Ingestion)   (Database         |    financial ledgers  +----------+
           |           Queries)         |                       |  Github  |
           v             v              |                       |   PR /   |
     +----------+  +------------+       |                       |  Branch  |
     | Temporal |  | PostgreSQL | ------+                       +----------+
     |  Queue   |  |  Database  |                                    ^
     +----------+  +------------+                                    |
           |                                                         | 5. Pull Request
     (Poll Activity Task)                                            |    Draft Delivery
           |                                                         |
           v                                                         |
  +-------------------------------------+                            |
  |     Hermes Orchestrator Core        | ---------------------------+
  +-------------------------------------+
       |                            |
  (Sub-agent Instruction)      (Sub-agent Instruction)
       |                            |
       v                            v
+------------------+         +-------------------------------+
| Developer Agent  | <=====> |           QA Agent            |
| (Hermes-Dev-01)  |         |        (Hermes-SDET-01)       |
+------------------+         +-------------------------------+
                                            |
                                  (Deploy Sandboxed Pod)
                                            |
                                            v
                             +-------------------------------+
                             | Kubernetes Sandbox Namespace  |
                             |  - Restricted Docker Runtime  |
                             |  - Ephemeral Jest/JUnit XML  |
                             +-------------------------------+
```

---

### 2. Detailed Data Flow Lifecycle

#### Phase 1: Ingestion & Planning
1. A **Manager** or **Business Analyst (BA)** enters a natural language scope task (e.g., "Implement Stripe Webhook") inside the **Dispatcher Dashboard**.
2. The **Node.js Backend** intercepts the request and calculates a micro-economic cost projection (LLM prompt token weight, predicted output size, compute ms multipliers).
3. The job is persisted inside **PostgreSQL** in `INGESTION_PLANNING` phase status.

#### Phase 2: Dispatch & Event Queueing
1. The backend pushes the execution request to **Temporal Workflow Engines** via `executeEngineeringTaskWorkflow()`.
2. This decouples long-running LLM execution loops (which can take 1 to 10 minutes) from synchronous HTTP request boundaries, ensuring high availability.
3. The Job transitions to `DISPATCHED_TO_QUEUE` status.

#### Phase 3: Developer Agent Loop
1. The **Hermes Orchestrator** pulls from the queue and binds the workflow context under a unique `hermes_session_id`.
2. **Hermes-Dev-01** (Developer Agent) spins up. It performs a git checkout of the master repo into an isolated git feature branch (`feature/hermes-task-id`).
3. The Developer Agent writes the code implementation *and* compiles corresponding unit tests. It commits and pushes changes.

#### Phase 4: QA & Sandboxed Verification
1. The **Hermes-SDET-01** (QA Agent) takes custody.
2. It provisions an ephemeral, network-isolated **Kubernetes namespace** or local Docker sandbox instance.
3. The QA Agent builds the source tree, runs the test runner, and pipes real-time raw stdout logs and standard JUnit XML report payloads back to the orchestrator.

#### Phase 5: Negotiation Feedback Loop
1. If any assertions, imports, or builds fail:
   - The QA Agent **rejects** the build execution.
   - It captures stack traces, packs them as JSON feedback payloads, and transitions PostgreSQL state to `NEGOTIATION_FEEDBACK`.
   - The orchestrator feeds this directly back into **Hermes-Dev-01's** short-term context.
   - The Developer rewrite cycle starts again.
2. If tests pass (100% green metrics):
   - The QA Agent stamps approval, compiles coverage reports, and advances the workflow.

#### Phase 6: Proof of Work & PR Review
1. Once approved, the orchestrator issues Git instructions to draft an official **Pull Request (PR)** against the main repo.
2. The Manager is instantly notified. They can inspect the unified Git diff, raw Docker container logs, JUnit schemas, and YTD micro-economic token ledgers.

#### Phase 7: Merge or Rollback Protocol
1. **Approve & Merge**: Merges branch into upstream master and updates PostgreSQL status to `COMPLETED_MERGED`.
2. **1-Click Rollback**: Simultaneously:
   - Executes recursive `git revert` on the target git branch.
   - Transition job state to `ROLLED_BACK`.
   - Evicts context memories inside Hermes short-term buffer files (`MEMORY.md`) to prevent subsequent hallucinations.
