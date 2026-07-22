import type { LedStripGeometry } from './pov';

export type PovRenderMode = 'solid' | 'dots' | 'comets' | 'blocks';

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

function getPatternColor(
  imgData: ImageData,
  colIdx: number,
  yRatio: number,
  opacity: number,
): string | null {
  const px = ((colIdx % imgData.width) + imgData.width) % imgData.width;
  const py = Math.max(0, Math.min(imgData.height - 1, Math.floor(yRatio * (imgData.height - 1))));
  const index = (py * imgData.width + px) * 4;
  const alpha = imgData.data[index + 3];
  if (alpha <= 15) return null;
  return `rgba(${imgData.data[index]}, ${imgData.data[index + 1]}, ${imgData.data[index + 2]}, ${(alpha / 255) * opacity})`;
}

function applyStripGeometry(ctx: CanvasRenderingContext2D, geometry: LedStripGeometry) {
  ctx.translate(geometry.translateX, geometry.translateY);
  ctx.rotate(geometry.rotationAngle);
  if (geometry.isRadialOrCircular) ctx.translate(0, geometry.middleOffset);
}

function drawCometPixels(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  colIdx: number,
  length: number,
  width: number,
  opacity: number,
) {
  const size = Math.max(3, width * 1.5);
  const lateralJitter = ((colIdx % 3) - 1) * size * 0.35;

  for (const endpoint of [-1, 1]) {
    const yRatio = endpoint < 0 ? 0 : 1;
    const color = getPatternColor(imgData, colIdx, yRatio, opacity);
    if (!color) continue;

    const endpointY = endpoint * length / 2;
    ctx.fillStyle = color;
    ctx.fillRect(-size / 2, endpointY - size / 2, size, size);

    const satelliteSize = size * 0.55;
    const satelliteY = endpointY - endpoint * size * 0.8;
    ctx.fillRect(
      lateralJitter - satelliteSize / 2,
      satelliteY - satelliteSize / 2,
      satelliteSize,
      satelliteSize,
    );
  }
}

function drawArcadeBlocks(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  colIdx: number,
  x: number,
  y: number,
  width: number,
  opacity: number,
) {
  const gridSize = Math.max(8, Math.round(width * 2));
  const blockSize = Math.max(4, width * 2);
  const snappedX = Math.floor(x / gridSize) * gridSize;
  const snappedY = Math.floor(y / gridSize) * gridSize;
  const primaryColor = getPatternColor(imgData, colIdx, 0.5, opacity);
  const accentColor = getPatternColor(imgData, colIdx + 1, colIdx % 2 === 0 ? 0.25 : 0.75, opacity * 0.8);

  if (primaryColor) {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(snappedX, snappedY, blockSize, blockSize);
  }
  if (accentColor) {
    const accentSize = Math.max(3, blockSize * 0.55);
    ctx.fillStyle = accentColor;
    ctx.fillRect(
      snappedX + gridSize,
      snappedY + (colIdx % 2 === 0 ? -gridSize : gridSize),
      accentSize,
      accentSize,
    );
  }
}

/** Draw one retained POV sample using the selected visual primitive. */
export function drawPovSample(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  renderMode: PovRenderMode,
  sample: PovSampleDrawParams,
) {
  ctx.save();

  if (renderMode === 'blocks') {
    drawArcadeBlocks(
      ctx,
      imgData,
      sample.colIdx,
      sample.x,
      sample.y,
      sample.width,
      sample.opacity,
    );
  } else {
    applyStripGeometry(ctx, sample.geometry);
    if (renderMode === 'comets') {
      drawCometPixels(
        ctx,
        imgData,
        sample.colIdx,
        sample.length,
        sample.width,
        sample.opacity,
      );
    } else {
      drawLedColumn(
        ctx,
        imgData,
        sample.colIdx,
        sample.ledCount,
        sample.length,
        sample.width,
        sample.opacity,
      );
    }
  }

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
