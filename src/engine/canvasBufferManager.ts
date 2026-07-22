import React from 'react';

export interface EnsureCanvasBuffersParams {
  videoWidth: number;
  videoHeight: number;
  frameSource: HTMLCanvasElement | HTMLVideoElement;
  needsCanvas2dEffects: boolean;
  processingCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  trailCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  blurredVideoCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  strobeVideoCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  povCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

export interface CanvasBuffers {
  procCanvas: HTMLCanvasElement;
  procCtx: CanvasRenderingContext2D;
  trailCanvas: HTMLCanvasElement;
  trailCtx: CanvasRenderingContext2D;
  blurredVideoCanvas: HTMLCanvasElement | null;
  blurredVideoCtx: CanvasRenderingContext2D | null;
  strobeVideoCanvas: HTMLCanvasElement | null;
  strobeVideoCtx: CanvasRenderingContext2D | null;
  povCanvas: HTMLCanvasElement;
}

export function ensureCanvasBuffers({
  videoWidth,
  videoHeight,
  frameSource,
  needsCanvas2dEffects,
  processingCanvasRef,
  trailCanvasRef,
  blurredVideoCanvasRef,
  strobeVideoCanvasRef,
  povCanvasRef,
}: EnsureCanvasBuffersParams): CanvasBuffers | null {
  if (!processingCanvasRef.current) {
    processingCanvasRef.current = document.createElement('canvas');
  }
  const procCanvas = processingCanvasRef.current;
  const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

  if (!trailCanvasRef.current) {
    trailCanvasRef.current = document.createElement('canvas');
  }
  const trailCanvas = trailCanvasRef.current;
  const trailCtx = trailCanvas.getContext('2d');

  if (needsCanvas2dEffects && !blurredVideoCanvasRef.current) {
    blurredVideoCanvasRef.current = document.createElement('canvas');
  }
  const blurredVideoCanvas = blurredVideoCanvasRef.current;
  const blurredVideoCtx = blurredVideoCanvas?.getContext('2d') ?? null;

  if (needsCanvas2dEffects && !strobeVideoCanvasRef.current) {
    strobeVideoCanvasRef.current = document.createElement('canvas');
  }
  const strobeVideoCanvas = strobeVideoCanvasRef.current;
  const strobeVideoCtx = strobeVideoCanvas?.getContext('2d') ?? null;

  if (!povCanvasRef.current) {
    povCanvasRef.current = document.createElement('canvas');
  }
  const povCanvas = povCanvasRef.current;

  procCanvas.width = 640;
  procCanvas.height = 480;

  if (!procCtx || !trailCtx || (needsCanvas2dEffects && !blurredVideoCtx)) return null;

  if (trailCanvas.width !== videoWidth || trailCanvas.height !== videoHeight) {
    trailCanvas.width = videoWidth;
    trailCanvas.height = videoHeight;
  }
  if (povCanvas.width !== videoWidth || povCanvas.height !== videoHeight) {
    povCanvas.width = videoWidth;
    povCanvas.height = videoHeight;
  }
  if (blurredVideoCanvas && blurredVideoCtx && (blurredVideoCanvas.width !== videoWidth || blurredVideoCanvas.height !== videoHeight)) {
    blurredVideoCanvas.width = videoWidth;
    blurredVideoCanvas.height = videoHeight;
    blurredVideoCtx.drawImage(frameSource, 0, 0, videoWidth, videoHeight);
  }
  if (strobeVideoCanvas && (strobeVideoCanvas.width !== videoWidth || strobeVideoCanvas.height !== videoHeight)) {
    strobeVideoCanvas.width = videoWidth;
    strobeVideoCanvas.height = videoHeight;
    if (strobeVideoCtx) {
      strobeVideoCtx.drawImage(frameSource, 0, 0, videoWidth, videoHeight);
    }
  }

  return {
    procCanvas,
    procCtx,
    trailCanvas,
    trailCtx,
    blurredVideoCanvas,
    blurredVideoCtx,
    strobeVideoCanvas,
    strobeVideoCtx,
    povCanvas,
  };
}
