import { TrackingSettings } from '../types';
import { evaluateStrobeTrigger } from './strobeEvaluator';

export interface RenderViewportOptions {
  ctx: CanvasRenderingContext2D;
  frameSource: HTMLCanvasElement | HTMLVideoElement;
  strobeVideoCanvas: HTMLCanvasElement | null;
  strobeVideoCtx: CanvasRenderingContext2D | null;
  currentSettings: TrackingSettings;
  now: number;
  lastStrobeTime: number;
  w: number;
  h: number;
  presentStrobe?: boolean;
}

export interface RenderViewportResult {
  isStrobeActive: boolean;
  isStrobeTriggered: boolean;
  nextLastStrobeTime: number;
}

export function renderViewportFrame({
  ctx,
  frameSource,
  strobeVideoCanvas,
  strobeVideoCtx,
  currentSettings,
  now,
  lastStrobeTime,
  w,
  h,
  presentStrobe = true,
}: RenderViewportOptions): RenderViewportResult {
  const { isStrobeActive, isStrobeTriggered, nextLastStrobeTime } = evaluateStrobeTrigger(
    currentSettings.strobeRate,
    now,
    lastStrobeTime
  );

  if (presentStrobe && isStrobeActive && isStrobeTriggered && strobeVideoCtx && strobeVideoCanvas) {
    strobeVideoCtx.drawImage(frameSource, 0, 0, w, h);
  }

  if (!presentStrobe) {
    // WebGL presents the completed composition after POV and glow are applied.
  } else if (!isStrobeActive) {
    ctx.drawImage(frameSource, 0, 0, w, h);
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
