import type React from 'react';
import type { TrackingSettings } from '../types';

export interface MotionBlurProcessorParams {
  currentSettings: TrackingSettings;
  blurredVideoCtx: CanvasRenderingContext2D;
  stampedVideoCanvas: HTMLCanvasElement;
  blurredVideoCanvas: HTMLCanvasElement;
  maskedBlurCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  video: HTMLVideoElement;
  procCanvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function processMotionBlur(params: MotionBlurProcessorParams): void {
  const {
    currentSettings,
    blurredVideoCtx,
    stampedVideoCanvas,
    blurredVideoCanvas,
    maskedBlurCanvasRef,
    video,
    procCanvas,
    ctx,
    w,
    h,
  } = params;

  // 4. Temporal Motion Blur (Only applied to moving objects)
  if (currentSettings.motionBlur > 0) {
    // Accumulate video frames inside the blur canvas
    blurredVideoCtx.globalAlpha = 1.0 - currentSettings.motionBlur;
    blurredVideoCtx.drawImage(stampedVideoCanvas, 0, 0, blurredVideoCanvas.width, blurredVideoCanvas.height);
    blurredVideoCtx.globalAlpha = 1.0;

    if (!maskedBlurCanvasRef.current) {
      maskedBlurCanvasRef.current = document.createElement('canvas');
    }
    const maskedBlurCanvas = maskedBlurCanvasRef.current;
    const maskedBlurCtx = maskedBlurCanvas.getContext('2d');

    if (maskedBlurCanvas.width !== video.videoWidth || maskedBlurCanvas.height !== video.videoHeight) {
      maskedBlurCanvas.width = video.videoWidth;
      maskedBlurCanvas.height = video.videoHeight;
    }

    if (maskedBlurCtx) {
      // Clear temp canvas
      maskedBlurCtx.clearRect(0, 0, maskedBlurCanvas.width, maskedBlurCanvas.height);
      
      // Draw the low-res motion mask (stretched to full size)
      maskedBlurCtx.drawImage(procCanvas, 0, 0, maskedBlurCanvas.width, maskedBlurCanvas.height);
      
      // Mask the accumulated blurred video frame
      maskedBlurCtx.globalCompositeOperation = 'source-in';
      maskedBlurCtx.drawImage(blurredVideoCanvas, 0, 0);
      maskedBlurCtx.globalCompositeOperation = 'source-over';
      
      // Draw only the blurred motion area on top of the sharp video
      ctx.drawImage(maskedBlurCanvas, 0, 0, w, h);
    }
  } else {
    // Keep it seeded so it doesn't blink black if turned on
    blurredVideoCtx.drawImage(stampedVideoCanvas, 0, 0, blurredVideoCanvas.width, blurredVideoCanvas.height);
  }
}
