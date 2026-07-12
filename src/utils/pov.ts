// POV (Persistence of Vision) sampling for the pixel-effect trail system.
// This module centralizes the logic that converts a tracked point's motion into
// discrete column samples painted along its path. Keeping this separate from
// TrackingCanvas makes the per-frame loop easier to follow and tune.

export interface PovTrailEntry {
  x: number;
  y: number;
  angle: number;
  motionAngle?: number;
  colIdx: number;
  length: number;
  opacity: number;
  timestamp: number;
}

export interface PovProjectionState {
  /** Progress along the image, 0..patternWidth (free-path mode). */
  progress: number;
  /** Angle (radians) of the current wrap position (circular mode). */
  angle: number;
  /** Sub-pixel distance accumulated since the last emitted column (free mode). */
  accumulatedDistance: number;
  /** Cleared when the point teleports (e.g. after a reset). */
  lastX: number | null;
  /** Cleared when the point teleports (e.g. after a reset). */
  lastY: number | null;
  /** Retained last valid center X of rotation. */
  lastCenterX?: number;
  /** Retained last valid center Y of rotation. */
  lastCenterY?: number;
}

export interface PovInput {
  id: number;
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  angle: number;          // logical angle of the tracked blob (radians)
  length: number;
  opacity: number;
  timestamp: number;
  /** Column index derived from the active mapping mode (time/angle/spatial). */
  colIdx: number;
  motionMode: 'circular' | 'free';
  circularCenter: { x: number; y: number };
  columnSpacing: number;  // in px of movement between columns
  patternWidth: number;  // image width (number of columns)
  projectionState: PovProjectionState;
  existingTrail: PovTrailEntry[];
}

export interface PovSample {
  id: number;
  x: number;
  y: number;
  angle: number;
  motionAngle?: number;
  colIdx: number;
  length: number;
  opacity: number;
  timestamp: number;
  /** State to persist for the next frame of this tracked point. */
  state: PovProjectionState;
}

export interface TrackedPointInput {
  id: number;
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  angle: number;
  length: number;
  envelopeFrame: number;
  lastSeen: number;
}

export interface BlobInput {
  x: number;
  y: number;
  angle: number;
  length: number;
  aspectRatio: number;
}

export interface LedStripGeometry {
  translateX: number;
  translateY: number;
  rotationAngle: number;
  isRadialOrCircular: boolean;
  radialDistance: number;
  middleOffset: number; // for translating along local Y axis to middle of strip
}

export function createPovProjectionState(): PovProjectionState {
  return {
    progress: 0,
    angle: 0,
    accumulatedDistance: 0,
    lastX: null,
    lastY: null,
  };
}

export function wrapColumn(value: number, patternWidth: number): number {
  const m = value % patternWidth;
  return m < 0 ? m + patternWidth : m;
}

/**
 * Performs stable track matching of current blobs to existing tracked points.
 * Uses nearest-neighbor with a maximum matching distance.
 */
export function matchTrackedPoints(
  currentBlobs: BlobInput[],
  existingTrackedPoints: TrackedPointInput[],
  maxMatchDistance: number,
  now: number,
  getNextId: () => number
): TrackedPointInput[] {
  const updatedTrackedPoints: TrackedPointInput[] = [];

  for (const blob of currentBlobs) {
    let bestMatch: TrackedPointInput | null = null;
    let minDistance = Infinity;

    for (const tp of existingTrackedPoints) {
      const dist = Math.hypot(blob.x - tp.x, blob.y - tp.y);
      if (dist < minDistance && dist < maxMatchDistance) {
        const alreadyMatched = updatedTrackedPoints.some(u => u.id === tp.id);
        if (!alreadyMatched) {
          minDistance = dist;
          bestMatch = tp;
        }
      }
    }

    if (bestMatch) {
      // Smooth angle and length if elongated
      let newAngle = bestMatch.angle;
      if (blob.aspectRatio > 1.4) {
        let diff = blob.angle - bestMatch.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        newAngle = bestMatch.angle + diff * 0.25;
      }
      const newLength = bestMatch.length + (blob.length - bestMatch.length) * 0.2;

      updatedTrackedPoints.push({
        id: bestMatch.id,
        x: blob.x,
        y: blob.y,
        prevX: bestMatch.x,
        prevY: bestMatch.y,
        angle: newAngle,
        length: newLength,
        envelopeFrame: (bestMatch.envelopeFrame || 0) + 1,
        lastSeen: now
      });
    } else {
      updatedTrackedPoints.push({
        id: getNextId(),
        x: blob.x,
        y: blob.y,
        angle: blob.angle,
        length: blob.length,
        envelopeFrame: 0,
        lastSeen: now
      });
    }
  }

  // Retain tracked points that weren't matched but were seen recently (within 200ms)
  for (const tp of existingTrackedPoints) {
    const isAlreadyUpdated = updatedTrackedPoints.some(u => u.id === tp.id);
    if (!isAlreadyUpdated && now - tp.lastSeen < 200) {
      updatedTrackedPoints.push(tp);
    }
  }

  return updatedTrackedPoints;
}

