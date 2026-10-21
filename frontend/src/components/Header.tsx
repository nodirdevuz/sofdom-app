import React, { useState, useRef, useEffect } from 'react';
import { Lang, I18N } from '../lib/i18n';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onBackToFeed: () => void;
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  onOpenProfile,
  onBackToFeed,
  lang,
  onChangeLang,
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close language menu on outside click
  useEffect(() => {
    if (!isLangOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isLangOpen]);

  const languages: { code: Lang; label: string; flag: string }[] = [
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'uz', label: 'Oʻzbekcha', flag: '🇺🇿' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ];

  const handleSelectLang = (code: Lang) => {
    onChangeLang(code);
    setIsLangOpen(false);
  };

  const t = I18N[lang];

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Left: Brand Logo — Original 3D Stone/Amber Monolith */}
        <div className="header-left">
          <a href="javascript:void(0)" onClick={onBackToFeed} className="logo-link" aria-label="SofDom — Без посредников">
            <div className="logo-badge">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%" fill="none">
                <defs>
                  <filter id="sd-hdr-shadow" x="-18%" y="-15%" width="140%" height="140%">
                    <feDropShadow dx="-3" dy="5" stdDeviation="4.5" floodColor="#1C1917" floodOpacity="0.34" />
                  </filter>
                  <filter id="sd-hdr-graphite" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency="0.16 0.20" numOctaves="4" seed="11" result="fineGrain" />
                    <feTurbulence type="turbulence" baseFrequency="0.035 0.048" numOctaves="3" seed="23" result="slateVeins" />
                    <feBlend mode="multiply" in="fineGrain" in2="slateVeins" result="combinedNoise" />
                    <feDiffuseLighting in="combinedNoise" lightingColor="#EAE4DC" surfaceScale="1.35" result="stoneRelief">
                      <feDistantLight azimuth="132" elevation="54" />
                    </feDiffuseLighting>
                    <feComposite in="stoneRelief" in2="SourceGraphic" operator="in" result="clippedRelief" />
                    <feBlend mode="soft-light" in="clippedRelief" in2="SourceGraphic" result="texturedStone" />
                    <feColorMatrix
                      type="matrix"
                      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.16 0"
                      in="fineGrain"
                      result="grainAlpha"
                    />
                    <feComposite in="grainAlpha" in2="SourceGraphic" operator="in" result="clippedGrain" />
                    <feBlend mode="overlay" in="clippedGrain" in2="texturedStone" />
                  </filter>
                  <filter id="sd-hdr-sphere-sh" x="-35%" y="-35%" width="170%" height="170%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#78350F" floodOpacity="0.52" />
                  </filter>
                  <linearGradient id="sd-hdr-stone-front" x1="20" y1="14" x2="140" y2="144" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#7D7972" />
                    <stop offset="28%" stopColor="#64605A" />
                    <stop offset="62%" stopColor="#504D48" />
                    <stop offset="88%" stopColor="#43403C" />
                    <stop offset="100%" stopColor="#373431" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-stone-bevel" x1="20" y1="14" x2="140" y2="144" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#9E9990" />
                    <stop offset="35%" stopColor="#706C65" />
                    <stop offset="75%" stopColor="#4A4742" />
                    <stop offset="100%" stopColor="#2B2927" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-inner-wall" x1="36" y1="34" x2="124" y2="132" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#282623" />
                    <stop offset="45%" stopColor="#3F3C38" />
                    <stop offset="100%" stopColor="#635F59" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-side-wall" x1="14" y1="68" x2="20" y2="146" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4A4742" />
                    <stop offset="50%" stopColor="#363330" />
                    <stop offset="100%" stopColor="#262421" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-roof-slope" x1="14" y1="71" x2="80" y2="14" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#5C5852" />
                    <stop offset="55%" stopColor="#736F68" />
                    <stop offset="100%" stopColor="#8A857C" />
                  </linearGradient>
                  <radialGradient id="sd-hdr-back-glow" cx="80" cy="86" r="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FDE047" stopOpacity="0.92" />
                    <stop offset="38%" stopColor="#FBBF24" stopOpacity="0.45" />
                    <stop offset="75%" stopColor="#FEF3C7" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#FAF6EE" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="sd-hdr-amber-body" x1="80" y1="36" x2="80" y2="130" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#B45309" />
                    <stop offset="18%" stopColor="#F59E0B" />
                    <stop offset="55%" stopColor="#D97706" />
                    <stop offset="70%" stopColor="#92400E" />
                    <stop offset="100%" stopColor="#5C2406" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-amber-edge" x1="38" y1="36" x2="122" y2="130" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#78350F" />
                    <stop offset="45%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#3B1502" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-amber-shine" x1="80" y1="38" x2="80" y2="128" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FEF9C3" stopOpacity="0.95" />
                    <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-pillar-depth" x1="0" y1="98" x2="0" y2="130" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#451A03" stopOpacity="0.58" />
                    <stop offset="100%" stopColor="#280F02" stopOpacity="0.92" />
                  </linearGradient>
                  <linearGradient id="sd-hdr-keyhole-rim" x1="70" y1="80" x2="90" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="40%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#78350F" />
                  </linearGradient>
                  <radialGradient id="sd-hdr-gold-sphere" cx="77" cy="81" r="11" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFBEB" />
                    <stop offset="25%" stopColor="#FDE047" />
                    <stop offset="60%" stopColor="#F59E0B" />
                    <stop offset="90%" stopColor="#B45309" />
                    <stop offset="100%" stopColor="#78350F" />
                  </radialGradient>
                </defs>
                <ellipse cx="80" cy="148" rx="60" ry="7.5" fill="#1C1917" opacity="0.32" />
                <path
                  d="M 80 14 L 146 71 L 140 144 H 20 L 14 71 Z"
                  fill="url(#sd-hdr-stone-bevel)"
                  filter="url(#sd-hdr-shadow)"
                />
                <path d="M 80 14 L 14 71 L 20 74 L 80 20 Z" fill="url(#sd-hdr-roof-slope)" />
                <path d="M 14 71 L 20 74 L 20 144 L 14 140 Z" fill="url(#sd-hdr-side-wall)" />
                <path
                  d="M 80 20 L 140 73 L 135 142 H 25 L 20 74 Z"
                  fill="url(#sd-hdr-stone-front)"
                  filter="url(#sd-hdr-graphite)"
                />
                <path
                  d="M 80 34 L 124 75 L 120 132 H 40 L 36 75 Z"
                  fill="url(#sd-hdr-inner-wall)"
                  stroke="#23211E"
                  strokeWidth="2.2"
                />
                <rect x="36" y="34" width="88" height="98" fill="url(#sd-hdr-back-glow)" opacity="0.9" />
                <g id="sd-hdr-amber-monolith">
                  <path
                    d="M 80 36 L 122 75 V 130 H 38 V 75 Z"
                    fill="url(#sd-hdr-amber-body)"
                    stroke="url(#sd-hdr-amber-edge)"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M 80 39 L 118 75 V 127 H 42 V 75 Z"
                    fill="none"
                    stroke="url(#sd-hdr-amber-shine)"
                    strokeWidth="1.2"
                    opacity="0.75"
                  />
                  <rect x="42" y="96" width="76" height="32" fill="url(#sd-hdr-pillar-depth)" />
                  <path d="M 71.2 95.5 A 14.5 14.5 0 1 1 88.8 95.5 L 91.5 117 H 68.5 Z" fill="url(#sd-hdr-keyhole-rim)" stroke="#B45309" strokeWidth="0.9" />
                  <path d="M 73.4 94 A 12 12 0 1 1 86.6 94 L 88.8 114.5 H 71.2 Z" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="0.8" />
                  <path d="M 73.4 94 L 75.5 96 L 73.8 111.5 L 71.2 114.5 Z" fill="#D97706" opacity="0.6" />
                  <path d="M 86.6 94 L 84.5 96 L 86.2 111.5 L 88.8 114.5 Z" fill="#92400E" opacity="0.7" />
                  <path d="M 71.2 114.5 L 73.8 111.5 H 86.2 L 88.8 114.5 Z" fill="#78350F" opacity="0.8" />
                  <path d="M 75.5 96 H 84.5 L 86.2 111.5 H 73.8 Z" fill="#FEF3C7" />
                  <circle cx="80" cy="84" r="10.8" fill="url(#sd-hdr-gold-sphere)" filter="url(#sd-hdr-sphere-sh)" />
                  <ellipse cx="76.4" cy="80.3" rx="3.3" ry="2.4" transform="rotate(-30 76.4 80.3)" fill="#FFFFFF" opacity="0.72" />
                </g>
              </svg>
            </div>
            <div className="logo-brand-text">
              <span className="logo-text">SofDom<span className="logo-accent-dot">.</span></span>
              <span className="logo-sub">{t.logoSub}</span>
            </div>
          </a>
        </div>

        {/* Right: Working Language Pill & Toolbar */}
        <div className="header-right">
          {/* Interactive Language Selector with Dropdown */}
          <div className="header-lang-wrapper" ref={langMenuRef}>
            <button
              className={`header-btn-lang clickable ${isLangOpen ? 'active' : ''}`}
              onClick={() => setIsLangOpen((prev) => !prev)}
              aria-label="Смена языка"
              aria-expanded={isLangOpen}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{lang.toUpperCase()}</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isLangOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Language Dropdown Menu */}
            {isLangOpen && (
              <div className="header-lang-dropdown">
                <div className="header-lang-dropdown-arrow" />
                {languages.map((item) => {
                  const isSelected = item.code === lang;
                  return (
                    <button
                      key={item.code}
                      className={`header-lang-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectLang(item.code)}
                    >
                      <span className="lang-flag">{item.flag}</span>
                      <span className="lang-name">{item.label}</span>
                      {isSelected && (
                        <svg className="lang-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Theme Toggle */}
          <button className="header-theme-toggle clickable" onClick={onToggleTheme} title="Переключить тему">
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>

          <button className="header-btn-filter clickable" onClick={() => alert('Фильтры: метро, этаж, стоимость, техника')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" x2="20" y1="21" y2="21" />
              <line x1="4" x2="20" y1="14" y2="14" />
              <line x1="4" x2="20" y1="7" y2="7" />
              <circle cx="8" cy="7" r="3" />
              <circle cx="16" cy="14" r="3" />
              <circle cx="10" cy="21" r="3" />
            </svg>
            <span>{t.nav.filters}</span>
          </button>

          <button className="btn-create-ad clickable" onClick={() => alert('Подать объявление: загрузка фото, адрес, цена')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{t.nav.add}</span>
          </button>

          {/* Desktop Avatar (Hidden on mobile) */}
          <div className="header-user-avatar clickable" onClick={onOpenProfile}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
};
