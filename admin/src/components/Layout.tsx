import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full font-sans text-[#1a1f25] bg-white">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Верхняя панель с гамбургером (только на узком экране) */}
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[#ececec] bg-white shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 p-1.5 rounded-[9px] text-[#1a1f25] hover:bg-[#f2f3f5]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-bold text-[15px] text-[#111418]">SofDom Admin</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 md:px-[34px] pt-5 md:pt-[26px] pb-10 md:pb-[44px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
