import { DEFAULT_TRACKING_SETTINGS } from './settingsDefaults';
import {
  getChangedSettingKeys,
  sanitizeSettings,
  searchSettingKeys,
  SETTING_DEFINITIONS,
} from './settingsRack';

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

console.log('✓ Settings rack catalog covers, searches, compares, and sanitizes settings');
