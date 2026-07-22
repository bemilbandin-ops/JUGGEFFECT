# WebGL2 Migration Plan

## Goal

Move JUGGEFFECT's full-resolution video compositing and temporal effects to WebGL2 while preserving the existing behavior, CPU tracking pipeline, recording flow, and Canvas2D fallback.

The migration is split into four deliveries. Each delivery must be implemented, reviewed, and verified before the next one begins.

## Rules for Every Delivery

- Read `AGENTS.md` and this entire plan before making changes.
- Implement only the delivery requested by the user. Do not begin later deliveries.
- Keep 60fps processing inside modular functions under `src/engine/`.
- Store high-frequency render state in refs or engine-owned objects, not React state.
- Do not add, remove, or change any key or value in:
  - `src/config/settingsDefaults.ts`
  - `src/config/settingsDefaults.test.ts`
- Preserve the existing Canvas2D path until the WebGL2 renderer is complete and verified.
- Do not introduce GPU-to-CPU `readPixels()` calls into the frame loop.
- Update the progress checklist and delivery notes after completing a delivery.
- Run all required verification commands before marking a delivery complete.

## Target Architecture

Use a hybrid rendering pipeline:

1. The existing low-resolution Canvas2D pipeline extracts the motion mask at 640x480.
2. Existing CPU code performs blob detection, point tracking, POV sampling, and POV geometry calculations.
3. WebGL2 performs full-resolution video adjustments, motion blur, trail feedback, glow, strobe, and final compositing.
4. The existing Canvas2D renderer remains available as a fallback when WebGL2 is unavailable or initialization fails.

The visible display canvas should be owned by one renderer. A canvas cannot use both a 2D context and a WebGL2 context, so context creation must happen behind the renderer seam.

### Keep on the CPU

- Low-resolution motion extraction and background learning
- `ImageData` motion mask required by blob detection
- Blob detection and tracked-point matching
- POV sampling and geometry calculations
- Pattern generation
- React settings and media lifecycle management

### Move to WebGL2

- Base video rendering
- Exposure, contrast, saturation, temperature, and tint
- Temporal motion blur
- Trail accumulation, fade, zoom, and drift
- Hue rotation, color cycling, and blend modes
- Glow passes
- Strobe presentation
- Final video, trail, motion-blur, and POV composition
- Clone-stamp compositing in Delivery 4

## Renderer Interface

Create a small renderer interface. Exact filenames may follow existing project conventions, but callers should not need to know about shaders, textures, framebuffers, or WebGL state.

```ts
interface EffectsRenderer {
  resize(width: number, height: number): void;
  render(frame: EffectsFrame): void;
  clearTemporalState(): void;
  dispose(): void;
}
```

The frame input should contain only the sources and state required to render a frame, such as the video or stamped-video source, motion mask, optional POV layer, settings, time, and strobe state.

A renderer factory should:

1. Try to construct the WebGL2 renderer.
2. Fall back to the existing Canvas2D implementation if WebGL2 is unsupported or initialization fails.
3. Report a useful warning when fallback occurs.

## Delivery 1: Renderer Foundation and Adjusted Video

### Scope

- Add the renderer interface and renderer factory.
- Wrap or adapt the existing Canvas2D path as the fallback renderer.
- Add a WebGL2 renderer under `src/engine/`.
- Initialize the WebGL2 context, fullscreen geometry, shader program, video texture, and required cleanup.
- Render the video frame to the display canvas.
- Implement exposure, contrast, saturation, temperature, and tint as shader uniforms.
- Resize the viewport and GPU resources when video dimensions change.
- Handle `webglcontextlost` and `webglcontextrestored`.
- Keep trails, motion blur, POV, strobe, and clone stamping on their existing paths for this delivery.

### Acceptance Criteria

- WebGL2 is selected when supported and Canvas2D remains a working fallback.
- Default settings render a visually unchanged video.
- All five camera adjustments respond to existing controls.
- Camera, demo video, and uploaded video sources render correctly.
- Resizing and fullscreen do not stretch or corrupt the frame.
- Starting and stopping recording still works through `canvas.captureStream()`.
- WebGL resources are not recreated on every frame.
- Context loss does not crash the application.

## Delivery 2: Motion Blur and Standard Trails

### Scope

