import { DEFAULT_TRACKING_SETTINGS } from './settingsDefaults';
import {
  getChangedSettingKeys,
  sanitizeSettings,
  searchSettingKeys,
  SETTING_DEFINITIONS,
} from './settingsRack';
import { sectionSummary } from '../components/settings/SettingsRack';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const defaultKeys = Object.keys(DEFAULT_TRACKING_SETTINGS).sort();
const catalogKeys = Object.keys(SETTING_DEFINITIONS).sort();
assert(JSON.stringify(catalogKeys) === JSON.stringify(defaultKeys), 'catalog must cover every setting exactly once');

assert(searchSettingKeys('trail length').includes('echoFadeRate'), 'plain label search must find echoFadeRate');
assert(searchSettingKeys('echoFadeRate').includes('echoFadeRate'), 'technical search must find echoFadeRate');

const changed = { ...DEFAULT_TRACKING_SETTINGS, blurAmount: 8, enablePoiMode: true };
assert(getChangedSettingKeys(changed).join(',') === 'blurAmount,enablePoiMode', 'changed keys must be stable and complete');

const sanitized = sanitizeSettings({ blurAmount: 'bad', hueRotate: 180, unknown: true });
assert(sanitized.blurAmount === DEFAULT_TRACKING_SETTINGS.blurAmount, 'invalid values must use defaults');
assert(sanitized.hueRotate === 180, 'valid saved values must survive');
assert(!('unknown' in sanitized), 'unknown saved keys must be discarded');

const summarySettings = {
  ...DEFAULT_TRACKING_SETTINGS,
  motionThreshold: 35,
  enableLightTracking: false,
  echoFadeRate: 0.2,
  blurAmount: 4,
  enablePoiMode: true,
  poiPatternType: 'spiral' as const,
  poiRenderMode: 'dots' as const,
  cloneStampEnabled: true,
  cloneStampBrushSize: 24,
  cloneStampFeather: 8,
  exposure: 10,
  saturation: -20,
  exportFps: 60 as const,
  exportQuality: 'ultra' as const,
};
assert(sectionSummary.tracking(summarySettings) === '100% sensitivity', 'tracking summary must reflect sensitivity and light tracking');
assert(sectionSummary.trails(summarySettings) === '80% length, 4px glow', 'trails summary must reflect length and glow');
assert(sectionSummary.pixel(summarySettings) === 'spiral pattern, dots', 'pixel summary must reflect the active pattern');
assert(sectionSummary.paint(summarySettings) === '24px brush, 8px softness', 'paint summary must reflect brush settings');
assert(sectionSummary.camera(summarySettings) === '+10% exposure, -20% saturation', 'camera summary must omit neutral controls');
assert(sectionSummary.export(summarySettings) === '60 fps, ultra quality', 'export summary must reflect output settings');

console.log('✓ Settings rack catalog covers, searches, compares, and sanitizes settings');
