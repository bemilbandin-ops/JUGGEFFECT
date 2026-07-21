import React from 'react';
import { Camera, Play } from 'lucide-react';

export interface VideoSourceSetupProps {
  isDragging: boolean;
  videoSourceMode: 'camera' | 'file';
  setVideoSourceMode: (mode: 'camera' | 'file') => void;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  cameraLoading: boolean;
  startCamera: () => void;
  loadDemoVideo: () => void;
  isDemoSelected: boolean;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  videoFileUrl: string | null;
}

export default function VideoSourceSetup({
  isDragging,
  videoSourceMode,
  setVideoSourceMode,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  cameraLoading,
  startCamera,
  loadDemoVideo,
  isDemoSelected,
  handleFileSelected,
  videoFileUrl,
}: VideoSourceSetupProps) {
  return (
    <div
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center p-8 text-center w-[400px] max-w-[90vw] gap-4 backdrop-blur-xl shadow-2xl rounded transition-all duration-200 border ${
        isDragging ? 'bg-blue-900/40 border-blue-500 scale-105' : 'bg-neutral-900/95 border-neutral-800'
      }`}
    >
      <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center text-blue-400 border border-neutral-700/50">
        {videoSourceMode === 'camera' ? (
          <Camera className="w-8 h-8 animate-pulse" />
        ) : (
          <Play className="w-8 h-8 animate-pulse ml-1" />
        )}
      </div>
      <div>
        <h3 className="font-sans font-semibold text-lg text-neutral-200">
          Ready to Start Juggling
        </h3>
        <p className="text-sm text-neutral-400 mt-1">
          Connect your webcam or upload a video to unlock trailing and trajectory mapping.
        </p>
      </div>

      <div className="w-full flex bg-neutral-950 p-1 rounded-sm border border-neutral-800 mt-2">
        <button
          onClick={() => setVideoSourceMode('camera')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            videoSourceMode === 'camera'
              ? 'bg-blue-500/10 text-blue-400 border border-neutral-700/50 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
          }`}
        >
          Live Camera
        </button>
        <button
          onClick={() => setVideoSourceMode('file')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            videoSourceMode === 'file'
              ? 'bg-blue-500/10 text-blue-400 border border-neutral-700/50 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
          }`}
        >
          Upload Video
        </button>
      </div>

      {videoSourceMode === 'camera' ? (
        devices.length > 0 ? (
          <div className="w-full flex flex-col gap-2">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-neutral-800 text-sm text-neutral-200 border border-neutral-700 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-all"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${devices.indexOf(device) + 1}`}
                </option>
              ))}
            </select>

            <button
              onClick={startCamera}
              disabled={cameraLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all py-2.5 px-4 rounded-lg font-sans font-medium text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50"
            >
              {cameraLoading ? 'Starting Stream...' : 'Initialize Camera'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-rose-400 font-mono">
            No video devices detected. Please verify your camera is connected.
          </p>
        )
      ) : (
        <div className="w-full flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-lg">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Quick Test</span>
            <button
              onClick={loadDemoVideo}
              className={`w-full py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 border ${
                isDemoSelected 
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/5' 
                  : 'bg-neutral-800/60 text-neutral-300 border-neutral-700/50 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {isDemoSelected ? 'Demo Video Selected' : 'Load Demo Juggling Video'}
            </button>
          </div>

          <div className="relative flex py-1 items-center justify-center">
            <div className="flex-grow border-t border-neutral-800/60"></div>
            <span className="flex-shrink mx-3 text-[10px] text-neutral-500 font-mono tracking-widest">OR</span>
            <div className="flex-grow border-t border-neutral-800/60"></div>
          </div>

          <div className="flex flex-col gap-1.5 p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-lg">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Upload Your Own</span>
            <input 
              type="file" 
              accept="video/*" 
              onChange={handleFileSelected} 
              className="w-full text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 hover:file:text-white file:cursor-pointer cursor-pointer"
            />
          </div>

          <button
            onClick={startCamera}
            disabled={cameraLoading || !videoFileUrl}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all py-2.5 px-4 rounded-lg font-sans font-medium text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50 mt-1"
          >
            {cameraLoading ? 'Starting Video...' : 'Play Video'}
          </button>
        </div>
      )}
    </div>
  );
}
