# POV Pixel Effect — Refined Implementation Plan

## Summary

Transform the current pixel effect from "paint one column at current blob position" to a real **Persistence of Vision (POV) sweep** that paints an image across the club's entire motion trail — exactly like real pixel poi hardware. Also add LED glow/bloom rendering and new procedural patterns.

**Target files:**
- [types.ts](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/types.ts) — Add ~10 new settings fields
- [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Rewrite poi rendering loop + add UI controls

---

## Part 1: New Type Definitions

#### [MODIFY] [types.ts](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/types.ts) — Lines 60-68

Add these new fields to the `TrackingSettings` interface, after `poiFrameInterval` (line 67):

```typescript
  // === NEW POV FIELDS ===
  poiPovEnabled: boolean;           // Toggle between old single-column mode and new POV sweep mode
  poiPovRetention: number;          // How long (ms) painted columns stay visible before fading (e.g., 300 = 300ms of trailing columns visible)
  poiPovFadeMode: 'linear' | 'exponential' | 'sharp'; // How the trail fades: linear = even fade, exponential = quick drop, sharp = hard cutoff
  poiPovColumnSpacing: number;      // Minimum pixel distance the club must travel before the next image column is painted (e.g., 4 = new column every 4px of movement)
  poiPovMotionMode: 'free' | 'circular'; // 'free' = paint along any motion path, 'circular' = optimize for spinning/circular motion (image wraps around rotation)
  poiGlowEnabled: boolean;          // Toggle LED glow/bloom halos
  poiGlowRadius: number;            // Radius of the glow halo in pixels (e.g., 8)
  poiGlowIntensity: number;         // Glow brightness multiplier 0.0–1.0
  poiLedCount: number;              // Override number of simulated LEDs per column (0 = auto from club length)
```

Also update the `poiPatternType` union on line 49 to add new procedural patterns:

```typescript
  poiPatternType: 'swedish' | 'youtube' | 'rainbow' | 'flowers' | 'text' | 'custom' | 'spiral' | 'chevron' | 'mandala';
```

---

## Part 2: Default Settings & Refs

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Lines 538-541

After `poiFrameInterval: 1,` on line 540, add defaults for the new fields:

```typescript
    poiPovEnabled: true,
    poiPovRetention: 400,
    poiPovFadeMode: 'exponential',
    poiPovColumnSpacing: 3,
    poiPovMotionMode: 'free',
    poiGlowEnabled: true,
    poiGlowRadius: 6,
    poiGlowIntensity: 0.5,
    poiLedCount: 0,
```

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Lines 459-465

Add a new ref for the POV trail buffer, after the existing poi refs:

```typescript
  // POV trail buffer: stores painted column snapshots per tracked point
  // Each entry: { id: trackingId, x, y, angle, colIdx, length, timestamp }
  const poiTrailBufferRef = useRef<Map<number, { x: number; y: number; angle: number; colIdx: number; length: number; timestamp: number }[]>>(new Map());
  // Track accumulated distance per tracked point (for per-pixel-distance column advancement)
  const poiAccumulatedDistRef = useRef<Map<number, number>>(new Map());
```

---

## Part 3: Core Algorithm — POV Trail Buffer Rendering

This is the main change. Replace the current rendering loop for poi mode.

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Lines 1596-1805

The entire section from `trackedPointsRef.current = updatedTrackedPoints;` (line 1596) through `trailCtx.restore();` (line 1803) needs to be replaced. Here is the new logic:

```
trackedPointsRef.current = updatedTrackedPoints;

// Clean up trail buffers for dead tracked points
const aliveIds = new Set(updatedTrackedPoints.map(t => t.id));
for (const [id] of poiTrailBufferRef.current) {
  if (!aliveIds.has(id)) {
    poiTrailBufferRef.current.delete(id);
    poiAccumulatedDistRef.current.delete(id);
  }
}

const patternWidth = patternCanvas.width;
const patternHeight = patternCanvas.height;
const imgData = poiPatternDataRef.current;
if (!imgData || imgData.width === 0 || imgData.height === 0 || patternWidth <= 0) continue-to-restore;

const usePov = currentSettings.poiPovEnabled;
const povRetention = currentSettings.poiPovRetention || 400;
const povFadeMode = currentSettings.poiPovFadeMode || 'exponential';
const columnSpacing = currentSettings.poiPovColumnSpacing || 3;
const motionMode = currentSettings.poiPovMotionMode || 'free';
const glowEnabled = currentSettings.poiGlowEnabled;
const glowRadius = currentSettings.poiGlowRadius || 6;
const glowIntensity = currentSettings.poiGlowIntensity || 0.5;
const ledCountOverride = currentSettings.poiLedCount || 0;

// Advance global column index (for time-based mode, kept for backward compat)
poiColumnIndexRef.current = (poiColumnIndexRef.current + currentSettings.poiSpeedMultiplier) % patternWidth;

for (const tp of trackedPointsRef.current) {
  if (tp.lastSeen !== now) continue;

  // Frame skip interval
  const frameInterval = currentSettings.poiFrameInterval || 1;
  if (tp.envelopeFrame % frameInterval !== 0) continue;

  // Envelope opacity (existing ADSR logic — keep as-is)
  // ... [keep the existing T_in/T_hold/T_out/T_wait logic from lines 1617-1646 unchanged] ...

  const L = currentSettings.poiHeight;
  const W = currentSettings.poiWidth;
  const orientation = currentSettings.poiOrientation;
  const finalL = L > 0 ? L : tp.length;
  const numLEDs = ledCountOverride > 0 ? ledCountOverride : Math.max(8, Math.floor(finalL / 5));

  // === Determine column index ===
  let colIdx = 0;
  const mappingMode = currentSettings.poiMappingMode || 'time';
  if (mappingMode === 'time') {
    colIdx = Math.floor(poiColumnIndexRef.current) % patternWidth;
  } else if (mappingMode === 'angle') {
    const normalizedAngle = (tp.angle + Math.PI) / (Math.PI * 2);
    colIdx = Math.floor(normalizedAngle * patternWidth) % patternWidth;
    if (colIdx < 0) colIdx += patternWidth;
  } else if (mappingMode === 'spatial') {
    const spatialScale = 0.5;
    colIdx = Math.floor(tp.x * spatialScale) % patternWidth;
    if (colIdx < 0) colIdx += patternWidth;
  }

  if (usePov) {
    // === NEW POV MODE ===
    // Get or create trail buffer and distance accumulator for this tracked point
    if (!poiTrailBufferRef.current.has(tp.id)) {
      poiTrailBufferRef.current.set(tp.id, []);
      poiAccumulatedDistRef.current.set(tp.id, 0);
    }
    const trail = poiTrailBufferRef.current.get(tp.id)!;
    const prevDist = poiAccumulatedDistRef.current.get(tp.id) || 0;

    // Calculate distance moved since last frame
    let distMoved = 0;
    if (tp.prevX !== undefined && tp.prevY !== undefined) {
      distMoved = Math.hypot(tp.x - tp.prevX, tp.y - tp.prevY);
    }
    const newAccDist = prevDist + distMoved;

    // Only add a new column if the club has moved enough pixels
    if (newAccDist >= columnSpacing) {
      // If distance-based, advance column index by number of columns traveled
      const columnsToAdvance = Math.floor(newAccDist / columnSpacing);
      const lastColIdx = trail.length > 0 ? trail[trail.length - 1].colIdx : colIdx;
      
      // For distance-based, step through columns
      for (let step = 0; step < columnsToAdvance; step++) {
        const stepCol = (lastColIdx + step + 1) % patternWidth;
        // Interpolate position along the movement vector for each sub-step
        const t_interp = columnsToAdvance > 1 ? (step + 1) / columnsToAdvance : 1;
        const interpX = tp.prevX !== undefined ? tp.prevX + (tp.x - tp.prevX) * t_interp : tp.x;
        const interpY = tp.prevY !== undefined ? tp.prevY + (tp.y - tp.prevY) * t_interp : tp.y;
        
        trail.push({
          x: interpX,
          y: interpY,
          angle: tp.angle,
          colIdx: stepCol,
          length: finalL,
          timestamp: now
        });
      }
      poiAccumulatedDistRef.current.set(tp.id, newAccDist % columnSpacing);
    } else {
      poiAccumulatedDistRef.current.set(tp.id, newAccDist);
    }

    // Evict entries older than the POV retention window
    const cutoff = now - povRetention;
    while (trail.length > 0 && trail[0].timestamp < cutoff) {
      trail.shift();
    }
    // Safety cap: max 500 entries per tracked point to prevent memory blowup
    while (trail.length > 500) {
      trail.shift();
    }

    // === RENDER ALL VISIBLE COLUMNS IN THE TRAIL ===
    for (const entry of trail) {
      const age = now - entry.timestamp;
      let fadeFactor = 1.0;
      if (povFadeMode === 'linear') {
        fadeFactor = 1.0 - (age / povRetention);
      } else if (povFadeMode === 'exponential') {
        fadeFactor = Math.pow(1.0 - (age / povRetention), 2.5);
      } else if (povFadeMode === 'sharp') {
        fadeFactor = age < povRetention * 0.8 ? 1.0 : (1.0 - (age - povRetention * 0.8) / (povRetention * 0.2));
      }
      fadeFactor = Math.max(0, Math.min(1, fadeFactor));
      const entryOpacity = finalOpacity * fadeFactor;
      if (entryOpacity <= 0.01) continue;

      // Draw the column at this trail entry's position/angle
      trailCtx.save();
      trailCtx.globalAlpha = entryOpacity;

      // Translate and rotate based on orientation (same logic as before)
      if (orientation === 'club') {
        trailCtx.translate(entry.x, entry.y);
        trailCtx.rotate(entry.angle);
      } else if (orientation === 'radial') {
        const cx = currentSettings.poiCenterRelativeX * trailCanvas.width;
        const cy = currentSettings.poiCenterRelativeY * trailCanvas.height;
        const angle = Math.atan2(entry.y - cy, entry.x - cx);
        trailCtx.translate(entry.x, entry.y);
        trailCtx.rotate(angle);
      } else if (orientation === 'motion') {
        // For motion, use the direction from prev to current entry
        // (approximate from trail neighbors)
        trailCtx.translate(entry.x, entry.y);
        trailCtx.rotate(entry.angle + Math.PI / 2);
      } else if (orientation === 'vertical') {
        trailCtx.translate(entry.x, entry.y);
      } else if (orientation === 'horizontal') {
        trailCtx.translate(entry.x, entry.y);
        trailCtx.rotate(Math.PI / 2);
      }

      // Draw LED column with glow
      drawLedColumnWithGlow(
        trailCtx, imgData, entry.colIdx, numLEDs, entry.length, W,
        glowEnabled, glowRadius, glowIntensity, entryOpacity
      );

      trailCtx.restore();
    }

  } else {
    // === LEGACY MODE (original single-column painting) ===
    // ... keep the existing single-column rendering code from lines 1701-1803 unchanged ...
  }
}
```

---

## Part 4: New Helper Function — `drawLedColumnWithGlow`

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Insert after line 305 (after `detectBlobs`)

Add this new standalone function:

```typescript
/**
 * Draws a single LED column at the current canvas transform origin.
 * Assumes ctx is already translated and rotated so the column goes along the Y axis.
 * Adds optional glow halos around each LED dot for realistic pixel poi look.
 */
function drawLedColumnWithGlow(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  colIdx: number,
  numLEDs: number,
  length: number,    // total length of the LED strip in canvas pixels
  dotWidth: number,  // diameter of each LED dot
  glowEnabled: boolean,
  glowRadius: number,
  glowIntensity: number,
  opacity: number
) {
  const pWidth = imgData.width;
  const pHeight = imgData.height;
  const data = imgData.data;
  const px = colIdx % pWidth;

  // Use 'lighter' composite for additive glow blending
  const prevComposite = ctx.globalCompositeOperation;
  if (glowEnabled) {
    ctx.globalCompositeOperation = 'lighter';
  }

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

    if (glowEnabled && glowRadius > 0) {
      // Draw glow halo first (radial gradient)
      const grad = ctx.createRadialGradient(0, y_pos, 0, 0, y_pos, glowRadius + dotWidth);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${ledAlpha * glowIntensity})`);
      grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${ledAlpha * glowIntensity * 0.4})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(-(glowRadius + dotWidth), y_pos - (glowRadius + dotWidth), (glowRadius + dotWidth) * 2, (glowRadius + dotWidth) * 2);
    }

    // Draw core LED dot
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ledAlpha})`;
    ctx.beginPath();
    ctx.arc(0, y_pos, dotWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Restore composite mode
  ctx.globalCompositeOperation = prevComposite;
}
```

