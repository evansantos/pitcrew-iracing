'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook that calls a callback on every animation frame.
 * Automatically handles cleanup on unmount.
 */
export function useAnimationFrame(callback: (deltaTime: number) => void, enabled: boolean = true) {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Keep callback ref current without re-subscribing
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const animate = (time: number) => {
      if (previousTimeRef.current !== 0) {
        const deltaTime = time - previousTimeRef.current;
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = 0;
    };
  }, [enabled]);
}
