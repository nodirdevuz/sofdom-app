import { NavLink } from 'react-router-dom';
import { navItems } from '../nav';
import { useAuth } from '../auth';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const itemBase =
  'flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[14px] font-medium cursor-pointer transition-colors no-underline';

function itemClass(active: boolean): string {
  return active
    ? `${itemBase} bg-[#10b981]/10 text-[#059669] font-semibold border border-[#10b981]/20`
    : `${itemBase} bg-transparent text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]`;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onClose}
          aria-hidden
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[260px] max-w-[82vw] shrink-0 border-r border-[#e2e8f0] bg-[#ffffff] flex flex-col h-full overflow-y-auto transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 pt-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white flex items-center justify-center font-extrabold text-xl shadow-sm shadow-emerald-500/20 shrink-0">
            S
          </div>
          <div className="leading-tight">
            <div className="font-bold text-[16px] text-[#0f172a] tracking-tight">SofDom Admin</div>
            <div className="text-[12px] text-[#94a3b8] font-medium">Томск • Недвижимость</div>
          </div>
        </div>

        <div className="h-px bg-[#f1f5f9] mx-4 mb-3" />
        <div className="px-5 pb-2 text-[11px] tracking-wider uppercase text-[#94a3b8] font-bold">
          Меню управления
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end
              onClick={onClose}
              className={({ isActive }) => itemClass(isActive)}
            >
              <span className="text-base">
                {item.id === 'overview' && '📊'}
                {item.id === 'listings' && '🏠'}
                {item.id === 'users' && '👥'}
                {item.id === 'scrapers' && '⚡'}
              </span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#64748b]">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer with Superadmin Profile */}
        <div className="mt-auto border-t border-[#f1f5f9] p-4 flex items-center gap-3 bg-[#fafbfc]">
          <div className="w-9 h-9 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center font-bold text-sm shrink-0 border border-[#a7f3d0]">
            АД
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-[13px] font-bold text-[#0f172a] truncate">Администратор</div>
            <div className="text-[11.5px] text-[#059669] font-medium">+7 999 000-00-01</div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Выйти из системы"
            className="ml-auto p-1.5 rounded-lg text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2]/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
