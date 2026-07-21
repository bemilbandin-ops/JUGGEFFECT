import React from 'react';
import {
  Sliders,
  X,
  Sparkles,
  Activity,
  Flame,
  Camera,
  Paintbrush,
  RotateCcw,
  Trash2,
  Zap,
  Wind,
  Infinity,
  Moon,
  ChevronDown,
  ChevronUp,
  Key,
  AlertCircle,
  Check,
  Info,
  Eye,
  Waves,
  Award,
  Sun,
  Contrast,
  Palette,
  Thermometer,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrackingSettings } from '../types';
import { QUICK_PRESETS } from '../config/settingsDefaults';
import { GeminiResponse } from '../utils/gemini';
import VariantSelector from './VariantSelector';

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
  geminiCollapsed: boolean;
  setGeminiCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  geminiActive: boolean;
  hasEnvApiKey: boolean;
  apiKeyInput: string;
  setApiKeyInput: (key: string) => void;
  handleSaveApiKey: (key: string) => void;
  cameraActive: boolean;
  runGeminiAnalysis: () => void;
  isGeminiAnalyzing: boolean;
  geminiError: string | null;
  geminiAnalysisResult: GeminiResponse | null;
  applyRecommendedSettings: (recSettings: Partial<TrackingSettings>, option: 'A' | 'B') => void;
  appliedOption: 'A' | 'B' | null;
  removalMaskCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
  removalMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
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
  geminiCollapsed,
  setGeminiCollapsed,
  geminiActive,
  hasEnvApiKey,
  apiKeyInput,
  setApiKeyInput,
  handleSaveApiKey,
  cameraActive,
  runGeminiAnalysis,
  isGeminiAnalyzing,
  geminiError,
  geminiAnalysisResult,
  applyRecommendedSettings,
  appliedOption,
  removalMaskCtxRef,
  removalMaskCanvasRef,
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

          <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4 pt-2">
            {activeTab === 'presets' && (
              <>
                {/* Quick Presets Section */}
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
                            <span className={`font-semibold transition-colors ${isApplied ? 'text-blue-400' : 'text-neutral-200 group-hover:text-white'}`}>
                              {preset.name}
                            </span>
                            {preset.id === 'led' && <Zap className={`w-3.5 h-3.5 ${isApplied ? 'text-amber-400' : 'text-amber-500/50 group-hover:text-amber-400'}`} />}
                            {preset.id === 'cyberpunk' && <Sparkles className={`w-3.5 h-3.5 ${isApplied ? 'text-pink-400' : 'text-pink-500/50 group-hover:text-pink-400'}`} />}
                            {preset.id === 'smoke' && <Wind className={`w-3.5 h-3.5 ${isApplied ? 'text-teal-400' : 'text-teal-500/50 group-hover:text-teal-400'}`} />}
                            {preset.id === 'strobe' && <Activity className={`w-3.5 h-3.5 ${isApplied ? 'text-cyan-400' : 'text-cyan-500/50 group-hover:text-cyan-400'}`} />}
                            {preset.id === 'vortex' && <Infinity className={`w-3.5 h-3.5 ${isApplied ? 'text-indigo-400' : 'text-indigo-500/50 group-hover:text-indigo-400'}`} />}
                            {preset.id === 'cascade' && <Moon className={`w-3.5 h-3.5 ${isApplied ? 'text-purple-400' : 'text-purple-500/50 group-hover:text-purple-400'}`} />}
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-normal mb-2 shrink-0">
                            {preset.description}
                          </p>
                          
                          <div className="flex flex-wrap gap-1 mt-auto">
                            {Object.entries(preset.settings)
                              .map(([k, v]) => getSettingDisplayName(k, v))
                              .filter(Boolean)
                              .slice(0, 3) // show top 3 settings to keep it clean
                              .map((disp, i) => (
                                <span key={i} className="text-[8px] bg-neutral-950 text-neutral-500 px-1.5 py-0.5 rounded font-mono border border-neutral-950">
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

                {/* Gemini AI Auto-Tuner (Beta) Collapsible Section */}
                <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                  <button
                    onClick={() => setGeminiCollapsed(!geminiCollapsed)}
                    className="w-full flex items-center justify-between p-3.5 font-sans font-semibold text-xs text-neutral-300 hover:text-white transition-all bg-neutral-900/50 hover:bg-neutral-800/20 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span>AI Scene Auto-Tuner</span>
                      <span className="text-[8px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider scale-90">
                        Beta
                      </span>
                    </div>
                    {geminiCollapsed ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronUp className="w-4 h-4 text-neutral-500" />}
                  </button>

                  {!geminiCollapsed && (
                    <div className="p-4 pt-1 border-t border-neutral-800/60 flex flex-col gap-4 animate-slideDown">
                      {!geminiActive && !hasEnvApiKey ? (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            Configure your Gemini API key to auto-tune sensitivity, light-tracking, and artistic settings using frame analysis.
                          </p>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">
                              Gemini API Key
                            </label>
                            <input
                              type="password"
                              placeholder="AIzaSy..."
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500 transition-all font-mono"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveApiKey(apiKeyInput)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-3 rounded transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Key className="w-3.5 h-3.5" />
                            Save API Key
                          </button>
                          <a
                            href="https://aistudio.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:underline text-center mt-1"
                          >
                            Get a free API Key from Google AI Studio &rarr;
                          </a>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between bg-neutral-950/40 p-2 border border-neutral-800 rounded text-[10px]">
                            <span className="text-neutral-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {hasEnvApiKey && !apiKeyInput ? 'Env API Key Active' : 'Custom API Key Active'}
                            </span>
                            <button
                              onClick={() => {
                                handleSaveApiKey('');
                              }}
                              className="text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                            >
                              Reset Key
                            </button>
                          </div>

                          {!cameraActive ? (
                            <div className="text-xs text-neutral-400 text-center py-4 bg-neutral-950/20 border border-dashed border-neutral-800 rounded">
                              Start camera or load a video file to run analysis.
                            </div>
                          ) : (
                            <button
                              onClick={runGeminiAnalysis}
                              disabled={isGeminiAnalyzing}
                              className={`w-full font-medium text-xs py-2 px-3 rounded transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 ${
                                isGeminiAnalyzing
                                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                              }`}
                            >
                              {isGeminiAnalyzing ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                                  Analyzing Scene...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Analyze Scene
                                </>
                              )}
                            </button>
                          )}

                          {geminiError && (
                            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded flex items-start gap-2 text-xs text-red-400">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div className="flex-1 leading-relaxed">
                                <span className="font-semibold block mb-0.5">Analysis failed</span>
                                {geminiError}
                              </div>
                            </div>
                          )}

                          {geminiAnalysisResult && (
                            <div className="flex flex-col gap-3 bg-neutral-950/40 border border-neutral-800 rounded p-3 animate-fadeIn">
                              <div>
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider block mb-1">
                                  AI Analysis
                                </span>
                                <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                                  {geminiAnalysisResult.analysis}
                                </p>
                              </div>

                              <div className="h-px bg-neutral-800" />

                              {/* Option A */}
                              <div className="flex flex-col gap-2 border border-neutral-800 rounded p-2.5 bg-neutral-900/50">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-blue-400">
                                    Option A: {geminiAnalysisResult.optionA.name}
                                  </span>
                                  <span className="text-[9px] font-mono bg-blue-950/30 text-blue-300 border border-blue-800/40 px-1 rounded uppercase">
                                    Tracking
                                  </span>
                                </div>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                  {geminiAnalysisResult.optionA.description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
                                  {Object.entries(geminiAnalysisResult.optionA.settings)
                                    .map(([k, v]) => getSettingDisplayName(k, v))
                                    .filter(Boolean)
                                    .map((disp, i) => (
                                      <span key={i} className="text-[9px] bg-neutral-950 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-neutral-800">
                                        {disp}
                                      </span>
                                    ))}
                                </div>
                                <button
                                  onClick={() =>
                                    applyRecommendedSettings(geminiAnalysisResult.optionA.settings, 'A')
                                  }
                                  className={`w-full py-1.5 px-3 rounded text-[11px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                    appliedOption === 'A'
                                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700/50 active:scale-97'
                                  }`}
                                >
                                  {appliedOption === 'A' ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Option A Applied
                                    </>
                                  ) : (
                                    'Apply Option A Settings'
                                  )}
                                </button>
                              </div>

                              {/* Option B */}
                              <div className="flex flex-col gap-2 border border-neutral-800 rounded p-2.5 bg-neutral-900/50">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-purple-400">
                                    Option B: {geminiAnalysisResult.optionB.name}
                                  </span>
                                  <span className="text-[9px] font-mono bg-purple-950/30 text-purple-300 border border-purple-800/40 px-1 rounded uppercase">
                                    Artistic
                                  </span>
                                </div>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                  {geminiAnalysisResult.optionB.description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
                                  {Object.entries(geminiAnalysisResult.optionB.settings)
                                    .map(([k, v]) => getSettingDisplayName(k, v))
                                    .filter(Boolean)
                                    .map((disp, i) => (
                                      <span key={i} className="text-[9px] bg-neutral-950 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-neutral-800">
                                        {disp}
                                      </span>
                                    ))}
                                </div>
                                <button
                                  onClick={() =>
                                    applyRecommendedSettings(geminiAnalysisResult.optionB.settings, 'B')
                                  }
                                  className={`w-full py-1.5 px-3 rounded text-[11px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                    appliedOption === 'B'
                                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700/50 active:scale-97'
                                  }`}
                                >
                                  {appliedOption === 'B' ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Option B Applied
                                    </>
                                  ) : (
                                    'Apply Option B Settings'
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'paint' && (
              <>
                {/* Object Removal (Clone Stamp) */}
                <div className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                    <Trash2 className="w-4 h-4 text-blue-400" />
                    <h3 className="font-sans font-semibold text-sm text-neutral-200">
                      Object Removal (Clone Stamp)
                    </h3>
                  </div>

                  <div className="flex flex-col gap-4 py-2">
                    <div className="p-3 bg-neutral-900 border border-neutral-700/50 rounded-sm flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Paint over unwanted static objects to hide them. Copies details from a customizable clean background offset.
                      </p>
                    </div>

                    <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none bg-neutral-950/20 border border-neutral-800/60 p-2.5 rounded-sm hover:border-neutral-700/60 transition-all">
                      <div className="flex flex-col">
                        <span className="font-medium">Enable Object Removal</span>
                        <span className="text-[10px] text-neutral-500">Activate paint brush to remove static elements</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.cloneStampEnabled}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, cloneStampEnabled: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-neutral-950" />
                    </label>

                    {settings.cloneStampEnabled && (
                      <>
                        {/* Brush Size */}
                        <div className="flex flex-col gap-1.5 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400">Brush Size</span>
                            <span className="text-neutral-200 font-mono">{settings.cloneStampBrushSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="150"
                            step="1"
                            value={settings.cloneStampBrushSize}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, cloneStampBrushSize: parseInt(e.target.value) }))
                            }
                            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Feather */}
                        <div className="flex flex-col gap-1.5 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400 flex items-center gap-1.5">
                              Feather
                            </span>
                            <span className="text-neutral-200 font-mono">{settings.cloneStampFeather}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={settings.cloneStampFeather}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, cloneStampFeather: parseInt(e.target.value) }))
                            }
                            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Offset X */}
                        <div className="flex flex-col gap-1.5 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400">Offset X</span>
                            <span className="text-neutral-200 font-mono">{settings.cloneStampOffsetX}px</span>
                          </div>
                          <input
                            type="range"
                            min="-500"
                            max="500"
                            step="1"
                            value={settings.cloneStampOffsetX}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, cloneStampOffsetX: parseInt(e.target.value) }))
                            }
                            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Offset Y */}
                        <div className="flex flex-col gap-1.5 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400">Offset Y</span>
                            <span className="text-neutral-200 font-mono">{settings.cloneStampOffsetY}px</span>
                          </div>
                          <input
                            type="range"
                            min="-500"
                            max="500"
                            step="1"
                            value={settings.cloneStampOffsetY}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, cloneStampOffsetY: parseInt(e.target.value) }))
                            }
                            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Clear Mask Button */}
                        <button
                          onClick={() => {
                            if (removalMaskCtxRef.current && removalMaskCanvasRef.current) {
                              removalMaskCtxRef.current.clearRect(
                                0,
                                0,
                                removalMaskCanvasRef.current.width,
                                removalMaskCanvasRef.current.height
                              );
                            }
                          }}
                          className="mt-2 text-xs flex items-center justify-center gap-1.5 py-2 px-3 rounded-sm border border-rose-950 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 hover:border-rose-800 transition-all cursor-pointer font-medium active:scale-97"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear Paint Mask
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'poi' && (
              <>
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
              </>
            )}

            {activeTab === 'trails' && (
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
              </>
            )}

            {activeTab === 'camera' && (
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
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        exposure: 0,
                        contrast: 0,
                        saturation: 0,
                        temperature: 0,
                        tint: 0
                      }))}
                      className="text-[10px] text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-750 px-2 py-1 rounded transition-all"
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
                        onDoubleClick={() => setSettings(prev => ({ ...prev, exposure: 0 }))}
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
                        onDoubleClick={() => setSettings(prev => ({ ...prev, contrast: 0 }))}
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
                        onDoubleClick={() => setSettings(prev => ({ ...prev, saturation: 0 }))}
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
                        onDoubleClick={() => setSettings(prev => ({ ...prev, temperature: 0 }))}
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
                        onDoubleClick={() => setSettings(prev => ({ ...prev, tint: 0 }))}
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
              </>
            )}

            {activeTab === 'trails' && (
              <>
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
            )}

            {activeTab === 'camera' && (
              <>
                {/* Universal settings */}
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
                      <span className="text-neutral-200 font-mono shrink-0 text-right">{(settings.bgLearningRate * 100).toFixed(0)}%</span>
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
                            // Restart camera to apply audio track setting change
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
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
