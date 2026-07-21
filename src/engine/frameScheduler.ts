import type React from 'react';

export function scheduleNextFrame(
  animationFrameIdRef: React.MutableRefObject<number | null>,
  callback: FrameRequestCallback
): void {
  animationFrameIdRef.current = requestAnimationFrame(callback);
}
