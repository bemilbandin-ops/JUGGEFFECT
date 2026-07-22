import type React from 'react';

export interface PreparedCloneStampCanvases {
  stampedVideoCanvas: HTMLCanvasElement;
  stampedVideoCtx: CanvasRenderingContext2D | null;
  removalMaskCanvas: HTMLCanvasElement;
  removalMaskCtx: CanvasRenderingContext2D | null;
}

export function prepareRemovalMaskCanvas(
  removalMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  removalMaskCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  if (!removalMaskCanvasRef.current) {
    removalMaskCanvasRef.current = document.createElement('canvas');
    removalMaskCtxRef.current = removalMaskCanvasRef.current.getContext('2d');
  }
  const removalMaskCanvas = removalMaskCanvasRef.current;
  const removalMaskCtx = removalMaskCtxRef.current;
  if (removalMaskCanvas.width !== targetWidth || removalMaskCanvas.height !== targetHeight) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = removalMaskCanvas.width;
    tempCanvas.height = removalMaskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx && removalMaskCanvas.width > 0 && removalMaskCanvas.height > 0) {
      tempCtx.drawImage(removalMaskCanvas, 0, 0);
    }
    removalMaskCanvas.width = targetWidth;
    removalMaskCanvas.height = targetHeight;
    if (removalMaskCtx) {
      removalMaskCtx.lineCap = 'round';
      removalMaskCtx.lineJoin = 'round';
      if (tempCanvas.width > 0 && tempCanvas.height > 0) {
        removalMaskCtx.drawImage(tempCanvas, 0, 0, removalMaskCanvas.width, removalMaskCanvas.height);
      }
    }
  }
  return removalMaskCanvas;
}

export function prepareCloneStampBaseCanvases(
  stampedVideoCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  removalMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  removalMaskCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>,
  targetWidth: number,
  targetHeight: number
): PreparedCloneStampCanvases {
  // Initialize and resize stampedVideoCanvasRef
  if (!stampedVideoCanvasRef.current) {
    stampedVideoCanvasRef.current = document.createElement('canvas');
  }
  const stampedVideoCanvas = stampedVideoCanvasRef.current;
  const stampedVideoCtx = stampedVideoCanvas.getContext('2d');
  if (stampedVideoCanvas.width !== targetWidth || stampedVideoCanvas.height !== targetHeight) {
    stampedVideoCanvas.width = targetWidth;
    stampedVideoCanvas.height = targetHeight;
  }

  const removalMaskCanvas = prepareRemovalMaskCanvas(
    removalMaskCanvasRef,
    removalMaskCtxRef,
    targetWidth,
    targetHeight
  );
  const removalMaskCtx = removalMaskCtxRef.current;

  return {
    stampedVideoCanvas,
    stampedVideoCtx,
    removalMaskCanvas,
    removalMaskCtx,
  };
}
