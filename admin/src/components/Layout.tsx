import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full font-sans text-[#0f172a] bg-[#f8fafc]">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[#e2e8f0] bg-white shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-[#0f172a] hover:bg-[#f1f5f9]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-extrabold text-[15px] text-[#0f172a]">SofDom Admin</span>
          <div className="w-8" />
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 md:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
