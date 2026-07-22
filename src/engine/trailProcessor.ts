import type React from 'react';
import type { TrackingSettings } from '../types';
import { updatePoiPattern } from '../utils/poiPatternGenerator';
import { detectBlobs } from '../utils/blobDetection';
import {
  createPovProjectionState,
  samplePovColumns,
  matchTrackedPoints,
  calculateLedStripGeometry,
  PovProjectionState,
  PovTrailEntry,
  PovSample,
  TrackedPointInput,
} from '../utils/pov';
import { drawPovSample } from '../utils/ledShaders';
import { processPixelComets, type PixelCometState } from './pixelCometProcessor';
import {
  renderClubDepthTunnels,
  renderLightPaintingSweeps,
  type LightPaintingState,
} from './lightPaintingProcessor';

export interface TrailProcessorParams {
  currentSettings: TrackingSettings;
  isStrobeTriggered: boolean;
  now: number;
  w: number;
  h: number;
  ctx: CanvasRenderingContext2D;
  trailCanvas: HTMLCanvasElement;
  trailCtx: CanvasRenderingContext2D;
  procCanvas: HTMLCanvasElement;
  frameCountAbsRef: React.MutableRefObject<number>;
  colorCycleAngleRef: React.MutableRefObject<number>;
  driftCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  lightPaintingStateRef: React.MutableRefObject<LightPaintingState>;
  poiPatternCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  poiPatternDataRef: React.MutableRefObject<ImageData | null>;
  poiCustomImageElementRef: React.MutableRefObject<HTMLImageElement | null>;
  motionMaskDataRef: React.MutableRefObject<ImageData | null>;
  isPaintingRef: React.MutableRefObject<boolean>;
  hoverPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  trackedPointsRef: React.MutableRefObject<TrackedPointInput[]>;
  nextTrackedIdRef: React.MutableRefObject<number>;
  povCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  lastSettingsStrRef: React.MutableRefObject<string>;
  poiColumnIndexRef: React.MutableRefObject<number>;
  poiTrailBufferRef: React.MutableRefObject<Map<number, PovTrailEntry[]>>;
  poiProjectionStateRef: React.MutableRefObject<Map<number, PovProjectionState>>;
  poiAccumulatedDistRef: React.MutableRefObject<Map<number, number>>;
  pixelCometStateRef: React.MutableRefObject<PixelCometState>;
  pixelCometLastTimeRef: React.MutableRefObject<number>;
  renderStandardTrails?: boolean;
  presentPov?: boolean;
}

