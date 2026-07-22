export interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

export function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): RenderTarget {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    throw new Error('Unable to allocate WebGL render target');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    throw new Error('WebGL render target is incomplete');
  }
  return { texture, framebuffer };
}

export function deleteRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget | null): void {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

export class PingPongRenderTargets {
  private readIndex = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly targets: [RenderTarget, RenderTarget]
  ) {}

  get read(): RenderTarget {
    return this.targets[this.readIndex];
  }

  get write(): RenderTarget {
    return this.targets[1 - this.readIndex];
  }

  swap(): void {
    this.readIndex = 1 - this.readIndex;
  }

  clear(): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    for (const target of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.readIndex = 0;
  }

  dispose(): void {
    deleteRenderTarget(this.gl, this.targets[0]);
    deleteRenderTarget(this.gl, this.targets[1]);
  }
}

export function createPingPongRenderTargets(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): PingPongRenderTargets {
  const first = createRenderTarget(gl, width, height);
  try {
    return new PingPongRenderTargets(gl, [first, createRenderTarget(gl, width, height)]);
  } catch (error) {
    deleteRenderTarget(gl, first);
    throw error;
  }
}
