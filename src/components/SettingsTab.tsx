import React from 'react';
import { Settings, Code, FileText, Terminal, User, Plus } from 'lucide-react';

export function SettingsTab() {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800" />
            Platform Settings & Integrations
          </h1>
          <p className="text-sm text-[#475569] mt-2">Manage API keys, external task systems, source code, and user access.</p>
        </div>

        <div className="space-y-8">
          {/* Source Control Integrations */}
          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4" /> Source Code
            </h2>
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">GitHub App</div>
                  <div className="text-xs text-[#475569]">Required for the Developer AI to create branches and Pull Requests.</div>
                </div>
                <button className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                  Connect GitHub
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">GitLab Integration</div>
                  <div className="text-xs text-[#475569]">Support for GitLab code repositories.</div>
                </div>
                <button className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                  Connect GitLab
                </button>
              </div>
            </div>
          </div>

          {/* ALM & Ticketing */}
          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Task Tracking
            </h2>
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Jira Integration</div>
                  <div className="text-xs text-[#475569]">Automatically import Jira tickets as tasks.</div>
                </div>
                <button className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                  Connect Jira
                </button>
              </div>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Linear</div>
                  <div className="text-xs text-[#475569]">Automatically assign Linear tickets to AI agents.</div>
                </div>
                <button className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                  Add API Key
                </button>
              </div>
            </div>
          </div>

          {/* Build & CI Systems */}
          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Deployments
            </h2>
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Jenkins</div>
                  <div className="text-xs text-[#475569]">Trigger Jenkins builds when tests pass.</div>
                </div>
                <button className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                  Setup Webhook
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Vercel / AWS Amplify</div>
                  <div className="text-xs text-[#475569]">Create live previews of your new code.</div>
                </div>
                <button className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                  Connect Hosting
                </button>
              </div>
            </div>
          </div>

          {/* Access & User Management */}
          <div className="border border-[#E2E8F0] p-6 bg-white">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" /> Users & Roles
            </h2>
            
            <table className="w-full text-left text-sm mt-4">
              <thead className="bg-[#F8FAFC] text-slate-700 text-xs uppercase font-bold">
                <tr>
                  <th className="px-3 py-2 border border-[#E2E8F0]">User Email</th>
                  <th className="px-3 py-2 border border-[#E2E8F0]">Role</th>
                  <th className="px-3 py-2 border border-[#E2E8F0]">Status</th>
                  <th className="px-3 py-2 border border-[#E2E8F0]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[#475569]">
                <tr>
                  <td className="px-3 py-2 border border-[#E2E8F0] font-mono text-xs">admin@hermes.io</td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">
                    <span className="bg-[#0F172A] text-white px-2 py-0.5 text-[10px] font-bold">Admin</span>
                  </td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">Active</td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">
                    <button className="text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-[#E2E8F0] font-mono text-xs">manager@hermes.io</td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">
                    <span className="bg-[#F8FAFC] border border-[#E2E8F0] text-slate-700 px-2 py-0.5 text-[10px] font-bold">Manager</span>
                  </td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">Active</td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">
                    <button className="text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-[#E2E8F0] font-mono text-xs">analyst@hermes.io</td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">
                    <span className="bg-[#F8FAFC] border border-[#E2E8F0] text-slate-700 px-2 py-0.5 text-[10px] font-bold">Business Analyst</span>
                  </td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">Invited</td>
                  <td className="px-3 py-2 border border-[#E2E8F0]">
                    <button className="text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <button className="mt-4 px-4 py-2 bg-[#0F172A] text-white text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> Invite User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
