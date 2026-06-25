import React from 'react';
import { LogOut } from 'lucide-react';
import { AuthUser, LedgerSummary } from '../types';

interface HeaderProps {
  user: AuthUser | null;
  ledgerSummary: LedgerSummary;
  onLogout: () => void;
}

function initialsFor(user: AuthUser | null) {
  if (!user) return "??";
  const parts = user.fullName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return user.email.substring(0, 2).toUpperCase();
}

export function Header({ user, ledgerSummary, onLogout }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-bold tracking-tighter text-xl">
          <div className="w-6 h-6 bg-[#0F172A] rounded-sm flex items-center justify-center text-white text-[11px] font-mono">H</div>
          <span>HERMES</span>
        </div>
        <div className="h-4 w-px bg-[#E2E8F0]"></div>
        <div className="text-xs font-mono text-[#475569] uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Backend Online
        </div>
      </div>

      <div className="flex gap-6 items-center">
        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase text-[#475569] leading-none font-semibold">Signed In</span>
          <span className="font-mono text-xs font-bold">{user?.role.replace("_", " ")}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase text-[#475569] leading-none font-semibold">Recorded Cost</span>
          <span className="font-mono text-xs font-bold text-slate-800">${ledgerSummary.totalActualCost.toFixed(5)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-[#0F172A] flex items-center justify-center font-mono font-bold text-xs bg-[#0F172A] text-white">
            {initialsFor(user)}
          </div>
          <button
            onClick={onLogout}
            className="w-8 h-8 border border-[#E2E8F0] bg-white flex items-center justify-center text-slate-600 hover:text-slate-900"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
