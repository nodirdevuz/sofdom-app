import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FALLBACK_PHOTO_SVG } from '../lib/constants';

interface LightboxModalProps {
  isOpen: boolean;
  photos: string[];
  currentIdx: number;
  offerId?: string;
  offerTitle?: string;
  onClose: () => void;
  onSelectIdx: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  photos,
  currentIdx,
  offerId = 'SD-1001',
  offerTitle = 'Квартира в аренду',
  onClose,
  onSelectIdx,
  onPrev,
  onNext
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragDownY, setDragDownY] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  // Reset zoom & drag on index change or close
  useEffect(() => {
    setIsZoomed(false);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragDownY(0);
    setIsDismissing(false);
  }, [currentIdx, isOpen]);

  // Scroll active thumbnail into center of thumb strip
  useEffect(() => {
    if (!isOpen || !thumbStripRef.current) return;
    const activeThumb = thumbStripRef.current.children[currentIdx] as HTMLElement;
    if (activeThumb) {
      const container = thumbStripRef.current;
      const scrollLeft = activeThumb.offsetLeft - container.clientWidth / 2 + activeThumb.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentIdx, isOpen]);

  // Keyboard navigation & body scroll locking
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomed) {
          setIsZoomed(false);
          setPanOffset({ x: 0, y: 0 });
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === '+' || e.key === '=') setIsZoomed(true);
      if (e.key === '-' || e.key === '_') {
        setIsZoomed(false);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
    };
  }, [isOpen, onPrev, onNext, onClose, isZoomed]);

  const toggleZoom = useCallback((clientX?: number, clientY?: number) => {
    setIsZoomed((prev) => {
      const next = !prev;
      if (!next) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  // Double tap handler for mobile
  const handleStageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };

      if (isZoomed) {
        dragStartRef.current = { x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y };
        setIsDragging(true);
      }

      // Double tap detected (< 300ms)
      if (now - lastTapRef.current < 300) {
        toggleZoom(touch.clientX, touch.clientY);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handleStageTouchMove = (e: React.TouchEvent) => {
    if (isZoomed && isDragging && dragStartRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      setPanOffset({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
    } else if (!isZoomed && touchStartRef.current && e.touches.length === 1) {
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      // Fluid swipe down to dismiss tracking
      if (dy > 0 && dy > Math.abs(dx) * 0.75) {
        setDragDownY(dy);
      }
    }
  };

  const handleStageTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    if (!touchStartRef.current || e.changedTouches.length === 0) {
      setDragDownY(0);
      return;
    }
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (!isZoomed) {
      // Swipe down to dismiss threshold
      if (dragDownY > 80 || (deltaY > 80 && Math.abs(deltaX) < 70)) {
        setIsDismissing(true);
        setTimeout(() => {
          onClose();
          setDragDownY(0);
          setIsDismissing(false);
        }, 180);
        return;
      }

      setDragDownY(0);

      // Horizontal swipe to flip photos
      if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < 70) {
        if (deltaX < 0) {
          onNext();
        } else {
          onPrev();
        }
      }
    }
  };

  // Mouse pan handlers for desktop zoom mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isZoomed) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isZoomed && isDragging && dragStartRef.current) {
      setPanOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIdx];

  return (
    <div
      className="lightbox-overlay"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        backgroundColor: `rgba(9, 12, 17, ${Math.max(0.15, 0.98 - dragDownY / 350)})`,
        opacity: isDismissing ? 0 : 1,
        transition: isDismissing ? 'opacity 0.18s ease-out' : 'background-color 0.08s ease'
      }}
    >
      {/* 1. TOP BAR */}
      <div className="lightbox-topbar">
        {/* Left: Property Title and SofDom ID */}
        <div className="lightbox-title-meta">
          <span className="lightbox-id-tag">№ {offerId}</span>
          <span className="lightbox-title-text" title={offerTitle}>
            {offerTitle}
          </span>
        </div>

        {/* Center: Photo Counter Pill */}
        <div className="lightbox-counter-pill">
          <span>{currentIdx + 1}</span>
          <span className="lightbox-counter-divider">/</span>
          <span>{photos.length}</span>
        </div>

        {/* Right: Actions (Zoom Toggle + Close) */}
        <div className="lightbox-actions-group">
          <button
            className={`lightbox-action-btn ${isZoomed ? 'active' : ''} clickable`}
            onClick={() => toggleZoom()}
            title={isZoomed ? 'Сбросить масштаб (1x)' : 'Приблизить фото (2x)'}
            aria-label="Масштаб"
          >
            {isZoomed ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            )}
            <span className="lightbox-action-label">{isZoomed ? '1x' : '2x'}</span>
          </button>

          <button
            className="lightbox-close-btn clickable"
            onClick={onClose}
            title="Закрыть (Esc)"
            aria-label="Закрыть"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. CENTER STAGE (FULL EXPANSIVE VIEW) */}
      <div
        className={`lightbox-center-stage ${isZoomed ? 'zoomed-stage' : ''}`}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isZoomed) onClose();
        }}
      >
        {/* Previous Chevron Button */}
        <button
          className="lightbox-nav-btn lightbox-btn-prev clickable"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Предыдущее фото"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Expansive Image Box (Exact hugging wrapper so shield sits on bottom-right of photo) */}
        <div
          className={`lightbox-img-box ${isZoomed ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            toggleZoom(e.clientX, e.clientY);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isZoomed) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              if (clickX < rect.width * 0.35) {
                onPrev();
              } else if (clickX > rect.width * 0.65) {
                onNext();
              }
            }
          }}
          style={
            isZoomed
              ? {
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(2)`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }
              : dragDownY > 0
              ? {
                  transform: `translate3d(0, ${dragDownY}px, 0) scale(${Math.max(0.75, 1 - dragDownY / 900)})`,
                  transition: isDismissing ? 'transform 0.18s ease-out, opacity 0.18s ease-out' : 'none',
                  opacity: isDismissing ? 0 : 1
                }
              : undefined
          }
        >
          <img
            key={currentIdx}
            src={currentPhoto}
            alt={`${offerTitle} — фото ${currentIdx + 1}`}
            className="lightbox-main-img"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.fallback) {
                target.dataset.fallback = '1';
                target.src = FALLBACK_PHOTO_SVG;
              }
            }}
          />

          {/* SOFDOM WATERMARK SHIELD:
              Covers competitor watermarks (ЦИАН ID... / ru09) in bottom-right corner
              with authoritative SofDom verification badge and internal listing ID */}
          <div className="lightbox-photo-shield">
            <div className="shield-top">
              <span className="shield-dot" />
              <span>SofDom • Проверено</span>
            </div>
            <div className="shield-sub">
              <span>№ {offerId}</span>
              <span className="shield-tag">Оригинал</span>
            </div>
          </div>
        </div>

        {/* Next Chevron Button */}
        <button
          className="lightbox-nav-btn lightbox-btn-next clickable"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Следующее фото"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* 3. BOTTOM THUMBNAILS CAROUSEL */}
      <div className="lightbox-bottom-strip" ref={thumbStripRef}>
        {photos.map((url, i) => (
          <div
            key={i}
            className={`lightbox-thumb-item ${i === currentIdx ? 'active' : ''} clickable`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectIdx(i);
            }}
            title={`Фото ${i + 1}`}
          >
            <img
              src={url}
              alt={`Миниатюра ${i + 1}`}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallback) {
                  target.dataset.fallback = '1';
                  target.src = FALLBACK_PHOTO_SVG;
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
