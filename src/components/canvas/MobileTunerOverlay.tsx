import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrackingSettings } from '../../types';

export interface TunerSettingItem {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  min: number;
  max: number;
  step: number;
  getValue: () => number;
  setValue: (val: number) => void;
  format: (val: number) => string;
}

export interface MobileTunerOverlayProps {
  cameraActive: boolean;
  isSidebarOpen: boolean;
  activeTunerKey: string | null;
  setActiveTunerKey: (key: string | null) => void;
  tunerSettings: TunerSettingItem[];
  getSettingColor: (key: string) => string;
  settings: TrackingSettings;
}

export default function MobileTunerOverlay({
  cameraActive,
  isSidebarOpen,
  activeTunerKey,
  setActiveTunerKey,
  tunerSettings,
  getSettingColor,
  settings,
}: MobileTunerOverlayProps) {
  if (!cameraActive || isSidebarOpen) return null;

  return (
    <div className="absolute bottom-28 left-4 right-4 z-20 pointer-events-none flex flex-col items-center gap-3 md:hidden">
      <AnimatePresence>
        {activeTunerKey && (() => {
          const item = tunerSettings.find((s) => s.key === activeTunerKey);
          if (!item) return null;
          const Icon = item.icon;
          const value = item.getValue();
          return (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 180 }}
              className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-neutral-800/80 rounded-2xl px-4 py-3.5 w-full max-w-[280px] flex flex-col gap-2.5 shadow-2xl pointer-events-auto font-sans"
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <Icon className="w-3.5 h-3.5 text-blue-400" />
                  <span>{item.name}</span>
                </div>
                <span
                  className="font-mono text-[11px]"
                  style={
                    item.key === 'hueRotate' && settings.hueRotate > 0
                      ? { color: `hsl(${settings.hueRotate}, 85%, 65%)` }
                      : { color: '#e5e5e5' }
                  }
                >
                  {item.format(value)}
                </span>
              </div>
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={value}
                onChange={(e) => item.setValue(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer mt-1"
              />
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className="bg-[#050505]/95 backdrop-blur-md border border-neutral-900 rounded-full px-2.5 py-1.5 flex items-center gap-2 shadow-2xl pointer-events-auto">
        {tunerSettings.map((item) => {
          const Icon = item.icon;
          const isActive = activeTunerKey === item.key;
          const colorClass = getSettingColor(item.key);
          return (
            <button
              key={item.key}
              onClick={() => setActiveTunerKey(isActive ? null : item.key)}
              className={`w-10 h-10 rounded-full border transition-all flex items-center justify-center cursor-pointer ${
                isActive
                  ? 'bg-blue-600 border-blue-500 text-white scale-110 shadow-lg shadow-blue-500/25 z-10'
                  : colorClass
              }`}
              style={
                item.key === 'hueRotate' && settings.hueRotate > 0 && !isActive
                  ? {
                      color: `hsl(${settings.hueRotate}, 85%, 65%)`,
                      borderColor: `hsla(${settings.hueRotate}, 85%, 65%, 0.3)`,
                    }
                  : undefined
              }
              title={item.name}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
