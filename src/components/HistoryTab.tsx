import React from 'react';
import { List, Search, RotateCcw, Cpu } from 'lucide-react';
import { JobHistory } from '../types';

export function HistoryTab({ jobHistoryData, onRefresh }: { jobHistoryData: JobHistory[]; onRefresh: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <List className="w-5 h-5 text-slate-800" />
              Task History & Queue
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track the status of all past, active, and queued AI tasks.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-[#E2E8F0] bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1">
              <Search className="w-3.5 h-3.5" /> Filter
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {jobHistoryData.map((job) => (
            <div key={job.id} className="border border-[#E2E8F0] bg-white p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-400 font-bold">{job.id}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      job.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                      job.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800 animate-pulse" :
                      job.status === "QUEUED" ? "bg-slate-100 text-slate-600" :
                      job.status === "ROLLED_BACK" ? "bg-red-100 text-red-800" :
                      "bg-orange-100 text-orange-800"
                    }`}>
                      {job.status.replace("_", " ")}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{job.task}</h3>
                </div>
                <div className="text-right text-xs font-mono text-slate-500">
                  <div>Sub: {job.submittedAt}</div>
                  {job.completedAt && <div>End: {job.completedAt}</div>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#E2E8F0]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Phase</span>
                  <div className="text-xs font-medium text-slate-700 mt-0.5">{job.phase}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Agent</span>
                  <div className="text-xs font-medium text-slate-700 mt-0.5 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    {job.assignedTo}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
