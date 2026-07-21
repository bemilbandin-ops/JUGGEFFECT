import React, { useRef, useEffect, useState } from 'react';
import {
  Waves,
  Activity,
  Sparkles,
  Sliders,
  Maximize2,
  Camera,
} from 'lucide-react';
import { TrackingSettings } from '../types';
import { DEFAULT_TRACKING_SETTINGS } from '../config/settingsDefaults';
import { extractMotion } from '../engine/motionExtractor';
import { analyzeScene, getGeminiClient, GeminiResponse } from '../utils/gemini';
import { PovProjectionState, PovTrailEntry } from '../utils/pov';
import { updatePoiPattern } from '../utils/poiPatternGenerator';
import { drawCloneStampPreview } from '../engine/cloneStampOverlay';
import { drawRadialCenterGuide } from '../engine/radialCenterGuide';
import { getCameraFilterString, getTrackingFilterString } from '../engine/cameraFilters';
import { drawDebugOverlay, updateFpsCounter } from '../engine/debugOverlay';
import { prepareCloneStampBaseCanvases } from '../engine/cloneStampCanvasPrep';
import { compositeCloneStamp } from '../engine/cloneStampCompositor';
import { renderViewportFrame } from '../engine/viewportRenderer';
import { ensureCanvasBuffers } from '../engine/canvasBufferManager';
import { renderPausedFrame } from '../engine/pausedFrameRenderer';
import { processMotionBlur } from '../engine/motionBlurProcessor';
import { processTrails } from '../engine/trailProcessor';
import { scheduleNextFrame } from '../engine/frameScheduler';

