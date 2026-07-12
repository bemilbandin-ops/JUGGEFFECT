import { DEFAULT_TRACKING_SETTINGS, QUICK_PRESETS } from './settingsDefaults';

function assertEqual(actual: any, expected: any, path: string) {
  if (typeof actual !== typeof expected) {
    throw new Error(`Type mismatch at ${path}: expected ${typeof expected}, got ${typeof actual}`);
  }
  if (typeof actual === 'object' && actual !== null && expected !== null) {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    
    // Check for missing/added keys
    for (const key of expectedKeys) {
      if (!(key in actual)) {
        throw new Error(`Missing key at ${path}.${key}: expected value is present in snapshot, but missing in actual defaults.`);
      }
    }
    for (const key of actualKeys) {
      if (!(key in expected)) {
        throw new Error(`Unexpected new key at ${path}.${key} (value: ${JSON.stringify(actual[key])}). If this new setting is intentional, update the snapshot in the test file.`);
      }
      assertEqual(actual[key], expected[key], `${path}.${key}`);
    }
  } else {
    if (actual !== expected) {
      throw new Error(`Value mismatch at ${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. SILENT SETTING MUTATION DETECTED! If this change was intentional, you must update the frozen snapshot in 'src/config/settingsDefaults.test.ts'.`);
    }
  }
}

// Frozen Snapshot of defaults
const FROZEN_DEFAULTS = {
  enableTrails: true,
  motionThreshold: 50,
  enableLightTracking: true,
  lightThreshold: 200,
  echoFadeRate: 0.05,
  bgLearningRate: 0.05,
  blurAmount: 0,
  hueRotate: 0,
  compositeMode: 'screen',
  invertColors: false,
  showDebugFeed: false,
  enableAudioSync: false,
  strobeRate: 0,
  strobeMode: 'freeze',
  colorCycleSpeed: 0,
  verticalDrift: 0,
  horizontalDrift: 0,
  feedbackZoom: 1.0,
  motionBlur: 0,
  lineSmoothness: 0,
  edgeAntiAliasing: 30,
  exportQuality: 'high',
  exportFps: 30,
  exportMimeType: '',
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  cloneStampEnabled: false,
  cloneStampOffsetX: 50,
  cloneStampOffsetY: 0,
  cloneStampBrushSize: 30,
  cloneStampFeather: 15,
  enablePoiMode: false,
  poiPatternType: 'swedish',
  poiText: 'JUGGLE',
  poiTextColor: '#ff2a85',
  poiCustomImage: null,
  poiHeight: 0,
  poiWidth: 3,
  poiOrientation: 'club',
  poiCenterRelativeX: 0.5,
  poiCenterRelativeY: 0.5,
  poiSpeedMultiplier: 2.0,
  poiMaxPoints: 3,
  poiMappingMode: 'angle',
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
};

