import type React from 'react';
import type { TrackingSettings } from '../types';
import { updateBackgroundAndExtractMotion } from '../utils/cv';

export interface MotionExtractorParams {
  frameSource: HTMLCanvasElement | HTMLVideoElement;
  procCanvas: HTMLCanvasElement;
  procCtx: CanvasRenderingContext2D;
  trackingFilter: string;
  bgDataRef: React.MutableRefObject<Float32Array | null>;
  motionMaskDataRef: React.MutableRefObject<ImageData | null>;
  smoothingCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  currentSettings: TrackingSettings;
}

export function extractMotion(params: MotionExtractorParams): void {
  const {
    frameSource,
    procCanvas,
    procCtx,
    trackingFilter,
    bgDataRef,
    motionMaskDataRef,
    smoothingCanvasRef,
    currentSettings,
  } = params;

  // Draw frame to low-res canvas for high performance (using sharp video)
  procCtx.filter = trackingFilter;
  procCtx.drawImage(frameSource, 0, 0, procCanvas.width, procCanvas.height);
  procCtx.filter = 'none';

  let procImageData: ImageData;
  try {
    procImageData = procCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
  } catch (err) {
    console.warn('Failed to get tracking image data (possibly tainted canvas):', err);
    // Fallback to empty image data to prevent crash
    procImageData = new ImageData(procCanvas.width, procCanvas.height);
  }

  if (!bgDataRef.current || bgDataRef.current.length !== procImageData.data.length) {
    bgDataRef.current = new Float32Array(procImageData.data.length);
    for (let i = 0; i < procImageData.data.length; i++) bgDataRef.current[i] = procImageData.data[i];
  }
  if (!motionMaskDataRef.current || motionMaskDataRef.current.width !== procCanvas.width) {
    motionMaskDataRef.current = new ImageData(procCanvas.width, procCanvas.height);
  }

  updateBackgroundAndExtractMotion(
    procImageData,
    bgDataRef.current,
    motionMaskDataRef.current,
    currentSettings.motionThreshold,
    currentSettings.bgLearningRate,
    currentSettings.invertColors,
    currentSettings.enableLightTracking,
    currentSettings.lightThreshold,
    currentSettings.edgeAntiAliasing
  );

  // Write the motion mask pixels to procCanvas immediately so we can use it for blur overlay and trails
  procCtx.putImageData(motionMaskDataRef.current, 0, 0);

  // Apply Line Smoothness (Anti-aliasing/Blur) to the mask
  if (currentSettings.lineSmoothness > 0) {
    if (!smoothingCanvasRef.current) {
      smoothingCanvasRef.current = document.createElement('canvas');
    }
    const smoothCanvas = smoothingCanvasRef.current;
    if (smoothCanvas.width !== procCanvas.width || smoothCanvas.height !== procCanvas.height) {
      smoothCanvas.width = procCanvas.width;
      smoothCanvas.height = procCanvas.height;
    }
    const smoothCtx = smoothCanvas.getContext('2d');
    if (smoothCtx) {
      smoothCtx.clearRect(0, 0, smoothCanvas.width, smoothCanvas.height);
      smoothCtx.filter = `blur(${currentSettings.lineSmoothness}px)`;
      smoothCtx.drawImage(procCanvas, 0, 0);
      smoothCtx.filter = 'none';

      procCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
      procCtx.drawImage(smoothCanvas, 0, 0);
    }
  }
}