/**
 * Unwraps a radial angle wrap-safely relative to the previous angle.
 */
export function unwrapRadialAngle(
  currentAngle: number,
  prevAngle: number
): number {
  let delta = currentAngle - prevAngle;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  return prevAngle + delta;
}

/**
 * Maps an angular phase (radians) or linear progress to a wrap-safe pattern column index.
 */
export function mapPhaseToColumn(
  phase: number,
  patternWidth: number,
  mode: 'circular' | 'free'
): number {
  if (mode === 'circular') {
    const m = Math.floor((phase * patternWidth) / (Math.PI * 2)) % patternWidth;
    return m < 0 ? m + patternWidth : m;
  } else {
    const m = Math.floor(phase) % patternWidth;
    return m < 0 ? m + patternWidth : m;
  }
}

/**
 * Interpolates coordinates, angles, and column indices between two frames to fill gaps.
 */
export function interpolateGap(
  prevX: number,
  prevY: number,
  prevAngle: number,
  prevCol: number,
  currX: number,
  currY: number,
  currAngle: number,
  currCol: number,
  patternWidth: number,
  stepSign: number,
  numSteps: number
): { x: number; y: number; angle: number; colIdx: number }[] {
  const steps: { x: number; y: number; angle: number; colIdx: number }[] = [];
  for (let step = 1; step <= numSteps; step++) {
    const t = step / numSteps;
    const x = prevX + (currX - prevX) * t;
    const y = prevY + (currY - prevY) * t;
    const angle = prevAngle + (currAngle - prevAngle) * t;
    const colIdx = wrapColumn(prevCol + stepSign * step, patternWidth);
    steps.push({ x, y, angle, colIdx });
  }
  return steps;
}

/**
 * Calculates canvas translation and rotation coordinates for positioning an LED strip.
 */
export function calculateLedStripGeometry(
  entryX: number,
  entryY: number,
  entryAngle: number,
  entryLength: number,
  entryMotionAngle: number | undefined,
  orientation: 'vertical' | 'horizontal' | 'motion' | 'radial' | 'club',
  centerX: number,
  centerY: number,
  motionMode?: 'circular' | 'free'
): LedStripGeometry {
  const isRadialOrCircular = motionMode === 'circular' || orientation === 'radial';

  if (isRadialOrCircular) {
    const radialAngle = Math.atan2(entryY - centerY, entryX - centerX);
    const radialDistance = Math.hypot(entryX - centerX, entryY - centerY);
    // Local +Y points radially outwards
    const rotationAngle = radialAngle - Math.PI / 2;
    return {
      translateX: centerX,
      translateY: centerY,
      rotationAngle,
      isRadialOrCircular: true,
      radialDistance,
      middleOffset: radialDistance - entryLength / 2
    };
  } else {
    let rotationAngle = 0;
    if (orientation === 'club') {
      rotationAngle = entryAngle - Math.PI / 2;
    } else if (orientation === 'motion') {
      rotationAngle = (entryMotionAngle ?? entryAngle) - Math.PI / 2;
    } else if (orientation === 'horizontal') {
      rotationAngle = Math.PI / 2;
    }
    // 'vertical' is rotationAngle = 0
    return {
      translateX: entryX,
      translateY: entryY,
      rotationAngle,
      isRadialOrCircular: false,
      radialDistance: 0,
      middleOffset: 0
    };
  }
}

