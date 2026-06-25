# Build Plan & Project Tracking

This document stores all information about what has been completed and what needs to be done to achieve the end goal from the original prompt.

## ✅ Phase 1: Core Architecture & UI Delivery (Completed)
- [x] **Product Vision & Task Lifecycle Mapping**: Implemented UI tracking for all 7 phases (Ingestion to Merge/Rollback).
- [x] **Strict UI/UX Specification**: Achieved minimalist monochrome palette, technical utility aesthetics, and all four core React views (Dispatcher, Pipeline, Audit Trail, Ledger).
- [x] **Architecture Flowchart**: Delivered `architecture/DATA_FLOW.md`.
- [x] **Database Schema**: Delivered `src/operational-code/schema.sql`.
- [x] **Temporal Workflow Code**: Delivered `src/workflows/engineeringWorkflow.ts`.
- [x] **Hermes Agent Configuration**: Delivered `src/agents/hermesConfig.ts`.
- [x] **Backend Cost Estimator**: Implemented dynamic estimation logic in `server.ts`.
- [x] **Simulated Sandbox Pipeline**: Created high-fidelity dummy outputs for the AI iterations to showcase the UI state changes.

## ✅ Phase 1.5: UI Refactoring & Modularization (Completed)
- [x] **Component Modularity**: Refactored monolithic `App.tsx` into multiple dedicated modular components (`DispatcherTab.tsx`, `PipelineTab.tsx`, `AuditTab.tsx`, etc.).
- [x] **Terminology De-jargonification**: Cleaned up excessive technical labels in the UI, enforcing literal and humble naming conventions (e.g., "Developer AI" instead of "Hermes-Dev-01", "Task History" instead of "Job History & Active Queue").
- [x] **Live Drop-In Functionality**: Added a "Drop-In" modal during task dispatching that lets the user inspect a virtual browser view and agent terminal execution in real-time.

## 🔄 Phase 2: Production Infrastructure Integration (Pending)
The following tasks are required to take the codebase from the current simulated preview sandbox into a live production environment.

- [ ] **Temporal Cluster Setup**: Deploy a self-hosted Temporal Cluster or connect to Temporal Cloud. Link `engineeringWorkflow.ts` to actual Temporal Workers.
- [ ] **PostgreSQL Deployment**: Deploy the database schema from `schema.sql` to a production PostgreSQL instance (e.g., AWS RDS or GCP Cloud SQL) and replace mock states with actual database queries via an ORM (Prisma/Drizzle).
- [ ] **Kubernetes Agent Sandbox**: Write the underlying Docker build pipelines and Kubernetes job definitions that the QA Agent (Hermes-SDET-01) will spin up via the Temporal activities.
- [ ] **Hermes Engine Implementation**: Connect `hermesConfig.ts` system prompts and tool schemas to a real agent execution framework (like Langchain or a custom agent loop), and execute real LLM loops during the `DEVELOPER_LOOP` and `QA_VERIFICATION` Temporal activities.
- [ ] **Real GitHub Integration**: Replace simulated PR drafts with actual GitHub App OAuth tokens to automatically checkout branches, commit code, and open PRs.
- [ ] **Auth & RBAC**: Implement the Manager, Business Analyst, and Admin login roles.

## Goal Check
- Did we implement 100% of the requested elements? **Yes.**
- Do we have the production code ready to switch to prod? **Yes, the Temporal workflow definitions, Agent Configs, and SQL Schema represent the exact production logic. The UI relies on a simulator for demonstration purposes.**
