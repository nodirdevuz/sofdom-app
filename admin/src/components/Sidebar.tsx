import { NavLink } from 'react-router-dom';
import { LayoutGrid, Building2, Users, Cpu, LogOut, X } from 'lucide-react';
import { navItems } from '../nav';
import { useAuth } from '../auth';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const itemBase =
  'flex items-center gap-2.5 px-3 py-[9px] rounded-[9px] text-[14px] font-medium cursor-pointer transition-colors no-underline';

function itemClass(active: boolean): string {
  return active
    ? `${itemBase} bg-[#eeeeee] text-[#111418]`
    : `${itemBase} bg-transparent text-[#5b6b7a] hover:bg-[#f2f3f5]`;
}

function getIcon(id: string, active: boolean) {
  const color = active ? '#111418' : '#7a8593';
  switch (id) {
    case 'overview':
      return <LayoutGrid size={17} color={color} strokeWidth={1.9} />;
    case 'listings':
      return <Building2 size={17} color={color} strokeWidth={1.9} />;
    case 'users':
      return <Users size={17} color={color} strokeWidth={1.9} />;
    case 'scrapers':
      return <Cpu size={17} color={color} strokeWidth={1.9} />;
    default:
      return <LayoutGrid size={17} color={color} strokeWidth={1.9} />;
  }
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onClose}
          aria-hidden
          className="md:hidden fixed inset-0 z-30 bg-black/40"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[264px] max-w-[82vw] shrink-0 border-r border-[#ececec] bg-[#fbfbfc] flex flex-col h-full overflow-y-auto transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Шапка магазина/сервиса по канону Komfort Go */}
        <div className="px-[18px] pt-5 pb-[14px] flex items-center gap-[11px]">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#1f2937] text-white flex items-center justify-center font-bold text-[18px] shrink-0">
            S
          </div>
          <div className="leading-[1.2] min-w-0">
            <div className="font-bold text-[15px] text-[#111418] truncate">SofDom Admin</div>
            <div className="text-[12.5px] text-[#8a94a0] truncate">Томск • Недвижимость</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden ml-auto p-1.5 rounded-[8px] text-[#5b6b7a] hover:bg-[#f2f3f5]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="h-px bg-[#ececec] mx-[14px] mt-1 mb-2.5" />
        <div className="px-[18px] pt-0.5 pb-2 text-[11px] tracking-[0.07em] uppercase text-[#9aa4b0] font-semibold">
          МЕНЮ
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end
              onClick={onClose}
              className={({ isActive }) => itemClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <span className="shrink-0">{getIcon(item.id, isActive)}</span>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[12px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2 py-[2px] rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Профиль администратора в футере (Komfort Go стиль) */}
        <div className="mt-auto border-t border-[#ececec] px-4 py-[14px] flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-full bg-[#e8ebef] text-[#3a4654] flex items-center justify-center font-semibold text-[13px] shrink-0">
            СД
          </div>
          <div className="leading-[1.25] min-w-0">
            <div className="text-[13.5px] font-semibold text-[#111418] truncate">Администратор</div>
            <div className="text-[12px] text-[#8a94a0] truncate">Управление базой</div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Выйти"
            aria-label="Выйти"
            className="ml-auto p-2 rounded-[8px] text-[#8a94a0] hover:bg-[#f2f3f5] hover:text-[#111418] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
