import React from 'react';
import {
  Camera,
  Play,
  Pause,
  RotateCcw,
  Square,
  Sliders,
  Maximize2,
  Minimize2,
  Eye,
} from 'lucide-react';
import { TrackingSettings } from '../types';
import { formatTime } from '../utils/time';

export interface CanvasHudProps {
  cameraActive: boolean;
  isSidebarOpen: boolean;
  fps: number;
  settings: TrackingSettings;
  supportedMimeTypes: { label: string; mimeType: string; ext: string }[];
  isFullscreen: boolean;
  videoSourceMode: 'camera' | 'file';
  isPaused: boolean;
  currentTime: number;
  duration: number;
  isRecording: boolean;
  recordingSeconds: number;
  exportConfigured: boolean;
  onToggleSidebar: () => void;
  onToggleFullscreen: () => void;
  onStopCamera: () => void;
  onTogglePlay: () => void;
  onScrubChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onClearTrails: () => void;
  onStopRecording: () => void;
  onShowExportModal: (show: boolean) => void;
  onStartRecording: () => void;
}

export default function CanvasHud({
  cameraActive,
  isSidebarOpen,
  fps,
  settings,
  supportedMimeTypes,
  isFullscreen,
  videoSourceMode,
  isPaused,
  currentTime,
  duration,
  isRecording,
  recordingSeconds,
  exportConfigured,
  onToggleSidebar,
  onToggleFullscreen,
  onStopCamera,
  onTogglePlay,
  onScrubChange,
  onScrubStart,
  onScrubEnd,
  onClearTrails,
  onStopRecording,
  onShowExportModal,
  onStartRecording,
}: CanvasHudProps) {
  if (!cameraActive) return null;

  return (
    <>
      {/* Top status bar */}
      <div className={`absolute top-14 left-4 right-4 flex items-center justify-between pointer-events-none z-20 transition-all duration-300 ${isSidebarOpen ? 'lg:pr-[340px]' : ''}`}>
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 flex items-center gap-2 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-medium text-neutral-300">LIVE</span>
            <span className="text-xs text-neutral-500">|</span>
            <span className="text-xs font-mono text-blue-400">{fps} FPS</span>
          </div>

          {/* Active Export Settings HUD */}
          <div className="bg-neutral-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-neutral-800/80 flex flex-col gap-1 text-[9px] font-mono text-neutral-400 w-fit">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Format: <span className="text-neutral-200 uppercase">{settings.exportMimeType ? (supportedMimeTypes.find(t => t.mimeType === settings.exportMimeType)?.ext || 'webm') : 'webm'}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>FPS: <span className="text-neutral-200">{settings.exportFps} FPS</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Quality: <span className="text-neutral-200 capitalize">{settings.exportQuality} ({settings.exportQuality === 'ultra' ? '30M' : settings.exportQuality === 'high' ? '15M' : settings.exportQuality === 'medium' ? '8M' : '4M'}bps)</span></span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          {/* Settings toggle */}
          <button
            onClick={onToggleSidebar}
            className={`border p-2 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
              isSidebarOpen 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
            title={isSidebarOpen ? 'Hide Settings' : 'Show Settings'}
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Settings</span>
          </button>

          {/* Full screen toggle */}
          <button
            onClick={onToggleFullscreen}
            className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-900 text-neutral-300 p-2 rounded-lg transition-all active:scale-95 cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onStopCamera}
            className="bg-rose-500/20 backdrop-blur-md border border-rose-500/30 hover:bg-rose-500 text-rose-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </button>
        </div>
      </div>

      {/* Playback Control Bar */}
      {videoSourceMode === 'file' && cameraActive && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-2xl bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-lg p-3 flex flex-col gap-2 pointer-events-auto shadow-2xl z-20">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 cursor-pointer flex items-center justify-center shrink-0 bg-neutral-800/50 border border-neutral-750"
              title={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current text-blue-400" /> : <Pause className="w-4 h-4 fill-current text-blue-400" />}
            </button>

            {/* Time Display */}
            <span className="text-[11px] font-mono text-neutral-400 select-none shrink-0 min-w-[85px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Progress Slider (Scrubber) */}
            <input
              type="range"
              min={0}
              max={duration && !isNaN(duration) && duration > 0 ? duration : 100}
              step={0.01}
              value={currentTime}
              onChange={onScrubChange}
              onMouseDown={onScrubStart}
              onTouchStart={onScrubStart}
              onMouseUp={onScrubEnd}
              onTouchEnd={onScrubEnd}
              style={{
                background: duration > 0
                  ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%, #262626 ${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%, #262626 100%)`
                  : '#262626'
              }}
              className="flex-1 accent-blue-500 h-2 rounded-lg appearance-none cursor-pointer border border-neutral-800 transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110"
            />

            {/* Clear Trails Button */}
            <button
              onClick={onClearTrails}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2.5 py-1 rounded text-[11px] font-medium transition-all active:scale-95 border border-neutral-750 flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Clear existing trails"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trails</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom control bar (Recording controls) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-900 px-4 py-2 rounded border border-neutral-800 pointer-events-auto shadow-2xl z-20">
        {isRecording ? (
          <button
            onClick={onStopRecording}
            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all"
          >
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span>Stop ({formatTime(recordingSeconds)})</span>
          </button>
        ) : !exportConfigured ? (
          <button
            onClick={() => onShowExportModal(true)}
            className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white active:scale-95 py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all border border-amber-500/30"
            title="Configure Export Settings"
          >
            <Sliders className="w-3.5 h-3.5 font-sans" />
            <span className="font-sans">Configure Export Quality First</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onStartRecording}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10 font-sans"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Record Overlay</span>
            </button>
            <button
              onClick={() => onShowExportModal(true)}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 p-1.5 rounded-full border border-neutral-750 active:scale-95 transition-all"
              title="Adjust Export Quality Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {settings.showDebugFeed && (
          <div className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Debug Mask
          </div>
        )}
      </div>
    </>
  );
}
