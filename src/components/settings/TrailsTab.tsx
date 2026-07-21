import React from 'react';
import { Activity, Sparkles, Eye, Waves, Award, Sliders, Camera, Maximize2 } from 'lucide-react';
import { TrackingSettings } from '../../types';

export interface TrailsTabProps {
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
}

export default function TrailsTab({ settings, setSettings }: TrailsTabProps) {
  return (
    <>
      {/* LED Echo Trails */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <Activity className="w-4 h-4 text-blue-400" />
          <h3 className="font-sans font-semibold text-sm text-neutral-200">
            LED Echo Trails
          </h3>
        </div>

        <div className="flex flex-col gap-4 py-2">
          <div className="p-3 bg-neutral-900 border border-neutral-700/50 rounded-sm flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-neutral-300 leading-relaxed">
              Pixel-perfect masking extracts moving props and stamps them into an echo buffer. The trail matches the exact shape, brightness, and colors of your flow prop at each frame.
            </p>
          </div>

          <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none bg-neutral-950/20 border border-neutral-800/60 p-2.5 rounded-sm hover:border-neutral-700/60 transition-all">
            <div className="flex flex-col">
              <span className="font-medium">Enable Motion Trails</span>
              <span className="text-[10px] text-neutral-500">Stamp and draw moving paths on the screen</span>
            </div>
            <input
              type="checkbox"
              checked={settings.enableTrails}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, enableTrails: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
          </label>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-neutral-400/80" />
                  Mask Sensitivity
                </span>
                <span className="text-[10px] text-neutral-500">Controls how much motion is picked up by the camera.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">{100 - settings.motionThreshold}%</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="1"
              value={135 - settings.motionThreshold}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, motionThreshold: 135 - parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 px-1 mt-1">
              <span>Less (Ignores noise)</span>
              <span>More (Extracts everything)</span>
            </div>
          </div>

          <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none bg-neutral-950/20 border border-neutral-800/60 p-2.5 rounded-sm hover:border-neutral-700/60 transition-all mt-2">
            <div className="flex flex-col">
              <span className="font-medium">Filter by Brightness</span>
              <span className="text-[10px] text-neutral-500">Only track bright moving objects (e.g. LED props)</span>
            </div>
            <input
              type="checkbox"
              checked={settings.enableLightTracking}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, enableLightTracking: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
          </label>

          <div className={`flex flex-col gap-1.5 mt-2 transition-all duration-200 ${!settings.enableLightTracking ? 'hidden' : ''}`}>
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-neutral-400/80" />
                  Brightness Threshold
                </span>
                <span className="text-[10px] text-neutral-500">Minimum brightness to track.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">{Math.round((settings.lightThreshold / 255) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              step="1"
              value={settings.lightThreshold}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, lightThreshold: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className={`flex flex-col gap-1.5 mt-2 transition-all duration-200 ${(!settings.enableTrails && settings.strobeRate === 0) ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-neutral-400/80" />
                  Echo Trail Length
                </span>
                <span className="text-[10px] text-neutral-500">How long the trail persists before fading away.</span>
              </div>
              <span className="text-neutral-200 font-mono">
                {Math.round((1 - settings.echoFadeRate) * 100) === 0 
                  ? '0% (No Trail)' 
                  : Math.round((1 - settings.echoFadeRate) * 100) === 100 
                    ? '100% (Infinite)' 
                    : `${Math.round((1 - settings.echoFadeRate) * 100)}% retention`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round((1 - settings.echoFadeRate) * 100)}
              onChange={(e) => {
                const retention = parseInt(e.target.value);
                setSettings((prev) => ({ ...prev, echoFadeRate: 1 - (retention / 100) }));
              }}
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Edge & Glow Effects Subgroup */}
          <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-md p-3.5 flex flex-col gap-4 mt-2">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800/60 pb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Edge & Glow Controls
            </span>
            
            {/* Shape Anti-Aliasing */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400">Shape Anti-Aliasing</span>
                  <span className="text-[10px] text-neutral-500">Smooths pixelated staircases on mask edges perfectly without smearing the shape.</span>
                </div>
                <span className="text-neutral-200 font-mono">{settings.edgeAntiAliasing}</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                value={settings.edgeAntiAliasing}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, edgeAntiAliasing: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Smear Edges */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-neutral-400/80" />
                    Smear Edges
                  </span>
                  <span className="text-[10px] text-neutral-500">Applies a spatial blur (creates a glowing cloud if set too high).</span>
                </div>
                <span className="text-neutral-200 font-mono">{settings.lineSmoothness}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.lineSmoothness}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, lineSmoothness: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Trail Blur Amount */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-400/80" />
                    Trail Blur Amount
                  </span>
                  <span className="text-[10px] text-neutral-500">Applies a soft glow-like blur to the trails.</span>
                </div>
                <span className="text-neutral-200 font-mono">{settings.blurAmount}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.blurAmount}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, blurAmount: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-neutral-400/80" />
                  Color Hue Shift
                </span>
                <span className="text-[10px] text-neutral-500">Shifts the colors of the trail permanently.</span>
              </div>
              <span className="text-neutral-200 font-mono">{settings.hueRotate}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={settings.hueRotate}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, hueRotate: parseInt(e.target.value) }))
              }
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex flex-col mb-1">
              <span className="text-xs text-neutral-400">Blend Mode</span>
              <span className="text-[10px] text-neutral-500">How new frames blend with older trails.</span>
            </div>
            <select
              value={settings.enableTrails ? settings.compositeMode : 'none'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'none') {
                  setSettings((prev) => ({ ...prev, enableTrails: false, compositeMode: 'none' }));
                } else {
                  setSettings((prev) => ({ ...prev, enableTrails: true, compositeMode: val }));
                }
              }}
              className="w-full bg-neutral-800 text-xs text-neutral-200 border border-neutral-700 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-all"
            >
              <option value="none">Disabled (No Trails)</option>
              <option value="screen">Screen (Glow)</option>
              <option value="source-over">Normal (Solid)</option>
              <option value="lighter">Additive (Intense)</option>
              <option value="color-dodge">Color Dodge</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cinematic Effects */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h3 className="font-sans font-semibold text-sm text-neutral-200">
            Cinematic Effects
          </h3>
        </div>

        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-neutral-400/80" />
                Chronophotography (Strobe)
              </span>
              <span className="text-[10px] text-neutral-500">Captures distinct snapshot frames instead of a continuous trail.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">
              {settings.strobeRate === 0 ? 'Off' : `Every ${settings.strobeRate.toFixed(2)}s`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="2.0"
            step="0.05"
            value={settings.strobeRate}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, strobeRate: parseFloat(e.target.value) }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />

          {settings.strobeRate > 0 && (
            <div className="flex items-center justify-between gap-4 mt-2 p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/60 transition-all duration-300">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-neutral-300">Strobe Style</span>
                <span className="text-[9px] text-neutral-500 leading-tight">Choose how frames behave between updates.</span>
              </div>
              <select
                value={settings.strobeMode}
                onChange={(e) => {
                  const val = e.target.value as 'freeze' | 'flash';
                  setSettings((prev) => ({ ...prev, strobeMode: val }));
                }}
                className="bg-neutral-800 text-[11px] text-neutral-200 border border-neutral-700 px-2 py-1.5 rounded-md outline-none cursor-pointer focus:border-blue-500 transition-all"
              >
                <option value="freeze">Freeze Frame (Posterize)</option>
                <option value="flash">Blackout Flash (Strobe Light)</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400">Rainbow Color Cycle</span>
              <span className="text-[10px] text-neutral-500">Continuously shifts the hue of the trail over time.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">
              {settings.colorCycleSpeed === 0 ? 'Off' : `${settings.colorCycleSpeed} deg/f`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={settings.colorCycleSpeed}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, colorCycleSpeed: parseInt(e.target.value) }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400">Fluid Smoke (Vertical Drift)</span>
              <span className="text-[10px] text-neutral-500">Makes the trail float upwards or downwards.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">{settings.verticalDrift} px/f</span>
          </div>
          <input
            type="range"
            min="-15"
            max="15"
            step="1"
            value={settings.verticalDrift}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, verticalDrift: parseInt(e.target.value) }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400">Fluid Smoke (Horizontal Drift)</span>
              <span className="text-[10px] text-neutral-500">Makes the trail drift left or right.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">{settings.horizontalDrift} px/f</span>
          </div>
          <input
            type="range"
            min="-15"
            max="15"
            step="1"
            value={settings.horizontalDrift}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, horizontalDrift: parseInt(e.target.value) }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1.5 mt-2 mb-2">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-neutral-400/80" />
                Feedback Loop (Zoom)
              </span>
              <span className="text-[10px] text-neutral-500">Scales the trail up/down for an infinite zoom.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">
              {settings.feedbackZoom === 1.0 ? 'Off' : `${((settings.feedbackZoom - 1) * 100).toFixed(1)}%`}
            </span>
          </div>
          <input
            type="range"
            min="0.95"
            max="1.1"
            step="0.005"
            value={settings.feedbackZoom}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, feedbackZoom: parseFloat(e.target.value) }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1.5 mt-2 mb-2">
          <div className="flex justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400">Motion Blur</span>
              <span className="text-[10px] text-neutral-500">Accumulates camera frames for a smooth ribbon effect.</span>
            </div>
            <span className="text-neutral-200 font-mono shrink-0 text-right">
              {settings.motionBlur === 0 ? 'Off' : `${(settings.motionBlur * 100).toFixed(0)}%`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={settings.motionBlur}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, motionBlur: parseFloat(e.target.value) }))
            }
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </>
  );
}
