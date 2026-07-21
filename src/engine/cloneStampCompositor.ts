import React from 'react';
import { TrackingSettings } from '../types';

export interface CompositeCloneStampOptions {
  video: HTMLVideoElement;
  stampedVideoCanvas: HTMLCanvasElement;
  stampedVideoCtx: CanvasRenderingContext2D | null;
  removalMaskCanvas: HTMLCanvasElement;
  currentSettings: TrackingSettings;
  cloneDestCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  featheredMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  clonedLayerCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

export function compositeCloneStamp({
  video,
  stampedVideoCanvas,
  stampedVideoCtx,
  removalMaskCanvas,
  currentSettings,
  cloneDestCanvasRef,
  featheredMaskCanvasRef,
  clonedLayerCanvasRef,
}: CompositeCloneStampOptions): void {
  if (!stampedVideoCtx) return;

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
      cloneDestCtx.drawImage(
        stampedVideoCanvas,
        -currentSettings.cloneStampOffsetX,
        -currentSettings.cloneStampOffsetY
      );

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
