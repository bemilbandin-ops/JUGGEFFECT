import type { ChangeEvent, ReactElement } from 'react';
import { DEFAULT_TRACKING_SETTINGS } from '../../config/settingsDefaults';
import { SETTING_DEFINITIONS, type SettingDefinition, type SettingSectionId } from '../../config/settingsRack';
import type { TrackingSettings } from '../../types';
import { SettingRow } from './SettingRow';

type MimeType = { label: string; mimeType: string; ext: string };

interface Props {
  section: SettingSectionId;
  settings: TrackingSettings;
  supportedMimeTypes: MimeType[];
  onChange: (patch: Partial<TrackingSettings>) => void;
  onAudioSyncChange: (enabled: boolean) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}

const rangeSpecs: Partial<Record<keyof TrackingSettings, readonly [number, number, number]>> = {
  lightThreshold: [0, 255, 1], blurAmount: [0, 20, 1], hueRotate: [0, 360, 1],
  strobeRate: [0, 2, .05], colorCycleSpeed: [0, 20, 1], verticalDrift: [-15, 15, 1],
  horizontalDrift: [-15, 15, 1], feedbackZoom: [.95, 1.1, .005], motionBlur: [0, .95, .05],
  lineSmoothness: [0, 20, 1], edgeAntiAliasing: [0, 500, 5], exposure: [-100, 100, 1],
  contrast: [-100, 100, 1], saturation: [-100, 100, 1], temperature: [-100, 100, 1], tint: [-100, 100, 1],
  cloneStampOffsetX: [-500, 500, 1], cloneStampOffsetY: [-500, 500, 1], cloneStampBrushSize: [5, 150, 1],
  cloneStampFeather: [0, 100, 1], poiHeight: [0, 400, 5], poiWidth: [1, 15, 1],
  poiCenterRelativeX: [0, 1, .01], poiCenterRelativeY: [0, 1, .01], poiSpeedMultiplier: [.2, 8, .1],
  poiMaxPoints: [1, 5, 1], poiOpacity: [.1, 1, .05], poiFadeInTime: [0, 120, 5],
  poiHoldTime: [0, 120, 5], poiFadeOutTime: [0, 120, 5], poiWaitTime: [0, 120, 5],
  poiFrameInterval: [1, 10, 1], poiPovRetention: [50, 2000, 25], poiPovColumnSpacing: [1, 20, 1],
  poiGlowRadius: [2, 20, 1], poiGlowIntensity: [.1, 1, .05], poiLedCount: [0, 72, 4],
};

const selectOptions: Partial<Record<keyof TrackingSettings, readonly (readonly [string, string])[]>> = {
  compositeMode: [['none', 'Disabled (No Trails)'], ['screen', 'Screen (Glow)'], ['source-over', 'Normal (Solid)'], ['lighter', 'Additive (Intense)'], ['color-dodge', 'Color Dodge']],
  strobeMode: [['freeze', 'Freeze Frame (Posterize)'], ['flash', 'Blackout Flash (Strobe Light)']],
  exportQuality: [['ultra', 'Ultra (30 Mbps - Lossless/Huge)'], ['high', 'High (15 Mbps - Premium/Clear)'], ['medium', 'Medium (8 Mbps - Balanced)'], ['standard', 'Standard (4 Mbps - Compact)']],
  exportFps: [['30', '30 FPS'], ['60', '60 FPS']],
  poiPatternType: [['swedish', 'Swedish Flag'], ['youtube', 'YouTube Logo'], ['rainbow', 'Spectrum Gradient'], ['flowers', 'Concentric Flowers'], ['text', 'Custom Text'], ['custom', 'Custom Image Upload'], ['spiral', 'Spiral Helix (Feathered POV)'], ['chevron', 'Chevron Zigzag (Geometric)'], ['mandala', 'Concentric Mandala (Rings)']],
  poiOrientation: [['club', 'Align with Juggling Club (Auto)'], ['vertical', 'Static Vertical (Flags / Text)'], ['horizontal', 'Static Horizontal'], ['motion', 'Motion Direction (Trailing Stick)'], ['radial', 'Radial Circle (Light Wheels)']],
  poiMappingMode: [['angle', 'Map to Club Rotation'], ['spatial', 'Map to Screen Position'], ['time', 'Cycle over Time']],
  poiRenderMode: [['dots', 'Dotted LEDs'], ['solid', 'Solid Ribbon']],
  poiPovFadeMode: [['exponential', 'Exponential (Smooth, Natural)'], ['linear', 'Linear (Even Fade)'], ['sharp', 'Sharp (Hard Cutoff)']],
  poiPovMotionMode: [['free', 'Free Path'], ['circular', 'Circular']],
  poiTextColor: [['#ff2a85', 'Pink'], ['#00ffcc', 'Cyan'], ['#ffe600', 'Yellow'], ['#3b82f6', 'Blue'], ['#ffffff', 'White']],
};

const booleanKeys = new Set<keyof TrackingSettings>([
  'enableLightTracking', 'invertColors', 'showDebugFeed', 'enableAudioSync', 'poiPovEnabled', 'poiGlowEnabled',
]);

const sectionToggleKeys = new Set<keyof TrackingSettings>(['enableTrails', 'enablePoiMode', 'cloneStampEnabled']);

