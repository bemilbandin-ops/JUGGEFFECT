import React from 'react';
import { TrackingSettings } from '../types';
import { getCameraFilterString, getTrackingFilterString } from './cameraFilters';
import { prepareCloneStampBaseCanvases } from './cloneStampCanvasPrep';
import { compositeCloneStamp } from './cloneStampCompositor';
import { ensureCanvasBuffers } from './canvasBufferManager';
import { renderPausedFrame } from './pausedFrameRenderer';
import { renderViewportFrame } from './viewportRenderer';
import { extractMotion } from './motionExtractor';
import { processMotionBlur } from './motionBlurProcessor';
import { processTrails } from './trailProcessor';
import { drawDebugOverlay, updateFpsCounter } from './debugOverlay';
import { drawCloneStampPreview } from './cloneStampOverlay';
import { drawRadialCenterGuide } from './radialCenterGuide';
import { scheduleNextFrame } from './frameScheduler';
import { PovProjectionState, PovTrailEntry } from '../utils/pov';

export interface ExecuteRenderLoopStepParams {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  settingsRef: React.MutableRefObject<TrackingSettings>;
  animationFrameIdRef: React.MutableRefObject<number | null>;
  lastTimeRef: React.MutableRefObject<number>;
  frameCountRef: React.MutableRefObject<number>;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  bgDataRef: React.MutableRefObject<Float32Array | null>;
  motionMaskDataRef: React.MutableRefObject<ImageData | null>;
  smoothingCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  maskedBlurCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  driftCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  poiPatternCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  poiPatternDataRef: React.MutableRefObject<ImageData | null>;
  poiCustomImageElementRef: React.MutableRefObject<HTMLImageElement | null>;
  isPaintingRef: React.MutableRefObject<boolean>;
  hoverPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isHoveringRef: React.MutableRefObject<boolean>;
  trackedPointsRef: React.MutableRefObject<any[]>;
  nextTrackedIdRef: React.MutableRefObject<number>;
  povCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  lastSettingsStrRef: React.MutableRefObject<string>;
  poiColumnIndexRef: React.MutableRefObject<number>;
  poiTrailBufferRef: React.MutableRefObject<Map<number, PovTrailEntry[]>>;
  poiProjectionStateRef: React.MutableRefObject<Map<number, PovProjectionState>>;
  poiAccumulatedDistRef: React.MutableRefObject<Map<number, number>>;
  activeTabRef: React.MutableRefObject<string>;
  isRecordingRef: React.MutableRefObject<boolean>;
  stampedVideoCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  removalMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  removalMaskCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  cloneDestCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  featheredMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  clonedLayerCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  processingCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  trailCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  blurredVideoCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  strobeVideoCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  frameCountAbsRef: React.MutableRefObject<number>;
  colorCycleAngleRef: React.MutableRefObject<number>;
  lastStrobeTimeRef: React.MutableRefObject<number>;
  render: () => void;
}

