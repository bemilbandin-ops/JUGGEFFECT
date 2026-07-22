import type { TrackedPointInput } from '../utils/pov';

export const PIXEL_COMET_PARTICLE_CAP = 360;

export interface PixelCometParticle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  ageMs: number;
  lifetimeMs: number;
  size: number;
  color: string;
  rotation: number;
}

export interface PixelCometSettings {
  cometLifetimeMs: number;
  cometEmission: number;
  cometPixelSize: number;
  cometSpread: number;
  cometInitialSpeed: number;
  cometDrag: number;
  cometGlowIntensity: number;
}

interface Endpoint {
  x: number;
  y: number;
}

export interface PixelCometState {
  particles: PixelCometParticle[];
  previousEndpoints: Map<number, [Endpoint, Endpoint]>;
  clear(): void;
}

export interface PixelCometProcessorParams {
  trackedProps: TrackedPointInput[];
  elapsedMs: number;
  settings: PixelCometSettings;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: PixelCometState;
  random?: () => number;
}

const COLORS = ['#ff3cac', '#38f9d7', '#ffe66d', '#62a8ff'];
const MOVEMENT_THRESHOLD_PX = 0.5;

export function createPixelCometState(): PixelCometState {
  const state: PixelCometState = {
    particles: [],
    previousEndpoints: new Map(),
    clear() {
      state.particles.length = 0;
      state.previousEndpoints.clear();
    },
  };
  return state;
}

function endpoints(x: number, y: number, length: number, angle: number): [Endpoint, Endpoint] {
  const dx = Math.cos(angle) * length / 2;
  const dy = Math.sin(angle) * length / 2;
  return [{ x: x - dx, y: y - dy }, { x: x + dx, y: y + dy }];
}

function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: PixelCometParticle[],
) {
  const draw = () => {
    for (const particle of particles) {
      const life = Math.max(0, 1 - particle.ageMs / particle.lifetimeMs);
      const size = Math.max(1, particle.size * life);
      ctx.save();
      ctx.globalAlpha = life;
      ctx.fillStyle = particle.color;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  };

  draw();
}

export function processPixelComets({
  trackedProps,
  elapsedMs,
  settings,
  canvas,
  ctx,
  state,
  random = Math.random,
}: PixelCometProcessorParams): void {
  const ageDelta = Math.max(0, elapsedMs);
  const dt = Math.min(ageDelta, 100);
  const drag = Math.pow(settings.cometDrag, dt / (1000 / 60));

  for (const particle of state.particles) {
    particle.x += particle.velocityX * dt;
    particle.y += particle.velocityY * dt;
    particle.velocityX *= drag;
    particle.velocityY *= drag;
    particle.ageMs += ageDelta;
    particle.rotation += 0.001 * dt;
  }
  state.particles = state.particles.filter((particle) => particle.ageMs < particle.lifetimeMs);

  const activeIds = new Set<number>();
  for (const prop of trackedProps) {
    activeIds.add(prop.id);
    const current = endpoints(prop.x, prop.y, prop.length, prop.angle);
    const previous = state.previousEndpoints.get(prop.id)
      ?? endpoints(prop.prevX ?? prop.x, prop.prevY ?? prop.y, prop.length, prop.angle);
    state.previousEndpoints.set(prop.id, current);

    for (let endpointIndex = 0; endpointIndex < 2; endpointIndex++) {
      const movementX = current[endpointIndex].x - previous[endpointIndex].x;
      const movementY = current[endpointIndex].y - previous[endpointIndex].y;
      const distance = Math.hypot(movementX, movementY);
      if (distance < MOVEMENT_THRESHOLD_PX || dt === 0) continue;

      const direction = Math.atan2(movementY, movementX);
      const endpointSpeed = distance / dt;
      for (let i = 0; i < settings.cometEmission; i++) {
        const spreadAngle = direction + (random() - 0.5) * settings.cometSpread;
        const speed = endpointSpeed * settings.cometInitialSpeed * (0.85 + random() * 0.3);
        state.particles.push({
          x: current[endpointIndex].x,
          y: current[endpointIndex].y,
          velocityX: Math.cos(spreadAngle) * speed,
          velocityY: Math.sin(spreadAngle) * speed,
          ageMs: 0,
          lifetimeMs: settings.cometLifetimeMs * (0.85 + random() * 0.3),
          size: settings.cometPixelSize * (0.85 + random() * 0.3),
          color: COLORS[Math.floor(random() * COLORS.length)],
          rotation: random() * Math.PI / 2,
        });
      }
    }
  }

  for (const id of state.previousEndpoints.keys()) {
    if (!activeIds.has(id)) state.previousEndpoints.delete(id);
  }
  if (state.particles.length > PIXEL_COMET_PARTICLE_CAP) {
    state.particles.splice(0, state.particles.length - PIXEL_COMET_PARTICLE_CAP);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderParticles(ctx, state.particles);
}