- Add reusable framebuffer and ping-pong texture support.
- Upload the existing CPU-produced motion mask to WebGL2.
- Implement temporal motion blur, limited to moving regions by the motion mask.
- Implement standard trail accumulation and fading.
- Implement feedback zoom, horizontal drift, vertical drift, hue rotation, color cycling, and existing trail blend modes.
- Reset GPU history when trails are cleared, video dimensions change, the source changes, or the user seeks.
- Keep CPU motion extraction, blob detection, POV rendering, and clone stamping unchanged.

### Acceptance Criteria

- Motion blur affects moving regions while stationary regions remain sharp.
- Trail length, fade, zoom, drift, hue, color cycle, blur, and blend controls remain functional.
- Temporal effects do not sample from the texture currently being rendered into.
- Clear trails, seek, resize, and source changes leave no stale GPU frames.
- No `readPixels()` call runs in the animation loop.
- Canvas2D fallback behavior remains functional.

## Delivery 3: POV Composition, Glow, and Strobe

### Scope

- Keep POV calculations and drawing on the CPU.
- Upload the existing POV canvas as a texture and composite it into the WebGL2 output.
- Add glow with separable horizontal and vertical blur passes.
- Move strobe flash and hold presentation to WebGL2.
- Integrate POV, glow, trails, motion blur, and adjusted video in the final composite pass.
- Ensure GPU history resets correctly during pause, seek, resize, clear, and source changes.

### Acceptance Criteria

- Existing POV patterns, orientations, fading, mapping, and tracking remain visually functional.
- Glow radius and intensity controls work without corrupting the core POV image.
- Strobe modes and timing match the existing behavior.
- Pausing and seeking display the correct frame without stale trails.
- Recording includes the complete WebGL2 composition.
- Camera, uploaded video, demo video, fullscreen, and fallback are all verified.

## Delivery 4: GPU Clone Stamp and Cleanup

### Scope

- Move clone-stamp compositing to WebGL2.
- Upload the painted removal mask only when it changes where practical.
- Sample shifted video coordinates and blend through the feathered mask.
- Preserve the clone brush preview and pointer behavior.
- Remove full-resolution Canvas2D buffers that are no longer needed.
- Retain the low-resolution processing canvas and all CPU tracking data.
- Review and simplify the final renderer integration without changing behavior.

### Acceptance Criteria

- Clone offset, brush size, feathering, painting, and clearing behave like the existing implementation.
- Clone stamping appears correctly in recordings.
- Removed buffers have no remaining callers.
- The Canvas2D fallback still supports the complete application.
- WebGL context restoration recreates required programs, textures, and framebuffers.
- No GPU resources leak when stopping a source or unmounting the view.

## Compatibility Requirements

Every delivery must preserve or explicitly verify:

- Browsers without WebGL2 use the Canvas2D fallback.
- Camera, demo, and uploaded video sources work.
- Canvas recording continues to capture the complete visible result.
- Resize and fullscreen update the viewport and render targets correctly.
- Pause, seek, source changes, and trail clearing reset temporal state appropriately.
- WebGL context loss is handled without an application crash.
- Cross-origin video behavior is not made less safe than the existing canvas pipeline.

Use `preserveDrawingBuffer: false` unless a verified recording issue requires otherwise. Avoid allocating textures, framebuffers, geometry, or shader programs inside the per-frame render path.

## Progress Checklist

- [x] Delivery 1: Renderer foundation and adjusted video
- [x] Delivery 2: Motion blur and standard trails
- [x] Delivery 3: POV composition, glow, and strobe
- [x] Delivery 4: GPU clone stamp and cleanup

### Delivery Notes

After each delivery, add a short note here containing:

- Completion date
- Main files added or changed
- Verification results
- Known differences, limitations, or follow-up items

#### Delivery 1 — 2026-07-21

- Added `effectsRenderer.ts`, `canvas2dEffectsRenderer.ts`, and `webgl2EffectsRenderer.ts`; updated the render loop and existing Canvas2D processors to present through the renderer seam.
- Verification passed: `rtk npx tsc --noEmit`, `rtk npm run build`, and `rtk npm run test` (including default-settings and presets lock tests).
- Manual Chrome checks passed for WebGL2 selection, default/demo rendering, all five camera adjustments, viewport resize, `captureStream()` recording, forced WebGL2 fallback, and context loss/restoration. The test environment had no camera device, blocked local file input injection, and did not grant fullscreen, so those three hardware/browser flows remain follow-up checks on a normal interactive browser.
- Delivery 2 temporal GPU effects were not started; trails, motion blur, POV, strobe, and clone stamp remain on their existing Canvas2D paths.