export function executeRenderLoopStep({
  video,
  canvas,
  ctx,
  settingsRef,
  animationFrameIdRef,
  lastTimeRef,
  frameCountRef,
  setFps,
  bgDataRef,
  motionMaskDataRef,
  smoothingCanvasRef,
  maskedBlurCanvasRef,
  driftCanvasRef,
  poiPatternCanvasRef,
  poiPatternDataRef,
  poiCustomImageElementRef,
  isPaintingRef,
  hoverPosRef,
  isHoveringRef,
  trackedPointsRef,
  nextTrackedIdRef,
  povCanvasRef,
  lastSettingsStrRef,
  poiColumnIndexRef,
  poiTrailBufferRef,
  poiProjectionStateRef,
  poiAccumulatedDistRef,
  activeTabRef,
  isRecordingRef,
  stampedVideoCanvasRef,
  removalMaskCanvasRef,
  removalMaskCtxRef,
  cloneDestCanvasRef,
  featheredMaskCanvasRef,
  clonedLayerCanvasRef,
  processingCanvasRef,
  trailCanvasRef,
  blurredVideoCanvasRef,
  strobeVideoCanvasRef,
  frameCountAbsRef,
  colorCycleAngleRef,
  lastStrobeTimeRef,
  render,
}: ExecuteRenderLoopStepParams): void {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    scheduleNextFrame(animationFrameIdRef, render);
    return;
  }

  const now = performance.now();
  const currentSettings = settingsRef.current;
  const cameraFilter = getCameraFilterString(currentSettings);
  const trackingFilter = getTrackingFilterString(currentSettings);

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const w = canvas.width;
  const h = canvas.height;

  const {
    stampedVideoCanvas,
    stampedVideoCtx,
    removalMaskCanvas,
  } = prepareCloneStampBaseCanvases(
    stampedVideoCanvasRef,
    removalMaskCanvasRef,
    removalMaskCtxRef,
    video.videoWidth,
    video.videoHeight
  );

  const buffers = ensureCanvasBuffers({
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    cameraFilter,
    stampedVideoCanvas,
    processingCanvasRef,
    trailCanvasRef,
    blurredVideoCanvasRef,
    strobeVideoCanvasRef,
    povCanvasRef,
  });

  if (!buffers) {
    scheduleNextFrame(animationFrameIdRef, render);
    return;
  }

  const {
    procCanvas,
    procCtx,
    trailCanvas,
    trailCtx,
    blurredVideoCanvas,
    blurredVideoCtx,
    strobeVideoCanvas,
    strobeVideoCtx,
  } = buffers;

  if (video.paused || video.ended) {
    renderPausedFrame({
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
      processingCanvasRef,
      isHoveringRef,
      hoverPosRef,
      activeTabRef,
      isRecordingRef,
      animationFrameIdRef,
      render,
    });
    return;
  }

  compositeCloneStamp({
    video,
    stampedVideoCanvas,
    stampedVideoCtx,
    removalMaskCanvas,
    currentSettings,
    cloneDestCanvasRef,
    featheredMaskCanvasRef,
    clonedLayerCanvasRef,
  });

  const { isStrobeTriggered, nextLastStrobeTime } = renderViewportFrame({
    ctx,
    stampedVideoCanvas,
    strobeVideoCanvas,
    strobeVideoCtx,
    cameraFilter,
    currentSettings,
    now,
    lastStrobeTime: lastStrobeTimeRef.current,
    w,
    h,
  });
  lastStrobeTimeRef.current = nextLastStrobeTime;

  extractMotion({
    stampedVideoCanvas,
    procCanvas,
    procCtx,
    trackingFilter,
    bgDataRef,
    motionMaskDataRef,
    smoothingCanvasRef,
    currentSettings,
  });

  processMotionBlur({
    currentSettings,
    blurredVideoCtx,
    cameraFilter,
    stampedVideoCanvas,
    blurredVideoCanvas,
    maskedBlurCanvasRef,
    video,
    procCanvas,
    ctx,
    w,
    h,
  });

  processTrails({
    currentSettings,
    isStrobeTriggered,
    now,
    w,
    h,
    ctx,
    trailCanvas,
    trailCtx,
    procCanvas,
    frameCountAbsRef,
    colorCycleAngleRef,
    driftCanvasRef,
    poiPatternCanvasRef,
    poiPatternDataRef,
    poiCustomImageElementRef,
    motionMaskDataRef,
    isPaintingRef,
    hoverPosRef,
    trackedPointsRef,
    nextTrackedIdRef,
    povCanvasRef,
    lastSettingsStrRef,
    poiColumnIndexRef,
    poiTrailBufferRef,
    poiProjectionStateRef,
    poiAccumulatedDistRef,
  });

  drawDebugOverlay(ctx, procCanvas, w, h, currentSettings.showDebugFeed);

  const fpsResult = updateFpsCounter(now, lastTimeRef.current, frameCountRef.current, setFps);
  lastTimeRef.current = fpsResult.nextLastTime;
  frameCountRef.current = fpsResult.nextFrameCount;

  if (currentSettings.cloneStampEnabled && isHoveringRef.current && hoverPosRef.current && ctx) {
    drawCloneStampPreview(
      ctx,
      hoverPosRef.current.x,
      hoverPosRef.current.y,
      currentSettings.cloneStampBrushSize,
      currentSettings.cloneStampOffsetX,
      currentSettings.cloneStampOffsetY
    );
  }

  if (
    currentSettings.enablePoiMode &&
    currentSettings.poiOrientation === 'radial' &&
    activeTabRef.current === 'poi' &&
    !isRecordingRef.current &&
    ctx
  ) {
    drawRadialCenterGuide(
      ctx,
      currentSettings.poiCenterRelativeX * w,
      currentSettings.poiCenterRelativeY * h
    );
  }

  scheduleNextFrame(animationFrameIdRef, render);
}
