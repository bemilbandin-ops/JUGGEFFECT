import { type ReactNode, useState } from 'react';
import { DEFAULT_TRACKING_SETTINGS, QUICK_PRESETS } from '../../config/settingsDefaults';
import {
  getChangedSettingKeys,
  searchSettingKeys,
  SECTION_ORDER,
  SETTING_DEFINITIONS,
  type SettingSectionId,
} from '../../config/settingsRack';
import type { TrackingSettings } from '../../types';
import { EffectSection } from './EffectSection';

interface SettingsRackProps {
  settings: TrackingSettings;
  sectionControls: Record<SettingSectionId, ReactNode>;
  canUndo: boolean;
  onChange: (patch: Partial<TrackingSettings>) => void;
  onUndo: () => void;
  onResetAll: () => void;
  onApplyPreset: (id: string, patch: Partial<TrackingSettings>) => void;
}

const sectionTitle: Record<SettingSectionId, string> = {
  tracking: 'Tracking',
  trails: 'Trails',
  pixel: 'Pixel / POV',
  paint: 'Paint / Clone',
  camera: 'Camera',
  export: 'Export',
};

export const sectionSummary = {
  tracking: (s: TrackingSettings) => `${135 - s.motionThreshold}% sensitivity${s.enableLightTracking ? ', bright objects only' : ''}`,
  trails: (s: TrackingSettings) => s.enableTrails ? `${Math.round((1 - s.echoFadeRate) * 100)}% length, ${s.blurAmount}px glow` : 'Off',
  pixel: (s: TrackingSettings) => s.enablePoiMode ? `${s.poiPatternType} pattern, ${s.poiRenderMode}` : 'Off',
  paint: (s: TrackingSettings) => s.cloneStampEnabled ? `${s.cloneStampBrushSize}px brush, ${s.cloneStampFeather}px softness` : 'Off',
  camera: (s: TrackingSettings) => [s.exposure && `${s.exposure > 0 ? '+' : ''}${s.exposure}% exposure`, s.saturation && `${s.saturation > 0 ? '+' : ''}${s.saturation}% saturation`].filter(Boolean).join(', ') || 'Neutral',
  export: (s: TrackingSettings) => `${s.exportFps} fps, ${s.exportQuality} quality`,
};

function formatValue(value: TrackingSettings[keyof TrackingSettings]) {
  return value === null ? 'None' : value === '' ? 'Empty' : String(value);
}

export function SettingsRack({ settings, sectionControls, canUndo, onChange, onUndo, onResetAll, onApplyPreset }: SettingsRackProps) {
  const [search, setSearch] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const searchResults = searchSettingKeys(search);
  const changedKeys = getChangedSettingKeys(settings);

  const selectSetting = (key: keyof TrackingSettings) => {
    const section = SETTING_DEFINITIONS[key].section;
    setSearch('');
    requestAnimationFrame(() => {
      const details = document.getElementById(`settings-section-${section}`) as HTMLDetailsElement | null;
      if (!details) return;
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const control = details.querySelector<HTMLElement>(`[data-setting-key="${key}"] [data-setting-control], [data-setting-key="${key}"]`);
      (control ?? details).focus();
    });
  };

  return (
    <aside aria-label="Effect settings" className="space-y-3">
      <div className="relative flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <button type="button" onClick={() => setShowPresets((show) => !show)} className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-200">
          Presets
        </button>
        <button type="button" disabled={!canUndo} onClick={onUndo} className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40">
          Undo
        </button>
        <button type="button" onClick={() => setShowChanges((show) => !show)} className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-200">
          Changes{changedKeys.length ? ` (${changedKeys.length})` : ''}
        </button>
        <div className="relative min-w-48 flex-1">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search settings"
            placeholder="Search settings"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          />
          {search && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-neutral-700 bg-neutral-900 p-1">
              {searchResults.map((key) => (
                <li key={key}>
                  <button type="button" className="w-full rounded px-2 py-1 text-left text-sm text-neutral-200 hover:bg-neutral-800" onClick={() => selectSetting(key)}>
                    {SETTING_DEFINITIONS[key].label}
                  </button>
                </li>
              ))}
              {!searchResults.length && <li className="px-2 py-1 text-sm text-neutral-500">No settings found</li>}
            </ul>
          )}
        </div>
        {showPresets && (
          <div className="w-full border-t border-neutral-800 pt-2">
            {QUICK_PRESETS.map((preset) => (
              <button key={preset.id} type="button" className="mr-2 text-sm text-blue-400 hover:text-blue-300" onClick={() => onApplyPreset(preset.id, preset.settings)}>
                {preset.name}
              </button>
            ))}
          </div>
        )}
        {showChanges && (
          <div className="w-full space-y-2 border-t border-neutral-800 pt-2">
            {changedKeys.map((key) => (
              <div key={key} className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="text-neutral-200">{SETTING_DEFINITIONS[key].label}</span>
                <span>Now: {formatValue(settings[key])}</span>
                <span>Default: {formatValue(DEFAULT_TRACKING_SETTINGS[key])}</span>
                <button type="button" className="text-blue-400 hover:text-blue-300" onClick={() => onChange({ [key]: DEFAULT_TRACKING_SETTINGS[key] } as Partial<TrackingSettings>)}>
                  Reset
                </button>
              </div>
            ))}
            {changedKeys.length > 0 && <button type="button" className="text-xs text-neutral-300 hover:text-white" onClick={onResetAll}>Reset all</button>}
            {!changedKeys.length && <p className="text-xs text-neutral-500">No changes</p>}
          </div>
        )}
      </div>

      {SECTION_ORDER.map((section) => (
        <div key={section}>
          <EffectSection
            id={`settings-section-${section}`}
            title={sectionTitle[section]}
            summary={sectionSummary[section](settings)}
            defaultOpen={section === 'tracking'}
          >
            {sectionControls[section]}
          </EffectSection>
        </div>
      ))}
    </aside>
  );
}

export type { SettingsRackProps };