---

## Part 5: New Procedural Patterns

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Insert inside `updatePoiPattern()` (after the `custom` block, before the closing `}` at line 422)

Add three new pattern types:

```typescript
  else if (type === 'spiral') {
    // Creates a repeating spiral/helix pattern that produces the feathered look from reference images
    canvas.width = 360;
    canvas.height = 72;
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normX = x / canvas.width;
        const normY = y / canvas.height;
        const angle = normX * Math.PI * 6; // 3 full spirals across the width
        const wave = Math.sin(angle + normY * Math.PI * 4) * 0.5 + 0.5;
        const h = (normX * 240 + 200) % 360; // Cyan to magenta hue sweep
        const s = 85 + wave * 15;
        const l = 20 + wave * 55;
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  else if (type === 'chevron') {
    // Creates repeating chevron/zigzag geometry — produces triangular patterns when spun
    canvas.width = 256;
    canvas.height = 80;
    const colors = ['#FF2A85', '#00FFCC', '#3B82F6', '#A855F7'];
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normY = y / canvas.height;
        const phase = (x / 32) * Math.PI * 2;
        const zigzag = Math.abs(((normY * 4 + Math.sin(phase) * 0.3) % 1) * 2 - 1);
        const band = Math.floor(normY * 4) % colors.length;
        if (zigzag > 0.15) {
          ctx.fillStyle = colors[band];
          ctx.globalAlpha = 0.3 + zigzag * 0.7;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
  else if (type === 'mandala') {
    // Creates concentric hexagonal/circular patterns — produces the mandala look from reference image 3
    canvas.width = 360;
    canvas.height = 80;
    const palette = ['#FF0040', '#00FF80', '#FFE600', '#00BFFF', '#FF6600', '#FFFFFF'];
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normX = x / canvas.width;
        const normY = y / canvas.height;
        const ring = Math.floor((normY * 5 + Math.sin(normX * Math.PI * 12) * 0.15) % palette.length);
        const edgeFade = 1 - Math.abs(Math.sin(normX * Math.PI * 12 + normY * Math.PI * 6)) * 0.3;
        if (edgeFade > 0.4) {
          ctx.fillStyle = palette[ring];
          ctx.globalAlpha = edgeFade;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
```

