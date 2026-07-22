import {
  createLightPaintingState,
  renderClubDepthTunnels,
  renderLightPaintingSweeps,
} from './lightPaintingProcessor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const path: Array<[number, number]> = [];
const stops: Array<[number, string]> = [];
let strokes = 0;
const ctx = {
  createLinearGradient: () => ({ addColorStop: (offset: number, color: string) => stops.push([offset, color]) }),
  save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke: () => { strokes++; },
  moveTo: (x: number, y: number) => path.push([x, y]),
  lineTo: (x: number, y: number) => path.push([x, y]),
  globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', strokeStyle: '',
  lineWidth: 1, lineCap: 'butt', shadowColor: '', shadowBlur: 0,
} as unknown as CanvasRenderingContext2D;
const sourceData = { width: 10, height: 10, data: new Uint8ClampedArray(400).fill(180) } as ImageData;
const state = createLightPaintingState();

renderLightPaintingSweeps({
  trackedProps: [{ id: 1, x: 50, y: 60, prevX: 50, prevY: 50, angle: 0, length: 40, envelopeFrame: 1, lastSeen: 1 }],
  sourceData,
  outputWidth: 100,
  outputHeight: 100,
  ctx,
  state,
});

assert(path.length === 4, 'A moving club should produce one swept quadrilateral');
assert(path[0][0] === 30 && path[0][1] === 50, 'Sweep should start at the previous first tip');
assert(path[2][0] === 70 && path[2][1] === 60, 'Sweep should include the current second tip');
assert(stops.length === 3 && stops.every(([, color]) => color === 'rgb(180, 180, 180)'), 'Sweep should preserve sampled club colors');

path.length = 0;
renderLightPaintingSweeps({
  trackedProps: [{ id: 1, x: 50, y: 60, prevX: 50, prevY: 60, angle: 0, length: 40, envelopeFrame: 2, lastSeen: 2 }],
  sourceData,
  outputWidth: 100,
  outputHeight: 100,
  ctx,
  state,
});
assert(path.length === 0, 'A stationary club should not paint another sweep');

state.clear();
assert(state.previousEndpoints.size === 0, 'Switching effects should clear sweep state');

path.length = 0;
renderClubDepthTunnels({
  trackedProps: [{ id: 1, x: 50, y: 50, prevX: 45, prevY: 50, angle: 0, length: 40, envelopeFrame: 1, lastSeen: 1 }],
  sourceData,
  outputWidth: 100,
  outputHeight: 100,
  ctx,
});
assert(strokes === 2, 'A depth tunnel should batch its perspective geometry into two strokes');
assert(Math.max(...path.map(([x]) => x)) - Math.min(...path.map(([x]) => x)) > 80, 'Tunnel should expand beyond the tracked club width');
console.log('lightPaintingProcessor tests passed');
