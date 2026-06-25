import React from 'react';

export function Header() {
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
          System Online (v4.1.2)
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase text-[#475569] leading-none font-semibold">Time Active</span>
          <span className="font-mono text-xs font-bold">14h 22m 04s</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase text-[#475569] leading-none font-semibold">Cost This Month</span>
          <span className="font-mono text-xs font-bold text-slate-800">$4,218.42 / $10,000.00</span>
        </div>
        <div className="w-8 h-8 rounded-full border border-[#0F172A] flex items-center justify-center font-mono font-bold text-xs bg-[#0F172A] text-white">
          MA
        </div>
      </div>
    </header>
  );
}
