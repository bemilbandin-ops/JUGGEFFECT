import React from 'react';
import {
  Sliders,
  X,
  Sparkles,
  Activity,
  Flame,
  Camera,
  Paintbrush,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrackingSettings } from '../types';
import PresetsTab from './settings/PresetsTab';
import TrailsTab from './settings/TrailsTab';
import PoiTab from './settings/PoiTab';
import CameraTab from './settings/CameraTab';
import PaintTab from './settings/PaintTab';

export interface SettingsDrawerProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activeTab: 'presets' | 'trails' | 'poi' | 'camera' | 'paint';
  setActiveTab: (tab: 'presets' | 'trails' | 'poi' | 'camera' | 'paint') => void;
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
  originalSettings: TrackingSettings | null;
  resetToOriginalSettings: () => void;
  resetToFactoryDefaults: () => void;
  appliedPresetId: string | null;
  applyPreset: (presetId: string, presetSettings: Partial<TrackingSettings>) => void;
  getSettingDisplayName: (key: string, val: any) => string;
  cameraActive: boolean;
  removalMaskCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
  removalMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  removalMaskRevisionRef: React.MutableRefObject<number>;
  startCamera: () => void;
}

export default function SettingsDrawer({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setActiveTab,
  settings,
  setSettings,
  originalSettings,
  resetToOriginalSettings,
  resetToFactoryDefaults,
  appliedPresetId,
  applyPreset,
  getSettingDisplayName,
  cameraActive,
  removalMaskCtxRef,
  removalMaskCanvasRef,
  removalMaskRevisionRef,
  startCamera,
}: SettingsDrawerProps) {
  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.2 }}
          className="absolute right-0 top-10 bottom-0 w-full sm:w-80 bg-[#0a0a0a]/95 backdrop-blur-2xl border-l border-neutral-800 z-30 flex flex-col shadow-2xl"
        >
          {/* Sidebar Header with Close Button */}
          <div className="flex items-center justify-between border-b border-neutral-800 p-4 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="font-sans font-semibold text-sm text-neutral-200">
                Settings Panel
              </h3>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 p-1.5 rounded-lg transition-all cursor-pointer"
              title="Close Settings"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Sidebar Tabs */}
          <div className="flex border-b border-neutral-800 p-1 bg-neutral-950/60 shrink-0 select-none">
            {(['presets', 'trails', 'poi', 'camera', 'paint'] as const).map((tab) => {
              const isActive = activeTab === tab;
              let label = '';
              let Icon = Sparkles;
              if (tab === 'presets') { label = 'Presets'; Icon = Sparkles; }
              if (tab === 'trails') { label = 'Trails'; Icon = Activity; }
              if (tab === 'poi') { label = 'Pixel Effect'; Icon = Flame; }
              if (tab === 'camera') { label = 'Camera'; Icon = Camera; }
              if (tab === 'paint') { label = 'Paint'; Icon = Paintbrush; }

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded transition-colors relative cursor-pointer ${
                    isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-sidebar-tab"
                      className="absolute inset-0 bg-neutral-900 border border-neutral-800 rounded"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="text-[9px] font-sans font-medium relative z-10 tracking-wider">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Panel Content */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4 pt-2">
            {activeTab === 'presets' && (
              <PresetsTab
                settings={settings}
                originalSettings={originalSettings}
                resetToOriginalSettings={resetToOriginalSettings}
                resetToFactoryDefaults={resetToFactoryDefaults}
                appliedPresetId={appliedPresetId}
                applyPreset={applyPreset}
                getSettingDisplayName={getSettingDisplayName}
              />
            )}

            {activeTab === 'paint' && (
              <PaintTab
                settings={settings}
                setSettings={setSettings}
                removalMaskCtxRef={removalMaskCtxRef}
                removalMaskCanvasRef={removalMaskCanvasRef}
                removalMaskRevisionRef={removalMaskRevisionRef}
              />
            )}

            {activeTab === 'poi' && (
              <PoiTab
                settings={settings}
                setSettings={setSettings}
              />
            )}

            {activeTab === 'trails' && (
              <TrailsTab
                settings={settings}
                setSettings={setSettings}
              />
            )}

            {activeTab === 'camera' && (
              <CameraTab
                settings={settings}
                setSettings={setSettings}
                cameraActive={cameraActive}
                startCamera={startCamera}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
