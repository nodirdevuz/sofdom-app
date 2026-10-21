import { useEffect, useRef } from 'react';
import { triggerHaptic } from '../components/MobileBottomNav';

interface SwipeBackOptions {
  onBack: () => void;
  enabled?: boolean;
}

/**
 * Native iOS Edge Swipe Back hook.
 * Triggers when user swipes from left edge to the right.
 */
export function useSwipeBack({ onBack, enabled = true }: SwipeBackOptions) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;
      const startX = touchStartRef.current.x;
      touchStartRef.current = null;

      // Conditions for native iOS edge swipe back:
      // 1. Touched within 70px from left edge and moved right by > 60px with low vertical jitter
      // 2. OR clear horizontal gesture right > 100px with deltaX > 2 * deltaY in under 450ms
      const isEdgeSwipe = startX <= 75 && deltaX > 60 && deltaY < 70;
      const isQuickFlick = deltaX > 110 && deltaY < deltaX * 0.45 && deltaTime < 450;

      if (isEdgeSwipe || isQuickFlick) {
        triggerHaptic();
        onBack();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onBack]);
}
