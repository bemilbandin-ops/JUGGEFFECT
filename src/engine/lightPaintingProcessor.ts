import type { TrackedPointInput } from '../utils/pov';

interface Point {
  x: number;
  y: number;
}

export interface LightPaintingState {
  previousEndpoints: Map<number, [Point, Point]>;
  clear(): void;
}

export interface LightPaintingParams {
  trackedProps: TrackedPointInput[];
  sourceData: ImageData;
  outputWidth: number;
  outputHeight: number;
  ctx: CanvasRenderingContext2D;
  state: LightPaintingState;
}

export function createLightPaintingState(): LightPaintingState {
  const state: LightPaintingState = {
    previousEndpoints: new Map(),
    clear() { state.previousEndpoints.clear(); },
  };
  return state;
}

function endpoints(prop: TrackedPointInput): [Point, Point] {
  const dx = Math.cos(prop.angle) * prop.length / 2;
  const dy = Math.sin(prop.angle) * prop.length / 2;
  return [{ x: prop.x - dx, y: prop.y - dy }, { x: prop.x + dx, y: prop.y + dy }];
}

function sampleColor(data: ImageData, x: number, y: number, scaleX: number, scaleY: number): string {
  const centerX = Math.round(x / scaleX);
  const centerY = Math.round(y / scaleY);
  let bestIndex = 0;
  let bestScore = -1;

  // Blob endpoints are estimates, so sample the brightest nearby foreground pixel
  // instead of letting a one-pixel miss turn a colored club into a black ribbon.
  for (let offsetY = -3; offsetY <= 3; offsetY++) {
    for (let offsetX = -3; offsetX <= 3; offsetX++) {
      const px = Math.max(0, Math.min(data.width - 1, centerX + offsetX));
      const py = Math.max(0, Math.min(data.height - 1, centerY + offsetY));
      const index = (py * data.width + px) * 4;
      const score = data.data[index + 3]
        * Math.max(data.data[index], data.data[index + 1], data.data[index + 2]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
  }

  return `rgb(${data.data[bestIndex]}, ${data.data[bestIndex + 1]}, ${data.data[bestIndex + 2]})`;
}

/** Fill the area swept by each moving club with colors sampled along that club. */
export function renderLightPaintingSweeps({
  trackedProps,
  sourceData,
  outputWidth,
  outputHeight,
  ctx,
  state,
}: LightPaintingParams): void {
  const scaleX = outputWidth / sourceData.width;
  const scaleY = outputHeight / sourceData.height;
  const activeIds = new Set<number>();

  for (const prop of trackedProps) {
    activeIds.add(prop.id);
    const current = endpoints(prop);
    const previous = state.previousEndpoints.get(prop.id) ?? endpoints({
      ...prop,
      x: prop.prevX ?? prop.x,
      y: prop.prevY ?? prop.y,
    });
    state.previousEndpoints.set(prop.id, current);
    if (Math.hypot(current[0].x - previous[0].x, current[0].y - previous[0].y) < 1
      && Math.hypot(current[1].x - previous[1].x, current[1].y - previous[1].y) < 1) continue;

    const gradient = ctx.createLinearGradient(current[0].x, current[0].y, current[1].x, current[1].y);
    gradient.addColorStop(0, sampleColor(sourceData, prop.x * 0.35 + current[0].x * 0.65, prop.y * 0.35 + current[0].y * 0.65, scaleX, scaleY));
    gradient.addColorStop(0.5, sampleColor(sourceData, prop.x, prop.y, scaleX, scaleY));
    gradient.addColorStop(1, sampleColor(sourceData, prop.x * 0.35 + current[1].x * 0.65, prop.y * 0.35 + current[1].y * 0.65, scaleX, scaleY));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(previous[0].x, previous[0].y);
    ctx.lineTo(current[0].x, current[0].y);
    ctx.lineTo(current[1].x, current[1].y);
    ctx.lineTo(previous[1].x, previous[1].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const id of state.previousEndpoints.keys()) {
    if (!activeIds.has(id)) state.previousEndpoints.delete(id);
  }
}

/** Extrude each tracked club into expanding cross-sections that read as a 3D tunnel. */
export function renderClubDepthTunnels({
  trackedProps,
  sourceData,
  outputWidth,
  outputHeight,
  ctx,
}: Omit<LightPaintingParams, 'state'>): void {
  const scaleX = outputWidth / sourceData.width;
  const scaleY = outputHeight / sourceData.height;

  for (const prop of trackedProps) {
    let directionX = prop.x - (prop.prevX ?? prop.x);
    let directionY = prop.y - (prop.prevY ?? prop.y);
    const speed = Math.hypot(directionX, directionY);
    if (speed < 0.5) {
      directionX = prop.x - outputWidth / 2;
      directionY = prop.y - outputHeight / 2;
    }
    const magnitude = Math.hypot(directionX, directionY) || 1;
    directionX /= magnitude;
    directionY /= magnitude;

    const color = sampleColor(sourceData, prop.x, prop.y, scaleX, scaleY);
    const depth = Math.min(180, 60 + speed * 8);
    const slices = 8;
    const axisX = Math.cos(prop.angle);
    const axisY = Math.sin(prop.angle);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    const farScale = 2.35;
    const farX = prop.x + directionX * depth;
    const farY = prop.y + directionY * depth;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prop.x - axisX * prop.length / 2, prop.y - axisY * prop.length / 2);
    ctx.lineTo(farX - axisX * prop.length * farScale / 2, farY - axisY * prop.length * farScale / 2);
    ctx.moveTo(prop.x + axisX * prop.length / 2, prop.y + axisY * prop.length / 2);
    ctx.lineTo(farX + axisX * prop.length * farScale / 2, farY + axisY * prop.length * farScale / 2);
    for (let index = slices; index >= 0; index--) {
      const t = index / slices;
      const perspective = 1 + t * 1.35;
      const centerX = prop.x + directionX * depth * t;
      const centerY = prop.y + directionY * depth * t;
      const halfLength = prop.length * perspective / 2;
      ctx.moveTo(centerX - axisX * halfLength, centerY - axisY * halfLength);
      ctx.lineTo(centerX + axisX * halfLength, centerY + axisY * halfLength);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(prop.x - axisX * prop.length / 2, prop.y - axisY * prop.length / 2);
    ctx.lineTo(prop.x + axisX * prop.length / 2, prop.y + axisY * prop.length / 2);
    ctx.stroke();
    ctx.restore();
  }
}
