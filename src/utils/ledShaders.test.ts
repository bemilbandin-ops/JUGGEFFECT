import { drawPovSample } from './ledShaders';

type DrawCall = { method: string; args: number[] };

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function createRecordingContext() {
  const calls: DrawCall[] = [];
  const ctx = {
    fillStyle: '',
    save: () => calls.push({ method: 'save', args: [] }),
    restore: () => calls.push({ method: 'restore', args: [] }),
    translate: (x: number, y: number) => calls.push({ method: 'translate', args: [x, y] }),
    rotate: (angle: number) => calls.push({ method: 'rotate', args: [angle] }),
    beginPath: () => calls.push({ method: 'beginPath', args: [] }),
    arc: (x: number, y: number, radius: number) => calls.push({ method: 'arc', args: [x, y, radius] }),
    fill: () => calls.push({ method: 'fill', args: [] }),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push({ method: 'fillRect', args: [x, y, width, height] }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const imageData = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 128, 255,
    0, 255, 255, 255,
    255, 220, 0, 255,
    128, 0, 255, 255,
  ]),
} as ImageData;

const geometry = {
  translateX: 23,
  translateY: 37,
  rotationAngle: Math.PI / 4,
  isRadialOrCircular: false,
  radialDistance: 0,
  middleOffset: 0,
};

function testCometsUseEndpointSquares() {
  const { ctx, calls } = createRecordingContext();
  drawPovSample(ctx, imageData, 'comets', {
    x: 23,
    y: 37,
    colIdx: 1,
    length: 40,
    width: 4,
    opacity: 1,
    ledCount: 16,
    geometry,
  });

  const rectangles = calls.filter((call) => call.method === 'fillRect');
  assert(rectangles.length === 4, `Comets should draw four endpoint pixels, got ${rectangles.length}`);
  assert(!calls.some((call) => call.method === 'arc'), 'Comets should not draw circular LED strips');
  assert(calls.some((call) => call.method === 'rotate'), 'Comets should follow the prop orientation');
  assert(
    rectangles.every((call) => Math.abs(call.args[1]) >= 12),
    'Comet pixels should stay near the prop endpoints rather than fill its center',
  );
}

function testBlocksUseScreenSpaceGrid() {
  const { ctx, calls } = createRecordingContext();
  drawPovSample(ctx, imageData, 'blocks', {
    x: 23,
    y: 37,
    colIdx: 1,
    length: 40,
    width: 3,
    opacity: 1,
    ledCount: 16,
    geometry,
  });

  const rectangles = calls.filter((call) => call.method === 'fillRect');
  assert(rectangles.length === 2, `Blocks should draw a two-pixel arcade cluster, got ${rectangles.length}`);
  assert(!calls.some((call) => call.method === 'arc'), 'Blocks should not draw circular LED strips');
  assert(!calls.some((call) => call.method === 'rotate'), 'Blocks should stay aligned to the screen grid');
  assert(rectangles[0].args[0] === 16, `Main block should snap x=23 to x=16, got ${rectangles[0].args[0]}`);
  assert(rectangles[0].args[1] === 32, `Main block should snap y=37 to y=32, got ${rectangles[0].args[1]}`);
}

function runAll() {
  try {
    testCometsUseEndpointSquares();
    testBlocksUseScreenSpaceGrid();
    console.log('Pixel render style tests passed.');
  } catch (error: any) {
    console.error('Pixel render style test failure:', error.message);
    process.exit(1);
  }
}

runAll();
