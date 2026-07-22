import React from 'react';
import { TrackingSettings } from '../types';
import { getTrackingFilterString } from './cameraFilters';
import type { EffectsRenderer } from './effectsRenderer';
import { prepareCloneStampBaseCanvases, prepareRemovalMaskCanvas } from './cloneStampCanvasPrep';
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
  renderer: EffectsRenderer;
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
  removalMaskRevisionRef: React.MutableRefObject<number>;
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
  lastProcessedVideoTimeRef: React.MutableRefObject<number>;
  render: () => void;
}

export function executeRenderLoopStep({
  video,
  canvas,
  ctx,
  renderer,
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
  removalMaskRevisionRef,
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
  lastProcessedVideoTimeRef,
  render,
}: ExecuteRenderLoopStepParams): void {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    scheduleNextFrame(animationFrameIdRef, render);
    return;
  }

  const now = performance.now();
  const currentSettings = settingsRef.current;
  const trackingFilter = getTrackingFilterString(currentSettings);

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  renderer.resize(video.videoWidth, video.videoHeight);

  const w = canvas.width;
  const h = canvas.height;

  const removalMaskCanvas = prepareRemovalMaskCanvas(
    removalMaskCanvasRef,
    removalMaskCtxRef,
    video.videoWidth,
    video.videoHeight
  );
  let stampedVideoCanvas: HTMLCanvasElement | null = null;
  let stampedVideoCtx: CanvasRenderingContext2D | null = null;
  if (!renderer.usesGpuCloneStamp) {
    ({ stampedVideoCanvas, stampedVideoCtx } = prepareCloneStampBaseCanvases(
      stampedVideoCanvasRef,
      removalMaskCanvasRef,
      removalMaskCtxRef,
      video.videoWidth,
      video.videoHeight
    ));
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
  }
  const frameSource: HTMLCanvasElement | HTMLVideoElement = stampedVideoCanvas ?? video;

  const buffers = ensureCanvasBuffers({
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    frameSource,
    needsCanvas2dEffects: !renderer.usesGpuTemporalEffects,
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

  const isTimeChanged = Math.abs(video.currentTime - lastProcessedVideoTimeRef.current) > 0.0001;

  if ((video.paused || video.ended) && !isTimeChanged) {
    if (renderer.usesGpuCloneStamp) ctx.clearRect(0, 0, w, h);
    renderPausedFrame({
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
      presentTemporalEffects: !renderer.usesGpuTemporalEffects,
      presentBase: !renderer.usesGpuCloneStamp,
    });
    renderer.clearTemporalState();
    renderer.render({
      source: renderer.usesGpuCloneStamp ? video : canvas,
      povLayer: currentSettings.enablePoiMode && !currentSettings.poiPovEnabled
        ? trailCanvas
        : povCanvasRef.current ?? undefined,
      overlayLayer: renderer.usesGpuCloneStamp ? canvas : undefined,
      cloneMask: removalMaskCanvas,
      cloneMaskRevision: removalMaskRevisionRef.current,
      settings: currentSettings,
      time: now,
      updateTemporalState: false,
    });
    return;
  }

  lastProcessedVideoTimeRef.current = video.currentTime;

  if (renderer.usesGpuCloneStamp) ctx.clearRect(0, 0, w, h);
  const { isStrobeActive, isStrobeTriggered, nextLastStrobeTime } = renderViewportFrame({
    ctx,
    frameSource,
    strobeVideoCanvas,
    strobeVideoCtx,
    currentSettings,
    now,
    lastStrobeTime: lastStrobeTimeRef.current,
    w,
    h,
    presentStrobe: !renderer.usesGpuTemporalEffects,
  });
  lastStrobeTimeRef.current = nextLastStrobeTime;

  extractMotion({
    frameSource,
    procCanvas,
    procCtx,
    trackingFilter,
    bgDataRef,
    motionMaskDataRef,
    smoothingCanvasRef,
    currentSettings,
  });

  if (!renderer.usesGpuTemporalEffects && blurredVideoCanvas && blurredVideoCtx) {
    processMotionBlur({
      currentSettings,
      blurredVideoCtx,
      stampedVideoCanvas: stampedVideoCanvas!,
      blurredVideoCanvas,
      maskedBlurCanvasRef,
      video,
      procCanvas,
      ctx,
      w,
      h,
    });
  }

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
    renderStandardTrails: !renderer.usesGpuTemporalEffects,
    presentPov: !renderer.usesGpuTemporalEffects,
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

  renderer.render({
    source: renderer.usesGpuCloneStamp ? video : canvas,
    motionMask: procCanvas,
    povLayer: currentSettings.enablePoiMode && !currentSettings.poiPovEnabled
      ? trailCanvas
      : povCanvasRef.current ?? undefined,
    overlayLayer: renderer.usesGpuCloneStamp ? canvas : undefined,
    cloneMask: removalMaskCanvas,
    cloneMaskRevision: removalMaskRevisionRef.current,
    settings: currentSettings,
    time: now,
    isStrobeActive,
    isStrobeTriggered,
    updateTemporalState: true,
  });

  scheduleNextFrame(animationFrameIdRef, render);
}
