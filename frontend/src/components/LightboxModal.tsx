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

function getCleanRoomTitle(title?: string): string {
  if (!title) return 'Квартира';
  if (/студи/i.test(title)) return 'Студия';
  const m = title.match(/(\d+)\s*[-—–]?\s*к(?:омн)?\.?\s*кв(?:артира)?/i);
  if (m) {
    const num = m[1];
    const words: Record<string, string> = {
      '1': '1-к. квартира',
      '2': '2-к. квартира',
      '3': '3-к. квартира',
      '4': '4-к. квартира',
      '5': '5-к. квартира',
    };
    return words[num] || `${num}-к. квартира`;
  }
  const parts = title.split(/[•⋅,]/);
  return parts[0].trim();
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
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragDownY, setDragDownY] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const isPinchingRef = useRef<boolean>(false);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  // Reset zoom & drag on index change or close
  useEffect(() => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragDownY(0);
    setIsDismissing(false);
    pinchStartDistRef.current = 0;
    isPinchingRef.current = false;
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
        if (scale > 1.05) {
          setScale(1);
          setPanOffset({ x: 0, y: 0 });
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === '+' || e.key === '=') setScale(2.5);
      if (e.key === '-' || e.key === '_') {
        setScale(1);
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
  }, [isOpen, onPrev, onNext, onClose, scale]);

  const toggleZoom = useCallback(() => {
    setScale((prev) => {
      if (prev > 1.05) {
        setPanOffset({ x: 0, y: 0 });
        return 1;
      }
      return 2.5;
    });
  }, []);

  // Multi-touch gestures: Two-finger Pinch-to-Zoom + Double Tap + Single-finger Drag / Dismiss
  const handleStageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      return;
    }

    if (e.touches.length === 1) {
      isPinchingRef.current = false;
      const now = Date.now();
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };

      if (scale > 1.05) {
        dragStartRef.current = { x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y };
        setIsDragging(true);
      }

      // Double tap detected (< 300ms)
      if (now - lastTapRef.current < 300) {
        toggleZoom();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handleStageTouchMove = (e: React.TouchEvent) => {
    // 1. Two-finger pinch-to-zoom
    if (e.touches.length === 2 && pinchStartDistRef.current > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / pinchStartDistRef.current;
      const nextScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, 1), 4);
      setScale(nextScale);
      return;
    }

    // 2. Drag / pan when zoomed in
    if (scale > 1.05 && isDragging && dragStartRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      setPanOffset({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
      return;
    }

    // 3. Swipe down to dismiss when NOT zoomed
    if (scale <= 1.05 && touchStartRef.current && e.touches.length === 1) {
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      if (dy > 0 && dy > Math.abs(dx) * 0.75) {
        setDragDownY(dy);
      }
    }
  };

  const handleStageTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = 0;
      isPinchingRef.current = false;
      if (scale < 1.05) {
        setScale(1);
        setPanOffset({ x: 0, y: 0 });
      }
    }

    setIsDragging(false);
    if (!touchStartRef.current || e.changedTouches.length === 0) {
      setDragDownY(0);
      return;
    }
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (scale <= 1.05) {
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
    if (scale > 1.05) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (scale > 1.05 && isDragging && dragStartRef.current) {
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
  const roomTitle = getCleanRoomTitle(offerTitle);
  const isZoomed = scale > 1.05;

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
      {/* 1. TOP BAR: [Тип квартиры] -> [Счетчик фото X из Y] -> [Приближение] -> [X Закрыть] */}
      <div className="lightbox-topbar">
        {/* Left: Clean Room Title (e.g. 2-к. квартира) */}
        <div className="lightbox-title-meta">
          <span className="lightbox-title-text" title={offerTitle}>
            {roomTitle}
          </span>
        </div>

        {/* Center: Photo Counter Pill (X из Y) */}
        <div className="lightbox-counter-pill">
          <span>{currentIdx + 1}</span>
          <span className="lightbox-counter-divider">из</span>
          <span>{photos.length}</span>
        </div>

        {/* Right: Actions (Zoom Toggle + Close) */}
        <div className="lightbox-actions-group">
          <button
            className={`lightbox-action-btn ${isZoomed ? 'active' : ''} clickable`}
            onClick={() => toggleZoom()}
            title={isZoomed ? 'Сбросить масштаб (1x)' : 'Приблизить фото (2.5x)'}
            aria-label="Приблизить"
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
            <span className="lightbox-action-label">{isZoomed ? '1x' : 'Приблизить'}</span>
          </button>

          <button
            className="lightbox-close-btn clickable"
            onClick={onClose}
            title="Закрыть (X)"
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. CENTER STAGE (FULL EXPANSIVE VIEW WITH PINCH-TO-ZOOM) */}
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

        {/* Expansive Image Box */}
        <div
          className={`lightbox-img-box ${isZoomed ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            toggleZoom();
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
            scale > 1.05
              ? {
                  transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${scale})`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  touchAction: 'none'
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
            alt={`${roomTitle} — фото ${currentIdx + 1}`}
            className="lightbox-main-img"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.fallback) {
                target.dataset.fallback = '1';
                target.src = FALLBACK_PHOTO_SVG;
              }
            }}
          />
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
