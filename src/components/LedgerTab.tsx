import React, { useState } from 'react';
import { DollarSign, Search } from 'lucide-react';
import { LedgerEntry, LedgerSummary } from '../types';

export function LedgerTab({
  ledgerData,
  summary,
  canView
}: {
  ledgerData: LedgerEntry[];
  summary: LedgerSummary;
  canView: boolean;
}) {
  const [searchLedger, setSearchLedger] = useState("");

  if (!canView) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="border border-[#E2E8F0] bg-[#F8FAFC] p-6 max-w-md">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Ledger Restricted
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Financial ledger access is available to Manager and Administrator roles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      
      {/* Financial Title Banner */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-slate-800" />
            Cost & Budget Tracking
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            History of AI cost, task time, and estimated vs. actual costs.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase text-[#475569] font-bold">TOTAL YEAR-TO-DATE COST</span>
          <div className="text-2xl font-mono font-bold">${summary.totalActualCost.toFixed(5)}</div>
        </div>
      </div>

      {/* Grid of Micro stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
          <span className="text-[10px] font-bold text-[#475569] uppercase">API Status</span>
          <div className="text-lg font-mono font-bold text-emerald-700 mt-1">ACTIVE</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Backend Ledger</span>
        </div>

        <div className="border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
          <span className="text-[10px] font-bold text-[#475569] uppercase">Total Tasks</span>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{summary.totalJobs}</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Persisted records</span>
        </div>

        <div className="border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
          <span className="text-[10px] font-bold text-[#475569] uppercase">Success Rate</span>
          <div className="text-lg font-mono font-bold text-blue-600 mt-1">{summary.successRate.toFixed(1)}% Passed</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Terminal jobs only</span>
        </div>

        <div className="border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
          <span className="text-[10px] font-bold text-[#475569] uppercase">Completed</span>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{summary.completedJobs}</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Approved merges</span>
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchLedger}
            onChange={(e) => setSearchLedger(e.target.value)}
            placeholder="Search costs by task name..."
            className="w-full pl-9 pr-3 py-1.5 border border-[#E2E8F0] text-xs font-mono focus:outline-none focus:border-black"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {ledgerData.length} entries
        </div>
      </div>

      {/* Consumption Table */}
      <div className="border border-[#E2E8F0] bg-white overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-mono">
              <th className="p-3 font-semibold">Job ID</th>
              <th className="p-3 font-semibold">Task Name</th>
              <th className="p-3 font-semibold">Branch</th>
              <th className="p-3 font-semibold text-right">Estimated Cost</th>
              <th className="p-3 font-semibold text-right">Actual Cost</th>
              <th className="p-3 font-semibold text-center">Tokens (In/Out)</th>
              <th className="p-3 font-semibold">Date</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] font-mono">
            {ledgerData
              .filter(item => item.task.toLowerCase().includes(searchLedger.toLowerCase()))
              .map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-400 font-bold">{item.id}</td>
                  <td className="p-3 text-slate-800 font-sans font-bold">{item.task}</td>
                  <td className="p-3 text-slate-600">{item.branch}</td>
                  <td className="p-3 text-right text-slate-500">${item.estimatedCost.toFixed(5)}</td>
                  <td className="p-3 text-right font-bold text-slate-900">${item.actualCost.toFixed(5)}</td>
                  <td className="p-3 text-center text-slate-500">{item.tokens}</td>
                  <td className="p-3 text-slate-500">{item.date}</td>
                  <td className="p-3">
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold ${
                      item.status === "COMPLETED" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : item.status === "REVIEW_READY" || item.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                    }`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
