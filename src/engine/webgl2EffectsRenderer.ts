import type { EffectsFrame, EffectsRenderer } from './effectsRenderer';
import { getStrobePresentation } from './strobeEvaluator';
import {
  createPingPongRenderTargets,
  createRenderTarget,
  deleteRenderTarget,
  PingPongRenderTargets,
  type RenderTarget,
} from './webglRenderTargets';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const ADJUST_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_frame;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform vec3 u_colorScale;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 color = texture(u_frame, v_uv);
  color.rgb = clamp(color.rgb * u_exposure, 0.0, 1.0);
  color.rgb = clamp((color.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float luminance = dot(color.rgb, vec3(0.213, 0.715, 0.072));
  color.rgb = clamp(mix(vec3(luminance), color.rgb, u_saturation), 0.0, 1.0);
  color.rgb = clamp(color.rgb * u_colorScale, 0.0, 1.0);
  outColor = color;
}`;

const CLONE_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform vec2 u_offset;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 base = texture(u_frame, v_uv);
  vec2 shiftedUv = v_uv + u_offset;
  bool inside = all(greaterThanEqual(shiftedUv, vec2(0.0))) && all(lessThanEqual(shiftedUv, vec2(1.0)));
  vec4 shifted = inside ? texture(u_frame, shiftedUv) : base;
  outColor = mix(base, shifted, texture(u_mask, v_uv).a);
}`;

const MASK_BLUR_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_source;
uniform vec2 u_direction;
in vec2 v_uv;
out vec4 outColor;
void main() {
  outColor = texture(u_source, v_uv) * 0.227027;
  outColor += texture(u_source, v_uv + u_direction * 1.384615) * 0.316216;
  outColor += texture(u_source, v_uv - u_direction * 1.384615) * 0.316216;
  outColor += texture(u_source, v_uv + u_direction * 3.230769) * 0.070270;
  outColor += texture(u_source, v_uv - u_direction * 3.230769) * 0.070270;
}`;

const MOTION_BLUR_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_current;
uniform sampler2D u_history;
uniform sampler2D u_mask;
uniform float u_amount;
uniform bool u_hasHistory;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 current = texture(u_current, v_uv);
  float moving = texture(u_mask, v_uv).a;
  vec4 history = u_hasHistory ? texture(u_history, v_uv) : current;
  outColor = mix(current, history, clamp(u_amount * moving, 0.0, 0.98));
}`;

const TRAIL_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_previous;
uniform sampler2D u_current;
uniform sampler2D u_mask;
uniform sampler2D u_fresh;
uniform vec2 u_drift;
uniform float u_zoom;
uniform float u_fade;
uniform float u_hue;
uniform bool u_hasHistory;
uniform bool u_useFreshTexture;
in vec2 v_uv;
out vec4 outColor;

vec3 rotateHue(vec3 color, float angle) {
  const mat3 toYiq = mat3(
    0.299, 0.596, 0.211,
    0.587, -0.275, -0.523,
    0.114, -0.321, 0.312
  );
  const mat3 toRgb = mat3(
    1.0, 1.0, 1.0,
    0.956, -0.272, -1.106,
    0.621, -0.647, 1.703
  );
  vec3 yiq = toYiq * color;
  float hue = atan(yiq.z, yiq.y) + angle;
  float chroma = length(yiq.yz);
  return clamp(toRgb * vec3(yiq.x, chroma * cos(hue), chroma * sin(hue)), 0.0, 1.0);
}

vec4 maskedCurrent(vec2 uv) {
  return texture(u_current, uv) * texture(u_mask, uv).a;
}

void main() {
  vec2 historyUv = (v_uv - vec2(0.5) - u_drift) / u_zoom + vec2(0.5);
  bool inside = all(greaterThanEqual(historyUv, vec2(0.0))) && all(lessThanEqual(historyUv, vec2(1.0)));
  vec4 previous = (u_hasHistory && inside) ? texture(u_previous, historyUv) : vec4(0.0);
  previous *= 1.0 - u_fade;

  vec4 fresh = u_useFreshTexture ? texture(u_fresh, v_uv) : maskedCurrent(v_uv);
  if (!u_useFreshTexture) fresh.rgb = rotateHue(fresh.rgb, u_hue);

  outColor = fresh + previous * (1.0 - fresh.a);
}`;

const GLOW_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_source;
uniform vec2 u_direction;
uniform float u_radius;
in vec2 v_uv;
out vec4 outColor;

float gaussian(float offset, float sigma) {
  return exp(-0.5 * offset * offset / (sigma * sigma));
}

void main() {
  float sigma = max(u_radius * 0.5, 0.5);
  vec4 color = texture(u_source, v_uv);
  float totalWeight = 1.0;
  for (int pair = 0; pair < 10; pair++) {
    float firstOffset = float(pair * 2 + 1);
    if (firstOffset > u_radius) continue;
    float firstWeight = gaussian(firstOffset, sigma);
    float secondOffset = firstOffset + 1.0;
    float secondWeight = secondOffset <= u_radius ? gaussian(secondOffset, sigma) : 0.0;
    float pairWeight = firstWeight + secondWeight;
    float sampleOffset = (firstOffset * firstWeight + secondOffset * secondWeight) / pairWeight;
    color += texture(u_source, v_uv + u_direction * sampleOffset) * pairWeight;
    color += texture(u_source, v_uv - u_direction * sampleOffset) * pairWeight;
    totalWeight += 2.0 * pairWeight;
  }
  outColor = color / totalWeight;
}`;

const COMPOSITE_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_base;
uniform sampler2D u_trail;
uniform sampler2D u_pov;
uniform sampler2D u_glow;
uniform sampler2D u_overlay;
uniform int u_blendMode;
uniform bool u_showTrail;
uniform bool u_showPov;
uniform bool u_showGlow;
uniform bool u_showOverlay;
uniform float u_glowIntensity;
in vec2 v_uv;
out vec4 outColor;

vec3 blendLayer(vec3 base, vec4 layer) {
  if (u_blendMode == 1) return min(base + layer.rgb, 1.0);
  if (u_blendMode == 2) {
    vec3 source = layer.a > 0.0 ? clamp(layer.rgb / layer.a, 0.0, 1.0) : vec3(0.0);
    vec3 dodge = min(base / max(vec3(0.001), vec3(1.0) - source), 1.0);
    return mix(base, dodge, layer.a);
  }
  if (u_blendMode == 3) return layer.rgb + base * (1.0 - layer.a);
  return 1.0 - (1.0 - base) * (1.0 - layer.rgb);
}

void main() {
  vec4 base = texture(u_base, v_uv);
  vec4 trail = u_showTrail ? texture(u_trail, v_uv) : vec4(0.0);
  vec4 pov = u_showPov ? texture(u_pov, v_uv) : vec4(0.0);
  vec3 blended = u_showTrail ? blendLayer(base.rgb, trail) : base.rgb;
  if (u_showGlow) blended = min(blended + texture(u_glow, v_uv).rgb * u_glowIntensity, 1.0);
  if (u_showPov) blended = blendLayer(blended, pov);
  vec4 result = vec4(blended, base.a);
  vec4 overlay = u_showOverlay ? texture(u_overlay, v_uv) : vec4(0.0);
  outColor = overlay + result * (1.0 - overlay.a);
}`;

const PRESENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_frame;
uniform bool u_black;
in vec2 v_uv;
out vec4 outColor;
void main() {
  outColor = u_black ? vec4(0.0, 0.0, 0.0, 1.0) : texture(u_frame, v_uv);
}`;

type ProgramName = 'clone' | 'maskBlur' | 'adjust' | 'motionBlur' | 'trail' | 'glow' | 'composite' | 'present';

export class WebGL2EffectsRenderer implements EffectsRenderer {
  readonly usesGpuTemporalEffects = true;
  readonly usesGpuCloneStamp = true;
  private readonly gl: WebGL2RenderingContext;
  private programs = new Map<ProgramName, WebGLProgram>();
  private vertexBuffer: WebGLBuffer | null = null;
  private sourceTexture: WebGLTexture | null = null;
  private maskTexture: WebGLTexture | null = null;
  private povTexture: WebGLTexture | null = null;
  private cloneMaskTexture: WebGLTexture | null = null;
  private overlayTexture: WebGLTexture | null = null;
  private cloneTarget: RenderTarget | null = null;
  private cloneMaskTargets: PingPongRenderTargets | null = null;
  private adjustedTarget: RenderTarget | null = null;
  private motionTargets: PingPongRenderTargets | null = null;
  private trailTargets: PingPongRenderTargets | null = null;
  private glowTargets: PingPongRenderTargets | null = null;
  private finalTarget: RenderTarget | null = null;
  private strobeTarget: RenderTarget | null = null;
  private targetWidth = 0;
  private targetHeight = 0;
  private motionHistoryReady = false;
  private trailHistoryReady = false;
  private strobeFrameReady = false;
  private lastStrobeTriggerTime = 0;
  private colorCycleAngle = 0;
  private lost = false;
  private warnedUploadFailure = false;
  private cloneMaskRevision = -1;
  private cloneMaskWidth = 0;
  private cloneMaskHeight = 0;
  private cloneFeather = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is unavailable');
    this.gl = gl;
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.initialize();
  }

  resize(width: number, height: number): void {
    const changed = this.canvas.width !== width || this.canvas.height !== height;
    if (changed) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
    if (!this.lost && (changed || this.targetWidth !== width || this.targetHeight !== height)) {
      this.allocateRenderTargets(width, height);
    }
  }

  render({
    source,
    motionMask,
    povLayer,
    overlayLayer,
    cloneMask,
    cloneMaskRevision = 0,
    settings,
    time = performance.now(),
    isStrobeActive = false,
    isStrobeTriggered = true,
    updateTemporalState = true,
  }: EffectsFrame): void {
    if (
      this.lost || !this.sourceTexture || !this.maskTexture || !this.povTexture ||
      !this.cloneMaskTexture || !this.overlayTexture || !this.cloneTarget ||
      !this.adjustedTarget || !this.finalTarget || !this.strobeTarget
    ) return;
    const gl = this.gl;
    try {
      this.uploadTexture(this.sourceTexture, source, 0);
      if (motionMask) this.uploadTexture(this.maskTexture, motionMask, 1);
      if (povLayer) this.uploadTexture(this.povTexture, povLayer, 2);
      if (overlayLayer) this.uploadTexture(this.overlayTexture, overlayLayer, 3);
      if (cloneMask && (
        cloneMaskRevision !== this.cloneMaskRevision ||
        cloneMask.width !== this.cloneMaskWidth || cloneMask.height !== this.cloneMaskHeight
      )) {
        this.uploadTexture(this.cloneMaskTexture, cloneMask, 4);
        this.cloneMaskRevision = cloneMaskRevision;
        this.cloneMaskWidth = cloneMask.width;
        this.cloneMaskHeight = cloneMask.height;
        this.cloneFeather = -1;
      }
    } catch (error) {
      if (!this.warnedUploadFailure) {
        console.warn('WebGL2 frame upload failed.', error);
        this.warnedUploadFailure = true;
      }
      return;
    }

    let frameTexture = this.sourceTexture;
    if (settings.cloneStampEnabled && cloneMask) {
      const maskTexture = this.getCloneMaskTexture(settings.cloneStampFeather);
      this.drawCloneStamp(maskTexture, settings.cloneStampOffsetX, settings.cloneStampOffsetY);
      frameTexture = this.cloneTarget.texture;
    }
    this.drawAdjustedFrame(frameTexture, settings);
    const baseTexture = this.drawMotionBlur(settings.motionBlur, updateTemporalState && !!motionMask);

    const showStandardTrails = settings.enableTrails
      && !settings.enablePoiMode
      && settings.trailEffectMode === 'standard';
    if (!showStandardTrails && this.trailHistoryReady) this.clearTrailHistory();
    if (showStandardTrails && updateTemporalState) {
      this.colorCycleAngle = (this.colorCycleAngle + settings.colorCycleSpeed) % 360;
    }
    if (showStandardTrails && updateTemporalState && motionMask && isStrobeTriggered) {
      this.updateTrails(baseTexture, settings);
    }

    const showPov = settings.enableTrails && settings.enablePoiMode && !!povLayer;
    const isComet = settings.pixelEffectMode === 'comets';
    const glowIntensity = isComet ? settings.cometGlowIntensity : settings.poiGlowIntensity;
    const glowRadius = isComet ? 2 + glowIntensity * 6 : settings.poiGlowRadius;
    const showGlow = showPov && glowIntensity > 0 && (isComet || (settings.poiPovEnabled && settings.poiGlowEnabled));
    if (showGlow) this.blurTexture(this.povTexture!, glowRadius);
    this.drawComposite(baseTexture, settings, showStandardTrails, showPov, showGlow, !!overlayLayer);

    if (isStrobeActive && isStrobeTriggered) {
      this.copyTexture(this.finalTarget.texture, this.strobeTarget.framebuffer);
      this.strobeFrameReady = true;
      this.lastStrobeTriggerTime = time;
    }
    const presentation = getStrobePresentation(
      isStrobeActive,
      settings.strobeMode,
      time - this.lastStrobeTriggerTime
    );
    if (presentation === 'live' || !this.strobeFrameReady) {
      this.copyTexture(this.finalTarget.texture, null);
    } else {
      this.copyTexture(this.strobeTarget.texture, null, presentation === 'black');
    }
    if (!isStrobeActive) this.strobeFrameReady = false;
  }

  clearTemporalState(): void {
    if (this.lost) return;
    this.motionTargets?.clear();
    this.trailTargets?.clear();
    this.glowTargets?.clear();
    if (this.finalTarget) this.clearRenderTarget(this.finalTarget);
    if (this.strobeTarget) this.clearRenderTarget(this.strobeTarget);
    this.motionHistoryReady = false;
    this.trailHistoryReady = false;
    this.strobeFrameReady = false;
    this.lastStrobeTriggerTime = 0;
    this.colorCycleAngle = 0;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.deleteResources();
  }

  private initialize(): void {
    const gl = this.gl;
    this.cloneMaskRevision = -1;
    this.cloneMaskWidth = 0;
    this.cloneMaskHeight = 0;
    this.cloneFeather = -1;
    this.warnedUploadFailure = false;
    this.programs.set('adjust', this.createProgram(ADJUST_SHADER));
    this.programs.set('clone', this.createProgram(CLONE_SHADER));
    this.programs.set('maskBlur', this.createProgram(MASK_BLUR_SHADER));
    this.programs.set('motionBlur', this.createProgram(MOTION_BLUR_SHADER));
    this.programs.set('trail', this.createProgram(TRAIL_SHADER));
    this.programs.set('glow', this.createProgram(GLOW_SHADER));
    this.programs.set('composite', this.createProgram(COMPOSITE_SHADER));
    this.programs.set('present', this.createProgram(PRESENT_SHADER));

    const buffer = gl.createBuffer();
    const sourceTexture = this.createUploadTexture();
    const maskTexture = this.createUploadTexture();
    const povTexture = this.createUploadTexture();
    const cloneMaskTexture = this.createUploadTexture();
    const overlayTexture = this.createUploadTexture();
    if (!buffer || !sourceTexture || !maskTexture || !povTexture || !cloneMaskTexture || !overlayTexture) {
      if (buffer) gl.deleteBuffer(buffer);
      if (sourceTexture) gl.deleteTexture(sourceTexture);
      if (maskTexture) gl.deleteTexture(maskTexture);
      if (povTexture) gl.deleteTexture(povTexture);
      if (cloneMaskTexture) gl.deleteTexture(cloneMaskTexture);
      if (overlayTexture) gl.deleteTexture(overlayTexture);
      throw new Error('Unable to allocate WebGL resources');
    }
    this.vertexBuffer = buffer;
    this.sourceTexture = sourceTexture;
    this.maskTexture = maskTexture;
    this.povTexture = povTexture;
    this.cloneMaskTexture = cloneMaskTexture;
    this.overlayTexture = overlayTexture;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.allocateRenderTargets(this.canvas.width, this.canvas.height);
  }

  private allocateRenderTargets(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    deleteRenderTarget(this.gl, this.adjustedTarget);
    deleteRenderTarget(this.gl, this.finalTarget);
    deleteRenderTarget(this.gl, this.strobeTarget);
    deleteRenderTarget(this.gl, this.cloneTarget);
    this.motionTargets?.dispose();
    this.trailTargets?.dispose();
    this.glowTargets?.dispose();
    this.cloneMaskTargets?.dispose();
    this.cloneTarget = createRenderTarget(this.gl, width, height);
    this.cloneMaskTargets = createPingPongRenderTargets(this.gl, width, height);
    this.adjustedTarget = createRenderTarget(this.gl, width, height);
    this.motionTargets = createPingPongRenderTargets(this.gl, width, height);
    this.trailTargets = createPingPongRenderTargets(this.gl, width, height);
    this.glowTargets = createPingPongRenderTargets(this.gl, width, height);
    this.finalTarget = createRenderTarget(this.gl, width, height);
    this.strobeTarget = createRenderTarget(this.gl, width, height);
    this.targetWidth = width;
    this.targetHeight = height;
    this.clearTemporalState();
    this.cloneFeather = -1;
  }

  private getCloneMaskTexture(feather: number): WebGLTexture {
    if (!this.cloneMaskTargets || !this.cloneMaskTexture || feather <= 0) return this.cloneMaskTexture!;
    if (this.cloneFeather === feather) return this.cloneMaskTargets.read.texture;
    const gl = this.gl;
    let program = this.useProgram('maskBlur', this.cloneMaskTargets.write.framebuffer);
    this.bindTexture(program, 'u_source', this.cloneMaskTexture, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'u_direction'), feather / this.targetWidth, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.cloneMaskTargets.swap();
    program = this.useProgram('maskBlur', this.cloneMaskTargets.write.framebuffer);
    this.bindTexture(program, 'u_source', this.cloneMaskTargets.read.texture, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'u_direction'), 0, feather / this.targetHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.cloneMaskTargets.swap();
    this.cloneFeather = feather;
    return this.cloneMaskTargets.read.texture;
  }

  private drawCloneStamp(maskTexture: WebGLTexture, offsetX: number, offsetY: number): void {
    const gl = this.gl;
    const program = this.useProgram('clone', this.cloneTarget!.framebuffer);
    this.bindTexture(program, 'u_frame', this.sourceTexture!, 0);
    this.bindTexture(program, 'u_mask', maskTexture, 1);
    gl.uniform2f(gl.getUniformLocation(program, 'u_offset'), offsetX / this.targetWidth, -offsetY / this.targetHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawAdjustedFrame(frameTexture: WebGLTexture, settings: EffectsFrame['settings']): void {
    const gl = this.gl;
    const program = this.useProgram('adjust', this.adjustedTarget!.framebuffer);
    this.bindTexture(program, 'u_frame', frameTexture, 0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_exposure'), 1 + settings.exposure / 100);
    gl.uniform1f(gl.getUniformLocation(program, 'u_contrast'), 1 + settings.contrast / 100);
    gl.uniform1f(gl.getUniformLocation(program, 'u_saturation'), 1 + settings.saturation / 100);
    const temperature = settings.temperature / 100;
    const tint = settings.tint / 100;
    gl.uniform3f(
      gl.getUniformLocation(program, 'u_colorScale'),
      1 + temperature * 0.15 + tint * 0.08,
      1 + temperature * 0.05 - tint * 0.15,
      1 - temperature * 0.15 + tint * 0.08
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawMotionBlur(amount: number, advance: boolean): WebGLTexture {
    if (!this.motionTargets || !advance) return this.adjustedTarget!.texture;
    const gl = this.gl;
    const program = this.useProgram('motionBlur', this.motionTargets.write.framebuffer);
    this.bindTexture(program, 'u_current', this.adjustedTarget!.texture, 0);
    this.bindTexture(program, 'u_history', this.motionTargets.read.texture, 1);
    this.bindTexture(program, 'u_mask', this.maskTexture!, 2);
    gl.uniform1f(gl.getUniformLocation(program, 'u_amount'), amount);
    gl.uniform1i(gl.getUniformLocation(program, 'u_hasHistory'), this.motionHistoryReady ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.motionTargets.swap();
    this.motionHistoryReady = true;
    return this.motionTargets.read.texture;
  }

  private updateTrails(baseTexture: WebGLTexture, settings: EffectsFrame['settings']): void {
    if (!this.trailTargets) return;
    let freshTexture: WebGLTexture | null = null;
    if (settings.blurAmount > 0 && this.glowTargets) {
      this.drawTrailPass(this.glowTargets.write.framebuffer, baseTexture, settings, null, false);
      this.glowTargets.swap();
      freshTexture = this.blurTexture(this.glowTargets.read.texture, settings.blurAmount);
    }
    this.drawTrailPass(
      this.trailTargets.write.framebuffer,
      baseTexture,
      settings,
      freshTexture,
      this.trailHistoryReady
    );
    this.trailTargets.swap();
    this.trailHistoryReady = true;
  }

  private drawTrailPass(
    framebuffer: WebGLFramebuffer,
    baseTexture: WebGLTexture,
    settings: EffectsFrame['settings'],
    freshTexture: WebGLTexture | null,
    hasHistory: boolean
  ): void {
    const gl = this.gl;
    const program = this.useProgram('trail', framebuffer);
    this.bindTexture(program, 'u_previous', this.trailTargets.read.texture, 0);
    this.bindTexture(program, 'u_current', baseTexture, 1);
    this.bindTexture(program, 'u_mask', this.maskTexture!, 2);
    this.bindTexture(program, 'u_fresh', freshTexture || baseTexture, 3);
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_drift'),
      settings.horizontalDrift / this.targetWidth,
      -settings.verticalDrift / this.targetHeight
    );
    gl.uniform1f(gl.getUniformLocation(program, 'u_zoom'), settings.feedbackZoom);
    gl.uniform1f(gl.getUniformLocation(program, 'u_fade'), settings.echoFadeRate);
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_hue'),
      ((settings.hueRotate + this.colorCycleAngle) * Math.PI) / 180
    );
    gl.uniform1i(gl.getUniformLocation(program, 'u_hasHistory'), hasHistory ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_useFreshTexture'), freshTexture ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private clearTrailHistory(): void {
    this.trailTargets?.clear();
    this.trailHistoryReady = false;
    this.colorCycleAngle = 0;
  }

  private blurTexture(source: WebGLTexture, radius: number): WebGLTexture {
    if (!this.glowTargets || radius <= 0) return source;
    const gl = this.gl;
    let program = this.useProgram('glow', this.glowTargets.write.framebuffer);
    this.bindTexture(program, 'u_source', source, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'u_direction'), 1 / this.targetWidth, 0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), radius);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.glowTargets.swap();

    program = this.useProgram('glow', this.glowTargets.write.framebuffer);
    this.bindTexture(program, 'u_source', this.glowTargets.read.texture, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'u_direction'), 0, 1 / this.targetHeight);
    gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), radius);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.glowTargets.swap();
    return this.glowTargets.read.texture;
  }

  private drawComposite(
    baseTexture: WebGLTexture,
    settings: EffectsFrame['settings'],
    showTrail: boolean,
    showPov: boolean,
    showGlow: boolean,
    showOverlay: boolean
  ): void {
    const gl = this.gl;
    const program = this.useProgram('composite', this.finalTarget!.framebuffer);
    this.bindTexture(program, 'u_base', baseTexture, 0);
    this.bindTexture(program, 'u_trail', this.trailTargets!.read.texture, 1);
    this.bindTexture(program, 'u_pov', this.povTexture!, 2);
    this.bindTexture(program, 'u_glow', this.glowTargets!.read.texture, 3);
    this.bindTexture(program, 'u_overlay', this.overlayTexture!, 4);
    const blendMode = settings.compositeMode;
    const blendIndex = blendMode === 'lighter' ? 1 : blendMode === 'color-dodge' ? 2 : blendMode === 'source-over' ? 3 : 0;
    gl.uniform1i(gl.getUniformLocation(program, 'u_blendMode'), blendIndex);
    gl.uniform1i(gl.getUniformLocation(program, 'u_showTrail'), showTrail && this.trailHistoryReady ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_showPov'), showPov ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_showGlow'), showGlow ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_showOverlay'), showOverlay ? 1 : 0);
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_glowIntensity'),
      settings.pixelEffectMode === 'comets' ? settings.cometGlowIntensity : settings.poiGlowIntensity
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private copyTexture(
    texture: WebGLTexture,
    framebuffer: WebGLFramebuffer | null,
    black = false
  ): void {
    const gl = this.gl;
    const program = this.useProgram('present', framebuffer);
    this.bindTexture(program, 'u_frame', texture, 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_black'), black ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private clearRenderTarget(target: RenderTarget): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private useProgram(name: ProgramName, framebuffer: WebGLFramebuffer | null): WebGLProgram {
    const gl = this.gl;
    const program = this.programs.get(name);
    if (!program || !this.vertexBuffer) throw new Error(`WebGL program ${name} is unavailable`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, this.targetWidth, this.targetHeight);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    return program;
  }

  private bindTexture(program: WebGLProgram, uniform: string, texture: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, uniform), unit);
  }

  private uploadTexture(texture: WebGLTexture, source: TexImageSource, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  private createUploadTexture(): WebGLTexture | null {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private createProgram(fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Unknown WebGL link error';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Unable to create WebGL shader');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader) || 'Unknown WebGL shader error';
      this.gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  private handleContextLost(event: Event): void {
    event.preventDefault();
    this.lost = true;
    this.programs.clear();
    this.vertexBuffer = null;
    this.sourceTexture = null;
    this.maskTexture = null;
    this.povTexture = null;
    this.cloneMaskTexture = null;
    this.overlayTexture = null;
    this.cloneTarget = null;
    this.cloneMaskTargets = null;
    this.adjustedTarget = null;
    this.motionTargets = null;
    this.trailTargets = null;
    this.glowTargets = null;
    this.finalTarget = null;
    this.strobeTarget = null;
  }

  private handleContextRestored(): void {
    this.lost = false;
    try {
      this.targetWidth = 0;
      this.targetHeight = 0;
      this.initialize();
      this.resize(this.canvas.width, this.canvas.height);
    } catch (error) {
      this.lost = true;
      console.warn('WebGL2 context restoration failed.', error);
    }
  }

  private deleteResources(): void {
    const gl = this.gl;
    for (const program of this.programs.values()) gl.deleteProgram(program);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
    if (this.maskTexture) gl.deleteTexture(this.maskTexture);
    if (this.povTexture) gl.deleteTexture(this.povTexture);
    if (this.cloneMaskTexture) gl.deleteTexture(this.cloneMaskTexture);
    if (this.overlayTexture) gl.deleteTexture(this.overlayTexture);
    deleteRenderTarget(gl, this.adjustedTarget);
    deleteRenderTarget(gl, this.finalTarget);
    deleteRenderTarget(gl, this.strobeTarget);
    deleteRenderTarget(gl, this.cloneTarget);
    this.motionTargets?.dispose();
    this.trailTargets?.dispose();
    this.glowTargets?.dispose();
    this.cloneMaskTargets?.dispose();
    this.programs.clear();
    this.vertexBuffer = null;
    this.sourceTexture = null;
    this.maskTexture = null;
    this.povTexture = null;
    this.cloneMaskTexture = null;
    this.overlayTexture = null;
    this.cloneTarget = null;
    this.cloneMaskTargets = null;
    this.adjustedTarget = null;
    this.motionTargets = null;
    this.trailTargets = null;
    this.glowTargets = null;
    this.finalTarget = null;
    this.strobeTarget = null;
  }
}
