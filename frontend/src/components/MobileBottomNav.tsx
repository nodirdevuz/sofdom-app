import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { Lang, I18N } from '../lib/i18n';

export type NavTabId = 'main' | 'map' | 'filters' | 'profile';

interface MobileBottomNavProps {
  activeTab: 'main' | 'map' | 'filters';
  onSelectTab: (tab: 'main' | 'map' | 'filters') => void;
  onOpenProfile: () => void;
  lang?: Lang;
}

interface TabDef {
  id: NavTabId;
  label: string;
  icon: (isActive: boolean) => React.ReactNode;
}

export function triggerHaptic() {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    } else if ('vibrate' in navigator) {
      navigator.vibrate(12);
    }
  } catch {}
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenProfile,
  lang = 'ru',
}) => {
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const t = I18N[lang] || I18N.ru;

  // Tabs matching the exact Komfort Go Capsule architecture
  const tabs: TabDef[] = [
    {
      id: 'main',
      label: t.nav.main,
      icon: (isActive) => (
        <svg width="23" height="23" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '1.5' : '2'} strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" fill={isActive ? '#FACC15' : 'none'} />
        </svg>
      ),
    },
    {
      id: 'map',
      label: t.nav.map,
      icon: (isActive) => (
        <svg width="23" height="23" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '1.5' : '2'} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" stroke="#000" strokeWidth={isActive ? '1.5' : '2'} />
          <line x1="16" y1="6" x2="16" y2="22" stroke="#000" strokeWidth={isActive ? '1.5' : '2'} />
        </svg>
      ),
    },
    {
      id: 'filters',
      label: t.nav.filters,
      icon: (isActive) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? '2.2' : '1.9'} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" fill={isActive ? '#FACC15' : 'none'} />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: t.nav.profile,
      icon: (isActive) => (
        <svg width="23" height="23" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '1.5' : '2'} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  // Map activeTab to index
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeTab));

  // Exact fluid measurement logic from Komfort Go CapsuleNav
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = (): void => {
      // First child is the sliding pill, tab elements start at index 1
      const target = nav.children[activeIndex + 1];
      if (target instanceof HTMLElement) {
        setPill({
          left: target.offsetLeft,
          width: target.offsetWidth,
        });
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    for (const child of Array.from(nav.children)) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    return () => ro.disconnect();
  }, [activeIndex, activeTab]);

  const handleTabClick = (tabId: NavTabId) => {
    triggerHaptic();

    if (tabId === 'main') {
      onSelectTab('main');
    } else if (tabId === 'map') {
      onSelectTab('map');
    } else if (tabId === 'filters') {
      onSelectTab('filters');
    } else if (tabId === 'profile') {
      onOpenProfile();
    }
  };

  return (
    <div className="mobile-bottom-capsule-wrapper">
      <nav ref={navRef} className="mobile-bottom-capsule" role="navigation" aria-label="Нижнее меню">
        {/* Komfort Go Fluid Sliding Pill (перетекающая капля) */}
        <span
          aria-hidden="true"
          className="capsule-sliding-pill"
          style={
            pill
              ? {
                  transform: `translateX(${pill.left}px)`,
                  width: `${pill.width}px`,
                  opacity: 1,
                }
              : { opacity: 0, width: 0 }
          }
        />

        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`capsule-tab-item ${isActive ? 'active' : ''} clickable`}
              onClick={() => handleTabClick(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="capsule-tab-icon">
                {tab.icon(isActive)}
              </div>
              <span className="capsule-tab-label">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
