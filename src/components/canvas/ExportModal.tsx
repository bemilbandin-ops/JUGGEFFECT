import React from 'react';
import { Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrackingSettings } from '../../types';

export interface ExportModalProps {
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
  supportedMimeTypes: { label: string; mimeType: string; ext: string }[];
  setExportConfigured: (configured: boolean) => void;
  startRecording: () => void;
}

export default function ExportModal({
  showExportModal,
  setShowExportModal,
  settings,
  setSettings,
  supportedMimeTypes,
  setExportConfigured,
  startRecording,
}: ExportModalProps) {
  return (
    <AnimatePresence>
      {showExportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-5 shadow-2xl font-sans"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-neutral-200">
                  Configure Export Quality
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex flex-col gap-4 font-sans">
              {/* Export Framerate */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-medium">Export Framerate</span>
                  <span className="text-[10px] text-neutral-500">60 FPS is smoother; 30 FPS has higher compatibility.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[30, 60].map((fpsVal) => (
                    <button
                      key={fpsVal}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, exportFps: fpsVal as 30 | 60 }))}
                      className={`py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                        settings.exportFps === fpsVal
                          ? 'bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-500/10'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-750'
                      }`}
                    >
                      {fpsVal} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Quality / Bitrate */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-medium">Export Quality (Bitrate)</span>
                  <span className="text-[10px] text-neutral-500">Higher bitrates prevent pixelation in high motion.</span>
                </div>
                <select
                  value={settings.exportQuality}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      exportQuality: e.target.value as 'standard' | 'medium' | 'high' | 'ultra',
                    }))
                  }
                  className="w-full bg-neutral-855 text-xs text-neutral-200 border border-neutral-700 px-3 py-2.5 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-all font-sans"
                >
                  <option value="ultra">Ultra (30 Mbps - Lossless/Huge)</option>
                  <option value="high">High (15 Mbps - Premium/Clear)</option>
                  <option value="medium">Medium (8 Mbps - Balanced)</option>
                  <option value="standard">Standard (4 Mbps - Compact)</option>
                </select>
              </div>

              {/* Container & Codec format */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-medium">Container & Codec</span>
                  <span className="text-[10px] text-neutral-500">Detected formats supported by your browser.</span>
                </div>
                {supportedMimeTypes.length > 0 ? (
                  <select
                    value={settings.exportMimeType}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, exportMimeType: e.target.value }))
                    }
                    className="w-full bg-neutral-855 text-xs text-neutral-200 border border-neutral-700 px-3 py-2.5 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-all font-sans"
                  >
                    {supportedMimeTypes.map((t) => (
                      <option key={t.mimeType} value={t.mimeType}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[10px] text-red-400 font-medium bg-red-950/20 border border-red-900/50 p-2 rounded">
                    No supported recording codecs detected.
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-neutral-800 pt-4 mt-1 font-sans">
              <button
                onClick={() => {
                  setExportConfigured(true);
                  setShowExportModal(false);
                }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 py-2 rounded-lg font-medium text-xs transition-all active:scale-[0.98]"
              >
                Save Settings
              </button>
              <button
                onClick={() => {
                  setExportConfigured(true);
                  setShowExportModal(false);
                  setTimeout(() => startRecording(), 100);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium text-xs transition-all active:scale-[0.98] shadow-lg shadow-blue-500/10"
              >
                Apply & Start
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
