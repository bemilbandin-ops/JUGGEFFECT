import type { TrackingSettings } from '../types';
import { Canvas2DEffectsRenderer } from './canvas2dEffectsRenderer';
import { WebGL2EffectsRenderer } from './webgl2EffectsRenderer';

export interface EffectsFrame {
  source: HTMLCanvasElement | HTMLVideoElement;
  motionMask?: HTMLCanvasElement;
  povLayer?: HTMLCanvasElement;
  overlayLayer?: HTMLCanvasElement;
  cloneMask?: HTMLCanvasElement;
  cloneMaskRevision?: number;
  settings: TrackingSettings;
  time?: number;
  isStrobeActive?: boolean;
  isStrobeTriggered?: boolean;
  updateTemporalState?: boolean;
}

export interface EffectsRenderer {
  readonly usesGpuTemporalEffects: boolean;
  readonly usesGpuCloneStamp: boolean;
  resize(width: number, height: number): void;
  render(frame: EffectsFrame): void;
  clearTemporalState(): void;
  dispose(): void;
}

export function createEffectsRenderer(canvas: HTMLCanvasElement): EffectsRenderer {
  try {
    const probe = new WebGL2EffectsRenderer(document.createElement('canvas'));
    probe.dispose();
    return new WebGL2EffectsRenderer(canvas);
  } catch (error) {
    console.warn('WebGL2 renderer unavailable; using Canvas2D fallback.', error);
    return new Canvas2DEffectsRenderer(canvas);
  }
}
