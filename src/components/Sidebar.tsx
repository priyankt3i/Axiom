import React from 'react';
import {
  Plus,
  Activity,
  List,
  FileText,
  TrendingUp,
  Database,
  Settings
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: "dispatcher" | "pipeline" | "audit" | "ledger" | "schemas" | "settings" | "history") => void;
  pipelineState: any; // We can type this better later if needed
}

export function Sidebar({ activeTab, setActiveTab, pipelineState }: SidebarProps) {
  return (
    <aside className="w-56 border-r border-[#E2E8F0] bg-[#F8FAFC] flex flex-col p-4 gap-1">
      <div className="text-[10px] font-bold text-[#475569] uppercase mb-2 px-2 tracking-wider">Tasks</div>
      <button
        onClick={() => setActiveTab("dispatcher")}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "dispatcher"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </div>
      </button>
      
      <button
        onClick={() => setActiveTab("pipeline")}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "pipeline"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>Active Task</span>
          </div>
          {pipelineState.terminalStatus !== "IDLE" && (
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          )}
        </div>
      </button>

      <button
        onClick={() => setActiveTab("history")}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "history"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center gap-2">
          <List className="w-4 h-4" />
          <span>Task History</span>
        </div>
      </button>

      <button
        onClick={() => {
          if (pipelineState.jobData) {
            setActiveTab("audit");
          } else {
            alert("Please create and run a task first to inspect the code changes and logs.");
          }
        }}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          !pipelineState.jobData ? "opacity-40 cursor-not-allowed" : ""
        } ${
          activeTab === "audit"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span>Review Pull Request</span>
        </div>
      </button>

      <div className="text-[10px] font-bold text-[#475569] uppercase mt-6 mb-2 px-2 tracking-wider">Analytics & Settings</div>
      
      <button
        onClick={() => setActiveTab("ledger")}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "ledger"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span>Cost Tracking</span>
        </div>
      </button>

      <button
        onClick={() => setActiveTab("schemas")}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "schemas"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          <span>Database Tables</span>
        </div>
      </button>

      <button
        onClick={() => setActiveTab("settings")}
        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "settings"
            ? "bg-[#0F172A] text-white font-bold"
            : "text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </div>
      </button>

      <div className="mt-auto border-t border-[#E2E8F0] pt-4 px-2 text-[10px] font-mono text-[#475569] leading-relaxed">
        <div className="font-bold text-[#0F172A]">Hermes-O Cloud</div>
        v4.1.2-stable <br/>
        Engine: Gemini-3.5-Flash
      </div>
    </aside>
  );
}
