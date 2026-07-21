import React from 'react';
import { Camera, Sun, Contrast, Palette, Thermometer, Sliders } from 'lucide-react';
import { TrackingSettings } from '../../types';

export interface CameraTabProps {
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
  cameraActive: boolean;
  startCamera: () => void;
}

export default function CameraTab({
  settings,
  setSettings,
  cameraActive,
  startCamera,
}: CameraTabProps) {
  return (
    <>
      {/* Camera Adjustments */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-400" />
            <h3 className="font-sans font-semibold text-sm text-neutral-200">
              Camera Adjustments
            </h3>
          </div>
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                exposure: 0,
                contrast: 0,
                saturation: 0,
                temperature: 0,
                tint: 0,
              }))
            }
            className="text-[10px] text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-750 px-2 py-1 rounded transition-all cursor-pointer"
            title="Reset all adjustments to defaults"
          >
            Reset All
          </button>
        </div>

        <p className="text-[10px] text-neutral-500 -mt-2">
          Fine-tune feed properties. Double-click any slider to reset it individually.
        </p>

        <div className="flex flex-col gap-4">
          {/* Exposure */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-neutral-400/80" />
                Exposure (Brightness)
              </span>
              <span className="text-neutral-200 font-mono">
                {settings.exposure > 0 ? `+${settings.exposure}` : settings.exposure}%
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.exposure}
              onDoubleClick={() => setSettings((prev) => ({ ...prev, exposure: 0 }))}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, exposure: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Contrast className="w-3.5 h-3.5 text-neutral-400/80" />
                Contrast
              </span>
              <span className="text-neutral-200 font-mono">
                {settings.contrast > 0 ? `+${settings.contrast}` : settings.contrast}%
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.contrast}
              onDoubleClick={() => setSettings((prev) => ({ ...prev, contrast: 0 }))}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, contrast: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Saturation */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-neutral-400/80" />
                Saturation (Color)
              </span>
              <span className="text-neutral-200 font-mono">
                {settings.saturation > 0 ? `+${settings.saturation}` : settings.saturation}%
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.saturation}
              onDoubleClick={() => setSettings((prev) => ({ ...prev, saturation: 0 }))}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, saturation: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Temperature */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-neutral-400/80" />
                Temperature (Warmth)
              </span>
              <span className="text-neutral-200 font-mono">
                {settings.temperature > 0 ? `+${settings.temperature}` : settings.temperature}%
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.temperature}
              onDoubleClick={() => setSettings((prev) => ({ ...prev, temperature: 0 }))}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, temperature: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-neutral-500 px-1 -mt-0.5">
              <span>Cool (Blue)</span>
              <span>Warm (Amber)</span>
            </div>
          </div>

          {/* Tint */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-neutral-400/80" />
                Tint (Green / Magenta)
              </span>
              <span className="text-neutral-200 font-mono">
                {settings.tint > 0 ? `+${settings.tint}` : settings.tint}%
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.tint}
              onDoubleClick={() => setSettings((prev) => ({ ...prev, tint: 0 }))}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, tint: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-neutral-500 px-1 -mt-0.5">
              <span>Green</span>
              <span>Magenta</span>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Settings */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="font-sans font-semibold text-sm text-neutral-200">
            Advanced Settings
          </h3>
        </div>

        <div className="flex flex-col gap-1.5 mt-1 mb-2">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400">Background Adaptation</span>
              <span className="text-[10px] text-neutral-500">How quickly the camera learns changes in the background.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">
              {(settings.bgLearningRate * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={Math.round(settings.bgLearningRate * 100)}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, bgLearningRate: parseInt(e.target.value) / 100 }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-500 px-1 mt-1">
            <span>Stable</span>
            <span>Fast Update</span>
          </div>
        </div>

        {/* Debug and audio settings */}
        <div className="flex flex-col gap-3 pt-1">
          <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
            <div className="flex flex-col">
              <span>Invert Tracked Colors</span>
              <span className="text-[10px] text-neutral-500">Creates a negative trail effect</span>
            </div>
            <input
              type="checkbox"
              checked={settings.invertColors}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, invertColors: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
          </label>

          <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
            <div className="flex flex-col">
              <span>Show Debug Mask</span>
              <span className="text-[10px] text-neutral-500">Visualizes what camera currently extracts</span>
            </div>
            <input
              type="checkbox"
              checked={settings.showDebugFeed}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, showDebugFeed: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
          </label>

          <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
            <div className="flex flex-col">
              <span>Record Audio Stream</span>
              <span className="text-[10px] text-neutral-500">Syncs background mic on export</span>
            </div>
            <input
              type="checkbox"
              checked={settings.enableAudioSync}
              onChange={(e) => {
                const val = e.target.checked;
                setSettings((prev) => ({ ...prev, enableAudioSync: val }));
                if (cameraActive) {
                  setTimeout(() => startCamera(), 100);
                }
              }}
              className="sr-only peer"
            />
            <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
          </label>
        </div>
      </div>
    </>
  );
}
