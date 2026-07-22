import {
  matchTrackedPoints,
  unwrapRadialAngle,
  mapPhaseToColumn,
  interpolateGap,
  calculateLedStripGeometry,
  samplePovColumns,
  createPovProjectionState,
  PovInput,
  PovSample,
  BlobInput,
  TrackedPointInput
} from './pov';

// Simple assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testTrackMatching() {
  console.log('--- Testing Track Matching ---');
  let nextId = 1;
  const getNextId = () => nextId++;

  const existing: TrackedPointInput[] = [
    { id: 10, x: 100, y: 100, angle: 0, length: 50, envelopeFrame: 10, lastSeen: 1000 }
  ];

  // Blob close to existing
  const blobs1: BlobInput[] = [
    { x: 105, y: 98, angle: 0.1, length: 52, aspectRatio: 1.5 }
  ];

  const matched1 = matchTrackedPoints(blobs1, existing, 50, 1030, getNextId);
  assert(matched1.length === 1, 'Should match the blob');
  assert(matched1[0].id === 10, 'Should retain ID 10');
  assert(matched1[0].envelopeFrame === 11, 'Should increment envelope frame');
  assert(Math.abs(matched1[0].x - 105) < 0.01, 'Should update coordinates');

  // Blob far away (new track)
  const blobs2: BlobInput[] = [
    { x: 300, y: 300, angle: 0.5, length: 40, aspectRatio: 1.0 }
  ];
  const matched2 = matchTrackedPoints(blobs2, matched1, 50, 1060, getNextId);
  assert(matched2.length === 2, 'Should have 2 tracks (the old one retained since it was seen 30ms ago, plus the new one)');
  assert(matched2.some(t => t.id === 1), 'Should spawn new track with ID 1');

  console.log('✓ Track matching passed.');
}

function testUnwrapRadialAngle() {
  console.log('--- Testing Radial Angle Unwrapping ---');
  const prev = Math.PI - 0.1;
  const curr = -Math.PI + 0.1; // Crossed wrap boundary counter-clockwise (or clockwise depending on coordinates)
  
  const unwrapped = unwrapRadialAngle(curr, prev);
  assert(Math.abs(unwrapped - (Math.PI + 0.1)) < 0.001, `Unwrapped angle should be near PI + 0.1, got ${unwrapped}`);
  console.log('✓ Radial angle unwrapping passed.');
}

function testCircularProjectionNoGaps() {
  console.log('--- Testing Circular Projection (Full Sweep & No Gaps) ---');
  const patternWidth = 12;
  const center = { x: 200, y: 200 };
  const radius = 100;
  
  let state = createPovProjectionState();
  const trail: any[] = [];
  const allEmittedCols: number[] = [];

  // Simulate a full rotation in 4 frames (90 degrees / Math.PI / 2 steps)
  // Each step is 3 columns (12 columns / 4 = 3 columns per frame)
  // With gap interpolation, we expect all 12 columns to be emitted in order!
  const numFrames = 4;
  for (let i = 0; i <= numFrames; i++) {
    const angle = (i * Math.PI * 2) / numFrames;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;

    const input: PovInput = {
      id: 1,
      x,
      y,
      prevX: i > 0 ? center.x + Math.cos(((i - 1) * Math.PI * 2) / numFrames) * radius : undefined,
      prevY: i > 0 ? center.y + Math.sin(((i - 1) * Math.PI * 2) / numFrames) * radius : undefined,
      angle: 0,
      length: 50,
      opacity: 1.0,
      timestamp: 1000 + i * 33,
      colIdx: 0,
      motionMode: 'circular',
      circularCenter: center,
      columnSpacing: 10,
      patternWidth,
      projectionState: state,
      existingTrail: trail
    };

    const samples = samplePovColumns(input);
    if (samples.length > 0) {
      state = samples[samples.length - 1].state;
      for (const s of samples) {
        allEmittedCols.push(s.colIdx);
        trail.push(s);
      }
    }
  }

  // We started at 0 angle -> col index 0 or 6 depending on atan2.
  // With 4 steps of 90 degrees, we should have covered 12 columns in total.
  console.log('Emitted columns:', allEmittedCols);
  assert(allEmittedCols.length >= 12, `Should emit at least 12 columns, got ${allEmittedCols.length}`);
  
  // Verify order is continuous and monotonic (wrapping 0..11)
  for (let i = 1; i < allEmittedCols.length; i++) {
    const diff = (allEmittedCols[i] - allEmittedCols[i - 1] + 12) % 12;
    assert(diff === 1 || diff === 0, `Columns must advance sequentially. Got: ${allEmittedCols[i - 1]} -> ${allEmittedCols[i]}`);
  }
  console.log('✓ Circular projection (full sweep + no gaps) passed.');
}

function testJumpRejection() {
  console.log('--- Testing Implausible Jump Rejection ---');
  const patternWidth = 12;
  const center = { x: 200, y: 200 };
  
  let state = createPovProjectionState();
  state.lastX = 100;
  state.lastY = 100;
  state.angle = 0;

  // Blob jumps suddenly by 200px (greater than 150px threshold)
  const input: PovInput = {
    id: 1,
    x: 300,
    y: 100,
    prevX: 100,
    prevY: 100,
    angle: 0,
    length: 50,
    opacity: 1.0,
    timestamp: 1033,
    colIdx: 0,
    motionMode: 'circular',
    circularCenter: center,
    columnSpacing: 10,
    patternWidth,
    projectionState: state,
    existingTrail: []
  };

  const samples = samplePovColumns(input);
  // Because it's a jump, it should NOT interpolate columns in between.
  // It should only emit 1 sample for the current position.
  assert(samples.length === 1, `Jump should reject interpolation. Expected 1 sample, got ${samples.length}`);
  console.log('✓ Jump rejection passed.');
}

function testFreePathColumnSpacing() {
  console.log('--- Testing Free-Path Column Spacing ---');
  let state = createPovProjectionState();
  const trail: PovSample[] = [];
  const sampleAt = (x: number) => samplePovColumns({
    id: 1,
    x,
    y: 0,
    prevX: x > 0 ? x - 1 : undefined,
    prevY: x > 0 ? 0 : undefined,
    angle: 0,
    length: 50,
    opacity: 1,
    timestamp: x,
    colIdx: 0,
    motionMode: 'free',
    circularCenter: { x: 0, y: 0 },
    columnSpacing: 10,
    patternWidth: 20,
    projectionState: state,
    existingTrail: trail,
  });

  const first = sampleAt(0);
  state = first[0].state;
  trail.push(...first);
  for (let x = 1; x < 10; x++) {
    assert(sampleAt(x).length === 0, `Should not emit before 10px spacing (x=${x})`);
  }
  const next = sampleAt(10);
  assert(next.length === 1, `Should emit once after 10px, got ${next.length}`);
  console.log('✓ Free-path column spacing passed.');
}

function runAll() {
  try {
    testTrackMatching();
    testUnwrapRadialAngle();
    testCircularProjectionNoGaps();
    testJumpRejection();
    testFreePathColumnSpacing();
    console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (e: any) {
    console.error('\nTEST FAILURE:', e.message);
    process.exit(1);
  }
}

runAll();
