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
  ChevronDown,
  ChevronUp,
  Key,
  AlertCircle,
  Check,
} from 'lucide-react';
import { TrackingSettings } from '../../types';
import { QUICK_PRESETS } from '../../config/settingsDefaults';
import { GeminiResponse } from '../../utils/gemini';

export interface PresetsTabProps {
  settings: TrackingSettings;
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
}

export default function PresetsTab({
  settings,
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
}: PresetsTabProps) {
  return (
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
                  <span
                    className={`font-semibold transition-colors ${
                      isApplied ? 'text-blue-400' : 'text-neutral-200 group-hover:text-white'
                    }`}
                  >
                    {preset.name}
                  </span>
                  {preset.id === 'led' && (
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        isApplied
                          ? 'text-amber-400'
                          : 'text-amber-500/50 group-hover:text-amber-400'
                      }`}
                    />
                  )}
                  {preset.id === 'cyberpunk' && (
                    <Sparkles
                      className={`w-3.5 h-3.5 ${
                        isApplied ? 'text-pink-400' : 'text-pink-500/50 group-hover:text-pink-400'
                      }`}
                    />
                  )}
                  {preset.id === 'smoke' && (
                    <Wind
                      className={`w-3.5 h-3.5 ${
                        isApplied ? 'text-teal-400' : 'text-teal-500/50 group-hover:text-teal-400'
                      }`}
                    />
                  )}
                  {preset.id === 'strobe' && (
                    <Activity
                      className={`w-3.5 h-3.5 ${
                        isApplied ? 'text-cyan-400' : 'text-cyan-500/50 group-hover:text-cyan-400'
                      }`}
                    />
                  )}
                  {preset.id === 'vortex' && (
                    <InfinityIcon
                      className={`w-3.5 h-3.5 ${
                        isApplied
                          ? 'text-indigo-400'
                          : 'text-indigo-500/50 group-hover:text-indigo-400'
                      }`}
                    />
                  )}
                  {preset.id === 'cascade' && (
                    <Moon
                      className={`w-3.5 h-3.5 ${
                        isApplied
                          ? 'text-purple-400'
                          : 'text-purple-500/50 group-hover:text-purple-400'
                      }`}
                    />
                  )}
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

      {/* Gemini AI Auto-Tuner Collapsible Section */}
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
          {geminiCollapsed ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          )}
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
                            <span
                              key={i}
                              className="text-[9px] bg-neutral-950 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-neutral-800"
                            >
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
                            <span
                              key={i}
                              className="text-[9px] bg-neutral-950 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-neutral-800"
                            >
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
  );
}
