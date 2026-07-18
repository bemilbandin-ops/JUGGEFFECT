import { DEFAULT_TRACKING_SETTINGS } from '../config/settingsDefaults';
import { appendSettingsHistory, applySettingsPatch, undoSettings } from './settingsActions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const first = applySettingsPatch(DEFAULT_TRACKING_SETTINGS, { blurAmount: 8 });
assert(first.next.blurAmount === 8, 'patch must apply');
assert(first.previous === DEFAULT_TRACKING_SETTINGS, 'patch must retain the exact previous object');
assert(undoSettings(first.next, first.previous) === DEFAULT_TRACKING_SETTINGS, 'undo must restore exact previous settings');

const history = appendSettingsHistory([], first.previous);
assert(history.length === 1, 'one logical change must add one history entry');
assert(undoSettings(first.next, history[0]) === DEFAULT_TRACKING_SETTINGS, 'history entry must restore the prior snapshot');

const enabledTrails = applySettingsPatch(
  { ...DEFAULT_TRACKING_SETTINGS, enableTrails: false, compositeMode: 'none' },
  { enableTrails: true },
);
assert(enabledTrails.next.compositeMode === 'screen', 'enabled trails must normalize a disabled blend mode');

console.log('✓ Settings actions apply patches and restore exact snapshots');
