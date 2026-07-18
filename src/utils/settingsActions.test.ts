import { DEFAULT_TRACKING_SETTINGS } from '../config/settingsDefaults';
import { applySettingsPatch, undoSettings } from './settingsActions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const first = applySettingsPatch(DEFAULT_TRACKING_SETTINGS, { blurAmount: 8 });
assert(first.next.blurAmount === 8, 'patch must apply');
assert(first.previous === DEFAULT_TRACKING_SETTINGS, 'patch must retain the exact previous object');
assert(undoSettings(first.next, first.previous) === DEFAULT_TRACKING_SETTINGS, 'undo must restore exact previous settings');

console.log('✓ Settings actions apply patches and restore exact snapshots');
