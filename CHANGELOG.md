# Changelog

## [1.1.0] - UI Refactoring and Component Modularization

### Added
- **Component Modularity**: Extracted monolithic `App.tsx` into highly modular React components for improved token-limit management and code maintainability:
  - `DispatcherTab.tsx`, `PipelineTab.tsx`, `AuditTab.tsx`, `LedgerTab.tsx`, `HistoryTab.tsx`, `SchemasTab.tsx`
  - `Sidebar.tsx`, `RightSidebar.tsx`, `Header.tsx`
- **Terminology Update**: Streamlined UI copy to remove excessive "tech-larping" (e.g., replaced "Hermes-Dev-01" with "Developer AI", simplified "Temporal Orchestration Workflow" to "Start Task") to adhere to clean, literal, human-readable design constraints.
- **Live Drop-In**: Implemented an interactive live drop-in session overlay in `PipelineTab.tsx` that simulates viewing a virtual browser and agent terminal in real-time while a task is dispatching.

## [1.0.0] - Initial Platform Setup

### Added
- **UI/UX Design**: Implemented strict monochrome, maximum information density design per specifications, featuring JetBrains Mono typography and Technical Utility layout.
- **Core Views**: Developed the Dispatcher, Live Pipeline, Audit Trail (Proof of Work), and Financial Ledger tabs.
- **Backend Simulation**: Built Express backend in `server.ts` to dynamically estimate task costs and simulate real-time agent output logs, test results, and XML.
- **Database Schema**: Created `src/operational-code/schema.sql` defining enterprise schemas for Users, Jobs, JobExecutions, FinancialLedger, and QALogs with rollback constraints.
- **Workflow Engine**: Added `src/workflows/engineeringWorkflow.ts` defining the complete Temporal Workflow lifecycle and rollback state machine.
- **Agent Tooling**: Added `src/agents/hermesConfig.ts` with strict system instructions, tool constraints, and prompt designs for Hermes-Dev-01 and Hermes-SDET-01.
- **Architecture**: Created `architecture/DATA_FLOW.md` outlining ASCII architectural components and data lifecycles.
- **Project Documentation**: Added `README.md`, `CHANGELOG.md`, `BUILD_PLAN.md`, and `manifest.json`.
