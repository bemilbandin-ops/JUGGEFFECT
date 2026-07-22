import React, { useRef } from 'react';
import { TrackingSettings } from '../types';

export interface UseCanvasPointerParams {
  displayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  removalMaskCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
  removalMaskRevisionRef: React.MutableRefObject<number>;
  settings: TrackingSettings;
}

export function useCanvasPointer({
  displayCanvasRef,
  removalMaskCtxRef,
  removalMaskRevisionRef,
  settings,
}: UseCanvasPointerParams) {
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPaintingRef = useRef<boolean>(false);
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const isHoveringRef = useRef<boolean>(false);

  function getCanvasMousePos(canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect();
    const elementWidth = rect.width;
    const elementHeight = rect.height;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const elementRatio = elementWidth / elementHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > elementRatio) {
      const renderHeight = elementWidth / canvasRatio;
      scaleX = canvasWidth / elementWidth;
      scaleY = canvasHeight / renderHeight;
      offsetY = (elementHeight - renderHeight) / 2;
    } else {
      const renderWidth = elementHeight * canvasRatio;
      scaleX = canvasWidth / renderWidth;
      scaleY = canvasHeight / elementHeight;
      offsetX = (elementWidth - renderWidth) / 2;
    }

    const x = (e.clientX - rect.left - offsetX) * scaleX;
    const y = (e.clientY - rect.top - offsetY) * scaleY;

    return { x, y };
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!settings.cloneStampEnabled && !settings.enablePoiMode) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    isPaintingRef.current = true;

    const pos = getCanvasMousePos(e.currentTarget, e);
    lastPosRef.current = pos;

    if (settings.cloneStampEnabled) {
      const maskCtx = removalMaskCtxRef.current;
      if (maskCtx) {
        maskCtx.beginPath();
        maskCtx.arc(pos.x, pos.y, settings.cloneStampBrushSize / 2, 0, Math.PI * 2);
        maskCtx.fillStyle = 'white';
        maskCtx.fill();
        removalMaskRevisionRef.current++;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    isHoveringRef.current = true;
    const pos = getCanvasMousePos(canvas, e);
    hoverPosRef.current = pos;

    if (!isPaintingRef.current) return;

    if (settings.cloneStampEnabled) {
      const maskCtx = removalMaskCtxRef.current;
      const lastPos = lastPosRef.current;
      if (maskCtx && lastPos) {
        maskCtx.beginPath();
        maskCtx.moveTo(lastPos.x, lastPos.y);
        maskCtx.lineTo(pos.x, pos.y);
        maskCtx.strokeStyle = 'white';
        maskCtx.lineWidth = settings.cloneStampBrushSize;
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        maskCtx.stroke();
        removalMaskRevisionRef.current++;
      }
    }
    lastPosRef.current = pos;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!settings.cloneStampEnabled && !settings.enablePoiMode) return;
    isPaintingRef.current = false;
    lastPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerLeave = () => {
    isHoveringRef.current = false;
    hoverPosRef.current = null;
  };

  return {
    isPaintingRef,
    hoverPosRef,
    isHoveringRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
