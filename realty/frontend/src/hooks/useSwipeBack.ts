import { useEffect, useRef } from 'react';
import { triggerHaptic } from '../components/MobileBottomNav';

interface SwipeBackOptions {
  onBack: () => void;
  enabled?: boolean;
}

/**
 * Native iOS Edge Swipe Back hook.
 * Strictly triggers only when user swipes from the physical left edge of the screen (<= 32px).
 * Safely excludes maps, carousels, and multi-touch gestures (pinch/rotate).
 */
export function useSwipeBack({ onBack, enabled = true }: SwipeBackOptions) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const isExcludedTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return !!target.closest(
        '.joymee-map-container, .ymaps-2-1-79-map, [class*="ymaps"], .joymee-location-box, .joymee-yandex-map-wrapper, .map-container, .gallery-slider, .joymee-photos-gallery, .joymee-main-photo-card, .lightbox-center-stage'
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Multi-touch active (e.g. 2 fingers on screen) -> cancel swipe back
      if (e.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      // If touch starts inside map or slider -> ignore
      if (isExcludedTarget(e.target)) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.touches[0];
      // Real iOS edge swipe strictly starts at bezel/edge (<= 32px from left screen edge)
      if (touch.clientX > 32) {
        touchStartRef.current = null;
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      // If a second finger touches down (pinch-to-zoom / rotate on map) -> immediately abort
      if (e.touches.length > 1) {
        touchStartRef.current = null;
        return;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      if (e.touches.length > 0) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;
      const startX = touchStartRef.current.x;
      touchStartRef.current = null;

      // Native iOS edge swipe criteria:
      // 1. Started at the very edge (<= 32px)
      // 2. Swiped distinctly to the right (> 70px)
      // 3. Low vertical variance (< 50px)
      // 4. Performed within 500ms
      const isEdgeSwipe = startX <= 32 && deltaX > 70 && deltaY < 50 && deltaTime < 500;

      if (isEdgeSwipe) {
        triggerHaptic();
        onBack();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onBack]);
}
