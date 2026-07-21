import React from 'react';
import { Flame, Info } from 'lucide-react';
import { TrackingSettings } from '../../types';
import VariantSelector from '../VariantSelector';

export interface PoiTabProps {
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
}

export default function PoiTab({ settings, setSettings }: PoiTabProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <Flame className="w-4 h-4 text-blue-400" />
        <h3 className="font-sans font-semibold text-sm text-neutral-200">
          Pixel Effect Painting
        </h3>
      </div>

      <div className="flex flex-col gap-4 py-2">
        <div className="p-3 bg-neutral-900 border border-neutral-700/50 rounded-sm flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-neutral-300 leading-relaxed">
            Projects colors from templates, custom text, or uploaded images along the path of moving LED props or mouse drags.
          </p>
        </div>

        <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none bg-neutral-950/20 border border-neutral-800/60 p-2.5 rounded-sm hover:border-neutral-700/60 transition-all">
          <div className="flex flex-col">
            <span className="font-medium">Enable Pixel Effect Mode</span>
            <span className="text-[10px] text-neutral-500">Paint patterns instead of basic motion trails</span>
          </div>
          <input
            type="checkbox"
            checked={settings.enablePoiMode}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enablePoiMode: e.target.checked }))
            }
            className="sr-only peer"
          />
          <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
        </label>

        {settings.enablePoiMode && (
          <>
            {/* LED Brightness Filter and Threshold */}
            <div className="flex flex-col gap-2 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
                <div className="flex flex-col">
                  <span className="font-medium text-[11px]">Filter by Brightness</span>
                  <span className="text-[9px] text-neutral-500">Only track bright moving objects (filters out noise)</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableLightTracking}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, enableLightTracking: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="relative w-8 h-4 bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-500 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
              </label>

              {settings.enableLightTracking && (
                <div className="flex flex-col gap-1 mt-1 border-t border-neutral-800/60 pt-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-400">LED Brightness Threshold</span>
                    <span className="text-neutral-200 font-mono">{settings.lightThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="255"
                    step="5"
                    value={settings.lightThreshold}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, lightThreshold: parseInt(e.target.value) }))
                    }
                    className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>
            <VariantSelector
              value={settings.poiPatternType}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, poiPatternType: e.target.value as any }))
              }
            />

            {settings.poiPatternType === 'text' && (
              <div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400">Text Content</span>
                  <input
                    type="text"
                    value={settings.poiText}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, poiText: e.target.value.toUpperCase() }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    placeholder="ENTER TEXT"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400">Text Color</span>
                  <div className="flex gap-2 mt-1">
                    {['#ff2a85', '#00ffcc', '#ffe600', '#3b82f6', '#ffffff'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings((prev) => ({ ...prev, poiTextColor: color }))}
                        className={`w-5 h-5 rounded-full border cursor-pointer transition-all ${
                          settings.poiTextColor === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {settings.poiPatternType === 'custom' && (
              <div className="flex flex-col gap-1.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
                <span className="text-[10px] text-neutral-400">Upload Image File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setSettings((prev) => ({ ...prev, poiCustomImage: event.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-neutral-400 file:mr-4 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer"
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-400">Effect Orientation</span>
              <select
                value={settings.poiOrientation}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiOrientation: e.target.value as any }))
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="club">Align with Juggling Club (Auto)</option>
                <option value="vertical">Static Vertical (Flags / Text)</option>
                <option value="horizontal">Static Horizontal</option>
                <option value="motion">Motion Direction (Trailing Stick)</option>
                <option value="radial">Radial Circle (Light Wheels)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-400">Pattern Mapping Mode</span>
              <select
                value={settings.poiMappingMode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiMappingMode: e.target.value as any }))
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="angle">Map to Club Rotation (for Light Wheels)</option>
                <option value="spatial">Map to Screen Position (for Flags & Text)</option>
                <option value="time">Cycle over Time (Standard)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-400">Render Style</span>
              <select
                value={settings.poiRenderMode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiRenderMode: e.target.value as any }))
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="dots">Dotted LEDs (Discrete Points)</option>
                <option value="solid">Solid Ribbon (Smeared Brush)</option>
              </select>
            </div>

            {/* POV Sweep Settings */}
            <div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
              <span className="text-[10px] text-neutral-400 block font-medium">POV Sweep (Persistence of Vision)</span>
              
              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
                <div className="flex flex-col">
                  <span className="font-medium text-[11px]">Enable POV Sweep</span>
                  <span className="text-[9px] text-neutral-500">Paint image across the motion trail (like real pixel poi)</span>
                </div>
                <input type="checkbox" checked={settings.poiPovEnabled ?? false}
                  onChange={(e) => setSettings((prev) => ({ ...prev, poiPovEnabled: e.target.checked }))}
                  className="sr-only peer" />
                <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
              </label>

              {(settings.poiPovEnabled ?? false) && (<>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">Trail Retention</span>
                    <span className="text-neutral-300 font-mono">{settings.poiPovRetention ?? 400}ms</span>
                  </div>
                  <input type="range" min="50" max="2000" step="25" value={settings.poiPovRetention ?? 400}
                    onChange={(e) => setSettings((prev) => ({ ...prev, poiPovRetention: parseInt(e.target.value) }))}
                    className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">Column Spacing</span>
                    <span className="text-neutral-300 font-mono">{settings.poiPovColumnSpacing ?? 3}px</span>
                  </div>
                  <input type="range" min="1" max="20" step="1" value={settings.poiPovColumnSpacing ?? 3}
                    onChange={(e) => setSettings((prev) => ({ ...prev, poiPovColumnSpacing: parseInt(e.target.value) }))}
                    className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-neutral-500">Fade Curve</span>
                  <select value={settings.poiPovFadeMode ?? 'exponential'}
                    onChange={(e) => setSettings((prev) => ({ ...prev, poiPovFadeMode: e.target.value as any }))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer">
                    <option value="exponential">Exponential (Smooth, Natural)</option>
                    <option value="linear">Linear (Even Fade)</option>
                    <option value="sharp">Sharp (Hard Cutoff)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-neutral-500">Motion Type</span>
                  <select value={settings.poiPovMotionMode ?? 'free'}
                    onChange={(e) => setSettings((prev) => ({ ...prev, poiPovMotionMode: e.target.value as any }))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer">
                    <option value="free">Free Path (Any motion — throws, swings, etc.)</option>
                    <option value="circular">Circular (Optimized for spinning — wraps image around rotation)</option>
                  </select>
                </div>
              </>)}
            </div>

            {/* LED Glow Settings */}
            <div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
              <span className="text-[10px] text-neutral-400 block font-medium">LED Glow / Bloom</span>
              
              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
                <div className="flex flex-col">
                  <span className="font-medium text-[11px]">Enable Glow Halos</span>
                  <span className="text-[9px] text-neutral-500">Adds realistic light bloom around each LED dot</span>
                </div>
                <input type="checkbox" checked={settings.poiGlowEnabled ?? false}
                  onChange={(e) => setSettings((prev) => ({ ...prev, poiGlowEnabled: e.target.checked }))}
                  className="sr-only peer" />
                <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
              </label>

              {(settings.poiGlowEnabled ?? false) && (<>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">Glow Radius</span>
                    <span className="text-neutral-300 font-mono">{settings.poiGlowRadius ?? 6}px</span>
                  </div>
                  <input type="range" min="2" max="20" step="1" value={settings.poiGlowRadius ?? 6}
                    onChange={(e) => setSettings((prev) => ({ ...prev, poiGlowRadius: parseInt(e.target.value) }))}
                    className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">Glow Intensity</span>
                    <span className="text-neutral-300 font-mono">{Math.round((settings.poiGlowIntensity ?? 0.5) * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="1.0" step="0.05" value={settings.poiGlowIntensity ?? 0.5}
                    onChange={(e) => setSettings((prev) => ({ ...prev, poiGlowIntensity: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer" />
                </div>
              </>)}

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">LED Count (per column)</span>
                  <span className="text-neutral-300 font-mono">{(settings.poiLedCount ?? 0) === 0 ? "Auto" : settings.poiLedCount}</span>
                </div>
                <input type="range" min="0" max="72" step="4" value={settings.poiLedCount ?? 0}
                  onChange={(e) => setSettings((prev) => ({ ...prev, poiLedCount: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            {settings.poiOrientation === 'radial' && (
              <div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
                <span className="text-[10px] text-neutral-400 block font-medium">Center of Rotation (Crosshair)</span>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">Horizontal Center</span>
                    <span className="text-neutral-300 font-mono">{Math.round(settings.poiCenterRelativeX * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.poiCenterRelativeX}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, poiCenterRelativeX: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">Vertical Center</span>
                    <span className="text-neutral-300 font-mono">{Math.round(settings.poiCenterRelativeY * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.poiCenterRelativeY}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, poiCenterRelativeY: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Effect Height (Length)</span>
                <span className="text-neutral-200 font-mono">
                  {settings.poiHeight === 0 ? "Auto (Club Length)" : `${settings.poiHeight}px`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                step="5"
                value={settings.poiHeight}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiHeight: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Effect Width (Thickness)</span>
                <span className="text-neutral-200 font-mono">{settings.poiWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={settings.poiWidth}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiWidth: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Pattern Draw Speed</span>
                <span className="text-neutral-200 font-mono">{settings.poiSpeedMultiplier.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="8.0"
                step="0.1"
                value={settings.poiSpeedMultiplier}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiSpeedMultiplier: parseFloat(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Max Tracking Spots</span>
                <span className="text-neutral-200 font-mono">{settings.poiMaxPoints} props</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.poiMaxPoints}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiMaxPoints: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Effect Opacity</span>
                <span className="text-neutral-200 font-mono">{Math.round(settings.poiOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.poiOpacity}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiOpacity: parseFloat(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Frame Paint Interval</span>
                <span className="text-neutral-200 font-mono">
                  {settings.poiFrameInterval === 1 ? "Every Frame" : `Every ${settings.poiFrameInterval} Frames`}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.poiFrameInterval}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, poiFrameInterval: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2.5 p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-sm">
              <span className="text-[10px] text-neutral-400 block font-medium">Strobe Envelope (ADSR)</span>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Fade In Time</span>
                  <span className="text-neutral-300 font-mono">
                    {settings.poiFadeInTime === 0 ? "None" : `${settings.poiFadeInTime} f`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={settings.poiFadeInTime}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, poiFadeInTime: parseInt(e.target.value) }))
                  }
                  className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Hold Active Time</span>
                  <span className="text-neutral-300 font-mono">
                    {settings.poiHoldTime === 0 ? "Constant" : `${settings.poiHoldTime} f`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={settings.poiHoldTime}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, poiHoldTime: parseInt(e.target.value) }))
                  }
                  className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Fade Out Time</span>
                  <span className="text-neutral-300 font-mono">
                    {settings.poiFadeOutTime === 0 ? "None" : `${settings.poiFadeOutTime} f`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={settings.poiFadeOutTime}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, poiFadeOutTime: parseInt(e.target.value) }))
                  }
                  className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Wait / Inactive Time</span>
                  <span className="text-neutral-300 font-mono">
                    {settings.poiWaitTime === 0 ? "None" : `${settings.poiWaitTime} f`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={settings.poiWaitTime}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, poiWaitTime: parseInt(e.target.value) }))
                  }
                  className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
