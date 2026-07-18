import { DEFAULT_TRACKING_SETTINGS } from './settingsDefaults';
import {
  getChangedSettingKeys,
  sanitizeSettings,
  searchSettingKeys,
  SETTING_DEFINITIONS,
} from './settingsRack';
import { getRackStatusLabel, sectionSummary, type SettingsRackProps } from '../components/settings/SettingsRack';
import { joinAriaIds } from '../components/settings/SettingRow';
import { formatSettingValue } from '../components/settings/SettingsSectionControls';

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

const customImage = 'data:image/png;base64,abc';
assert(sanitizeSettings({ poiCustomImage: customImage }).poiCustomImage === customImage, 'valid custom images must survive');
assert(sanitizeSettings({ poiCustomImage: null }).poiCustomImage === null, 'null custom images must survive');

const invalidSaved = sanitizeSettings({
  compositeMode: 'invalid',
  poiPatternType: 'invalid',
  exportQuality: 'invalid',
  motionThreshold: Number.NaN,
  echoFadeRate: 2,
  poiLedCount: 999,
});
assert(invalidSaved.compositeMode === DEFAULT_TRACKING_SETTINGS.compositeMode, 'invalid blend modes must use defaults');
assert(invalidSaved.poiPatternType === DEFAULT_TRACKING_SETTINGS.poiPatternType, 'invalid pattern types must use defaults');
assert(invalidSaved.exportQuality === DEFAULT_TRACKING_SETTINGS.exportQuality, 'invalid quality values must use defaults');
assert(invalidSaved.motionThreshold === DEFAULT_TRACKING_SETTINGS.motionThreshold, 'non-finite numbers must use defaults');
assert(invalidSaved.echoFadeRate === DEFAULT_TRACKING_SETTINGS.echoFadeRate, 'out-of-range fade values must use defaults');
assert(invalidSaved.poiLedCount === DEFAULT_TRACKING_SETTINGS.poiLedCount, 'out-of-range LED counts must use defaults');
assert(sanitizeSettings({ enableTrails: true, compositeMode: 'none' }).compositeMode === 'screen', 'enabled trails must use an active blend mode');

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

assert(joinAriaIds('existing-label', 'setting-label') === 'existing-label setting-label', 'ARIA labels must preserve existing IDs');
assert(joinAriaIds(undefined, 'setting-description', 'disabled-reason') === 'setting-description disabled-reason', 'ARIA descriptions must include the disabled reason');

assert(getRackStatusLabel(DEFAULT_TRACKING_SETTINGS, null) === null, 'defaults must not be marked modified');
assert(getRackStatusLabel(changed, null) === 'Modified', 'changed settings without a preset must be marked modified');
assert(getRackStatusLabel(changed, 'cascade') === null, 'an active preset must not be marked modified');
assert(formatSettingValue('echoFadeRate', { ...DEFAULT_TRACKING_SETTINGS, echoFadeRate: 0.2 }) === '80% retention', 'trail readouts must be meaningful');
assert(formatSettingValue('poiLedCount', { ...DEFAULT_TRACKING_SETTINGS, poiLedCount: 0 }) === 'Auto', 'automatic LED count must be named');

const sectionControls: SettingsRackProps['sectionControls'] = {
  tracking: null,
  trails: null,
  pixel: null,
  paint: null,
  camera: null,
  export: null,
};
assert(Object.keys(sectionControls).length === 6, 'the rack must require controls for every section');

console.log('✓ Settings rack catalog covers, searches, compares, and sanitizes settings');