export function useTrackingRenderLoop() {
  // Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tracking state refs (to avoid react state update overhead at 60fps)
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

  // Paint interaction refs
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPaintingRef = useRef<boolean>(false);
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const isHoveringRef = useRef<boolean>(false);

  // Pixel Poi refs
  const poiPatternCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poiPatternDataRef = useRef<ImageData | null>(null);
  const poiCustomImageElementRef = useRef<HTMLImageElement | null>(null);
  const poiColumnIndexRef = useRef<number>(0);
  const poiTrailBufferRef = useRef<Map<number, PovTrailEntry[]>>(new Map());
  const poiAccumulatedDistRef = useRef<Map<number, number>>(new Map());
  const poiProjectionStateRef = useRef<Map<number, PovProjectionState>>(new Map());
  const lastSettingsStrRef = useRef<string>('');
  const trackedPointsRef = useRef<{ id: number; x: number; y: number; prevX?: number; prevY?: number; angle: number; length: number; envelopeFrame: number; lastSeen: number }[]>([]);
  const nextTrackedIdRef = useRef<number>(1);

  // React-controlled state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [videoSourceMode, setVideoSourceMode] = useState<'camera' | 'file'>('camera');
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [isDemoSelected, setIsDemoSelected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [activeTunerKey, setActiveTunerKey] = useState<string | null>(null);
  
  // Settings state
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

  // Gemini State
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [geminiActive, setGeminiActive] = useState<boolean>(() => !!getGeminiClient());
  const [isGeminiAnalyzing, setIsGeminiAnalyzing] = useState<boolean>(false);
  const [geminiAnalysisResult, setGeminiAnalysisResult] = useState<GeminiResponse | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [appliedOption, setAppliedOption] = useState<'A' | 'B' | null>(null);
  const [originalSettings, setOriginalSettings] = useState<TrackingSettings | null>(null);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [geminiCollapsed, setGeminiCollapsed] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'presets' | 'trails' | 'poi' | 'camera' | 'paint'>('presets');

  const hasEnvApiKey = !!(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY);

  const handleSaveApiKey = (key: string) => {
    const trimmed = key.trim();
    localStorage.setItem('gemini_api_key', trimmed);
    setApiKeyInput(trimmed);
    setGeminiActive(!!trimmed);
    if (!trimmed) {
      localStorage.removeItem('gemini_api_key');
    }
  };

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const maxDimension = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.80);
  };

  const runGeminiAnalysis = async () => {
    setIsGeminiAnalyzing(true);
    setGeminiError(null);
    setGeminiAnalysisResult(null);
    setAppliedOption(null);
    setOriginalSettings(null);

    try {
      const dataUrl = captureFrame();
      if (!dataUrl) {
        throw new Error('Please start the camera or a video file first to capture a frame.');
      }

      const client = getGeminiClient(apiKeyInput);
      if (!client) {
        throw new Error('Please configure a Gemini API key first.');
      }

      const result = await analyzeScene(dataUrl, apiKeyInput);
      setGeminiAnalysisResult(result);
    } catch (err: any) {
      console.error('Gemini Scene Analysis Error:', err);
      setGeminiError(err.message || 'An unknown error occurred during analysis.');
    } finally {
      setIsGeminiAnalyzing(false);
    }
  };

  const applyRecommendedSettings = (recSettings: Partial<TrackingSettings>, option: 'A' | 'B') => {
    setSettings((prev) => {
      let base = originalSettings;
      if (!base) {
        base = prev;
        setOriginalSettings(prev);
      }
      return {
        ...base,
        ...recSettings,
      };
    });
    setAppliedOption(option);
    setAppliedPresetId(null);
  };

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
    setAppliedOption(null);
  };

  const resetToOriginalSettings = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setOriginalSettings(null);
      setAppliedOption(null);
      setAppliedPresetId(null);
    }
  };

  const resetToFactoryDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This will clear your custom tweaks.')) {
      setSettings(DEFAULT_TRACKING_SETTINGS);
      setOriginalSettings(null);
      setAppliedOption(null);
      setAppliedPresetId(null);
      try {
        localStorage.removeItem('juggeffect_tracking_settings');
      } catch (e) {
        console.error('Failed to clear settings from localStorage:', e);
      }
    }
  };

  const getAdjustmentMatrix = () => {
    const t = settings.temperature / 100;
    const p = settings.tint / 100;

    const r_scale = 1 + t * 0.15 + p * 0.08;
    const g_scale = 1 + t * 0.05 - p * 0.15;
    const b_scale = 1 - t * 0.15 + p * 0.08;

    return `${r_scale} 0 0 0 0 0 ${g_scale} 0 0 0 0 0 ${b_scale} 0 0 0 0 0 1 0`;
  };

  const getSettingDisplayName = (key: string, val: any): string => {
    switch (key) {
      case 'enableTrails': return val ? 'Trails: On' : 'Trails: Off';
      case 'motionThreshold': return `Sensitivity: ${Math.round((135 - val))}%`;
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

  // Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedExt, setRecordedExt] = useState<string>('webm');
  const [recordedSize, setRecordedSize] = useState<number>(0);
  const [supportedMimeTypes, setSupportedMimeTypes] = useState<{ label: string; mimeType: string; ext: string }[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportConfigured, setExportConfigured] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const candidates = [
      { label: 'WebM (VP9) - Ultra Quality', mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { label: 'WebM (H.264) - High Compatibility', mimeType: 'video/webm;codecs=h264,opus', ext: 'webm' },
      { label: 'WebM (VP8)', mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { label: 'MP4 (H.264) - Apple/Standard', mimeType: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
      { label: 'MP4 (AAC)', mimeType: 'video/mp4', ext: 'mp4' },
      { label: 'Matroska (MKV)', mimeType: 'video/x-matroska;codecs=avc1', ext: 'mkv' },
      { label: 'WebM (Default)', mimeType: 'video/webm', ext: 'webm' }
    ];
    const supported = candidates.filter(candidate => {
      try {
        return MediaRecorder.isTypeSupported(candidate.mimeType);
      } catch (e) {
        return false;
      }
    });
    setSupportedMimeTypes(supported);
    if (supported.length > 0) {
      setSettings(prev => ({
        ...prev,
        exportMimeType: prev.exportMimeType || supported[0].mimeType
      }));
    }
  }, []);

  useEffect(() => {
    async function getDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        const devicesList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devicesList.filter((device) => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.error('Error fetching video devices:', err);
      }
    }
    getDevices();

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setVideoFileUrl(url);
      setIsDemoSelected(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setVideoFileUrl(url);
        setVideoSourceMode('file');
        setIsDemoSelected(false);
        if (cameraActive) stopCamera();
      }
    }
  }

  function loadDemoVideo() {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const videoUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}juggling-demo.mp4`;
    setVideoFileUrl(videoUrl);
    setIsDemoSelected(true);
  }

  const handleDurationChange = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration || 0);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!isScrubbingRef.current) {
      setCurrentTime(e.currentTarget.currentTime || 0);
    }
  };

  const handlePlay = () => {
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleSeeked = () => {
    bgDataRef.current = null;
    motionMaskDataRef.current = null;
    if (trailCanvasRef.current) {
      const tCtx = trailCanvasRef.current.getContext('2d');
      if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
    }
    trackedPointsRef.current = [];
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleScrubStart = () => {
    isScrubbingRef.current = true;
  };

  const handleScrubEnd = () => {
    isScrubbingRef.current = false;
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(err => {
        if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
          return;
        }
        console.error('Play error:', err);
      });
    } else {
      videoRef.current.pause();
    }
  };

  const handleClearTrails = () => {
    bgDataRef.current = null;
    motionMaskDataRef.current = null;
    if (trailCanvasRef.current) {
      const tCtx = trailCanvasRef.current.getContext('2d');
      if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
    }
    if (povCanvasRef.current) {
      const pCtx = povCanvasRef.current.getContext('2d');
      if (pCtx) pCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
    }
    trackedPointsRef.current = [];
    poiTrailBufferRef.current.clear();
    poiProjectionStateRef.current.clear();
    poiAccumulatedDistRef.current.clear();
  };

  async function startCamera() {
    setCameraLoading(true);
    stopCamera();
    setRecordedVideoUrl(null);

    try {
      if (videoSourceMode === 'camera') {
        if (!selectedDeviceId) {
          setCameraLoading(false);
          return;
        }
        const constraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60 },
          },
          audio: settings.enableAudioSync,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.removeAttribute('src');
          videoRef.current.srcObject = stream;
          videoRef.current.loop = false;
          setupVideoPlayback();
        }
      } else {
        if (!videoFileUrl) {
          setCameraLoading(false);
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = videoFileUrl;
          videoRef.current.loop = true;
          videoRef.current.load();
          setupVideoPlayback();
        }
      }
    } catch (err) {
      console.error('Error opening video source:', err);
      alert('Unable to access video source. Please check permissions and files.');
    } finally {
      setCameraLoading(false);
    }
  }

  function setupVideoPlayback() {
    if (!videoRef.current) return;
    
    videoRef.current.onloadedmetadata = () => {
      bgDataRef.current = null;
      motionMaskDataRef.current = null;
      if (trailCanvasRef.current) {
        const tCtx = trailCanvasRef.current.getContext('2d');
        if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
      }
      if (povCanvasRef.current) {
        const pCtx = povCanvasRef.current.getContext('2d');
        if (pCtx) pCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
      }
      startRenderLoop();
    };

    videoRef.current.play().then(() => {
      setCameraActive(true);
      if (videoRef.current!.videoWidth > 0 && !animationFrameIdRef.current) {
         videoRef.current!.onloadedmetadata = null;
         bgDataRef.current = null;
         motionMaskDataRef.current = null;
         if (trailCanvasRef.current) {
           const tCtx = trailCanvasRef.current.getContext('2d');
           if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
         }
         if (povCanvasRef.current) {
           const pCtx = povCanvasRef.current.getContext('2d');
           if (pCtx) pCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
         }
         startRenderLoop();
      }
    }).catch(err => {
      if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
        return;
      }
      console.error('Video play error:', err);
      alert('Video play error: ' + err.message);
    });
  }

  function stopCamera() {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }

    setCameraActive(false);
    setFps(0);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
  }

  function getCanvasMousePos(canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect();
    const elementWidth = rect.width;
    const elementHeight = rect.height;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const elementRatio = elementWidth / elementHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > elementRatio) {
      const renderHeight = elementWidth / canvasRatio;
      scaleX = canvasWidth / elementWidth;
      scaleY = canvasHeight / renderHeight;
      offsetY = (elementHeight - renderHeight) / 2;
    } else {
      const renderWidth = elementHeight * canvasRatio;
      scaleX = canvasWidth / renderWidth;
      scaleY = canvasHeight / elementHeight;
      offsetX = (elementWidth - renderWidth) / 2;
    }

    const x = (e.clientX - rect.left - offsetX) * scaleX;
    const y = (e.clientY - rect.top - offsetY) * scaleY;

    return { x, y };
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!settings.cloneStampEnabled && !settings.enablePoiMode) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    isPaintingRef.current = true;
    
    const pos = getCanvasMousePos(e.currentTarget, e);
    lastPosRef.current = pos;
    
    if (settings.cloneStampEnabled) {
      const maskCtx = removalMaskCtxRef.current;
      if (maskCtx) {
        maskCtx.beginPath();
        maskCtx.arc(pos.x, pos.y, settings.cloneStampBrushSize / 2, 0, Math.PI * 2);
        maskCtx.fillStyle = 'white';
        maskCtx.fill();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    isHoveringRef.current = true;
    const pos = getCanvasMousePos(canvas, e);
    hoverPosRef.current = pos;
    
    if (!isPaintingRef.current) return;
    
    if (settings.cloneStampEnabled) {
      const maskCtx = removalMaskCtxRef.current;
      const lastPos = lastPosRef.current;
      if (maskCtx && lastPos) {
        maskCtx.beginPath();
        maskCtx.moveTo(lastPos.x, lastPos.y);
        maskCtx.lineTo(pos.x, pos.y);
        maskCtx.strokeStyle = 'white';
        maskCtx.lineWidth = settings.cloneStampBrushSize;
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        maskCtx.stroke();
      }
    }
    lastPosRef.current = pos;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!settings.cloneStampEnabled && !settings.enablePoiMode) return;
    isPaintingRef.current = false;
    lastPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerLeave = () => {
    isHoveringRef.current = false;
    hoverPosRef.current = null;
  };

  const frameCountAbsRef = useRef<number>(0);
  const colorCycleAngleRef = useRef<number>(0);
  const lastStrobeTimeRef = useRef<number>(0);

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
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        scheduleNextFrame(animationFrameIdRef, render);
        return;
      }

      const now = performance.now();
      const currentSettings = settingsRef.current;
      const cameraFilter = getCameraFilterString(currentSettings);
      const trackingFilter = getTrackingFilterString(currentSettings);

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const w = canvas.width;
      const h = canvas.height;

      const {
        stampedVideoCanvas,
        stampedVideoCtx,
        removalMaskCanvas,
      } = prepareCloneStampBaseCanvases(
        stampedVideoCanvasRef,
        removalMaskCanvasRef,
        removalMaskCtxRef,
        video.videoWidth,
        video.videoHeight
      );

      const buffers = ensureCanvasBuffers({
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        cameraFilter,
        stampedVideoCanvas,
        processingCanvasRef,
        trailCanvasRef,
        blurredVideoCanvasRef,
        strobeVideoCanvasRef,
        povCanvasRef,
      });

      if (!buffers) {
        scheduleNextFrame(animationFrameIdRef, render);
        return;
      }

      const {
        procCanvas,
        procCtx,
        trailCanvas,
        trailCtx,
        blurredVideoCanvas,
        blurredVideoCtx,
        strobeVideoCanvas,
        strobeVideoCtx,
      } = buffers;

      if (video.paused || video.ended) {
        renderPausedFrame({
          video,
          stampedVideoCanvas,
          stampedVideoCtx,
          removalMaskCanvas,
          currentSettings,
          cloneDestCanvasRef,
          featheredMaskCanvasRef,
          clonedLayerCanvasRef,
          ctx,
          cameraFilter,
          w,
          h,
          trailCanvasRef,
          processingCanvasRef,
          isHoveringRef,
          hoverPosRef,
          activeTabRef,
          isRecordingRef,
          animationFrameIdRef,
          render,
        });
        return;
      }

      compositeCloneStamp({
        video,
        stampedVideoCanvas,
        stampedVideoCtx,
        removalMaskCanvas,
        currentSettings,
        cloneDestCanvasRef,
        featheredMaskCanvasRef,
        clonedLayerCanvasRef,
      });

      const { isStrobeActive, isStrobeTriggered, nextLastStrobeTime } = renderViewportFrame({
        ctx,
        stampedVideoCanvas,
        strobeVideoCanvas,
        strobeVideoCtx,
        cameraFilter,
        currentSettings,
        now,
        lastStrobeTime: lastStrobeTimeRef.current,
        w,
        h,
      });
      lastStrobeTimeRef.current = nextLastStrobeTime;

      extractMotion({
        stampedVideoCanvas,
        procCanvas,
        procCtx,
        trackingFilter,
        bgDataRef,
        motionMaskDataRef,
        smoothingCanvasRef,
        currentSettings,
      });

      processMotionBlur({
        currentSettings,
        blurredVideoCtx,
        cameraFilter,
        stampedVideoCanvas,
        blurredVideoCanvas,
        maskedBlurCanvasRef,
        video,
        procCanvas,
        ctx,
        w,
        h,
      });

      processTrails({
        currentSettings,
        isStrobeTriggered,
        now,
        w,
        h,
        ctx,
        trailCanvas,
        trailCtx,
        procCanvas,
        frameCountAbsRef,
        colorCycleAngleRef,
        driftCanvasRef,
        poiPatternCanvasRef,
        poiPatternDataRef,
        poiCustomImageElementRef,
        motionMaskDataRef,
        isPaintingRef,
        hoverPosRef,
        trackedPointsRef,
        nextTrackedIdRef,
        povCanvasRef,
        lastSettingsStrRef,
        poiColumnIndexRef,
        poiTrailBufferRef,
        poiProjectionStateRef,
        poiAccumulatedDistRef,
      });

      drawDebugOverlay(ctx, procCanvas, w, h, currentSettings.showDebugFeed);

      const fpsResult = updateFpsCounter(now, lastTimeRef.current, frameCountRef.current, setFps);
      lastTimeRef.current = fpsResult.nextLastTime;
      frameCountRef.current = fpsResult.nextFrameCount;

      if (currentSettings.cloneStampEnabled && isHoveringRef.current && hoverPosRef.current && ctx) {
        drawCloneStampPreview(
          ctx,
          hoverPosRef.current.x,
          hoverPosRef.current.y,
          currentSettings.cloneStampBrushSize,
          currentSettings.cloneStampOffsetX,
          currentSettings.cloneStampOffsetY
        );
      }

      if (currentSettings.enablePoiMode && 
          currentSettings.poiOrientation === 'radial' && 
          activeTabRef.current === 'poi' && 
          !isRecordingRef.current && 
          ctx) {
        drawRadialCenterGuide(
          ctx,
          currentSettings.poiCenterRelativeX * w,
          currentSettings.poiCenterRelativeY * h
        );
      }

      scheduleNextFrame(animationFrameIdRef, render);
    };

    render();
  }

  async function startRecording() {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    setRecordedVideoUrl(null);
    setRecordingSeconds(0);
    recordedChunksRef.current = [];

    const targetFps = settings.exportFps || 30;
    const stream = canvas.captureStream(targetFps);

    if (settings.enableAudioSync) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach((track) => {
          stream.addTrack(track);
        });
      } catch (err) {
        console.warn('Audio capture failed or permission denied:', err);
      }
    }

    const bitrates = {
      ultra: 30000000,
      high: 15000000,
      medium: 8000000,
      standard: 4000000,
    };
    const targetBitrate = bitrates[settings.exportQuality] || 15000000;
    const selectedMime = settings.exportMimeType || 'video/webm';

    const options = {
      mimeType: selectedMime,
      videoBitsPerSecond: targetBitrate,
    };

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      try {
        recorder = new MediaRecorder(stream, { mimeType: selectedMime });
      } catch (e2) {
        recorder = new MediaRecorder(stream);
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || selectedMime;
      
      let ext = 'webm';
      if (mimeType.includes('mp4')) {
        ext = 'mp4';
      } else if (mimeType.includes('matroska') || mimeType.includes('mkv')) {
        ext = 'mkv';
      }
      
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setRecordedExt(ext);
      setRecordedSize(blob.size);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error('Fullscreen failed:', err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }

  const tunerSettings = [
    {
      key: 'echoFadeRate',
      name: 'Trail Length',
      icon: Waves,
      min: 0,
      max: 100,
      step: 1,
      getValue: () => Math.round((1 - settings.echoFadeRate) * 100),
      setValue: (val: number) => setSettings(prev => ({ ...prev, echoFadeRate: 1 - (val / 100) })),
      format: (val: number) => val === 0 ? '0% (Off)' : val === 100 ? 'Infinite' : `${val}% retention`
    },
    {
      key: 'motionThreshold',
      name: 'Sensitivity',
      icon: Activity,
      min: 15,
      max: 120,
      step: 1,
      getValue: () => 135 - settings.motionThreshold,
      setValue: (val: number) => setSettings(prev => ({ ...prev, motionThreshold: 135 - val })),
      format: (val: number) => `${val}%`
    },
    {
      key: 'blurAmount',
      name: 'Trail Glow',
      icon: Sparkles,
      min: 0,
      max: 20,
      step: 1,
      getValue: () => settings.blurAmount,
      setValue: (val: number) => setSettings(prev => ({ ...prev, blurAmount: val })),
      format: (val: number) => `${val}px`
    },
    {
      key: 'hueRotate',
      name: 'Hue Shift',
      icon: Sliders,
      min: 0,
      max: 360,
      step: 1,
      getValue: () => settings.hueRotate,
      setValue: (val: number) => setSettings(prev => ({ ...prev, hueRotate: val })),
      format: (val: number) => `${val}°`
    },
    {
      key: 'feedbackZoom',
      name: 'Feedback Zoom',
      icon: Maximize2,
      min: 0.95,
      max: 1.10,
      step: 0.005,
      getValue: () => settings.feedbackZoom,
      setValue: (val: number) => setSettings(prev => ({ ...prev, feedbackZoom: val })),
      format: (val: number) => val === 1.0 ? '100% (Off)' : `${((val - 1) * 100).toFixed(1)}%`
    },
    {
      key: 'strobeRate',
      name: 'Strobe Rate',
      icon: Camera,
      min: 0,
      max: 2.0,
      step: 0.05,
      getValue: () => settings.strobeRate,
      setValue: (val: number) => setSettings(prev => ({ ...prev, strobeRate: val })),
      format: (val: number) => val === 0 ? 'Off' : `Every ${val.toFixed(2)}s`
    }
  ];

  const getSettingColor = (key: string) => {
    switch (key) {
      case 'echoFadeRate': {
        const p = 1 - settings.echoFadeRate;
        if (p < 0.05) return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
        return 'text-cyan-400 bg-cyan-950/20 border-cyan-800/60 shadow-[0_0_12px_rgba(34,211,238,0.25)]';
      }
      case 'motionThreshold': {
        const val = 135 - settings.motionThreshold;
        const p = (val - 15) / 105;
        if (p < 0.1) return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-805/60 shadow-[0_0_12px_rgba(52,211,153,0.25)]';
      }
      case 'blurAmount': {
        const p = settings.blurAmount / 20;
        if (p < 0.05) return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
        return 'text-purple-400 bg-purple-950/20 border-purple-800/60 shadow-[0_0_12px_rgba(192,132,252,0.25)]';
      }
      case 'hueRotate': {
        if (settings.hueRotate === 0) return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
        return 'bg-neutral-950/40 border-neutral-700/60 shadow-[0_0_12px_rgba(255,255,255,0.15)]';
      }
      case 'feedbackZoom': {
        const p = Math.abs(settings.feedbackZoom - 1.0) / 0.1;
        if (p < 0.05) return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
        return 'text-amber-400 bg-amber-950/20 border-amber-800/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]';
      }
      case 'strobeRate': {
        if (settings.strobeRate === 0) return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
        return 'text-rose-400 bg-rose-950/20 border-rose-800/60 shadow-[0_0_12px_rgba(251,113,133,0.25)]';
      }
      default:
        return 'text-neutral-500 bg-neutral-900/50 border-neutral-800';
    }
  };

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
    apiKeyInput,
    setApiKeyInput,
    geminiActive,
    isGeminiAnalyzing,
    geminiAnalysisResult,
    geminiError,
    appliedOption,
    originalSettings,
    appliedPresetId,
    geminiCollapsed,
    setGeminiCollapsed,
    activeTab,
    setActiveTab,
    hasEnvApiKey,
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
    getSettingColor,
    getAdjustmentMatrix,
    getSettingDisplayName,
    handleSaveApiKey,
    runGeminiAnalysis,
    applyRecommendedSettings,
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
