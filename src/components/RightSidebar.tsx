import React from 'react';
import { Server } from 'lucide-react';

interface RightSidebarProps {
  pipelineState: any; // Using any for now to simplify typing
}

export function RightSidebar({ pipelineState }: RightSidebarProps) {
  return (
    <aside className="w-64 border-l border-[#E2E8F0] flex flex-col bg-[#F8FAFC] p-4 gap-4 overflow-y-auto">
      
      {/* Section 1: Running agents */}
      <div>
        <h3 className="text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">
          Active AI Agents
        </h3>
        <div className="space-y-2">
          
          <div className="p-3 border border-[#E2E8F0] bg-white">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-900 font-mono">Developer AI</span>
              <span className={`text-[9px] font-mono font-bold ${
                pipelineState.terminalStatus === "DEVELOPING" || pipelineState.terminalStatus === "RESOLVING"
                  ? "text-blue-600 animate-pulse"
                  : "text-slate-500"
              }`}>
                {pipelineState.terminalStatus === "DEVELOPING" || pipelineState.terminalStatus === "RESOLVING" ? "WORKING" : "IDLE"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Writes code, fixes bugs, and creates new features in isolation.
            </p>
            <div className="w-full bg-[#F8FAFC] h-1.5 mt-2 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${
                pipelineState.terminalStatus === "DEVELOPING" || pipelineState.terminalStatus === "RESOLVING" ? "bg-blue-500 w-full" : "bg-emerald-500 w-full"
              }`}></div>
            </div>
          </div>

          <div className="p-3 border border-[#0F172A] bg-white">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-900 font-mono">QA Tester AI</span>
              <span className={`text-[9px] font-mono font-bold ${
                pipelineState.terminalStatus === "TESTING"
                  ? "text-blue-600 animate-pulse"
                  : "text-slate-500"
              }`}>
                {pipelineState.terminalStatus === "TESTING" ? "TESTING" : "IDLE"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Runs code, tests for errors, and provides feedback to the developer.
            </p>
            <div className="w-full bg-[#F8FAFC] h-1.5 mt-2 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${
                pipelineState.terminalStatus === "TESTING" ? "bg-blue-500 w-[65%]" : "bg-emerald-500 w-full"
              }`}></div>
            </div>
          </div>

        </div>
      </div>

      <div className="h-px bg-[#E2E8F0]"></div>

      {/* Section 2: Real-time Infrastructure diagnostics */}
      <div>
        <h3 className="text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">
          System Status
        </h3>
        <div className="space-y-3 font-mono text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Workflow Server:</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Server className="w-3 h-3" /> ONLINE
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Test Environment:</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Server className="w-3 h-3" /> READY
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Network Security:</span>
            <span className="text-amber-700 font-bold">SECURE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Data Encryption:</span>
            <span className="text-slate-800">AES-256</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-[#E2E8F0]"></div>

      {/* Section 3: Rollback Protection Notice */}
      <div>
        <h3 className="text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">
          Safety Rules
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
          The AI agents have a maximum of 3 attempts to fix errors.
        </p>
        <p className="font-semibold text-slate-700 text-[11px]">
          If tests still fail, changes are automatically undone (rolled back).
        </p>
      </div>

    </aside>
  );
}
