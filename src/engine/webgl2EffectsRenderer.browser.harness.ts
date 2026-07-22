import { DEFAULT_TRACKING_SETTINGS } from '../config/settingsDefaults';
import type { TrackingSettings } from '../types';
import { extractMotion } from './motionExtractor';
import { WebGL2EffectsRenderer } from './webgl2EffectsRenderer';

const WIDTH = 48;
const HEIGHT = 24;
const STAMP_X = 12;
const STAMP_Y = 12;

type BlendMode = 'screen' | 'lighter' | 'color-dodge' | 'source-over';
type RendererInternals = { gl: WebGL2RenderingContext };

function layer(
  stamp: [number, number, number] | null,
  mask = false,
  background: [number, number, number] = [0, 0, 0]
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { alpha: true })!;
  context.clearRect(0, 0, WIDTH, HEIGHT);
  if (!mask) {
    context.fillStyle = `rgb(${background.join(',')})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (stamp) {
    context.fillStyle = mask ? '#fff' : `rgb(${stamp.join(',')})`;
    context.fillRect(STAMP_X, STAMP_Y, 1, 1);
  }
  return canvas;
}

function settings(fade: number, blur: number, compositeMode: BlendMode): TrackingSettings {
  return {
    ...DEFAULT_TRACKING_SETTINGS,
    enableTrails: true,
    enablePoiMode: false,
    echoFadeRate: fade,
    blurAmount: blur,
    compositeMode,
    motionBlur: 0,
    feedbackZoom: 1,
    horizontalDrift: 0,
    verticalDrift: 0,
    hueRotate: 0,
    colorCycleSpeed: 0,
  };
}

function pixels(
  fade: number,
  blur: number,
  mode: BlendMode,
  decayFrames = 0,
  decayBackground: [number, number, number] = [0, 0, 0],
  decayBlur = blur
): Uint8Array {
  const output = document.createElement('canvas');
  output.width = WIDTH;
  output.height = HEIGHT;
  const renderer = new WebGL2EffectsRenderer(output);
  renderer.resize(WIDTH, HEIGHT);
  const configured = settings(fade, blur, mode);
  renderer.render({
    source: layer([96, 144, 208]),
    motionMask: layer([255, 255, 255], true),
    settings: configured,
  });
  for (let frame = 0; frame < decayFrames; frame += 1) {
    renderer.render({
      source: layer(null, false, decayBackground),
      motionMask: layer(null, true),
      settings: { ...configured, blurAmount: decayBlur },
    });
  }
  const gl = (renderer as unknown as RendererInternals).gl;
  const result = new Uint8Array(WIDTH * HEIGHT * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, result);
  renderer.dispose();
  return result;
}

function basePixels(background: [number, number, number]): Uint8Array {
  const output = document.createElement('canvas');
  output.width = WIDTH;
  output.height = HEIGHT;
  const renderer = new WebGL2EffectsRenderer(output);
  renderer.resize(WIDTH, HEIGHT);
  renderer.render({
    source: layer(null, false, background),
    motionMask: layer(null, true),
    settings: { ...settings(1, 0, 'screen'), enableTrails: false },
  });
  const gl = (renderer as unknown as RendererInternals).gl;
  const result = new Uint8Array(WIDTH * HEIGHT * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, result);
  renderer.dispose();
  return result;
}

function poiPixels(povEnabled: boolean): Uint8Array {
  const output = document.createElement('canvas');
  output.width = WIDTH;
  output.height = HEIGHT;
  const renderer = new WebGL2EffectsRenderer(output);
  renderer.resize(WIDTH, HEIGHT);
  renderer.render({
    source: layer(null),
    motionMask: layer(null, true),
    povLayer: layer([255, 255, 255], true),
    settings: {
      ...settings(0, 0, 'screen'),
      enablePoiMode: true,
      poiPovEnabled: povEnabled,
      poiGlowEnabled: false,
    },
  });
  const gl = (renderer as unknown as RendererInternals).gl;
  const result = new Uint8Array(WIDTH * HEIGHT * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, result);
  renderer.dispose();
  return result;
}

function rgbSum(data: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
  return total;
}

function pixelDifference(a: Uint8Array, b: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total;
}

function litPixelCount(data: Uint8Array, threshold = 3): number {
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] > threshold) count += 1;
  }
  return count;
}

function horizontalSpread(data: Uint8Array, threshold = 3): { span: number; darkGap: number } {
  const y = HEIGHT - 1 - STAMP_Y;
  const values = Array.from({ length: WIDTH }, (_, x) => {
    const i = (y * WIDTH + x) * 4;
    return data[i] + data[i + 1] + data[i + 2];
  });
  const lit = values.flatMap((value, x) => value > threshold ? [x] : []);
  if (lit.length === 0) return { span: 0, darkGap: 0 };
  let longest = 0;
  let current = 0;
  for (let x = Math.min(...lit); x <= Math.max(...lit); x += 1) {
    if (values[x] <= threshold) current += 1;
    else current = 0;
    longest = Math.max(longest, current);
  }
  return { span: Math.max(...lit) - Math.min(...lit) + 1, darkGap: longest };
}

function horizontalVariance(data: Uint8Array): number {
  let energy = 0;
  let weightedDistance = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const i = (y * WIDTH + x) * 4;
      const value = data[i] + data[i + 1] + data[i + 2];
      energy += value;
      weightedDistance += value * (x - STAMP_X) ** 2;
    }
  }
  return weightedDistance / energy;
}

function extractMask(lineSmoothness: number, ramp = false): HTMLCanvasElement {
  const size: [number, number] = ramp ? [3, 1] : [9, 9];
  const source = document.createElement('canvas');
  source.width = size[0];
  source.height = size[1];
  const sourceContext = source.getContext('2d')!;
  const image = sourceContext.createImageData(...size);
  const values = ramp ? [40, 65, 90] : [90];
  values.forEach((value, index) => {
    const pixel = ramp ? index : 4 * size[0] + 4;
    image.data[pixel * 4] = value;
    image.data[pixel * 4 + 3] = 255;
  });
  sourceContext.putImageData(image, 0, 0);

  const procCanvas = document.createElement('canvas');
  procCanvas.width = size[0];
  procCanvas.height = size[1];
  const procCtx = procCanvas.getContext('2d')!;
  extractMotion({
    frameSource: source,
    procCanvas,
    procCtx,
    trackingFilter: 'none',
    bgDataRef: { current: new Float32Array(size[0] * size[1] * 4) },
    motionMaskDataRef: { current: null },
    smoothingCanvasRef: { current: null },
    currentSettings: {
      ...DEFAULT_TRACKING_SETTINGS,
      motionThreshold: 50,
      edgeAntiAliasing: 30,
      bgLearningRate: 0,
      enableLightTracking: false,
      lineSmoothness,
    },
  });
  return procCanvas;
}

function uploadedMaskCoverage(mask: HTMLCanvasElement): number {
  const output = document.createElement('canvas');
  output.width = mask.width;
  output.height = mask.height;
  const renderer = new WebGL2EffectsRenderer(output);
  renderer.resize(mask.width, mask.height);
  const configured = settings(0, 0, 'screen');
  renderer.render({ source: layer(null, false, [120, 120, 120]), motionMask: mask, settings: configured });
  renderer.render({ source: layer(null), motionMask: layer(null, true), settings: configured });
  const gl = (renderer as unknown as RendererInternals).gl;
  const data = new Uint8Array(mask.width * mask.height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, mask.width, mask.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  renderer.dispose();
  return litPixelCount(data, 0);
}

const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function run(): Record<string, unknown> {
  const poiPresentation = {
    legacy: rgbSum(poiPixels(false)),
    sweep: rgbSum(poiPixels(true)),
  };
  check(poiPresentation.legacy > 0, 'legacy Pixel Effect layer was hidden by WebGL');
  check(poiPresentation.sweep > 0, 'POV Sweep layer was hidden by WebGL');

  const retention = [0, 0.25, 0.75, 1].map((retained) => ({
    retained,
    screen: rgbSum(pixels(1 - retained, 0, 'screen', 1)),
    normal: rgbSum(pixels(1 - retained, 0, 'source-over', 1)),
  }));
  for (const mode of ['screen', 'normal'] as const) {
    const values = retention.map((sample) => sample[mode]);
    check(values[0] === 0, `${mode}: 0% retention left visible RGB (${values[0]})`);
    check(values[3] > 0, `${mode}: 100% retention lost the previous stamp`);
    check(values.every((value, i) => i === 0 || value > values[i - 1]), `${mode}: decay was not strictly monotonic (${values})`);
  }

  const modes = ['screen', 'lighter', 'color-dodge', 'source-over'] as const;
  const neutralBase: [number, number, number] = [40, 64, 80];
  const expectedBase = basePixels(neutralBase);
  const transparentNeutrality = Object.fromEntries(modes.map((mode) => [
    mode,
    pixelDifference(pixels(1, 0, mode, 1, neutralBase), expectedBase),
  ]));
  check(Object.values(transparentNeutrality).every((difference) => difference === 0), `transparent history affected base: ${JSON.stringify(transparentNeutrality)}`);

  const blendFrames = Object.fromEntries(modes.map((mode) => [mode, pixels(0, 0, mode)]));
  const blendDifferences = {
    normalScreen: pixelDifference(blendFrames['source-over'], blendFrames.screen),
    additiveScreen: pixelDifference(blendFrames.lighter, blendFrames.screen),
    dodgeScreen: pixelDifference(blendFrames['color-dodge'], blendFrames.screen),
  };
  check(Object.values(blendDifferences).every((difference) => difference > 0), `blend modes were not distinct: ${JSON.stringify(blendDifferences)}`);

  const blurRadii = [0, 2, 4, 8];
  const blur = blurRadii.map((radius) => {
    const data = pixels(0, radius, 'screen');
    return { radius, litPixels: litPixelCount(data), variance: horizontalVariance(data), ...horizontalSpread(data) };
  });
  check(blur[0].litPixels === 1, `radius 0 was not a one-pixel no-op: ${JSON.stringify(blur[0])}`);
  check(blur.every((sample, i) => i === 0 || sample.variance > blur[i - 1].variance), `blur radius did not expand its spread: ${JSON.stringify(blur)}`);
  check(blur.every((sample) => sample.darkGap === 0), `blur contained detached horizontal ghosts: ${JSON.stringify(blur)}`);
  const historyReblurDifference = pixelDifference(
    pixels(0, 2, 'screen', 1, [0, 0, 0], 0),
    pixels(0, 2, 'screen', 1, [0, 0, 0], 8)
  );
  check(historyReblurDifference === 0, `changing blur reprocessed existing history (${historyReblurDifference})`);

  const rampMask = extractMask(0, true).getContext('2d')!.getImageData(0, 0, 3, 1).data;
  const edgeRampAlpha = [rampMask[3], rampMask[7], rampMask[11]];
  check(edgeRampAlpha[0] === 0 && edgeRampAlpha[1] === 127 && edgeRampAlpha[2] === 255, `edge confidence ramp was ${edgeRampAlpha}`);
  const lineSmoothnessCoverage = {
    sharp: uploadedMaskCoverage(extractMask(0)),
    smooth: uploadedMaskCoverage(extractMask(2)),
  };
  check(lineSmoothnessCoverage.smooth > lineSmoothnessCoverage.sharp, `line smoothing did not expand uploaded WebGL mask coverage: ${JSON.stringify(lineSmoothnessCoverage)}`);

  return { poiPresentation, retention, transparentNeutrality, blendDifferences, blur, historyReblurDifference, edgeRampAlpha, lineSmoothnessCoverage };
}

const result = document.querySelector('#result')!;
try {
  const report = run();
  result.textContent = `${failures.length === 0 ? 'PASS' : 'FAIL'}\n${JSON.stringify({ ...report, failures }, null, 2)}`;
} catch (error) {
  result.textContent = `FAIL\n${error instanceof Error ? error.stack : String(error)}`;
}
