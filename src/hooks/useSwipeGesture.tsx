import { useRef, useCallback, useState } from "react";

interface SwipeConfig {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeState {
  swiping: boolean;
  direction: "left" | "right" | "up" | "down" | null;
  deltaX: number;
  deltaY: number;
}

export const useSwipeGesture = (config: SwipeConfig = {}) => {
  const { threshold = 50, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown } = config;
  
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    swiping: false,
    direction: null,
    deltaX: 0,
    deltaY: 0,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    setSwipeState({ swiping: false, direction: null, deltaX: 0, deltaY: 0 });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;

    let direction: SwipeState["direction"] = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? "right" : "left";
    } else {
      direction = deltaY > 0 ? "down" : "up";
    }

    setSwipeState({
      swiping: true,
      direction,
      deltaX,
      deltaY,
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current) return;

    const { deltaX, deltaY, direction } = swipeState;

    if (Math.abs(deltaX) >= threshold || Math.abs(deltaY) >= threshold) {
      switch (direction) {
        case "left":
          onSwipeLeft?.();
          break;
        case "right":
          onSwipeRight?.();
          break;
        case "up":
          onSwipeUp?.();
          break;
        case "down":
          onSwipeDown?.();
          break;
      }
    }

    touchStart.current = null;
    setSwipeState({ swiping: false, direction: null, deltaX: 0, deltaY: 0 });
  }, [swipeState, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const handlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return {
    handlers,
    swipeState,
    isSwiping: swipeState.swiping,
    swipeDirection: swipeState.direction,
    deltaX: swipeState.deltaX,
    deltaY: swipeState.deltaY,
  };
};

export default useSwipeGesture;
