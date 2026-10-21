import React, { useEffect } from 'react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenAdmin,
}) => {
  // Bulletproof body scroll lock so background NEVER moves
  useEffect(() => {
    if (!isOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const preventBackgroundTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.profile-sheet-card')) {
        return; // Allow scrolling inside the profile card
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventBackgroundTouch, { passive: false });

    return () => {
      window.removeEventListener('touchmove', preventBackgroundTouch);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="profile-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="profile-sheet-card" onClick={(e) => e.stopPropagation()}>
        {/* iOS Grab Handle */}
        <div className="sheet-handle-row" onClick={onClose}>
          <div className="sheet-handle-bar"></div>
        </div>

        {/* Header */}
        <div className="profile-sheet-header">
          <h2 className="profile-sheet-title">Профиль</h2>
          <button className="profile-sheet-close clickable" onClick={onClose} aria-label="Закрыть профиль">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Full-featured User Header Card */}
        <div className="profile-user-box">
          <div className="profile-user-avatar">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="profile-user-info">
            <div className="profile-user-name">Личный кабинет SofDom</div>
            <div className="profile-user-phone">+7 (926) 845-••-••</div>
            <div className="profile-user-badge">✓ Подтверждённый аккаунт</div>
          </div>
        </div>

        {/* User Activity / Stats row */}
        <div className="profile-stats-row">
          <div className="profile-stat-box">
            <span className="profile-stat-num">4</span>
            <span className="profile-stat-label">В избранном</span>
          </div>
          <div className="profile-stat-box">
            <span className="profile-stat-num">18</span>
            <span className="profile-stat-label">Просмотрено</span>
          </div>
          <div className="profile-stat-box">
            <span className="profile-stat-num">0</span>
            <span className="profile-stat-label">Объявлений</span>
          </div>
        </div>

        {/* Full-fledged Menu List */}
        <div className="profile-menu-list">
          <div className="profile-menu-item clickable" onClick={() => alert('Открывается список избранных квартир')}>
            <div className="profile-menu-icon-wrap">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <div className="profile-menu-text-wrap">
              <span className="profile-menu-title">Избранные объявления</span>
              <span className="profile-menu-sub">4 сохранённых варианта</span>
            </div>
            <span className="profile-menu-chevron">›</span>
          </div>

          <div className="profile-menu-item clickable" onClick={() => alert('Уведомления о новых квартирах')}>
            <div className="profile-menu-icon-wrap">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div className="profile-menu-text-wrap">
              <span className="profile-menu-title">Уведомления о новых квартирах</span>
              <span className="profile-menu-sub">Срочные предложения первыми</span>
            </div>
            <span className="profile-menu-chevron">›</span>
          </div>

          <div className="profile-menu-item clickable" onClick={() => alert('Форма подачи объявления')}>
            <div className="profile-menu-icon-wrap">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div className="profile-menu-text-wrap">
              <span className="profile-menu-title">Сдать квартиру (Собственник)</span>
              <span className="profile-menu-sub">Бесплатное размещение в каталоге</span>
            </div>
            <span className="profile-menu-chevron">›</span>
          </div>

          <div className="profile-menu-item clickable" onClick={() => alert('История звонков и контактов')}>
            <div className="profile-menu-icon-wrap">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="profile-menu-text-wrap">
              <span className="profile-menu-title">Контакты и история</span>
              <span className="profile-menu-sub">Номера просмотренных продавцов</span>
            </div>
            <span className="profile-menu-chevron">›</span>
          </div>

          <div className="profile-menu-item clickable" onClick={() => alert('Служба поддержки SofDom в Telegram')}>
            <div className="profile-menu-icon-wrap">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="profile-menu-text-wrap">
              <span className="profile-menu-title">Поддержка и помощь</span>
              <span className="profile-menu-sub">Ответим за 5 минут в Telegram</span>
            </div>
            <span className="profile-menu-chevron">›</span>
          </div>

          {onOpenAdmin && (
            <div
              className="profile-menu-item clickable"
              style={{ color: '#059669', fontWeight: 600 }}
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
            >
              <div className="profile-menu-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="profile-menu-text-wrap">
                <span className="profile-menu-title" style={{ color: '#059669' }}>Панель управления</span>
                <span className="profile-menu-sub">Статистика и парсеры</span>
              </div>
              <span className="profile-menu-chevron">⚙️</span>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <div className="profile-sheet-footer">
          <button className="profile-logout-btn clickable" onClick={() => alert('Вы вышли из профиля')}>
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};
