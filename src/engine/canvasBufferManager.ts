import React from 'react';

export interface EnsureCanvasBuffersParams {
  videoWidth: number;
  videoHeight: number;
  cameraFilter: string;
  stampedVideoCanvas: HTMLCanvasElement;
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
  blurredVideoCanvas: HTMLCanvasElement;
  blurredVideoCtx: CanvasRenderingContext2D;
  strobeVideoCanvas: HTMLCanvasElement;
  strobeVideoCtx: CanvasRenderingContext2D | null;
  povCanvas: HTMLCanvasElement;
}

export function ensureCanvasBuffers({
  videoWidth,
  videoHeight,
  cameraFilter,
  stampedVideoCanvas,
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

  if (!blurredVideoCanvasRef.current) {
    blurredVideoCanvasRef.current = document.createElement('canvas');
  }
  const blurredVideoCanvas = blurredVideoCanvasRef.current;
  const blurredVideoCtx = blurredVideoCanvas.getContext('2d');

  if (!strobeVideoCanvasRef.current) {
    strobeVideoCanvasRef.current = document.createElement('canvas');
  }
  const strobeVideoCanvas = strobeVideoCanvasRef.current;
  const strobeVideoCtx = strobeVideoCanvas.getContext('2d');

  if (!povCanvasRef.current) {
    povCanvasRef.current = document.createElement('canvas');
  }
  const povCanvas = povCanvasRef.current;

  procCanvas.width = 640;
  procCanvas.height = 480;

  if (!procCtx || !trailCtx || !blurredVideoCtx) return null;

  if (trailCanvas.width !== videoWidth || trailCanvas.height !== videoHeight) {
    trailCanvas.width = videoWidth;
    trailCanvas.height = videoHeight;
  }
  if (povCanvas.width !== videoWidth || povCanvas.height !== videoHeight) {
    povCanvas.width = videoWidth;
    povCanvas.height = videoHeight;
  }
  if (blurredVideoCanvas.width !== videoWidth || blurredVideoCanvas.height !== videoHeight) {
    blurredVideoCanvas.width = videoWidth;
    blurredVideoCanvas.height = videoHeight;
    blurredVideoCtx.filter = cameraFilter;
    blurredVideoCtx.drawImage(stampedVideoCanvas, 0, 0, videoWidth, videoHeight);
    blurredVideoCtx.filter = 'none';
  }
  if (strobeVideoCanvas.width !== videoWidth || strobeVideoCanvas.height !== videoHeight) {
    strobeVideoCanvas.width = videoWidth;
    strobeVideoCanvas.height = videoHeight;
    if (strobeVideoCtx) {
      strobeVideoCtx.filter = cameraFilter;
      strobeVideoCtx.drawImage(stampedVideoCanvas, 0, 0, videoWidth, videoHeight);
      strobeVideoCtx.filter = 'none';
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
