import { getCameraFilterString } from './cameraFilters';
import type { EffectsFrame, EffectsRenderer } from './effectsRenderer';

export class Canvas2DEffectsRenderer implements EffectsRenderer {
  readonly usesGpuTemporalEffects = false;
  readonly usesGpuCloneStamp = false;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas2D is unavailable');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  render({ source, settings }: EffectsFrame): void {
    this.ctx.filter = getCameraFilterString(settings);
    this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = 'none';
  }

  clearTemporalState(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void {}
}
