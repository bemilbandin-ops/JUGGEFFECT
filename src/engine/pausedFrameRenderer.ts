import type React from 'react';
import type { TrackingSettings } from '../types';
import { drawDebugOverlay } from './debugOverlay';
import { drawCloneStampPreview } from './cloneStampOverlay';
import { drawRadialCenterGuide } from './radialCenterGuide';
import { scheduleNextFrame } from './frameScheduler';

export interface RenderPausedFrameParams {
  frameSource: HTMLCanvasElement | HTMLVideoElement;
  currentSettings: TrackingSettings;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  trailCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  povCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  processingCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  isHoveringRef: React.MutableRefObject<boolean>;
  hoverPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  activeTabRef: React.MutableRefObject<string>;
  isRecordingRef: React.MutableRefObject<boolean>;
  animationFrameIdRef: React.MutableRefObject<number | null>;
  render: () => void;
  presentTemporalEffects?: boolean;
  presentBase?: boolean;
}

export function renderPausedFrame(params: RenderPausedFrameParams): void {
  const {
    frameSource,
    currentSettings,
    ctx,
    w,
    h,
    trailCanvasRef,
    povCanvasRef,
    processingCanvasRef,
    isHoveringRef,
    hoverPosRef,
    activeTabRef,
    isRecordingRef,
    animationFrameIdRef,
    render,
    presentTemporalEffects = true,
    presentBase = true,
  } = params;
  if (presentBase) ctx.drawImage(frameSource, 0, 0, w, h);

  if (presentTemporalEffects && currentSettings.enableTrails && trailCanvasRef.current) {
    const blendMode = (currentSettings.compositeMode === 'none' || !currentSettings.compositeMode)
      ? 'screen'
      : currentSettings.compositeMode;
    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    ctx.drawImage(trailCanvasRef.current, 0, 0, w, h);
    if (currentSettings.enablePoiMode && povCanvasRef?.current) {
      const povCanvas = povCanvasRef.current;
      const glowEnabled = currentSettings.poiGlowEnabled;
      const glowRadius = currentSettings.poiGlowRadius || 6;
      const glowIntensity = currentSettings.poiGlowIntensity || 0.5;

      if (glowEnabled && glowRadius > 0 && glowIntensity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = `blur(${glowRadius}px)`;
        ctx.globalAlpha = glowIntensity;
        ctx.drawImage(povCanvas, 0, 0, w, h);
        ctx.restore();
      }
      ctx.save();
      ctx.drawImage(povCanvas, 0, 0, w, h);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  if (processingCanvasRef.current) {
    drawDebugOverlay(
      ctx,
      processingCanvasRef.current,
      w,
      h,
      currentSettings.showDebugFeed
    );
  }

  if (currentSettings.cloneStampEnabled && isHoveringRef.current && hoverPosRef.current) {
    drawCloneStampPreview(
      ctx,
      hoverPosRef.current.x,
      hoverPosRef.current.y,
      currentSettings.cloneStampBrushSize,
      currentSettings.cloneStampOffsetX,
      currentSettings.cloneStampOffsetY
    );
  }

  if (currentSettings.enablePoiMode && 
      currentSettings.poiOrientation === 'radial' && 
      activeTabRef.current === 'poi' && 
      !isRecordingRef.current) {
    drawRadialCenterGuide(
      ctx,
      currentSettings.poiCenterRelativeX * w,
      currentSettings.poiCenterRelativeY * h
    );
  }

  scheduleNextFrame(animationFrameIdRef, render);
}
