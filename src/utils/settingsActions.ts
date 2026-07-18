import { TrackingSettings } from '../types';

export interface SettingsSnapshot {
  previous: TrackingSettings;
  next: TrackingSettings;
}

export function applySettingsPatch(
  current: TrackingSettings,
  patch: Partial<TrackingSettings>,
): SettingsSnapshot {
  return { previous: current, next: { ...current, ...patch } };
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
