export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  procCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  showDebugFeed: boolean
): void {
  if (showDebugFeed && procCanvas) {
    ctx.globalAlpha = 0.65;
    ctx.drawImage(procCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1.0;
  }
}

export interface FpsUpdateResult {
  nextLastTime: number;
  nextFrameCount: number;
}

export function updateFpsCounter(
  now: number,
  lastTime: number,
  frameCount: number,
  onFpsUpdate: (fps: number) => void
): FpsUpdateResult {
  const nextFrameCount = frameCount + 1;
  const delta = now - lastTime;
  if (delta >= 1000) {
    onFpsUpdate(Math.round((nextFrameCount * 1000) / delta));
    return {
      nextLastTime: now,
      nextFrameCount: 0,
    };
  }
  return {
    nextLastTime: lastTime,
    nextFrameCount,
  };
}
