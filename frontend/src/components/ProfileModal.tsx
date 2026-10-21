import React from 'react';

interface ProfileModalProps {
  isOpen: boolean;
  theme: 'light' | 'dark';
  onSetTheme: (theme: 'light' | 'dark') => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  theme,
  onSetTheme,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="profile-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="profile-sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="profile-sheet-handle"></div>
        <div className="profile-sheet-header">
          <h2 className="profile-sheet-title">Профиль</h2>
          <button className="profile-sheet-close clickable" onClick={onClose} aria-label="Закрыть профиль">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="profile-user-box">
          <div className="profile-user-avatar">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="profile-user-info">
            <div className="profile-user-name">Пользователь SofDom</div>
            <div className="profile-user-phone">+7 (926) 845-••-•• • Собственник</div>
          </div>
        </div>

        {/* Theme Switcher in Profile */}
        <div className="profile-theme-row">
          <div className="profile-row-label">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <span>Тема оформления</span>
          </div>
          <div className="theme-segmented-ctrl">
            <button
              className={`theme-pill-opt ${theme === 'light' ? 'active' : ''} clickable`}
              onClick={() => onSetTheme('light')}
            >
              ☀️ Светлая
            </button>
            <button
              className={`theme-pill-opt ${theme === 'dark' ? 'active' : ''} clickable`}
              onClick={() => onSetTheme('dark')}
            >
              🌙 Тёмная
            </button>
          </div>
        </div>

        <div className="profile-menu-list">
          <div className="profile-menu-item clickable" onClick={() => alert('Избранные объявления')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <span>Избранные объявления</span>
            <span className="profile-menu-chevron">›</span>
          </div>
          <div className="profile-menu-item clickable" onClick={() => alert('Мои объявления')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Мои объявления</span>
            <span className="profile-menu-chevron">›</span>
          </div>
          <div className="profile-menu-item clickable" onClick={() => alert('Выбран язык: Русский')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Язык приложения (RU)</span>
            <span className="profile-menu-chevron">›</span>
          </div>
        </div>
      </div>
    </div>
  );
};
