import React, { useState } from 'react';
import { Monitor, X, Play, Terminal } from 'lucide-react';

interface PipelineTabProps {
  taskInput: string;
  branchName?: string;
  pipelineState: any;
  setPipelineState: any;
  handleRollback: () => void;
  handleApproveMerge: () => void;
  handleDispatchJob: () => void;
  isDispatching: boolean;
  logsEndRef: any;
  setActiveTab: (tab: "dispatcher" | "pipeline" | "audit" | "ledger" | "schemas" | "settings" | "history") => void;
  canReview: boolean;
}

export function PipelineTab({
  taskInput,
  branchName,
  pipelineState,
  setPipelineState,
  handleRollback,
  handleApproveMerge,
  handleDispatchJob,
  isDispatching,
  logsEndRef,
  setActiveTab,
  canReview
}: PipelineTabProps) {
  const [isDropInOpen, setIsDropInOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      
      {/* Drop-In Modal Overlay */}
      {isDropInOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-full max-h-[80vh] flex flex-col rounded shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Live Agent Drop-In Session
                </span>
              </div>
              <button 
                onClick={() => setIsDropInOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex min-h-0">
              {/* Virtual Browser View */}
              <div className="flex-1 border-r border-slate-800 flex flex-col bg-white">
                <div className="h-8 border-b border-slate-200 bg-slate-100 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  </div>
                  <div className="flex-1 mx-4 bg-white border border-slate-200 rounded text-[10px] px-2 py-0.5 font-mono text-slate-500">
                    http://localhost:3000/sandbox
                  </div>
                </div>
                <div className="flex-1 p-8 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute top-4 left-4 right-4 bottom-4 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400">
                    <Monitor className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-mono text-sm">Waiting for agent to render UI components...</p>
                  </div>
                  {/* Simulated cursor */}
                  <div className="absolute top-1/2 left-1/2 w-4 h-4 text-blue-500 z-10 animate-bounce">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                      <path d="M7 2l12 11.2l-5.8.5l3.3 7.3l-2.2.9l-3.2-7.4L7 18.5z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Live Terminal / Editor View */}
              <div className="w-96 flex flex-col bg-[#1E1E1E]">
                <div className="h-8 border-b border-black bg-[#2D2D2D] flex items-center px-4">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Agent Terminal</span>
                </div>
                <div className="flex-1 p-4 font-mono text-xs text-emerald-400 overflow-y-auto space-y-1">
                  <div>$ npm run test:e2e</div>
                  <div className="text-slate-400">Starting Playwright...</div>
                  <div className="text-yellow-400">Navigating to /sandbox</div>
                  <div>Locating input field #email...</div>
                  <div>Typing test user credentials...</div>
                  <div className="animate-pulse flex items-center gap-2 mt-4">
                    <div className="w-2 h-4 bg-emerald-400"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* Task Summary Banner */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#E2E8F0] bg-white">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">
              Task: {taskInput}
            </h1>
            <span className="text-xs bg-[#E2E8F0] px-1.5 py-0.5 font-mono">
              {branchName || "no-branch-yet"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[#475569]">Status:</span>
            <span className="text-xs font-mono font-bold uppercase text-blue-600">
              {pipelineState.runningText}
            </span>
          </div>
        </div>

        <div className="flex gap-2 font-mono">
          {pipelineState.terminalStatus === "PR_DRAFT" && canReview && (
            <>
              <button
                onClick={handleRollback}
                className="px-3 py-1.5 border border-red-600 text-red-600 text-xs font-bold hover:bg-red-50"
              >
                1-CLICK UNDO
              </button>
              <button
                onClick={handleApproveMerge}
                className="px-3 py-1.5 bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800"
              >
                APPROVE & MERGE
              </button>
            </>
          )}
          {pipelineState.terminalStatus === "PR_DRAFT" && !canReview && (
            <span className="px-3 py-1.5 border border-[#E2E8F0] text-slate-500 text-xs font-bold">
              MANAGER REVIEW REQUIRED
            </span>
          )}
          {pipelineState.terminalStatus === "IDLE" && (
            <button
              onClick={handleDispatchJob}
              className="px-4 py-1.5 bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800"
            >
              START TASK
            </button>
          )}
        </div>
      </div>

      {/* Progress Horizontal Pipeline */}
      <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] grid grid-cols-7 gap-1">
        {[
          { index: 1, name: "01. PLAN" },
          { index: 2, name: "02. QUEUE" },
          { index: 3, name: "03. BUILD" },
          { index: 4, name: "04. TEST" },
          { index: 5, name: "05. FIX" },
          { index: 6, name: "06. REVIEW" },
          { index: 7, name: "07. DONE" }
        ].map((step) => {
          const isActive = pipelineState.phaseIndex === step.index;
          const isCompleted = pipelineState.phaseIndex > step.index || pipelineState.terminalStatus === "COMPLETED";
          
          let barBg = "bg-[#E2E8F0]";
          let textColor = "text-[#475569] opacity-40";
          if (isActive) {
            barBg = "bg-blue-600";
            textColor = "text-blue-600 font-bold";
          } else if (isCompleted) {
            barBg = "bg-slate-900";
            textColor = "text-slate-900 font-bold";
          }

          return (
            <div key={step.index} className="flex flex-col gap-2 relative">
              <div className={`h-1.5 ${barBg} transition-all duration-300`}></div>
              <span className={`text-[9px] font-mono tracking-wider ${textColor}`}>
                {step.name}
              </span>
              {isActive && (
                <div className="absolute -top-1.5 right-0 w-3 h-3 rounded-full bg-blue-600 animate-ping"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive terminal and execution splits */}
      <div className="flex-1 flex min-h-0 bg-slate-950">
        
        {/* Left: Terminal Output Stream */}
        <div className="flex-1 flex flex-col border-r border-slate-800">
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
              System Logs
            </span>
            <span className="text-[10px] font-mono text-blue-400 animate-pulse font-bold">
              {pipelineState.terminalStatus}
            </span>
          </div>

          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto leading-relaxed text-slate-300 space-y-1">
            {pipelineState.logs.map((log: string, i: number) => (
              <div key={i} className="whitespace-pre-wrap">
                {log.startsWith("[ERROR]") ? (
                  <span className="text-red-400 font-bold">{log}</span>
                ) : log.includes("FAILED") ? (
                  <span className="text-amber-400 font-bold">{log}</span>
                ) : log.includes("PASS") || log.includes("passed") ? (
                  <span className="text-emerald-400 font-bold">{log}</span>
                ) : log.startsWith("[AGENT") ? (
                  <span className="text-blue-400 font-bold">{log}</span>
                ) : (
                  <span>{log}</span>
                )}
              </div>
            ))}
            {isDispatching && (
              <div className="flex items-center gap-2 text-slate-400 mt-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                <span className="italic">Running AI agents...</span>
              </div>
            )}
            <div ref={logsEndRef}></div>
          </div>
        </div>

        {/* Right Panel: Side Status overview */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col p-4 text-slate-300 justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                Task Progress
              </h3>
              <div className="mt-3 space-y-3">
                <div className="flex justify-between items-end border-b border-slate-800 pb-1">
                  <span className="text-xs text-slate-400">Attempt Limit:</span>
                  <span className="font-mono text-xs text-white font-bold">
                    {pipelineState.activeIterationIndex} / 3 Max
                  </span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-800 pb-1">
                  <span className="text-xs text-slate-400">Current Phase:</span>
                  <span className="font-mono text-xs text-blue-400 font-bold">
                    {pipelineState.terminalStatus}
                  </span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-800 pb-1">
                  <span className="text-xs text-slate-400">Environment:</span>
                  <span className="font-mono text-xs text-white">
                    Secure Sandbox
                  </span>
                </div>
              </div>
            </div>

            {pipelineState.jobData && (
              <div className="p-3 border border-slate-800 bg-slate-950 space-y-2">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">
                  TASK COMPLETED
                </span>
                <div className="text-xs font-bold text-white leading-tight">
                  {pipelineState.jobData.finalPr.prTitle}
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {pipelineState.jobData.finalPr.prDescription.substring(0, 140)}...
                </p>
                <div className="text-xs text-slate-300 font-mono">
                  ✓ Test Coverage: {pipelineState.jobData.finalPr.testCoverage}%
                </div>
              </div>
            )}
          </div>

          {/* Quick Audit Actions */}
          <div className="pt-4 border-t border-slate-800">
            <span className="text-[9px] font-mono text-slate-500 block uppercase mb-2">
              Interactive Controls
            </span>
            <div className="grid grid-cols-1 gap-2 font-mono">
              {isDispatching && (
                <button
                  onClick={() => setIsDropInOpen(true)}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold text-center border border-blue-500 flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.3)] animate-pulse"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  LIVE DROP-IN
                </button>
              )}
              {pipelineState.jobData && (
                <button
                  onClick={() => setActiveTab("audit")}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-center border border-slate-700 uppercase"
                >
                  Review Code Changes
                </button>
              )}
              <button
                onClick={() => {
                  setPipelineState({
                    phaseIndex: 0,
                    runningText: "READY FOR TASK",
                    jobData: null,
                    activeIterationIndex: 1,
                    logs: ["[System State]: Reset completed. Ready to start new task..."],
                    terminalStatus: "IDLE"
                  });
                }}
                className="w-full py-1.5 bg-transparent hover:bg-slate-800 text-xs text-slate-400 text-center border border-slate-800 uppercase"
              >
                Reset Status
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
