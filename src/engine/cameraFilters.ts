import { TrackingSettings } from '../types';

export function getCameraFilterString(currentSettings: TrackingSettings): string {
  const filters = [];
  if (currentSettings.exposure !== 0) {
    filters.push(`brightness(${1 + currentSettings.exposure / 100})`);
  }
  if (currentSettings.contrast !== 0) {
    filters.push(`contrast(${1 + currentSettings.contrast / 100})`);
  }
  if (currentSettings.saturation !== 0) {
    filters.push(`saturate(${1 + currentSettings.saturation / 100})`);
  }
  if (currentSettings.temperature !== 0 || currentSettings.tint !== 0) {
    filters.push(`url(#camera-adjustments)`);
  }
  return filters.length > 0 ? filters.join(' ') : 'none';
}

export function getTrackingFilterString(currentSettings: TrackingSettings): string {
  const filters = [];
  if (currentSettings.exposure !== 0) {
    filters.push(`brightness(${1 + currentSettings.exposure / 100})`);
  }
  if (currentSettings.contrast !== 0) {
    filters.push(`contrast(${1 + currentSettings.contrast / 100})`);
  }
  if (currentSettings.saturation !== 0) {
    filters.push(`saturate(${1 + currentSettings.saturation / 100})`);
  }
  return filters.length > 0 ? filters.join(' ') : 'none';
}
