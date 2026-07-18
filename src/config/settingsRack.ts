import { DEFAULT_TRACKING_SETTINGS } from './settingsDefaults';
import { TrackingSettings } from '../types';

export type SettingSectionId = 'tracking' | 'trails' | 'pixel' | 'paint' | 'camera' | 'export';

export interface SettingDefinition {
  section: SettingSectionId;
  label: string;
  description: string;
  advanced?: boolean;
  dependsOn?: { key: keyof TrackingSettings; value: TrackingSettings[keyof TrackingSettings]; explanation: string };
}

export const SECTION_ORDER: readonly SettingSectionId[] = [
  'tracking', 'trails', 'pixel', 'paint', 'camera', 'export',
];

export const SETTING_DEFINITIONS = {
  enableTrails: { section: 'trails', label: 'Trails', description: 'Draw movement trails.' },
  motionThreshold: { section: 'tracking', label: 'Movement sensitivity', description: 'How much movement is required before it is tracked.' },
  enableLightTracking: { section: 'tracking', label: 'Track bright objects only', description: 'Ignore movement that is not bright.' },
  lightThreshold: { section: 'tracking', label: 'Brightness threshold', description: 'Minimum brightness that can be tracked.', dependsOn: { key: 'enableLightTracking', value: true, explanation: 'Turn on bright-object tracking to use this.' } },
  echoFadeRate: { section: 'trails', label: 'Trail length', description: 'How long previous movement remains visible.' },
  bgLearningRate: { section: 'tracking', label: 'Background adaptation', description: 'How quickly the tracker accepts scene changes.', advanced: true },
  blurAmount: { section: 'trails', label: 'Trail glow', description: 'Softens and spreads trail pixels.' },
  hueRotate: { section: 'trails', label: 'Hue shift', description: 'Rotates all trail colors.' },
  compositeMode: { section: 'trails', label: 'Blend mode', description: 'How trails mix with the camera image.', advanced: true },
  invertColors: { section: 'camera', label: 'Invert colors', description: 'Create a negative image.' },
  showDebugFeed: { section: 'tracking', label: 'Show tracking mask', description: 'Show exactly what the tracker detects.', advanced: true },
  enableAudioSync: { section: 'camera', label: 'Include live audio', description: 'Use microphone audio with camera recording.', advanced: true },
  strobeRate: { section: 'trails', label: 'Strobe spacing', description: 'Time between trail snapshots.', advanced: true },
  strobeMode: { section: 'trails', label: 'Strobe style', description: 'Freeze movement or flash the full frame.', advanced: true, dependsOn: { key: 'strobeRate', value: 0, explanation: 'Set strobe spacing above Off to choose a style.' } },
  colorCycleSpeed: { section: 'trails', label: 'Color cycling', description: 'Continuously rotate trail color.', advanced: true },
  verticalDrift: { section: 'trails', label: 'Vertical drift', description: 'Move older trail pixels up or down.', advanced: true },
  horizontalDrift: { section: 'trails', label: 'Horizontal drift', description: 'Move older trail pixels left or right.', advanced: true },
  feedbackZoom: { section: 'trails', label: 'Trail zoom', description: 'Grow or shrink older trail pixels.', advanced: true },
  motionBlur: { section: 'trails', label: 'Motion blur', description: 'Blend consecutive camera frames.', advanced: true },
  lineSmoothness: { section: 'trails', label: 'Line smoothing', description: 'Smooth jagged movement edges.', advanced: true },
  edgeAntiAliasing: { section: 'trails', label: 'Edge softness', description: 'Soften the edge of detected movement.', advanced: true },
  exportQuality: { section: 'export', label: 'Video quality', description: 'Recording bitrate preset.' },
  exportFps: { section: 'export', label: 'Frame rate', description: 'Frames recorded each second.' },
  exportMimeType: { section: 'export', label: 'Video format', description: 'Browser-supported recording format.', advanced: true },
  exposure: { section: 'camera', label: 'Exposure', description: 'Make the image lighter or darker.' },
  contrast: { section: 'camera', label: 'Contrast', description: 'Increase or reduce separation between light and dark.' },
  saturation: { section: 'camera', label: 'Saturation', description: 'Increase or reduce color intensity.' },
  temperature: { section: 'camera', label: 'Temperature', description: 'Shift the image cooler or warmer.' },
  tint: { section: 'camera', label: 'Tint', description: 'Shift the image between green and magenta.' },
  cloneStampEnabled: { section: 'paint', label: 'Paint / Clone', description: 'Paint offset copies of the camera image.' },
  cloneStampOffsetX: { section: 'paint', label: 'Horizontal offset', description: 'Move the cloned source left or right.' },
  cloneStampOffsetY: { section: 'paint', label: 'Vertical offset', description: 'Move the cloned source up or down.' },
  cloneStampBrushSize: { section: 'paint', label: 'Brush size', description: 'Width of the painted area.' },
  cloneStampFeather: { section: 'paint', label: 'Brush softness', description: 'Softness around the brush edge.' },
  enablePoiMode: { section: 'pixel', label: 'Pixel / POV', description: 'Paint patterns along moving props.' },
  poiPatternType: { section: 'pixel', label: 'Pattern', description: 'Pattern painted along the movement path.' },
  poiText: { section: 'pixel', label: 'Pattern text', description: 'Text used by the text pattern.', dependsOn: { key: 'poiPatternType', value: 'text', explanation: 'Choose the Text pattern to edit this.' } },
  poiTextColor: { section: 'pixel', label: 'Text color', description: 'Color of the text pattern.', dependsOn: { key: 'poiPatternType', value: 'text', explanation: 'Choose the Text pattern to edit this.' } },
  poiCustomImage: { section: 'pixel', label: 'Custom pattern image', description: 'Image used by the custom pattern.', dependsOn: { key: 'poiPatternType', value: 'custom', explanation: 'Choose the Custom pattern to upload an image.' } },
  poiHeight: { section: 'pixel', label: 'Pattern height', description: 'Rendered pattern length; Auto follows the prop.' },
  poiWidth: { section: 'pixel', label: 'Pattern width', description: 'Width of each painted pattern slice.' },
  poiOrientation: { section: 'pixel', label: 'Orientation', description: 'How the pattern aligns to movement.' },
  poiCenterRelativeX: { section: 'pixel', label: 'Center X', description: 'Horizontal center for radial mapping.', advanced: true },
  poiCenterRelativeY: { section: 'pixel', label: 'Center Y', description: 'Vertical center for radial mapping.', advanced: true },
  poiSpeedMultiplier: { section: 'pixel', label: 'Pattern speed', description: 'How quickly the pattern advances.' },
  poiMaxPoints: { section: 'pixel', label: 'Maximum props', description: 'Maximum moving objects painted at once.', advanced: true },
  poiMappingMode: { section: 'pixel', label: 'Pattern mapping', description: 'Use elapsed time, movement angle, or screen position.', advanced: true },
  poiRenderMode: { section: 'pixel', label: 'Pixel style', description: 'Render continuous slices or individual LED dots.' },
  poiOpacity: { section: 'pixel', label: 'Pattern opacity', description: 'Transparency of the painted pattern.' },
  poiFadeInTime: { section: 'pixel', label: 'Fade in', description: 'Frames used to reveal the pattern.', advanced: true },
  poiHoldTime: { section: 'pixel', label: 'Hold', description: 'Frames held at full opacity.', advanced: true },
  poiFadeOutTime: { section: 'pixel', label: 'Fade out', description: 'Frames used to hide the pattern.', advanced: true },
  poiWaitTime: { section: 'pixel', label: 'Wait', description: 'Frames before the pattern repeats.', advanced: true },
  poiFrameInterval: { section: 'pixel', label: 'Paint interval', description: 'How often a pattern frame is painted.', advanced: true },
  poiPovEnabled: { section: 'pixel', label: 'POV sweep', description: 'Retain pattern columns while the prop moves.' },
  poiPovRetention: { section: 'pixel', label: 'Sweep persistence', description: 'Milliseconds that painted columns remain visible.' },
  poiPovFadeMode: { section: 'pixel', label: 'Sweep fade', description: 'How retained columns disappear.', advanced: true },
  poiPovColumnSpacing: { section: 'pixel', label: 'Column spacing', description: 'Movement required before painting another column.', advanced: true },
  poiPovMotionMode: { section: 'pixel', label: 'Motion shape', description: 'Optimize the sweep for free or circular movement.', advanced: true },
  poiGlowEnabled: { section: 'pixel', label: 'LED glow', description: 'Add bloom around simulated LEDs.' },
  poiGlowRadius: { section: 'pixel', label: 'Glow size', description: 'Radius of the LED bloom.' },
  poiGlowIntensity: { section: 'pixel', label: 'Glow strength', description: 'Brightness of the LED bloom.' },
  poiLedCount: { section: 'pixel', label: 'LED count', description: 'Simulated LEDs; Auto follows prop length.', advanced: true },
} satisfies Record<keyof TrackingSettings, SettingDefinition>;

export function searchSettingKeys(query: string): (keyof TrackingSettings)[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return (Object.entries(SETTING_DEFINITIONS) as [keyof TrackingSettings, SettingDefinition][])
    .filter(([key, item]) => `${item.label} ${item.description} ${key}`.toLowerCase().includes(normalized))
    .map(([key]) => key);
}

export function getChangedSettingKeys(settings: TrackingSettings): (keyof TrackingSettings)[] {
  return (Object.keys(DEFAULT_TRACKING_SETTINGS) as (keyof TrackingSettings)[])
    .filter((key) => settings[key] !== DEFAULT_TRACKING_SETTINGS[key])
    .sort();
}

export function sanitizeSettings(saved: unknown): TrackingSettings {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...DEFAULT_TRACKING_SETTINGS };
  const source = saved as Record<string, unknown>;
  const result = { ...DEFAULT_TRACKING_SETTINGS } as Record<string, unknown>;
  for (const [key, defaultValue] of Object.entries(DEFAULT_TRACKING_SETTINGS)) {
    const value = source[key];
    if (value === null && defaultValue === null) result[key] = value;
    else if (typeof value === typeof defaultValue) result[key] = value;
  }
  return result as unknown as TrackingSettings;
}
