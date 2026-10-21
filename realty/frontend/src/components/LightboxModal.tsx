import React, { useEffect } from 'react';

interface LightboxModalProps {
  isOpen: boolean;
  photos: string[];
  currentIdx: number;
  onClose: () => void;
  onSelectIdx: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  photos,
  currentIdx,
  onClose,
  onSelectIdx,
  onPrev,
  onNext
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onPrev, onNext, onClose]);

  if (!isOpen || photos.length === 0) return null;

  return (
    <div className="lightbox-overlay">
      <div className="lightbox-topbar">
        <div className="lightbox-counter">
          {currentIdx + 1} / {photos.length}
        </div>
        <button className="lightbox-close-btn clickable" onClick={onClose} title="Закрыть (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div
        className="lightbox-center-stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <button
          className="lightbox-nav-btn lightbox-btn-prev clickable"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Предыдущее фото"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="lightbox-img-wrapper">
          <img src={photos[currentIdx]} alt="Полноэкранное фото" />
        </div>
        <button
          className="lightbox-nav-btn lightbox-btn-next clickable"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Следующее фото"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="lightbox-bottom-strip">
        {photos.map((url, i) => (
          <div
            key={i}
            className={`lightbox-thumb-item ${i === currentIdx ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectIdx(i);
            }}
          >
            <img src={url} alt={`Превью ${i + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
};