---

## Part 6: Updated Preset

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — Lines 177-205

Replace the existing `pixel-poi` preset with an updated version that uses the new POV settings:

```typescript
  {
    id: 'pixel-poi',
    name: 'Pixel POV',
    description: 'Persistence-of-vision sweep that paints images along club trails.',
    icon: 'Flame',
    color: 'text-blue-400 border-blue-500/20 hover:border-blue-500/40 bg-blue-950/10',
    settings: {
      enableTrails: true,
      enablePoiMode: true,
      poiPatternType: 'spiral',
      poiOrientation: 'club',
      enableLightTracking: true,
      lightThreshold: 200,
      echoFadeRate: 0.02,
      blurAmount: 0,
      poiHeight: 0,
      poiWidth: 3,
      poiSpeedMultiplier: 2.5,
      poiMaxPoints: 3,
      poiMappingMode: 'time',
      poiRenderMode: 'dots',
      poiOpacity: 1.0,
      poiFadeInTime: 0,
      poiHoldTime: 0,
      poiFadeOutTime: 0,
      poiWaitTime: 0,
      poiFrameInterval: 1,
      poiPovEnabled: true,
      poiPovRetention: 400,
      poiPovFadeMode: 'exponential',
      poiPovColumnSpacing: 3,
      poiPovMotionMode: 'free',
      poiGlowEnabled: true,
      poiGlowRadius: 6,
      poiGlowIntensity: 0.5,
      poiLedCount: 0,
    }
  }
```