export function processTrails(params: TrailProcessorParams): void {
  const {
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
    lightPaintingStateRef,
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
    pixelCometStateRef,
    pixelCometLastTimeRef,
    renderStandardTrails = true,
    presentPov = true,
  } = params;

  const shouldProcessTrails = currentSettings.enableTrails;
  const isComet = currentSettings.pixelEffectMode === 'comets';
  const usePov = !isComet && currentSettings.poiPovEnabled;
  if (currentSettings.trailEffectMode !== 'light-painting') lightPaintingStateRef.current.clear();

  if (!renderStandardTrails && !currentSettings.enablePoiMode) {
    trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    if (povCanvasRef.current) {
      const povCtx = povCanvasRef.current.getContext('2d');
      if (povCtx) povCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
    }
    trackedPointsRef.current = [];
    poiTrailBufferRef.current.clear();
    poiProjectionStateRef.current.clear();
    poiAccumulatedDistRef.current.clear();
    pixelCometStateRef.current.clear();
    return;
  }

  if (shouldProcessTrails) {
    // Effect: Color Cycle updates continuously for smooth hue rotation
    frameCountAbsRef.current++;
    colorCycleAngleRef.current = (colorCycleAngleRef.current + currentSettings.colorCycleSpeed) % 360;

    if (isStrobeTriggered) {
      // 1. Effect: Feedback Zoom and Smoke Drift (only on strobe trigger to avoid smearing and rapid vanishing)
      if (currentSettings.verticalDrift !== 0 || currentSettings.horizontalDrift !== 0 || currentSettings.feedbackZoom !== 1.0) {
        if (!driftCanvasRef.current) {
          driftCanvasRef.current = document.createElement('canvas');
        }
        const tempCanvas = driftCanvasRef.current;
        if (tempCanvas.width !== trailCanvas.width || tempCanvas.height !== trailCanvas.height) {
          tempCanvas.width = trailCanvas.width;
          tempCanvas.height = trailCanvas.height;
        }
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(trailCanvas, 0, 0);
          trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
          
          trailCtx.save();
          // Center for scaling
          trailCtx.translate(trailCanvas.width / 2, trailCanvas.height / 2);
          trailCtx.scale(currentSettings.feedbackZoom, currentSettings.feedbackZoom);
          trailCtx.translate(-trailCanvas.width / 2, -trailCanvas.height / 2);
          
          // Apply drift
          trailCtx.drawImage(tempCanvas, currentSettings.horizontalDrift, currentSettings.verticalDrift);
          trailCtx.restore();
        }
      }

      // 2. Apply fade (only on strobe trigger to preserve trail persistence across intervals)
      const fadeRate = currentSettings.echoFadeRate;
      trailCtx.globalCompositeOperation = 'destination-out';
      trailCtx.fillStyle = `rgba(0, 0, 0, ${fadeRate})`;
      trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);

      // 3. Stroboscopic rendering: Draw new motion mask snapshot onto the trail canvas
      trailCtx.globalCompositeOperation = 'source-over';
      
      const filters = [];
      if (currentSettings.blurAmount > 0) {
        filters.push(`blur(${currentSettings.blurAmount}px)`);
      }
      
      const totalHueShift = (currentSettings.hueRotate + colorCycleAngleRef.current) % 360;
      if (totalHueShift > 0) {
        filters.push(`hue-rotate(${totalHueShift}deg)`);
      }
      
      trailCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';
      
      if (currentSettings.enablePoiMode) {
        const patternCanvas = poiPatternCanvasRef.current || (poiPatternCanvasRef.current = document.createElement('canvas'));
        if (!isComet && !poiPatternDataRef.current) {
          updatePoiPattern(patternCanvas, currentSettings, poiCustomImageElementRef.current);
          const pCtx = patternCanvas.getContext('2d');
          if (pCtx && patternCanvas.width > 0 && patternCanvas.height > 0) {
            poiPatternDataRef.current = pCtx.getImageData(0, 0, patternCanvas.width, patternCanvas.height);
          }
        }

        if (patternCanvas) {
          const rawBlobs = detectBlobs(motionMaskDataRef.current!, currentSettings.poiMaxPoints);
          const scaleX = trailCanvas.width / procCanvas.width;
          const scaleY = trailCanvas.height / procCanvas.height;
          const currentBlobs = rawBlobs.map(b => ({
            x: b.x * scaleX,
            y: b.y * scaleY,
            angle: b.angle,
            length: b.length,
            aspectRatio: b.aspectRatio
          }));

          if (isPaintingRef.current && hoverPosRef.current) {
            const mouseScaleX = trailCanvas.width / w;
            const mouseScaleY = trailCanvas.height / h;
            const mX = hoverPosRef.current.x * mouseScaleX;
            const mY = hoverPosRef.current.y * mouseScaleY;
            const closeToExisting = currentBlobs.some(b => Math.hypot(b.x - mX, b.y - mY) < 15);
            if (!closeToExisting) {
              currentBlobs.push({
                x: mX,
                y: mY,
                angle: 0,
                length: 100,
                aspectRatio: 2.0
              });
            }
          }

          const maxMatchDistance = 100;
          trackedPointsRef.current = matchTrackedPoints(
            currentBlobs,
            trackedPointsRef.current,
            maxMatchDistance,
            now,
            () => nextTrackedIdRef.current++
          );

          if (isComet && povCanvasRef.current) {
            poiTrailBufferRef.current.clear();
            poiProjectionStateRef.current.clear();
            poiAccumulatedDistRef.current.clear();
            processPixelComets({
              trackedProps: trackedPointsRef.current.filter((point) => point.lastSeen === now),
              elapsedMs: pixelCometLastTimeRef.current ? now - pixelCometLastTimeRef.current : 1000 / 60,
              settings: currentSettings,
              canvas: povCanvasRef.current,
              ctx: povCanvasRef.current.getContext('2d')!,
              state: pixelCometStateRef.current,
            });
            pixelCometLastTimeRef.current = now;
          } else {
            pixelCometStateRef.current.clear();
            pixelCometLastTimeRef.current = now;
          }

          const patternWidth = patternCanvas.width;
          const patternHeight = patternCanvas.height;
          const imgData = poiPatternDataRef.current;

          if (!isComet && imgData && imgData.width > 0 && imgData.height > 0 && patternWidth > 0) {
            const povCanvas = povCanvasRef.current;
            const povCtx = povCanvas ? povCanvas.getContext('2d') : null;

            // Clear canvas immediately if key settings change
            const settingsStr = `${currentSettings.poiPatternType}-${currentSettings.poiRenderMode}-${currentSettings.poiWidth}-${currentSettings.poiOrientation}-${currentSettings.poiGlowEnabled}-${currentSettings.poiGlowRadius}`;
            if (lastSettingsStrRef.current !== settingsStr) {
              lastSettingsStrRef.current = settingsStr;
              if (povCtx && povCanvas) {
                povCtx.clearRect(0, 0, povCanvas.width, povCanvas.height);
              }
            }

            const povRetention = currentSettings.poiPovRetention || 400;
            const povFadeMode = currentSettings.poiPovFadeMode || 'exponential';
            const columnSpacing = currentSettings.poiPovColumnSpacing || 3;
            const motionMode = currentSettings.poiPovMotionMode || 'free';
            const glowEnabled = currentSettings.poiGlowEnabled;
            const glowRadius = currentSettings.poiGlowRadius || 6;
            const glowIntensity = currentSettings.poiGlowIntensity || 0.5;
            const ledCountOverride = currentSettings.poiLedCount || 0;

            // Advance global column index
            poiColumnIndexRef.current = (poiColumnIndexRef.current + currentSettings.poiSpeedMultiplier) % patternWidth;

            // 1. Process active tracked points to update trail buffers
            for (const tp of trackedPointsRef.current) {
              if (tp.lastSeen !== now) continue;

              // Frame skip interval
              const frameInterval = currentSettings.poiFrameInterval || 1;
              if (tp.envelopeFrame % frameInterval !== 0) continue;

              // Envelope opacity (existing ADSR logic)
              const T_in = currentSettings.poiFadeInTime || 0;
              const T_hold = currentSettings.poiHoldTime || 0;
              const T_out = currentSettings.poiFadeOutTime || 0;
              const T_wait = currentSettings.poiWaitTime || 0;
              const T_total = T_in + T_hold + T_out + T_wait;

              let envelopeFactor = 1.0;
              if (T_total > 0) {
                const frameInCycle = tp.envelopeFrame % T_total;
                if (frameInCycle < T_in) {
                  envelopeFactor = T_in > 0 ? frameInCycle / T_in : 1.0;
                }
                else if (frameInCycle < T_in + T_hold) {
                  envelopeFactor = 1.0;
                }
                else if (frameInCycle < T_in + T_hold + T_out) {
                  const progress = frameInCycle - (T_in + T_hold);
                  envelopeFactor = T_out > 0 ? 1.0 - (progress / T_out) : 0.0;
                }
                else {
                  envelopeFactor = 0.0;
                }
              }

              const baseOpacity = currentSettings.poiOpacity !== undefined ? currentSettings.poiOpacity : 1.0;
              const finalOpacity = baseOpacity * envelopeFactor;

              if (finalOpacity <= 0.01) {
                continue;
              }

              const L = currentSettings.poiHeight;
              const W = currentSettings.poiWidth;
              const orientation = currentSettings.poiOrientation;
              const finalL = L > 0 ? L : tp.length;

              // === Determine column index ===
              let colIdx = 0;
              const mappingMode = currentSettings.poiMappingMode || 'time';
              if (mappingMode === 'time') {
                colIdx = Math.floor(poiColumnIndexRef.current) % patternWidth;
              } else if (mappingMode === 'angle') {
                const normalizedAngle = (tp.angle + Math.PI) / (Math.PI * 2);
                colIdx = Math.floor(normalizedAngle * patternWidth) % patternWidth;
                if (colIdx < 0) colIdx += patternWidth;
              } else if (mappingMode === 'spatial') {
                const spatialScale = 0.5;
                colIdx = Math.floor(tp.x * spatialScale) % patternWidth;
                if (colIdx < 0) colIdx += patternWidth;
              }

              if (usePov) {
                // === NEW POV MODE (refactored sampling) ===
                const trail = poiTrailBufferRef.current.get(tp.id) || [];

                const samples: PovSample[] = samplePovColumns({
                  id: tp.id,
                  x: tp.x,
                  y: tp.y,
                  prevX: tp.prevX,
                  prevY: tp.prevY,
                  angle: tp.angle,
                  length: finalL,
                  opacity: finalOpacity,
                  timestamp: now,
                  colIdx,
                  motionMode: motionMode as 'circular' | 'free',
                  circularCenter: {
                    x: currentSettings.poiCenterRelativeX * trailCanvas.width,
                    y: currentSettings.poiCenterRelativeY * trailCanvas.height,
                  },
                  columnSpacing,
                  patternWidth,
                  projectionState: (
                    poiProjectionStateRef.current.get(tp.id)
                    || createPovProjectionState()
                  ),
                  existingTrail: trail,
                });

                if (samples.length > 0) {
                  poiProjectionStateRef.current.set(tp.id, samples[samples.length - 1].state);
                  for (const s of samples) {
                    trail.push({
                      x: s.x,
                      y: s.y,
                      angle: s.angle,
                      colIdx: s.colIdx,
                      length: s.length,
                      opacity: s.opacity,
                      timestamp: s.timestamp,
                    });
                  }
                  poiTrailBufferRef.current.set(tp.id, trail);
                }

                while (trail.length > 500) {
                  trail.shift();
                }
              } else {
                // === LEGACY MODE (original single-column painting) ===
                const renderMode = currentSettings.poiRenderMode || 'dots';
                const drawLEDs = (
                  drawDot: (y_rel: number, colorStr: string) => void
                ) => {
                  const numLEDsLegacy = Math.max(5, Math.floor(finalL / 8));
                  const px = colIdx % patternWidth;
                  const data = imgData.data;

                  for (let i = 0; i < numLEDsLegacy; i++) {
                    const y_ratio = numLEDsLegacy > 1 ? i / (numLEDsLegacy - 1) : 0.5;
                    const y_rel = -finalL / 2 + y_ratio * finalL;
                    
                    const py = Math.floor(y_ratio * (patternHeight - 1));
                    const idx = (py * patternWidth + px) * 4;
                    const r = data[idx];
                    const g = data[idx+1];
                    const b = data[idx+2];
                    const a = data[idx+3];

                    if (a > 15) {
                      const colorStr = `rgba(${r}, ${g}, ${b}, ${(a / 255) * finalOpacity})`;
                      drawDot(y_rel, colorStr);
                    }
                  }
                };

                trailCtx.save();
                trailCtx.globalAlpha = finalOpacity;

                if (orientation === 'vertical') {
                  if (renderMode === 'dots') {
                    drawLEDs((y_rel, colorStr) => {
                      trailCtx.fillStyle = colorStr;
                      trailCtx.beginPath();
                      trailCtx.arc(tp.x, tp.y + y_rel, W / 2, 0, Math.PI * 2);
                      trailCtx.fill();
                    });
                  } else {
                    trailCtx.drawImage(
                      patternCanvas,
                      colIdx, 0, 1, patternCanvas.height,
                      tp.x - W / 2, tp.y - finalL / 2, W, finalL
                    );
                  }
                }
                else if (orientation === 'horizontal') {
                  if (renderMode === 'dots') {
                    drawLEDs((y_rel, colorStr) => {
                      trailCtx.fillStyle = colorStr;
                      trailCtx.beginPath();
                      trailCtx.arc(tp.x + y_rel, tp.y, W / 2, 0, Math.PI * 2);
                      trailCtx.fill();
                    });
                  } else {
                    trailCtx.drawImage(
                      patternCanvas,
                      colIdx, 0, 1, patternCanvas.height,
                      tp.x - finalL / 2, tp.y - W / 2, finalL, W
                    );
                  }
                }
                else if (orientation === 'motion') {
                  let angle = 0;
                  if (tp.prevX !== undefined && tp.prevY !== undefined) {
                    const dx = tp.x - tp.prevX;
                    const dy = tp.y - tp.prevY;
                    if (Math.hypot(dx, dy) > 2) {
                      angle = Math.atan2(dy, dx) + Math.PI / 2;
                    }
                  }
                  trailCtx.translate(tp.x, tp.y);
                  trailCtx.rotate(angle);
                  if (renderMode === 'dots') {
                    drawLEDs((y_rel, colorStr) => {
                      trailCtx.fillStyle = colorStr;
                      trailCtx.beginPath();
                      trailCtx.arc(0, y_rel, W / 2, 0, Math.PI * 2);
                      trailCtx.fill();
                    });
                  } else {
                    trailCtx.drawImage(
                      patternCanvas,
                      colIdx, 0, 1, patternCanvas.height,
                      -W / 2, -finalL / 2, W, finalL
                    );
                  }
                }
                else if (orientation === 'radial') {
                  const cx = currentSettings.poiCenterRelativeX * trailCanvas.width;
                  const cy = currentSettings.poiCenterRelativeY * trailCanvas.height;
                  const angle = Math.atan2(tp.y - cy, tp.x - cx);

                  trailCtx.translate(tp.x, tp.y);
                  trailCtx.rotate(angle);
                  if (renderMode === 'dots') {
                    drawLEDs((y_rel, colorStr) => {
                      trailCtx.fillStyle = colorStr;
                      trailCtx.beginPath();
                      trailCtx.arc(0, y_rel, W / 2, 0, Math.PI * 2);
                      trailCtx.fill();
                    });
                  } else {
                    trailCtx.drawImage(
                      patternCanvas,
                      colIdx, 0, 1, patternCanvas.height,
                      -W / 2, -finalL / 2, W, finalL
                    );
                  }
                }
                else if (orientation === 'club') {
                  trailCtx.translate(tp.x, tp.y);
                  trailCtx.rotate(tp.angle);
                  if (renderMode === 'dots') {
                    drawLEDs((y_rel, colorStr) => {
                      trailCtx.fillStyle = colorStr;
                      trailCtx.beginPath();
                      trailCtx.arc(0, y_rel, W / 2, 0, Math.PI * 2);
                      trailCtx.fill();
                    });
                  } else {
                    trailCtx.drawImage(
                      patternCanvas,
                      colIdx, 0, 1, patternCanvas.height,
                      -W / 2, -finalL / 2, W, finalL
                    );
                  }
                }

                trailCtx.restore();
              }
            }

            // 2. Render all visible trails in the buffer (POV mode)
            if (usePov && povCanvasRef.current) {
              const povCanvas = povCanvasRef.current;
              const povCtx = povCanvas.getContext('2d');
              if (povCtx) {
                povCtx.clearRect(0, 0, povCanvas.width, povCanvas.height);

                const W = currentSettings.poiWidth;
                const orientation = currentSettings.poiOrientation;
                for (const [id, trail] of poiTrailBufferRef.current) {
                  // Evict old entries
                  const cutoff = now - povRetention;
                  while (trail.length > 0 && trail[0].timestamp < cutoff) {
                    trail.shift();
                  }

                  if (trail.length === 0) {
                    poiTrailBufferRef.current.delete(id);
                    poiAccumulatedDistRef.current.delete(id);
                    continue;
                  }

                  const cx = currentSettings.poiCenterRelativeX * povCanvas.width;
                  const cy = currentSettings.poiCenterRelativeY * povCanvas.height;

                  for (const entry of trail) {
                    const age = now - entry.timestamp;
                    let fadeFactor = 1.0;
                    if (povFadeMode === 'linear') {
                      fadeFactor = 1.0 - (age / povRetention);
                    } else if (povFadeMode === 'exponential') {
                      fadeFactor = Math.pow(1.0 - (age / povRetention), 2.5);
                    } else if (povFadeMode === 'sharp') {
                      fadeFactor = age < povRetention * 0.8 ? 1.0 : (1.0 - (age - povRetention * 0.8) / (povRetention * 0.2));
                    }
                    fadeFactor = Math.max(0, Math.min(1, fadeFactor));
                    const entryOpacity = entry.opacity * fadeFactor;
                    if (entryOpacity <= 0.01) continue;

                    const geom = calculateLedStripGeometry(
                      entry.x,
                      entry.y,
                      entry.angle,
                      entry.length,
                      entry.motionAngle,
                      orientation,
                      cx,
                      cy,
                      motionMode as 'circular' | 'free'
                    );

                    const numLEDs = ledCountOverride > 0 ? ledCountOverride : Math.max(8, Math.floor(entry.length / 5));
                    drawPovSample(povCtx, imgData, {
                      x: entry.x,
                      y: entry.y,
                      colIdx: entry.colIdx,
                      length: entry.length,
                      width: W,
                      opacity: entryOpacity,
                      ledCount: numLEDs,
                      geometry: geom,
                    });
                  }
                }
              }
            }
          }
        }
      } else {
        if (povCanvasRef.current) {
          const povCtx = povCanvasRef.current.getContext('2d');
          if (povCtx) povCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
        }
        poiTrailBufferRef.current.clear();
        poiProjectionStateRef.current.clear();
        poiAccumulatedDistRef.current.clear();
        pixelCometStateRef.current.clear();
        if (currentSettings.trailEffectMode !== 'standard' && motionMaskDataRef.current) {
          const scaleX = trailCanvas.width / procCanvas.width;
          const scaleY = trailCanvas.height / procCanvas.height;
          const maxPropLength = Math.max(procCanvas.width, procCanvas.height) * 0.7;
          const blobs = detectBlobs(motionMaskDataRef.current, 3)
            .filter((blob) => blob.aspectRatio >= 1.4 && blob.length <= maxPropLength)
            .map((blob) => ({
              ...blob,
              x: blob.x * scaleX,
              y: blob.y * scaleY,
              length: blob.length * Math.max(scaleX, scaleY),
            }));
          trackedPointsRef.current = matchTrackedPoints(
            blobs,
            trackedPointsRef.current,
            100,
            now,
            () => nextTrackedIdRef.current++,
          );
          const effectParams = {
            trackedProps: trackedPointsRef.current.filter((point) => (
              point.lastSeen === now && point.envelopeFrame >= 2
            )),
            sourceData: motionMaskDataRef.current,
            outputWidth: trailCanvas.width,
            outputHeight: trailCanvas.height,
            ctx: trailCtx,
            state: lightPaintingStateRef.current,
          };
          if (currentSettings.trailEffectMode === 'depth-tunnel') {
            renderClubDepthTunnels(effectParams);
          } else {
            renderLightPaintingSweeps(effectParams);
          }
        } else {
          trackedPointsRef.current = [];
          lightPaintingStateRef.current.clear();
          trailCtx.drawImage(procCanvas, 0, 0, trailCanvas.width, trailCanvas.height);
        }
      }
      trailCtx.filter = 'none';
    }

    // Determine blend mode (fallback to 'screen' if compositeMode is 'none')
    const blendMode = (currentSettings.compositeMode === 'none' || !currentSettings.compositeMode)
      ? 'screen'
      : currentSettings.compositeMode;

    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    if (renderStandardTrails) ctx.drawImage(trailCanvas, 0, 0, w, h);
    if (presentPov && currentSettings.enablePoiMode && (usePov || isComet) && povCanvasRef.current) {
      const povCanvas = povCanvasRef.current;
      const glowEnabled = isComet
        ? currentSettings.cometGlowIntensity > 0
        : currentSettings.poiGlowEnabled;
      const glowRadius = isComet
        ? 2 + currentSettings.cometGlowIntensity * 6
        : currentSettings.poiGlowRadius || 6;
      const glowIntensity = isComet
        ? currentSettings.cometGlowIntensity
        : currentSettings.poiGlowIntensity || 0.5;

      // 1. Glow pass
      if (glowEnabled && glowRadius > 0 && glowIntensity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = `blur(${glowRadius}px)`;
        ctx.globalAlpha = glowIntensity;
        ctx.drawImage(povCanvas, 0, 0, w, h);
        ctx.restore();
      }
      // 2. Core pass
      ctx.save();
      ctx.drawImage(povCanvas, 0, 0, w, h);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  } else {
    trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    if (povCanvasRef.current) {
      const povCtx = povCanvasRef.current.getContext('2d');
      if (povCtx) povCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
    }
    poiTrailBufferRef.current.clear();
    poiProjectionStateRef.current.clear();
    poiAccumulatedDistRef.current.clear();
    pixelCometStateRef.current.clear();
  }
}
