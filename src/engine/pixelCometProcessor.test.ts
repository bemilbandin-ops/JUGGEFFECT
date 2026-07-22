import {
  createPixelCometState,
  processPixelComets,
  type PixelCometSettings,
} from './pixelCometProcessor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const settings: PixelCometSettings = {
  cometLifetimeMs: 500,
  cometEmission: 2,
  cometPixelSize: 6,
  cometSpread: 0,
  cometInitialSpeed: 1,
  cometDrag: 0.9,
  cometGlowIntensity: 0.3,
};

function createContext() {
  const rectangles: Array<[number, number, number, number]> = [];
  const alphas: number[] = [];
  return {
    rectangles,
    alphas,
    clearRect() {},
    fillRect(x: number, y: number, width: number, height: number) {
      rectangles.push([x, y, width, height]);
      alphas.push(this.globalAlpha);
    },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
  } as unknown as CanvasRenderingContext2D & {
    rectangles: Array<[number, number, number, number]>;
    alphas: number[];
  };
}

function tracked(x: number, prevX: number = x) {
  return [{
    id: 1,
    x,
    y: 100,
    prevX,
    prevY: 100,
    angle: 0,
    length: 80,
    envelopeFrame: 1,
    lastSeen: 0,
  }];
}

function seededRandom(seed: number) {
  return () => ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

function run() {
  const canvas = { width: 320, height: 240 } as HTMLCanvasElement;
  const state = createPixelCometState();
  const ctx = createContext();

  processPixelComets({ trackedProps: tracked(110, 100), elapsedMs: 16, settings, canvas, ctx, state, random: () => 0.5 });
  assert(state.particles.length === 4, 'A moving prop should emit the requested amount from both endpoints');
  assert(ctx.rectangles.length === state.particles.length, 'Glow should not redraw and blur every particle');
  assert(state.particles.some((p) => p.x === 70 && p.y === 100), 'Particles should emit from the first calculated endpoint');
  assert(state.particles.some((p) => p.x === 150 && p.y === 100), 'Particles should emit from the second calculated endpoint');
  assert(state.particles.every((p) => p.velocityX > 0), 'Particles should inherit the endpoint motion direction');

  const stationary = createPixelCometState();
  processPixelComets({ trackedProps: tracked(100), elapsedMs: 16, settings, canvas, ctx, state: stationary, random: () => 0.5 });
  assert(stationary.particles.length === 0, 'A stationary prop should not emit particles');

  const initialVelocity = state.particles[0].velocityX;
  processPixelComets({ trackedProps: [], elapsedMs: 100, settings, canvas, ctx, state, random: () => 0.5 });
  assert(state.particles[0].velocityX < initialVelocity, 'Drag should reduce particle velocity');
  assert(state.particles[0].ageMs === 100, 'Particle age should advance by elapsed time');
  assert(ctx.alphas.some((alpha) => alpha < 1), 'Rendered particles should fade as they age');
  assert(ctx.rectangles.every(([, , width, height]) => width === height && width <= settings.cometPixelSize), 'Comets should draw decaying squares, never LED columns');

  processPixelComets({ trackedProps: [], elapsedMs: 500, settings, canvas, ctx, state, random: () => 0.5 });
  assert(Number(state.particles.length) === 0, 'Particles should expire after their lifetime');

  const capped = createPixelCometState();
  for (let i = 0; i < 100; i++) {
    processPixelComets({ trackedProps: tracked(100 + i, 99 + i), elapsedMs: 16, settings: { ...settings, cometEmission: 20 }, canvas, ctx, state: capped, random: () => 0.5 });
  }
  assert(capped.particles.length <= 360, 'Particle count should never exceed the strict cap');

  const first = createPixelCometState();
  const second = createPixelCometState();
  const randomA = seededRandom(7);
  const randomB = seededRandom(7);
  const varied = { ...settings, cometSpread: 0.4 };
  processPixelComets({ trackedProps: tracked(110, 100), elapsedMs: 16, settings: varied, canvas, ctx, state: first, random: randomA });
  processPixelComets({ trackedProps: tracked(110, 100), elapsedMs: 16, settings: varied, canvas, ctx, state: second, random: randomB });
  assert(JSON.stringify(first.particles) === JSON.stringify(second.particles), 'Seeded randomness should produce deterministic particles');

  first.clear();
  assert(first.particles.length === 0, 'Switching away should clear particle state through the public state interface');
}

run();
console.log('pixelCometProcessor tests passed');