---

## Part 7: UI Controls

#### [MODIFY] [TrackingCanvas.tsx](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/components/TrackingCanvas.tsx) — After the "Render Style" dropdown (around line 3395)

Insert a new UI section for the POV settings. Place it after the existing render style select and before the radial center controls:

```tsx
{/* POV Sweep Settings */}
<div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
  <span className="text-[10px] text-neutral-400 block font-medium">POV Sweep (Persistence of Vision)</span>
  
  <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
    <div className="flex flex-col">
      <span className="font-medium text-[11px]">Enable POV Sweep</span>
      <span className="text-[9px] text-neutral-500">Paint image across the motion trail (like real pixel poi)</span>
    </div>
    <input type="checkbox" checked={settings.poiPovEnabled}
      onChange={(e) => setSettings((prev) => ({ ...prev, poiPovEnabled: e.target.checked }))}
      className="sr-only peer" />
    <div className="relative w-8 h-4 bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-500 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
  </label>

  {settings.poiPovEnabled && (<>
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-neutral-500">Trail Retention</span>
        <span className="text-neutral-300 font-mono">{settings.poiPovRetention}ms</span>
      </div>
      <input type="range" min="50" max="2000" step="25" value={settings.poiPovRetention}
        onChange={(e) => setSettings((prev) => ({ ...prev, poiPovRetention: parseInt(e.target.value) }))}
        className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" />
    </div>

    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-neutral-500">Column Spacing</span>
        <span className="text-neutral-300 font-mono">{settings.poiPovColumnSpacing}px</span>
      </div>
      <input type="range" min="1" max="20" step="1" value={settings.poiPovColumnSpacing}
        onChange={(e) => setSettings((prev) => ({ ...prev, poiPovColumnSpacing: parseInt(e.target.value) }))}
        className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" />
    </div>

    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-neutral-500">Fade Curve</span>
      <select value={settings.poiPovFadeMode}
        onChange={(e) => setSettings((prev) => ({ ...prev, poiPovFadeMode: e.target.value as any }))}
        className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-[10px] text-neutral-300 outline-none focus:border-blue-500 cursor-pointer">
        <option value="exponential">Exponential (Smooth, Natural)</option>
        <option value="linear">Linear (Even Fade)</option>
        <option value="sharp">Sharp (Hard Cutoff)</option>
      </select>
    </div>

    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-neutral-500">Motion Type</span>
      <select value={settings.poiPovMotionMode}
        onChange={(e) => setSettings((prev) => ({ ...prev, poiPovMotionMode: e.target.value as any }))}
        className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-[10px] text-neutral-300 outline-none focus:border-blue-500 cursor-pointer">
        <option value="free">Free Path (Any motion — throws, swings, etc.)</option>
        <option value="circular">Circular (Optimized for spinning — wraps image around rotation)</option>
      </select>
    </div>
  </>)}
</div>

{/* LED Glow Settings */}
<div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
  <span className="text-[10px] text-neutral-400 block font-medium">LED Glow / Bloom</span>
  
  <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
    <div className="flex flex-col">
      <span className="font-medium text-[11px]">Enable Glow Halos</span>
      <span className="text-[9px] text-neutral-500">Adds realistic light bloom around each LED dot</span>
    </div>
    <input type="checkbox" checked={settings.poiGlowEnabled}
      onChange={(e) => setSettings((prev) => ({ ...prev, poiGlowEnabled: e.target.checked }))}
      className="sr-only peer" />
    <div className="relative w-8 h-4 bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-500 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
  </label>

  {settings.poiGlowEnabled && (<>
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-neutral-500">Glow Radius</span>
        <span className="text-neutral-300 font-mono">{settings.poiGlowRadius}px</span>
      </div>
      <input type="range" min="2" max="20" step="1" value={settings.poiGlowRadius}
        onChange={(e) => setSettings((prev) => ({ ...prev, poiGlowRadius: parseInt(e.target.value) }))}
        className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" />
    </div>

    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-neutral-500">Glow Intensity</span>
        <span className="text-neutral-300 font-mono">{Math.round(settings.poiGlowIntensity * 100)}%</span>
      </div>
      <input type="range" min="0.1" max="1.0" step="0.05" value={settings.poiGlowIntensity}
        onChange={(e) => setSettings((prev) => ({ ...prev, poiGlowIntensity: parseFloat(e.target.value) }))}
        className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" />
    </div>
  </>)}

  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[10px]">
      <span className="text-neutral-500">LED Count (per column)</span>
      <span className="text-neutral-300 font-mono">{settings.poiLedCount === 0 ? "Auto" : settings.poiLedCount}</span>
    </div>
    <input type="range" min="0" max="72" step="4" value={settings.poiLedCount}
      onChange={(e) => setSettings((prev) => ({ ...prev, poiLedCount: parseInt(e.target.value) }))}
      className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" />
  </div>
</div>
```

