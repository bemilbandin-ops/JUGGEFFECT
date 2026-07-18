import { TrackingSettings } from '../types';

export interface SettingsSnapshot {
  previous: TrackingSettings;
  next: TrackingSettings;
}

export function applySettingsPatch(
  current: TrackingSettings,
  patch: Partial<TrackingSettings>,
): SettingsSnapshot {
  const next = { ...current, ...patch };
  if (next.enableTrails && next.compositeMode === 'none') next.compositeMode = 'screen';
  return { previous: current, next };
}

export function appendSettingsHistory(
  history: TrackingSettings[],
  previous: TrackingSettings,
): TrackingSettings[] {
  return [...history.slice(-49), previous];
}

export function undoSettings(
  _current: TrackingSettings,
  previous: TrackingSettings,
): TrackingSettings {
  return previous;
}
