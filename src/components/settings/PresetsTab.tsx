import React from 'react';
import {
  Sliders,
  RotateCcw,
  Trash2,
  Sparkles,
  Zap,
  Wind,
  Activity,
  Infinity as InfinityIcon,
  Moon,
  Flame,
  Rainbow,
  Palette,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';
import { TrackingSettings } from '../../types';
import { QUICK_PRESETS } from '../../config/settingsDefaults';

const PRESET_ICONS: Record<string, LucideIcon> = {
  Zap,
  Sparkles,
  Wind,
  Activity,
  Infinity: InfinityIcon,
  Moon,
  Flame,
  Rainbow,
  Palette,
  ScanLine,
};

export interface PresetsTabProps {
  settings: TrackingSettings;
  originalSettings: TrackingSettings | null;
  resetToOriginalSettings: () => void;
  resetToFactoryDefaults: () => void;
  appliedPresetId: string | null;
  applyPreset: (presetId: string, presetSettings: Partial<TrackingSettings>) => void;
  getSettingDisplayName: (key: string, val: any) => string;
}

export default function PresetsTab({
  originalSettings,
  resetToOriginalSettings,
  resetToFactoryDefaults,
  appliedPresetId,
  applyPreset,
  getSettingDisplayName,
}: PresetsTabProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="font-sans font-semibold text-sm text-neutral-200">
            Quick Visual Presets
          </h3>
        </div>
        <div className="flex items-center gap-3 select-none">
          {originalSettings && (
            <button
              onClick={resetToOriginalSettings}
              className="text-[10px] text-amber-400 hover:text-amber-300 transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Manual
            </button>
          )}
          <button
            onClick={resetToFactoryDefaults}
            className="text-[10px] text-red-400 hover:text-red-300 transition-all flex items-center gap-1 cursor-pointer"
            title="Reset all settings to default values and clear local storage"
          >
            <Trash2 className="w-3 h-3" />
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {QUICK_PRESETS.map((preset) => {
          const isApplied = appliedPresetId === preset.id;
          const PresetIcon = PRESET_ICONS[preset.icon] ?? Sparkles;
          const presetColor = preset.color.split(' ')[0];
          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id, preset.settings)}
              className={`flex flex-col text-left p-3 rounded border text-xs transition-all relative overflow-hidden group cursor-pointer active:scale-97 select-none ${
                isApplied
                  ? 'bg-neutral-800/80 border-blue-500 shadow-md shadow-blue-500/5'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700/80 hover:bg-neutral-800/30'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span
                  className={`font-semibold transition-colors ${
                    isApplied ? 'text-blue-400' : 'text-neutral-200 group-hover:text-white'
                  }`}
                >
                  {preset.name}
                </span>
                <PresetIcon
                  className={`w-3.5 h-3.5 ${presetColor} transition-opacity ${
                    isApplied ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'
                  }`}
                />
              </div>
              <p className="text-[10px] text-neutral-400 leading-normal mb-2 shrink-0">
                {preset.description}
              </p>

              <div className="flex flex-wrap gap-1 mt-auto">
                {Object.entries(preset.settings)
                  .map(([k, v]) => getSettingDisplayName(k, v))
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((disp, i) => (
                    <span
                      key={i}
                      className="text-[8px] bg-neutral-950 text-neutral-500 px-1.5 py-0.5 rounded font-mono border border-neutral-950"
                    >
                      {disp}
                    </span>
                  ))}
                {Object.keys(preset.settings).length > 3 && (
                  <span className="text-[8px] bg-neutral-950 text-neutral-600 px-1 rounded font-mono border border-neutral-950">
                    +{Object.keys(preset.settings).length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