export function SettingsSectionControls({ section, settings, supportedMimeTypes, onChange, onAudioSyncChange, onGestureStart, onGestureEnd }: Props) {
  const enabled = {
    lightThreshold: settings.enableLightTracking,
    strobeMode: settings.strobeRate > 0,
    poiText: settings.poiPatternType === 'text', poiTextColor: settings.poiPatternType === 'text',
    poiCustomImage: settings.poiPatternType === 'custom',
    poiCenterRelativeX: settings.poiOrientation === 'radial', poiCenterRelativeY: settings.poiOrientation === 'radial',
    poiPovRetention: settings.poiPovEnabled, poiPovFadeMode: settings.poiPovEnabled,
    poiPovColumnSpacing: settings.poiPovEnabled, poiPovMotionMode: settings.poiPovEnabled,
    poiGlowRadius: settings.poiGlowEnabled, poiGlowIntensity: settings.poiGlowEnabled,
  } satisfies Partial<Record<keyof TrackingSettings, boolean>>;
  const sectionEnabled = section === 'trails' ? settings.enableTrails : section === 'pixel' ? settings.enablePoiMode : section === 'paint' ? settings.cloneStampEnabled : true;

  const patchValue = (key: keyof TrackingSettings, value: unknown) => {
    if (key === 'compositeMode') {
      const compositeMode = String(value);
      onChange(compositeMode === 'none' ? { enableTrails: false, compositeMode } : { enableTrails: true, compositeMode });
    } else if (key === 'enableAudioSync') onAudioSyncChange(Boolean(value));
    else onChange({ [key]: value } as Partial<TrackingSettings>);
  };

  const range = (key: keyof TrackingSettings, spec: readonly [number, number, number], value = Number(settings[key]), convert: (value: number) => unknown = Number) => (
    <input type="range" min={spec[0]} max={spec[1]} step={spec[2]} value={value}
      onPointerDown={onGestureStart} onPointerUp={onGestureEnd} onPointerCancel={onGestureEnd} onBlur={onGestureEnd}
      onChange={(event) => patchValue(key, convert(Number(event.target.value)))}
      className="w-32 accent-blue-500" />
  );

  const control = (key: keyof TrackingSettings): ReactElement => {
    if (key === 'motionThreshold') return range(key, [15, 120, 1], 135 - settings.motionThreshold, (value) => 135 - value);
    if (key === 'echoFadeRate') return range(key, [0, 100, 1], Math.round((1 - settings.echoFadeRate) * 100), (value) => 1 - value / 100);
    if (key === 'bgLearningRate') return range(key, [1, 20, 1], Math.round(settings.bgLearningRate * 100), (value) => value / 100);
    if (key === 'poiCustomImage') return <input type="file" accept="image/*" onChange={(event) => readImage(event, (value) => patchValue(key, value))} className="max-w-32 text-xs" />;
    if (key === 'poiText') return <input type="text" value={settings.poiText} placeholder="ENTER TEXT" onChange={(event) => patchValue(key, event.target.value.toUpperCase())} className="w-32 rounded bg-neutral-950 px-2 py-1 text-sm" />;
    if (key === 'exportMimeType') return <select value={settings.exportMimeType} onChange={(event) => patchValue(key, event.target.value)} className="max-w-40 rounded bg-neutral-950 px-2 py-1 text-sm">{supportedMimeTypes.map((type) => <option key={type.mimeType} value={type.mimeType}>{type.label}</option>)}</select>;
    if (booleanKeys.has(key)) return <input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => patchValue(key, event.target.checked)} className="h-5 w-5 accent-blue-500" />;
    const options = selectOptions[key];
    if (options) return <select value={String(settings[key])} onChange={(event) => patchValue(key, key === 'exportFps' ? Number(event.target.value) : event.target.value)} className="max-w-40 rounded bg-neutral-950 px-2 py-1 text-sm">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>;
    const spec = rangeSpecs[key];
    if (spec) return range(key, spec);
    return <input type="text" value={String(settings[key] ?? '')} onChange={(event) => patchValue(key, event.target.value)} className="w-32 rounded bg-neutral-950 px-2 py-1 text-sm" />;
  };

  return <>{(Object.keys(SETTING_DEFINITIONS) as (keyof TrackingSettings)[])
    .filter((key) => SETTING_DEFINITIONS[key].section === section && !sectionToggleKeys.has(key))
    .map((key) => {
      const definition = SETTING_DEFINITIONS[key] as SettingDefinition;
      const dependencyEnabled = enabled[key] ?? true;
      const disabled = !sectionEnabled || !dependencyEnabled;
      return <div key={key}><SettingRow settingKey={key} label={definition.label} description={definition.description}
        changed={settings[key] !== DEFAULT_TRACKING_SETTINGS[key]}
        disabledReason={disabled ? (!sectionEnabled ? `Enable ${section === 'pixel' ? 'Pixel / POV' : section === 'paint' ? 'Paint / Clone' : 'Trails'} to use this.` : definition.dependsOn?.explanation ?? 'Enable the parent option to use this.') : undefined}
        onReset={() => onChange({ [key]: DEFAULT_TRACKING_SETTINGS[key] } as Partial<TrackingSettings>)}>
        {control(key)}
      </SettingRow></div>;
    })}</>;
}

function readImage(event: ChangeEvent<HTMLInputElement>, onLoad: (value: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result));
  reader.readAsDataURL(file);
}
