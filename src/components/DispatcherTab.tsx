import React from 'react';
import { Cpu, Code, ShieldCheck, Play } from 'lucide-react';

interface DispatcherTabProps {
  taskInput: string;
  setTaskInput: (val: string) => void;
  devRoleInput: string;
  setDevRoleInput: (val: string) => void;
  qaRoleInput: string;
  setQaRoleInput: (val: string) => void;
  estimatedCost: {
    estimatedCost: number;
    inputTokens: number;
    outputTokens: number;
    computeMs: number;
    isComplex: boolean;
  };
  fetchEstimate: () => void;
  isDispatching: boolean;
  handleDispatchJob: () => void;
}

export function DispatcherTab({
  taskInput,
  setTaskInput,
  devRoleInput,
  setDevRoleInput,
  qaRoleInput,
  setQaRoleInput,
  estimatedCost,
  fetchEstimate,
  isDispatching,
  handleDispatchJob
}: DispatcherTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-slate-800" />
          Create a New AI Task
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Specify goals, set limits, and write instructions for the AI agents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Elements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-[#E2E8F0] p-4 bg-white">
            <label className="block text-xs font-bold uppercase text-[#475569] mb-1.5 tracking-wider">
              1. Task Instructions
            </label>
            <textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              rows={4}
              className="w-full border border-[#E2E8F0] p-3 text-sm font-mono focus:outline-none focus:border-[#0F172A] bg-[#F8FAFC]"
              placeholder="e.g. Implement robust Stripe payment webhook with raw body verification and signature validation checks."
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-slate-400">
                The agents will automatically generate code and tests based on these instructions.
              </span>
              <button 
                onClick={fetchEstimate}
                className="text-xs font-mono font-bold underline text-slate-700 hover:text-black"
              >
                Recalculate Estimate
              </button>
            </div>
          </div>

          {/* Sub-Agent Config Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Developer Agent Prompt Tuning */}
            <div className="border border-[#E2E8F0] p-4 bg-white">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E2E8F0]">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-mono">
                  <Code className="w-3.5 h-3.5" /> Developer AI
                </span>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1 py-0.5 font-bold">DEVELOPER</span>
              </div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Developer AI Instructions
              </label>
              <textarea
                value={devRoleInput}
                onChange={(e) => setDevRoleInput(e.target.value)}
                rows={4}
                className="w-full border border-[#E2E8F0] p-2 text-xs font-mono focus:outline-none focus:border-black bg-white"
              />
            </div>

            {/* QA Agent Prompt Tuning */}
            <div className="border border-[#E2E8F0] p-4 bg-white">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E2E8F0]">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" /> QA Tester AI
                </span>
                <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1 py-0.5 font-bold">TESTER</span>
              </div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                QA Tester AI Instructions
              </label>
              <textarea
                value={qaRoleInput}
                onChange={(e) => setQaRoleInput(e.target.value)}
                rows={4}
                className="w-full border border-[#E2E8F0] p-2 text-xs font-mono focus:outline-none focus:border-black bg-white"
              />
            </div>

          </div>

          {/* Dispatch Controls */}
          <div className="border border-[#0F172A] bg-[#F8FAFC] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-900 font-mono">
                Ready to start the task.
              </div>
              <p className="text-xs text-slate-500">
                This will run the developer and QA agents sequentially.
              </p>
            </div>
            <button
              onClick={handleDispatchJob}
              disabled={isDispatching}
              className="px-6 py-2.5 bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              {isDispatching ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Starting Task...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Task</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: Micro-Economic Estimator Specs */}
        <div className="space-y-4">
          
          <div className="border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Cost & Time Estimate
            </h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-end justify-between border-b border-[#E2E8F0] pb-2">
                <span className="text-slate-500 text-xs">Estimated Cost</span>
                <span className="text-2xl font-mono font-bold text-slate-900">
                  ${estimatedCost.estimatedCost.toFixed(5)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">
                    Input Tokens
                  </span>
                  <span className="font-bold text-slate-800">
                    {(estimatedCost.inputTokens / 1000).toFixed(1)}k tokens
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">
                    Output Tokens
                  </span>
                  <span className="font-bold text-slate-800">
                    {(estimatedCost.outputTokens / 1000).toFixed(1)}k tokens
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">
                    Compute Runtime
                  </span>
                  <span className="font-bold text-slate-800">
                    {(estimatedCost.computeMs / 1000).toFixed(1)} seconds
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">
                    Task Complexity
                  </span>
                  <span className={`font-bold uppercase ${estimatedCost.isComplex ? "text-amber-600" : "text-emerald-600"}`}>
                    {estimatedCost.isComplex ? "HIGH" : "NORMAL"}
                  </span>
                </div>
              </div>

              <div className="p-2 border border-slate-200 bg-white text-[11px] text-slate-500 leading-relaxed font-mono">
                Pricing basis: <br/>
                - Input: $0.075 / million <br/>
                - Output: $0.300 / million <br/>
                - Compute: $0.000016 / ms
              </div>
            </div>
          </div>

          <div className="border border-[#E2E8F0] p-4 text-xs space-y-3 bg-white text-slate-600 leading-relaxed">
            <h4 className="font-bold text-[#0F172A] uppercase">Security Policies</h4>
            <p>
              Tasks are executed in a secure environment with no external network access to prevent unauthorized code execution.
            </p>
            <div className="flex items-center gap-1 text-emerald-700 font-bold font-mono">
              <ShieldCheck className="w-4 h-4" /> SECURE EXECUTION
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
