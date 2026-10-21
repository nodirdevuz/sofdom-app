/**
 * SVG-иконки, перенесённые один-в-один из исходного дизайна.
 * Цвет наследуется через `currentColor`.
 */
import type { NavGroup } from '../nav';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** «Обзор» — сетка 2×2. */
export function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** «Кассиры» — кошелёк/касса. */
export function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.3" />
    </svg>
  );
}

/** «Данные» — цилиндр БД. */
function DataIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

/** «Аналитика». */
function AnalyticsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.6" cy="6" r="1.3" />
      <circle cx="3.6" cy="12" r="1.3" />
      <circle cx="3.6" cy="18" r="1.3" />
    </svg>
  );
}

/** «Клиенты». */
function CustomersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 19v-1.4a3.5 3.5 0 0 0-2.6-3.4" />
    </svg>
  );
}

/** «Поставщики». */
function SuppliersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M3 6h11v9H3z" />
      <path d="M14 9h4l3 3v3h-7z" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </svg>
  );
}

/** «Финансы». */
function FinanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1.2" />
    </svg>
  );
}

/** Иконка группы навигации по её id. */
export function GroupIcon({ id }: { id: NavGroup['id'] }) {
  switch (id) {
    case 'cashiers':
      return <WalletIcon />;
    case 'data':
      return <DataIcon />;
    case 'analytics':
      return <AnalyticsIcon />;
    case 'customers':
      return <CustomersIcon />;
    case 'suppliers':
      return <SuppliersIcon />;
    case 'finance':
      return <FinanceIcon />;
    case 'staff':
      return <CustomersIcon />;
  }
}

export function ChevronUp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
      <polyline points="6 15 12 9 18 15" />
    </svg>
  );
}

export function ChevronDown() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M12 3v11" />
      <polyline points="8 11 12 15 16 11" />
      <path d="M5 19h14" />
    </svg>
  );
}

/** «Выйти» — дверь со стрелкой. */
export function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** «ИИ-ассистент» — искра. */
export function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

/** Гамбургер — открыть меню на узком экране. */
export function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="1.9" {...stroke}>
      <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
      <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
    </svg>
  );
}

/** Крестик — закрыть выезжающее меню. */
export function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.9" {...stroke}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