#### Delivery 2 — 2026-07-21

- Added reusable framebuffer and ping-pong render targets in `webglRenderTargets.ts`; expanded `webgl2EffectsRenderer.ts` with CPU-mask upload, motion-masked temporal blur, and standard trail feedback/compositing.
- Preserved the Canvas2D temporal fallback and CPU POV path; wired GPU history clearing into trail reset, seek, resize, source start/stop, source metadata, and preset changes.
- Verification passed: `rtk npx tsc --noEmit`, `rtk npm run build`, and `rtk npm run test` (including default-settings and presets lock tests).
- Headless Chromium checks passed for demo playback through WebGL2, motion blur, fade, trail blur, hue/color cycling, zoom, horizontal/vertical drift, color-dodge blending, trail clearing, and forced Canvas2D fallback. Browser screenshot capture produced Chromium driver `ReadPixels` performance warnings; application source contains no `readPixels()` call. Camera hardware, uploaded local files, and interactive fullscreen remain follow-up checks on a normal browser.
- Delivery 3 was not started; POV upload/composition, glow, and strobe presentation remain on their existing CPU/Canvas2D paths.

#### Delivery 3 — 2026-07-22

- Updated `effectsRenderer.ts`, `webgl2EffectsRenderer.ts`, `renderLoopEngine.ts`, `trailProcessor.ts`, `pausedFrameRenderer.ts`, `viewportRenderer.ts`, and `strobeEvaluator.ts`; added `strobeEvaluator.test.ts` and wired it into the existing test command.
- Kept CPU POV tracking/drawing intact, then uploaded the POV canvas for GPU composition with separable glow passes and GPU-held freeze/flash strobe presentation. GPU temporal state now clears while paused as well as on the existing seek, resize, clear, preset, and source reset paths.
- Verification passed: `rtk npx tsc --noEmit`, `rtk npm run build`, and `rtk npm run test` (including the default-settings and presets lock tests).
- Headless Chrome checks passed for demo playback through WebGL2, POV rendering, glow radius/intensity changes, freeze and flash strobe modes, pause/seek/reset, fullscreen sizing, forced Canvas2D fallback, and `captureStream()` recording (one video track and a non-empty WebM). Camera hardware and local uploaded-video selection remain follow-up checks in an interactive browser; the only console error was an unrelated missing favicon (404).
- Delivery 4 was not started; clone-stamp compositing and buffer cleanup remain unchanged.

#### Delivery 4 — 2026-07-22

- Updated `effectsRenderer.ts`, `webgl2EffectsRenderer.ts`, `renderLoopEngine.ts`, clone-mask preparation/pointer handling, and the Canvas2D buffer/presentation helpers; GPU clone stamping now uploads painted masks only after paint, clear, resize, or restoration changes and composites shifted video through a separably feathered mask.
- Preserved the complete Canvas2D fallback while avoiding its stamped-video, clone-intermediate, motion-blur, and strobe buffers on the WebGL2 path; overlays remain visible and recorded after GPU composition. WebGL disposal/restoration covers the added programs, textures, and render targets.
- Verification passed: `rtk npx tsc --noEmit`, `rtk npm run build`, and `rtk npm run test` (including the default-settings and presets lock tests).
- Headless Chrome checks passed for demo and uploaded-source handling, clone enable/paint/clear, brush preview, brush size, X/Y offsets, feather changes, a non-empty recorded WebM, forced Canvas2D fallback, and WebGL context loss/restoration with the painted mask retained. Camera hardware was unavailable for an interactive camera check; the only application console error was the existing missing favicon (404).

## Required Verification

Run all commands after every delivery:

```powershell
rtk npx tsc --noEmit
rtk npm run build
rtk npm run test
```

All unit tests and the default-settings lock test must pass. If the settings lock test fails, revert the mutated setting or snapshot and rerun the complete verification sequence.

In addition, manually test the acceptance criteria relevant to the delivery. Do not mark the progress checklist complete based only on compilation or automated tests.
