import React from 'react';
import { PipelineJob } from '../types';

interface AuditTabProps {
  jobData: PipelineJob;
  onRollback: () => void;
  onApproveMerge: () => void;
}

export function AuditTab({ jobData, onRollback, onApproveMerge }: AuditTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* PR Banner Header */}
      <div className="px-6 py-4 border-b border-[#E2E8F0] bg-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 font-bold uppercase">
              PULL REQUEST PREVIEW
            </span>
            <h1 className="text-base font-bold text-slate-900">
              {jobData.finalPr.prTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Branch: {jobData.gitBranch} • Total Cost: ${jobData.finalPr.actualCost.toFixed(5)} USD
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onRollback}
            className="px-3 py-1.5 border border-red-600 text-red-600 text-xs font-bold font-mono hover:bg-red-50"
          >
            UNDO CHANGES
          </button>
          <button
            onClick={onApproveMerge}
            className="px-3 py-1.5 bg-[#0F172A] text-white text-xs font-bold font-mono hover:bg-slate-800"
          >
            APPROVE & MERGE
          </button>
        </div>
      </div>

      {/* Split Diff Panel */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left Pane: Code Patch Diff */}
        <div className="w-1/2 border-r border-[#E2E8F0] flex flex-col bg-slate-50 overflow-hidden">
          <div className="px-4 py-2 bg-white border-b border-[#E2E8F0] flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase text-[#475569] font-mono">
              Code Changes
            </span>
            <span className="text-[10px] font-mono text-green-600 font-bold">
              + Fixed Issues
            </span>
          </div>

          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto leading-relaxed space-y-1 bg-[#F8FAFC]">
            {jobData.iterations.map((it, idx) => (
              <div key={idx} className="mb-6">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">
                  Attempt {it.iterationIndex} Code Changes: {it.developerAction}
                </div>
                <pre className="p-3 bg-white border border-slate-200 text-slate-800 overflow-x-auto whitespace-pre">
                  {it.codeDiff.split("\n").map((line, lIdx) => {
                    let lineBg = "";
                    if (line.startsWith("+")) lineBg = "bg-green-50 text-green-700 font-bold";
                    if (line.startsWith("-")) lineBg = "bg-red-50 text-red-700 line-through";
                    return (
                      <div key={lIdx} className={`${lineBg} px-1 rounded-sm`}>
                        {line}
                      </div>
                    );
                  })}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: XML Test Log schemas */}
        <div className="w-1/2 flex flex-col bg-slate-900 overflow-hidden">
          <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-bold uppercase font-mono">
              Test Results
            </span>
            <span className="text-[10px] font-mono text-blue-400">
              Passed
            </span>
          </div>

          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto leading-relaxed text-slate-300 bg-slate-950">
            {jobData.iterations.map((it, idx) => (
              <div key={idx} className="mb-6">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Attempt {it.iterationIndex} Test Results (Status: {it.status})
                </div>
                <pre className="p-3 bg-slate-900 text-slate-400 border border-slate-800 overflow-x-auto whitespace-pre text-[11px]">
                  {it.testResultsXml}
                </pre>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
