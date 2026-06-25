# Hermes Multi-Agent Orchestrator

Enterprise-grade multi-agent software engineering task scheduler, pipeline orchestrator, sandbox verification environment, and audit log ledger.

## Project Structure

- `src/App.tsx`: Main React application containing the UI/UX implementation of the Dispatcher, Pipeline, Audit Trail, and Ledger.
- `src/operational-code/schema.sql`: Full PostgreSQL database schema defining Users, Roles, Jobs, JobExecutions, FinancialLedger, and QALogs.
- `src/workflows/engineeringWorkflow.ts`: Temporal workflow definition that orchestrates the job ingestion, developer loop, QA verification, PR creation, and rollback state machine.
- `src/agents/hermesConfig.ts`: System prompts and tool configurations for the Developer Agent (Hermes-Dev-01) and QA Agent (Hermes-SDET-01).
- `architecture/DATA_FLOW.md`: Detailed system architecture and data flowchart.
- `server.ts`: Express backend handling dynamic cost estimation and dispatch, integrating with Gemini and supporting high-fidelity offline execution simulations.

## Production Readiness

The UI application demonstrates the end-to-end user experience, but it utilizes a simulation mode via `server.ts` for actual long-running tasks. 

**What is Production Ready:**
1. **Temporal Workflow Code (`src/workflows/engineeringWorkflow.ts`)**: This code is fully typed and ready to be deployed to a Temporal worker environment.
2. **Database Schema (`src/operational-code/schema.sql`)**: Ready for deployment to a PostgreSQL database (e.g., Cloud SQL).
3. **Agent Configurations (`src/agents/hermesConfig.ts`)**: The system prompts and tool schemas are ready to be ingested by a framework (e.g., Langchain or the actual Hermes framework backend).

**What is Simulated (Mocked) in the UI:**
The UI relies on simulated backend execution delays and mock AI outputs (via `server.ts`) to mimic the asynchronous 10-minute workflow processes, because a true Temporal execution and dynamic Kubernetes sandbox spin-up would require a fully deployed infrastructure environment that is not present in this web sandbox.

## Getting Started

1. Set up the development server using Vite (`npm run dev`).
2. Run tests (once deployed).
3. See `BUILD_PLAN.md` for remaining tasks.
