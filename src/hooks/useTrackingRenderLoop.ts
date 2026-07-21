import React, { useRef, useEffect, useState } from 'react';
import { TrackingSettings } from '../types';
import { DEFAULT_TRACKING_SETTINGS } from '../config/settingsDefaults';
import { getTunerSettings, getSettingColor, getAdjustmentMatrix } from '../config/tunerConfigs';
import { useVideoRecorder } from './useVideoRecorder';
import { useVideoMediaController } from './useVideoMediaController';
import { useCanvasPointer } from './useCanvasPointer';
import { executeRenderLoopStep } from '../engine/renderLoopEngine';
import { PovProjectionState, PovTrailEntry } from '../utils/pov';
import { updatePoiPattern } from '../utils/poiPatternGenerator';

export function useTrackingRenderLoop() {
  // Element Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tracking state refs (to avoid React state overhead at 60fps)
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgDataRef = useRef<Float32Array | null>(null);
  const motionMaskDataRef = useRef<ImageData | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const povCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurredVideoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskedBlurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const driftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strobeVideoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clone stamp refs
  const removalMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const removalMaskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stampedVideoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cloneDestCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const featheredMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clonedLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pixel Poi refs
  const poiPatternCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poiPatternDataRef = useRef<ImageData | null>(null);
  const poiCustomImageElementRef = useRef<HTMLImageElement | null>(null);
  const poiColumnIndexRef = useRef<number>(0);
  const poiTrailBufferRef = useRef<Map<number, PovTrailEntry[]>>(new Map());
  const poiAccumulatedDistRef = useRef<Map<number, number>>(new Map());
  const poiProjectionStateRef = useRef<Map<number, PovProjectionState>>(new Map());
  const lastSettingsStrRef = useRef<string>('');
  const trackedPointsRef = useRef<
    { id: number; x: number; y: number; prevX?: number; prevY?: number; angle: number; length: number; envelopeFrame: number; lastSeen: number }[]
  >([]);
  const nextTrackedIdRef = useRef<number>(1);

  // Render timing refs
  const frameCountAbsRef = useRef<number>(0);
  const colorCycleAngleRef = useRef<number>(0);
  const lastStrobeTimeRef = useRef<number>(0);

  // FPS & Viewport React state
  const [fps, setFps] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [activeTunerKey, setActiveTunerKey] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<TrackingSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('juggeffect_tracking_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_TRACKING_SETTINGS, ...parsed };
        } catch (e) {
          console.error('Failed to parse saved settings:', e);
        }
      }
    }
    return DEFAULT_TRACKING_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('juggeffect_tracking_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [settings]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    poiPatternDataRef.current = null;
    if (settings.poiCustomImage) {
      const img = new Image();
      img.onload = () => {
        poiCustomImageElementRef.current = img;
        if (poiPatternCanvasRef.current) {
          updatePoiPattern(poiPatternCanvasRef.current, settings, img);
        }
      };
      img.src = settings.poiCustomImage;
    } else {
      poiCustomImageElementRef.current = null;
      if (poiPatternCanvasRef.current) {
        updatePoiPattern(poiPatternCanvasRef.current, settings, null);
      }
    }
  }, [settings.poiCustomImage, settings.poiPatternType, settings.poiText, settings.poiTextColor]);

  const [originalSettings, setOriginalSettings] = useState<TrackingSettings | null>(null);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'presets' | 'trails' | 'poi' | 'camera' | 'paint'>('presets');

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Composition: Video Recorder Sub-Hook
  const {
    isRecording,
    recordingSeconds,
    recordedVideoUrl,
    setRecordedVideoUrl,
    recordedExt,
    recordedSize,
    supportedMimeTypes,
    showExportModal,
    setShowExportModal,
    exportConfigured,
    setExportConfigured,
    startRecording,
    stopRecording,
  } = useVideoRecorder({
    displayCanvasRef,
    settings,
    setSettings,
  });

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Composition: Canvas Pointer Sub-Hook
  const {
    isPaintingRef,
    hoverPosRef,
    isHoveringRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  } = useCanvasPointer({
    displayCanvasRef,
    removalMaskCtxRef,
    settings,
  });

  // Composition: Video Media Controller Sub-Hook
  const {
    cameraActive,
    cameraLoading,
    isPaused,
    currentTime,
    duration,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    videoSourceMode,
    setVideoSourceMode,
    videoFileUrl,
    isDemoSelected,
    isFullscreen,
    isDragging,
    handleFileSelected,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    loadDemoVideo,
    handleDurationChange,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleSeeked,
    handleScrubChange,
    handleScrubStart,
    handleScrubEnd,
    handleTogglePlay,
    handleClearTrails,
    startCamera,
    stopCamera,
    toggleFullscreen,
  } = useVideoMediaController({
    videoRef,
    containerRef,
    streamRef,
    animationFrameIdRef,
    bgDataRef,
    motionMaskDataRef,
    trailCanvasRef,
    povCanvasRef,
    trackedPointsRef,
    poiTrailBufferRef,
    poiProjectionStateRef,
    poiAccumulatedDistRef,
    settings,
    setFps,
    setRecordedVideoUrl,
    startRenderLoop,
  });

  const applyPreset = (presetId: string, presetSettings: Partial<TrackingSettings>) => {
    setSettings((prev) => {
      let base = originalSettings;
      if (!base) {
        base = prev;
        setOriginalSettings(prev);
      }
      return {
        ...base,
        ...presetSettings,
      };
    });
    setAppliedPresetId(presetId);
  };

  const resetToOriginalSettings = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setOriginalSettings(null);
      setAppliedPresetId(null);
    }
  };

  const resetToFactoryDefaults = () => {
    if (
      window.confirm('Are you sure you want to reset all settings to defaults? This will clear your custom tweaks.')
    ) {
      setSettings(DEFAULT_TRACKING_SETTINGS);
      setOriginalSettings(null);
      setAppliedPresetId(null);
      try {
        localStorage.removeItem('juggeffect_tracking_settings');
      } catch (e) {
        console.error('Failed to clear settings from localStorage:', e);
      }
    }
  };

  const getSettingDisplayName = (key: string, val: any): string => {
    switch (key) {
      case 'enableTrails': return val ? 'Trails: On' : 'Trails: Off';
      case 'motionThreshold': return `Sensitivity: ${Math.round(135 - val)}%`;
      case 'enableLightTracking': return val ? 'Light Filter: On' : 'Light Filter: Off';
      case 'lightThreshold': return `Min Brightness: ${val}`;
      case 'echoFadeRate': return `Trail Length: ${Math.round((1 - val) * 100)}%`;
      case 'bgLearningRate': return `Adaptation Speed: ${Math.round(val * 100)}%`;
      case 'blurAmount': return `Glow: ${val}px`;
      case 'hueRotate': return `Hue Shift: ${val}°`;
      case 'colorCycleSpeed': return val === 0 ? '' : `Color Cycle Speed: ${val}`;
      case 'strobeRate': return val === 0 ? 'Strobe: Off' : `Strobe: ${val}s`;
      case 'strobeMode': return `Strobe Style: ${val}`;
      case 'feedbackZoom': return val === 1.0 ? 'Tunnel Zoom: Off' : `Tunnel Zoom: ${Math.round(val * 100)}%`;
      case 'verticalDrift': return val === 0 ? '' : `Vertical Drift: ${val}px`;
      case 'horizontalDrift': return val === 0 ? '' : `Horizontal Drift: ${val}px`;
      case 'motionBlur': return val === 0 ? 'Motion Blur: Off' : `Motion Blur: ${Math.round(val * 100)}%`;
      case 'lineSmoothness': return val === 0 ? 'Smoothing: Off' : `Smoothing: ${val}px`;
      case 'exposure': return `Exposure: ${val > 0 ? '+' : ''}${val}%`;
      case 'contrast': return `Contrast: ${val > 0 ? '+' : ''}${val}%`;
      case 'saturation': return `Saturation: ${val > 0 ? '+' : ''}${val}%`;
      case 'temperature': return `Warmth: ${val > 0 ? '+' : ''}${val}%`;
      case 'tint': return `Tint: ${val > 0 ? '+' : ''}${val}%`;
      default: return `${key}: ${val}`;
    }
  };

  function startRenderLoop() {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      executeRenderLoopStep({
        video,
        canvas,
        ctx,
        settingsRef,
        animationFrameIdRef,
        lastTimeRef,
        frameCountRef,
        setFps,
        bgDataRef,
        motionMaskDataRef,
        smoothingCanvasRef,
        maskedBlurCanvasRef,
        driftCanvasRef,
        poiPatternCanvasRef,
        poiPatternDataRef,
        poiCustomImageElementRef,
        isPaintingRef,
        hoverPosRef,
        isHoveringRef,
        trackedPointsRef,
        nextTrackedIdRef,
        povCanvasRef,
        lastSettingsStrRef,
        poiColumnIndexRef,
        poiTrailBufferRef,
        poiProjectionStateRef,
        poiAccumulatedDistRef,
        activeTabRef,
        isRecordingRef,
        stampedVideoCanvasRef,
        removalMaskCanvasRef,
        removalMaskCtxRef,
        cloneDestCanvasRef,
        featheredMaskCanvasRef,
        clonedLayerCanvasRef,
        processingCanvasRef,
        trailCanvasRef,
        blurredVideoCanvasRef,
        strobeVideoCanvasRef,
        frameCountAbsRef,
        colorCycleAngleRef,
        lastStrobeTimeRef,
        render,
      });
    };

    render();
  }

  const tunerSettings = getTunerSettings(settings, setSettings);

  return {
    videoRef,
    displayCanvasRef,
    containerRef,
    removalMaskCanvasRef,
    removalMaskCtxRef,
    cameraActive,
    cameraLoading,
    isPaused,
    currentTime,
    duration,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    videoSourceMode,
    setVideoSourceMode,
    videoFileUrl,
    isDemoSelected,
    fps,
    isFullscreen,
    isSidebarOpen,
    setIsSidebarOpen,
    activeTunerKey,
    setActiveTunerKey,
    settings,
    setSettings,
    originalSettings,
    appliedPresetId,
    activeTab,
    setActiveTab,
    isRecording,
    recordingSeconds,
    recordedVideoUrl,
    setRecordedVideoUrl,
    recordedExt,
    recordedSize,
    supportedMimeTypes,
    isDragging,
    showExportModal,
    setShowExportModal,
    exportConfigured,
    setExportConfigured,
    tunerSettings,
    getSettingColor: (key: string) => getSettingColor(key, settings),
    getAdjustmentMatrix: () => getAdjustmentMatrix(settings),
    getSettingDisplayName,
    applyPreset,
    resetToOriginalSettings,
    resetToFactoryDefaults,
    handleFileSelected,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    loadDemoVideo,
    handleDurationChange,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleSeeked,
    handleScrubChange,
    handleScrubStart,
    handleScrubEnd,
    handleTogglePlay,
    handleClearTrails,
    startCamera,
    stopCamera,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    startRecording,
    stopRecording,
    toggleFullscreen,
  };
}
