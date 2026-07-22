import type { LedStripGeometry } from './pov';

export interface PovSampleDrawParams {
  x: number;
  y: number;
  colIdx: number;
  length: number;
  width: number;
  opacity: number;
  ledCount: number;
  geometry: LedStripGeometry;
}

function applyStripGeometry(ctx: CanvasRenderingContext2D, geometry: LedStripGeometry) {
  ctx.translate(geometry.translateX, geometry.translateY);
  ctx.rotate(geometry.rotationAngle);
  if (geometry.isRadialOrCircular) ctx.translate(0, geometry.middleOffset);
}

/** Draw one retained POV sample using the selected visual primitive. */
export function drawPovSample(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  sample: PovSampleDrawParams,
) {
  ctx.save();

  applyStripGeometry(ctx, sample.geometry);
  drawLedColumn(ctx, imgData, sample.colIdx, sample.ledCount, sample.length, sample.width, sample.opacity);

  ctx.restore();
}

/**
 * Draws a single LED column at the current canvas transform origin without glow/blur.
 * Assumes ctx is already translated and rotated so the column goes along the Y axis.
 */
export function drawLedColumn(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  colIdx: number,
  numLEDs: number,
  length: number,    // total length of the LED strip in canvas pixels
  dotWidth: number,  // diameter of each LED dot
  opacity: number
) {
  const pWidth = imgData.width;
  const pHeight = imgData.height;
  const data = imgData.data;

  // Wrap column index safely
  const px = ((colIdx % pWidth) + pWidth) % pWidth;

  for (let i = 0; i < numLEDs; i++) {
    const y_ratio = numLEDs > 1 ? i / (numLEDs - 1) : 0.5;
    const y_pos = -length / 2 + y_ratio * length;

    const py = Math.floor(y_ratio * (pHeight - 1));
    const idx = (py * pWidth + px) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a <= 15) continue;

    const ledAlpha = (a / 255) * opacity;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ledAlpha})`;
    ctx.beginPath();
    ctx.arc(0, y_pos, dotWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFullPattern() {
  // Placeholder for full pattern drawing helper if referenced
}
