import type React from 'react';
import type { TrackingSettings } from '../types';
import { drawDebugOverlay } from './debugOverlay';
import { drawCloneStampPreview } from './cloneStampOverlay';
import { drawRadialCenterGuide } from './radialCenterGuide';
import { scheduleNextFrame } from './frameScheduler';

export interface RenderPausedFrameParams {
  video: HTMLVideoElement;
  stampedVideoCanvas: HTMLCanvasElement;
  stampedVideoCtx: CanvasRenderingContext2D | null;
  removalMaskCanvas: HTMLCanvasElement;
  currentSettings: TrackingSettings;
  cloneDestCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  featheredMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  clonedLayerCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  ctx: CanvasRenderingContext2D;
  cameraFilter: string;
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
}

export function renderPausedFrame(params: RenderPausedFrameParams): void {
  const {
    video,
    stampedVideoCanvas,
    stampedVideoCtx,
    removalMaskCanvas,
    currentSettings,
    cloneDestCanvasRef,
    featheredMaskCanvasRef,
    clonedLayerCanvasRef,
    ctx,
    cameraFilter,
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
  } = params;

  if (stampedVideoCtx) {
    stampedVideoCtx.drawImage(video, 0, 0, stampedVideoCanvas.width, stampedVideoCanvas.height);
    
    if (currentSettings.cloneStampEnabled) {
      const wVideo = stampedVideoCanvas.width;
      const hVideo = stampedVideoCanvas.height;
      
      if (!cloneDestCanvasRef.current) {
        cloneDestCanvasRef.current = document.createElement('canvas');
      }
      const cloneDestCanvas = cloneDestCanvasRef.current;
      const cloneDestCtx = cloneDestCanvas.getContext('2d');
      if (cloneDestCanvas.width !== wVideo || cloneDestCanvas.height !== hVideo) {
        cloneDestCanvas.width = wVideo;
        cloneDestCanvas.height = hVideo;
      }
      
      if (cloneDestCtx) {
        cloneDestCtx.clearRect(0, 0, wVideo, hVideo);
        cloneDestCtx.drawImage(stampedVideoCanvas, -currentSettings.cloneStampOffsetX, -currentSettings.cloneStampOffsetY);
        
        if (!featheredMaskCanvasRef.current) {
          featheredMaskCanvasRef.current = document.createElement('canvas');
        }
        const featheredMaskCanvas = featheredMaskCanvasRef.current;
        const featheredMaskCtx = featheredMaskCanvas.getContext('2d');
        if (featheredMaskCanvas.width !== wVideo || featheredMaskCanvas.height !== hVideo) {
          featheredMaskCanvas.width = wVideo;
          featheredMaskCanvas.height = hVideo;
        }
        
        if (featheredMaskCtx) {
          featheredMaskCtx.clearRect(0, 0, wVideo, hVideo);
          if (currentSettings.cloneStampFeather > 0) {
            featheredMaskCtx.filter = `blur(${currentSettings.cloneStampFeather}px)`;
          }
          featheredMaskCtx.drawImage(removalMaskCanvas, 0, 0);
          featheredMaskCtx.filter = 'none';
          
          if (!clonedLayerCanvasRef.current) {
            clonedLayerCanvasRef.current = document.createElement('canvas');
          }
          const clonedLayerCanvas = clonedLayerCanvasRef.current;
          const clonedLayerCtx = clonedLayerCanvas.getContext('2d');
          if (clonedLayerCanvas.width !== wVideo || clonedLayerCanvas.height !== hVideo) {
            clonedLayerCanvas.width = wVideo;
            clonedLayerCanvas.height = hVideo;
          }
          
          if (clonedLayerCtx) {
            clonedLayerCtx.clearRect(0, 0, wVideo, hVideo);
            clonedLayerCtx.drawImage(cloneDestCanvas, 0, 0);
            clonedLayerCtx.globalCompositeOperation = 'destination-in';
            clonedLayerCtx.drawImage(featheredMaskCanvas, 0, 0);
            clonedLayerCtx.globalCompositeOperation = 'source-over';
            
            stampedVideoCtx.drawImage(clonedLayerCanvas, 0, 0);
          }
        }
      }
    }
  }

  ctx.filter = cameraFilter;
  ctx.drawImage(stampedVideoCanvas, 0, 0, w, h);
  ctx.filter = 'none';

  if (currentSettings.enableTrails && trailCanvasRef.current) {
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