// Frozen Snapshot of presets
const FROZEN_PRESETS = [
  {
    id: 'led',
    name: 'LED Tracker',
    description: 'Filters dark details to track glowing props in low light.',
    icon: 'Zap',
    color: 'text-amber-400 border-amber-500/20 hover:border-amber-500/40 bg-amber-950/10',
    settings: {
      enableTrails: true,
      motionThreshold: 40,
      enableLightTracking: true,
      lightThreshold: 200,
      echoFadeRate: 0.08,
      bgLearningRate: 0.05,
      blurAmount: 4,
      hueRotate: 0,
      colorCycleSpeed: 0,
      feedbackZoom: 1.0,
      verticalDrift: 0,
      horizontalDrift: 0,
      strobeRate: 0,
      motionBlur: 0,
    }
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    description: 'Vibrant rainbow trails with a zoom-tunnel echo.',
    icon: 'Sparkles',
    color: 'text-pink-400 border-pink-500/20 hover:border-pink-500/40 bg-pink-950/10',
    settings: {
      enableTrails: true,
      motionThreshold: 50,
      enableLightTracking: false,
      echoFadeRate: 0.05,
      blurAmount: 8,
      hueRotate: 180,
      colorCycleSpeed: 1.5,
      feedbackZoom: 1.03,
      verticalDrift: 0,
      horizontalDrift: 0,
      strobeRate: 0,
      motionBlur: 0,
    }
  },
  {
    id: 'smoke',
    name: 'Spectral Smoke',
    description: 'Ethereal trails that drift upwards like smoke.',
    icon: 'Wind',
    color: 'text-teal-400 border-teal-500/20 hover:border-teal-500/40 bg-teal-950/10',
    settings: {
      enableTrails: true,
      motionThreshold: 60,
      enableLightTracking: false,
      echoFadeRate: 0.03,
      blurAmount: 6,
      hueRotate: 0,
      colorCycleSpeed: 0.3,
      feedbackZoom: 1.0,
      verticalDrift: -1.5,
      horizontalDrift: 0.5,
      strobeRate: 0,
      motionBlur: 0.1,
    }
  },
  {
    id: 'strobe',
    name: 'Strobe Echo',
    description: 'Fading frozen silhouettes floating in space.',
    icon: 'Activity',
    color: 'text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-950/10',
    settings: {
      enableTrails: true,
      motionThreshold: 55,
      enableLightTracking: false,
      echoFadeRate: 0.12,
      blurAmount: 4,
      feedbackZoom: 1.0,
      verticalDrift: 0,
      horizontalDrift: 0,
      strobeRate: 0.15,
      strobeMode: 'freeze',
      hueRotate: 120,
      colorCycleSpeed: 0,
      motionBlur: 0,
    }
  },
  {
    id: 'vortex',
    name: 'Wormhole Vortex',
    description: 'Trails get sucked into an infinite inward spiral.',
    icon: 'Infinity',
    color: 'text-indigo-400 border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-950/10',
    settings: {
      enableTrails: true,
      motionThreshold: 45,
      enableLightTracking: false,
      echoFadeRate: 0.02,
      blurAmount: 2,
      feedbackZoom: 0.96,
      verticalDrift: 0,
      horizontalDrift: 0,
      strobeRate: 0,
      colorCycleSpeed: 0.8,
      motionBlur: 0,
    }
  },
  {
    id: 'cascade',
    name: 'Stardust Cascade',
    description: 'Glowing violet clouds falling down like meteors.',
    icon: 'Moon',
    color: 'text-purple-400 border-purple-500/20 hover:border-purple-500/40 bg-purple-950/10',
    settings: {
      enableTrails: true,
      motionThreshold: 55,
      enableLightTracking: false,
      echoFadeRate: 0.10,
      blurAmount: 12,
      hueRotate: 240,
      colorCycleSpeed: 0,
      feedbackZoom: 1.0,
      verticalDrift: 2.0,
      horizontalDrift: -1.5,
      strobeRate: 0,
      motionBlur: 0.75,
    }
  },
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
];

function runTests() {
  console.log('--- Testing Default Settings & Presets Lock ---');
  try {
    assertEqual(DEFAULT_TRACKING_SETTINGS, FROZEN_DEFAULTS, 'DEFAULT_TRACKING_SETTINGS');
    console.log('✓ Default Settings Lock passed.');

    if (QUICK_PRESETS.length !== FROZEN_PRESETS.length) {
      throw new Error(`Preset count mismatch: expected ${FROZEN_PRESETS.length}, got ${QUICK_PRESETS.length}.`);
    }

    for (let i = 0; i < QUICK_PRESETS.length; i++) {
      const actual = QUICK_PRESETS[i];
      const expected = FROZEN_PRESETS[i];
      assertEqual(actual, expected, `QUICK_PRESETS[${actual.id}]`);
    }
    console.log('✓ Presets Lock passed.');
    console.log('\nSETTINGS LOCK TESTS PASSED SUCCESSFULLY! 🔒');
  } catch (error: any) {
    console.error('\nSETTINGS LOCK FAILURE:', error.message);
    process.exit(1);
  }
}

runTests();
