import { TrackingSettings } from '../types';
import { evaluateStrobeTrigger } from './strobeEvaluator';

export interface RenderViewportOptions {
  ctx: CanvasRenderingContext2D;
  stampedVideoCanvas: HTMLCanvasElement;
  strobeVideoCanvas: HTMLCanvasElement;
  strobeVideoCtx: CanvasRenderingContext2D | null;
  cameraFilter: string;
  currentSettings: TrackingSettings;
  now: number;
  lastStrobeTime: number;
  w: number;
  h: number;
}

export interface RenderViewportResult {
  isStrobeActive: boolean;
  isStrobeTriggered: boolean;
  nextLastStrobeTime: number;
}

export function renderViewportFrame({
  ctx,
  stampedVideoCanvas,
  strobeVideoCanvas,
  strobeVideoCtx,
  cameraFilter,
  currentSettings,
  now,
  lastStrobeTime,
  w,
  h,
}: RenderViewportOptions): RenderViewportResult {
  const { isStrobeActive, isStrobeTriggered, nextLastStrobeTime } = evaluateStrobeTrigger(
    currentSettings.strobeRate,
    now,
    lastStrobeTime
  );

  if (isStrobeActive && isStrobeTriggered && strobeVideoCtx) {
    strobeVideoCtx.filter = cameraFilter;
    strobeVideoCtx.drawImage(stampedVideoCanvas, 0, 0, stampedVideoCanvas.width, stampedVideoCanvas.height);
    strobeVideoCtx.filter = 'none';
  }

  if (!isStrobeActive) {
    ctx.filter = cameraFilter;
    ctx.drawImage(stampedVideoCanvas, 0, 0, w, h);
    ctx.filter = 'none';
  } else {
    if (currentSettings.strobeMode === 'flash') {
      const flashDuration = 40; // ms
      if (now - nextLastStrobeTime <= flashDuration) {
        ctx.drawImage(strobeVideoCanvas, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.drawImage(strobeVideoCanvas, 0, 0, w, h);
    }
  }

  return {
    isStrobeActive,
    isStrobeTriggered,
    nextLastStrobeTime,
  };
}