export function appendCircularPovEntries(
  input: PovInput,
  samples: PovSample[]
): void {
  const { patternWidth, circularCenter, x, y, timestamp } = input;
  let cx = circularCenter.x;
  let cy = circularCenter.y;
  const state = input.projectionState;

  // Validate center, fall back to last valid center if needed
  if (isNaN(cx) || isNaN(cy) || (cx === 0 && cy === 0)) {
    if (state.lastCenterX !== undefined && state.lastCenterY !== undefined) {
      cx = state.lastCenterX;
      cy = state.lastCenterY;
    } else {
      cx = 0.5;
      cy = 0.5;
    }
  } else {
    // Reject implausible jumps in rotation center
    if (state.lastCenterX !== undefined && state.lastCenterY !== undefined) {
      const centerDist = Math.hypot(cx - state.lastCenterX, cy - state.lastCenterY);
      if (centerDist > 150) {
        cx = state.lastCenterX;
        cy = state.lastCenterY;
      }
    }
  }

  const angToCenter = Math.atan2(y - cy, x - cx);
  let prevAngle = state.angle;
  let lastX = state.lastX;
  let lastY = state.lastY;

  if (lastX === null || lastY === null) {
    prevAngle = angToCenter;
    lastX = x;
    lastY = y;
  }

  // Reject track jumps
  const jumpDist = Math.hypot(x - lastX, y - lastY);
  let delta = angToCenter - prevAngle;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;

  if (jumpDist > 150) {
    // Implausible jump: reset phase without interpolating
    delta = 0;
    prevAngle = angToCenter;
    lastX = x;
    lastY = y;
  }

  const prevCol = Math.floor((prevAngle * patternWidth) / (Math.PI * 2));
  const currentCol = Math.floor((unwrapRadialAngle(angToCenter, prevAngle) * patternWidth) / (Math.PI * 2));
  const colDelta = currentCol - prevCol;
  const numSteps = Math.abs(colDelta);

  if (numSteps > 0) {
    const stepSign = Math.sign(colDelta);
    const steps = interpolateGap(
      lastX, lastY, prevAngle, prevCol,
      x, y, prevAngle + delta, currentCol,
      patternWidth, stepSign, numSteps
    );

    for (const step of steps) {
      samples.push({
        id: input.id,
        x: step.x,
        y: step.y,
        angle: step.angle,
        colIdx: step.colIdx,
        length: input.length,
        opacity: input.opacity,
        timestamp: timestamp,
        state: {
          progress: step.colIdx,
          angle: step.angle,
          accumulatedDistance: state.accumulatedDistance,
          lastX: x,
          lastY: y,
          lastCenterX: cx,
          lastCenterY: cy,
        },
      });
    }
  }

  const finalState: PovProjectionState = {
    progress: wrapColumn(currentCol, patternWidth),
    angle: prevAngle + delta,
    accumulatedDistance: state.accumulatedDistance,
    lastX: x,
    lastY: y,
    lastCenterX: cx,
    lastCenterY: cy,
  };

  if (samples.length === 0) {
    samples.push({
      id: input.id,
      x,
      y,
      angle: angToCenter,
      colIdx: wrapColumn(currentCol, patternWidth),
      length: input.length,
      opacity: input.opacity,
      timestamp: timestamp,
      state: finalState,
    });
  } else {
    samples[samples.length - 1].state = finalState;
  }
}

export function appendFreePovEntries(
  input: PovInput,
  samples: PovSample[]
): void {
  const { columnSpacing, patternWidth, x, y, angle, colIdx, timestamp } = input;
  const prevX = input.prevX;
  const prevY = input.prevY;
  const state = input.projectionState;

  let distMoved = 0;
  let motionAngle: number | undefined;

  let lastX = state.lastX;
  let lastY = state.lastY;

  if (prevX === undefined || prevY === undefined || lastX === null || lastY === null) {
    distMoved = columnSpacing;
    lastX = x;
    lastY = y;
  } else {
    distMoved = Math.hypot(x - prevX, y - prevY);
    motionAngle = Math.atan2(y - prevY, x - prevX);

    // Reject track jumps
    const jumpDist = Math.hypot(x - lastX, y - lastY);
    if (jumpDist > 150) {
      distMoved = columnSpacing; // reset tracking, no large interpolation
      lastX = x;
      lastY = y;
    }
  }

  const accumulated = state.accumulatedDistance + distMoved;
  if (accumulated < columnSpacing) {
    samples.push({
      id: input.id,
      x,
      y,
      angle,
      motionAngle,
      colIdx,
      length: input.length,
      opacity: input.opacity,
      timestamp: timestamp,
      state: {
        progress: state.progress,
        angle: state.angle,
        accumulatedDistance: accumulated,
        lastX: x,
        lastY: y,
      },
    });
    return;
  }

  const columnsToAdvance = Math.floor(accumulated / columnSpacing);
  const lastColIdx = input.existingTrail.length > 0
    ? input.existingTrail[input.existingTrail.length - 1].colIdx
    : colIdx;
  const startCol = wrapColumn(lastColIdx + 1, patternWidth);

  for (let step = 0; step < columnsToAdvance; step++) {
    const t = columnsToAdvance > 1 ? (step + 1) / columnsToAdvance : 1;
    const interpX = lastX !== null ? lastX + (x - lastX) * t : x;
    const interpY = lastY !== null ? lastY + (y - lastY) * t : y;
    const stepCol = wrapColumn(startCol + step, patternWidth);

    samples.push({
      id: input.id,
      x: interpX,
      y: interpY,
      angle,
      motionAngle,
      colIdx: stepCol,
      length: input.length,
      opacity: input.opacity,
      timestamp: timestamp,
      state: {
        progress: stepCol,
        angle,
        accumulatedDistance: accumulated % columnSpacing,
        lastX: x,
        lastY: y,
      },
    });
  }

  if (samples.length === 0) {
    samples.push({
      id: input.id,
      x,
      y,
      angle,
      motionAngle,
      colIdx,
      length: input.length,
      opacity: input.opacity,
      timestamp: timestamp,
      state: {
        progress: colIdx,
        angle,
        accumulatedDistance: accumulated % columnSpacing,
        lastX: x,
        lastY: y,
      },
    });
  }
}

export function samplePovColumns(input: PovInput): PovSample[] {
  const samples: PovSample[] = [];
  if (input.motionMode === 'circular') {
    appendCircularPovEntries(input, samples);
  } else {
    appendFreePovEntries(input, samples);
  }
  return samples;
}