Also update the Pattern Source `<select>` options (around line 3289-3296) to include the three new patterns:

```html
<option value="spiral">Spiral Helix (Feathered POV)</option>
<option value="chevron">Chevron Zigzag (Geometric)</option>
<option value="mandala">Concentric Mandala (Rings)</option>
```

---

## Part 8: Circular Motion Mode (for `poiPovMotionMode === 'circular'`)

When motion mode is `'circular'`, instead of painting columns along the free movement path, the algorithm should:

1. Use the center-of-rotation point (`poiCenterRelativeX/Y`) to calculate the **angular position** of the club relative to the center
2. Map the angular position directly to the pattern column: `colIdx = Math.floor(((angle + PI) / (2*PI)) * patternWidth) % patternWidth`
3. The trail buffer still works the same way (position + fade over time), but column assignment is angle-based rather than distance-based
4. This makes the image wrap cleanly around a circular rotation — matching the reference photos

This should be implemented as a branch inside the `usePov` block:

```typescript
if (motionMode === 'circular') {
  const cx = currentSettings.poiCenterRelativeX * trailCanvas.width;
  const cy = currentSettings.poiCenterRelativeY * trailCanvas.height;
  const angToCenter = Math.atan2(tp.y - cy, tp.x - cx);
  colIdx = Math.floor(((angToCenter + Math.PI) / (Math.PI * 2)) * patternWidth) % patternWidth;
  if (colIdx < 0) colIdx += patternWidth;
  // Always add an entry each frame (no distance gating for circular — angle determines column)
  trail.push({ x: tp.x, y: tp.y, angle: tp.angle, colIdx, length: finalL, timestamp: now });
}
```

---

## Verification Plan

### Build Verification
```bash
cd d:\Codexcode\JUGGEFFECT\JUGGEFFECT && npm run dev
```
- Ensure the app builds and loads without TypeScript errors

### Manual Testing
1. **POV sweep test**: Enable Pixel POV preset → swing an LED club (or bright light) in an arc → verify that the image "paints" across the swept path with fading trailing columns
2. **Glow test**: Toggle glow on/off → verify visible bloom halos around each LED dot with additive blending
3. **Circular mode test**: Switch to "Circular" motion mode + "Radial" orientation → spin club in a circle → verify the image wraps cleanly around the rotation
4. **Pattern test**: Try each new pattern (spiral, chevron, mandala) → verify they render and produce distinct visual signatures
5. **Legacy mode test**: Disable POV sweep toggle → verify the original single-column behavior still works unchanged
6. **Performance test**: Verify 60fps with 3 tracked clubs and 400ms retention (~20-30 trail entries per club)

### Memory Check
- Verify trail buffer entries are properly evicted (cap at 500 per tracked point + time-based eviction)
- Verify dead tracked point buffers are cleaned up
