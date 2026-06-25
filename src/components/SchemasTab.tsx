import React from 'react';
import { Database } from 'lucide-react';

export function SchemasTab() {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-800" />
          Database Tables
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tracking structure for tasks, agent costs, and code review history.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* 1. Job table spec */}
        <div className="border border-[#E2E8F0] bg-white">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex justify-between items-center">
            <span className="font-mono text-xs font-bold text-[#0F172A]">
              TABLE: jobs
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              Database Table
            </span>
          </div>

          <div className="p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono">
                  <th className="pb-2 font-semibold">Column</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold">Constraint</th>
                  <th className="pb-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 text-slate-900 font-bold">id</td>
                  <td className="py-2 text-blue-600">UUID</td>
                  <td className="py-2 text-slate-500">PRIMARY KEY</td>
                  <td className="py-2 text-slate-600 font-sans">Unique job identifier.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">creator_id</td>
                  <td className="py-2 text-blue-600">UUID</td>
                  <td className="py-2 text-slate-500">FOREIGN KEY</td>
                  <td className="py-2 text-slate-600 font-sans">User who created the task.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">description</td>
                  <td className="py-2 text-blue-600">TEXT</td>
                  <td className="py-2 text-slate-500">NOT NULL</td>
                  <td className="py-2 text-slate-600 font-sans">Plain text task description.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">current_phase</td>
                  <td className="py-2 text-blue-600">VARCHAR(60)</td>
                  <td className="py-2 text-slate-500">DEFAULT 'START'</td>
                  <td className="py-2 text-slate-600 font-sans">Tracks current state of the task.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">branch_name</td>
                  <td className="py-2 text-blue-600">VARCHAR(255)</td>
                  <td className="py-2 text-slate-500">UNIQUE</td>
                  <td className="py-2 text-slate-600 font-sans">Isolated git branch assigned to the Developer AI.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Financial ledger spec */}
        <div className="border border-[#E2E8F0] bg-white">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex justify-between items-center">
            <span className="font-mono text-xs font-bold text-[#0F172A]">
              TABLE: costs
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              Cost Tracking Table
            </span>
          </div>

          <div className="p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono">
                  <th className="pb-2 font-semibold">Column</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold">Constraint</th>
                  <th className="pb-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 text-slate-900 font-bold">id</td>
                  <td className="py-2 text-blue-600">UUID</td>
                  <td className="py-2 text-slate-500">PRIMARY KEY</td>
                  <td className="py-2 text-slate-600 font-sans">Cost entry key.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">task_id</td>
                  <td className="py-2 text-blue-600">UUID</td>
                  <td className="py-2 text-slate-500">FOREIGN KEY</td>
                  <td className="py-2 text-slate-600 font-sans">Links directly to active task record.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">estimated_cost</td>
                  <td className="py-2 text-blue-600">NUMERIC(10,5)</td>
                  <td className="py-2 text-slate-500">NOT NULL</td>
                  <td className="py-2 text-slate-600 font-sans">Estimated API cost.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">actual_cost</td>
                  <td className="py-2 text-blue-600">NUMERIC(10,5)</td>
                  <td className="py-2 text-slate-500">DEFAULT 0.00</td>
                  <td className="py-2 text-slate-600 font-sans">Final calculated API cost.</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-900 font-bold">duration</td>
                  <td className="py-2 text-blue-600">INTEGER</td>
                  <td className="py-2 text-slate-500">NOT NULL</td>
                  <td className="py-2 text-slate-600 font-sans">Time taken to run code tests.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. DDL Script view */}
        <div className="border border-[#E2E8F0] bg-slate-950 p-4 font-mono text-xs text-slate-300">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">
            DATABASE CREATION SQL
          </div>
          <pre className="overflow-x-auto whitespace-pre text-[11px] leading-relaxed text-slate-400">
{`-- Create table schema mapping
CREATE TYPE task_phase AS ENUM ('START', 'QUEUED', 'DEVELOPING', 'TESTING', 'FIXING_BUGS', 'PR_OPEN', 'DONE', 'ROLLED_BACK');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  current_phase task_phase NOT NULL DEFAULT 'START',
  branch_name VARCHAR(255) UNIQUE,
  repository VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`}
          </pre>
        </div>

      </div>
    </div>
  );
}
