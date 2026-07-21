import React, { useRef, useEffect, useState, MouseEvent } from 'react';
import {
  Camera,
  Play,
  Pause,
  RotateCcw,
  Square,
  Download,
  Maximize2,
  Minimize2,
  Trash2,
  Pipette,
  Paintbrush,
  Check,
  Eye,
  Sliders,
  Sparkles,
  Info,
  ChevronRight,
  Activity,
  Award,
  Waves,
  X,
  Key,
  AlertCircle,
  Zap,
  Wind,
  ChevronDown,
  ChevronUp,
  Infinity,
  Moon,
  Sun,
  Contrast,
  Thermometer,
  Palette,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HSV, TrackingSettings } from '../types';
import { DEFAULT_TRACKING_SETTINGS, QUICK_PRESETS } from '../config/settingsDefaults';
import { extractMotion } from '../engine/motionExtractor';
import { analyzeScene, getGeminiClient, GeminiResponse } from '../utils/gemini';
import {
  createPovProjectionState,
  samplePovColumns,
  matchTrackedPoints,
  calculateLedStripGeometry,
  PovProjectionState,
  PovTrailEntry,
  PovSample,
} from '../utils/pov';
import { detectBlobs, BlobPoint, BlobCluster } from '../utils/blobDetection';
import { formatTime } from '../utils/time';
import { drawLedColumn, drawFullPattern } from '../utils/ledShaders';
import { updatePoiPattern } from '../utils/poiPatternGenerator';
import { drawCloneStampPreview } from '../engine/cloneStampOverlay';
import { drawRadialCenterGuide } from '../engine/radialCenterGuide';
import { evaluateStrobeTrigger } from '../engine/strobeEvaluator';
import { getCameraFilterString, getTrackingFilterString } from '../engine/cameraFilters';
import { drawDebugOverlay, updateFpsCounter } from '../engine/debugOverlay';
import { prepareCloneStampBaseCanvases } from '../engine/cloneStampCanvasPrep';
import { renderPausedFrame } from '../engine/pausedFrameRenderer';
import VariantSelector from './VariantSelector';
import CanvasHud from './CanvasHud';
import SettingsDrawer from './SettingsDrawer';


export default function TrackingCanvas() {
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
  // POV trail buffer: stores painted column snapshots per tracked point
  // Each entry: { id: trackingId, x, y, angle, colIdx, length, timestamp }
  const poiTrailBufferRef = useRef<Map<number, PovTrailEntry[]>>(new Map());
  // Track accumulated distance per tracked point (for per-pixel-distance column advancement)
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
          // Merge with DEFAULT_TRACKING_SETTINGS to ensure any newly added setting fields exist
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

    // Standardize and downscale resolution for AI analysis (max 640px on the longest side)
    // This dramatically reduces upload times and inference latency for high-res cameras/videos.
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
      console.log('Captured image payload size:', Math.round(dataUrl.length / 1024), 'KB');

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
    setAppliedPresetId(null); // Clear preset selection if AI is used
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
    setAppliedOption(null); // Clear Gemini option applied state
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
    const t = settings.temperature / 100; // -1 to 1
    const p = settings.tint / 100;        // -1 to 1

    // Warmth (Temperature): warmer = more red/green, less blue; cooler = less red/green, more blue
    // Tint: magenta = more red/blue, less green; green = less red/blue, more green
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

  // Detect browser supported video codecs
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

  // Initialize and list camera devices
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
        // stop dummy stream if created
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.error('Error fetching video devices:', err);
      }
    }
    getDevices();

    // Clean up on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // Update full screen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Timer for video recording
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
          console.log('Playback interrupted/aborted');
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

  // Start Camera Feed or Video File
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
    
    // Start processing once video is playing and loaded
    videoRef.current.onloadedmetadata = () => {
      // Reset background model and buffers on camera start
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
      // In case metadata is already loaded (can happen with local files on re-play)
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
      // Ignore AbortError / interrupted by pause calls as they are standard browser behavior during source/mode switching
      if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
        console.log('Video playback interrupted (expected during source/mode switching).');
        return;
      }
      console.error('Video play error:', err);
      alert('Video play error: ' + err.message);
    });
  }

  // Stop Camera Feed and loop
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

  // Helper to map client mouse/touch positions to internal canvas dimensions (handles object-contain scaling)
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
      // Canvas is wider than element (letterboxed top/bottom)
      const renderHeight = elementWidth / canvasRatio;
      scaleX = canvasWidth / elementWidth;
      scaleY = canvasHeight / renderHeight;
      offsetY = (elementHeight - renderHeight) / 2;
    } else {
      // Canvas is taller than element (pillarboxed left/right)
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

  // High-performance CV processing and canvas rendering
  function startRenderLoop() {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (!video || !canvas) return;

    // Create / configure the low-resolution hidden processing canvas
    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement('canvas');
    }
    const procCanvas = processingCanvasRef.current;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    
    // Create / configure the persistent trail canvas for Echo effect
    if (!trailCanvasRef.current) {
      trailCanvasRef.current = document.createElement('canvas');
    }
    const trailCanvas = trailCanvasRef.current;
    const trailCtx = trailCanvas.getContext('2d');

    if (!blurredVideoCanvasRef.current) {
      blurredVideoCanvasRef.current = document.createElement('canvas');
    }
    const blurredVideoCanvas = blurredVideoCanvasRef.current;
    const blurredVideoCtx = blurredVideoCanvas.getContext('2d');

    // Set processing resolution (standard 640x480 for flow props)
    procCanvas.width = 640;
    procCanvas.height = 480;

    const ctx = canvas.getContext('2d');
    if (!ctx || !procCtx || !trailCtx || !blurredVideoCtx) return;

    const render = () => {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const now = performance.now();
      const currentSettings = settingsRef.current;
      const cameraFilter = getCameraFilterString(currentSettings);
      const trackingFilter = getTrackingFilterString(currentSettings);

      // Match display canvas size to video aspect ratio dynamically
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Initialize and resize clone stamp base canvas & removal mask canvas (Phase 2)
      const {
        stampedVideoCanvas,
        stampedVideoCtx,
        removalMaskCanvas,
        removalMaskCtx,
      } = prepareCloneStampBaseCanvases(
        stampedVideoCanvasRef,
        removalMaskCanvasRef,
        removalMaskCtxRef,
        video.videoWidth,
        video.videoHeight
      );

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

      // Draw original video frame and apply Clone Stamp if enabled
      if (stampedVideoCtx) {
        stampedVideoCtx.drawImage(video, 0, 0, stampedVideoCanvas.width, stampedVideoCanvas.height);
        
        if (currentSettings.cloneStampEnabled) {
          const wVideo = stampedVideoCanvas.width;
          const hVideo = stampedVideoCanvas.height;
          
          if (!cloneDestCanvasRef.current) {
            cloneDestCanvasRef.current = document.createElement('canvas');
          }
          const cloneDestCanvas = cloneDestCanvasRef.current;
          const cloneDestCtx = cloneDestCanvas.getContext('2d');
          if (cloneDestCanvas.width !== wVideo || cloneDestCanvas.height !== hVideo) {
            cloneDestCanvas.width = wVideo;
            cloneDestCanvas.height = hVideo;
          }
          
          if (cloneDestCtx) {
            cloneDestCtx.clearRect(0, 0, wVideo, hVideo);
            cloneDestCtx.drawImage(stampedVideoCanvas, -currentSettings.cloneStampOffsetX, -currentSettings.cloneStampOffsetY);
            
            if (!featheredMaskCanvasRef.current) {
              featheredMaskCanvasRef.current = document.createElement('canvas');
            }
            const featheredMaskCanvas = featheredMaskCanvasRef.current;
            const featheredMaskCtx = featheredMaskCanvas.getContext('2d');
            if (featheredMaskCanvas.width !== wVideo || featheredMaskCanvas.height !== hVideo) {
              featheredMaskCanvas.width = wVideo;
              featheredMaskCanvas.height = hVideo;
            }
            
            if (featheredMaskCtx) {
              featheredMaskCtx.clearRect(0, 0, wVideo, hVideo);
              if (currentSettings.cloneStampFeather > 0) {
                featheredMaskCtx.filter = `blur(${currentSettings.cloneStampFeather}px)`;
              }
              featheredMaskCtx.drawImage(removalMaskCanvas, 0, 0);
              featheredMaskCtx.filter = 'none';
              
              if (!clonedLayerCanvasRef.current) {
                clonedLayerCanvasRef.current = document.createElement('canvas');
              }
              const clonedLayerCanvas = clonedLayerCanvasRef.current;
              const clonedLayerCtx = clonedLayerCanvas.getContext('2d');
              if (clonedLayerCanvas.width !== wVideo || clonedLayerCanvas.height !== hVideo) {
                clonedLayerCanvas.width = wVideo;
                clonedLayerCanvas.height = hVideo;
              }
              
              if (clonedLayerCtx) {
                clonedLayerCtx.clearRect(0, 0, wVideo, hVideo);
                clonedLayerCtx.drawImage(cloneDestCanvas, 0, 0);
                clonedLayerCtx.globalCompositeOperation = 'destination-in';
                clonedLayerCtx.drawImage(featheredMaskCanvas, 0, 0);
                clonedLayerCtx.globalCompositeOperation = 'source-over';
                
                stampedVideoCtx.drawImage(clonedLayerCanvas, 0, 0);
              }
            }
          }
        }
      }

      if (trailCanvas.width !== video.videoWidth || trailCanvas.height !== video.videoHeight) {
        trailCanvas.width = video.videoWidth;
        trailCanvas.height = video.videoHeight;
      }
      if (!povCanvasRef.current) {
        povCanvasRef.current = document.createElement('canvas');
      }
      const povCanvas = povCanvasRef.current;
      if (povCanvas.width !== video.videoWidth || povCanvas.height !== video.videoHeight) {
        povCanvas.width = video.videoWidth;
        povCanvas.height = video.videoHeight;
      }
      if (blurredVideoCanvas.width !== video.videoWidth || blurredVideoCanvas.height !== video.videoHeight) {
        blurredVideoCanvas.width = video.videoWidth;
        blurredVideoCanvas.height = video.videoHeight;
        blurredVideoCtx.filter = cameraFilter;
        blurredVideoCtx.drawImage(stampedVideoCanvas, 0, 0, video.videoWidth, video.videoHeight); // seed it
        blurredVideoCtx.filter = 'none';
      }

      if (!strobeVideoCanvasRef.current) {
        strobeVideoCanvasRef.current = document.createElement('canvas');
      }
      const strobeVideoCanvas = strobeVideoCanvasRef.current;
      const strobeVideoCtx = strobeVideoCanvas.getContext('2d');
      if (strobeVideoCanvas.width !== video.videoWidth || strobeVideoCanvas.height !== video.videoHeight) {
        strobeVideoCanvas.width = video.videoWidth;
        strobeVideoCanvas.height = video.videoHeight;
        if (strobeVideoCtx) {
          strobeVideoCtx.filter = cameraFilter;
          strobeVideoCtx.drawImage(stampedVideoCanvas, 0, 0, video.videoWidth, video.videoHeight); // seed it
          strobeVideoCtx.filter = 'none';
        }
      }

      const { isStrobeActive, isStrobeTriggered, nextLastStrobeTime } = evaluateStrobeTrigger(
        currentSettings.strobeRate,
        now,
        lastStrobeTimeRef.current
      );
      lastStrobeTimeRef.current = nextLastStrobeTime;

      if (isStrobeActive && isStrobeTriggered && strobeVideoCtx) {
        strobeVideoCtx.filter = cameraFilter;
        strobeVideoCtx.drawImage(stampedVideoCanvas, 0, 0, video.videoWidth, video.videoHeight);
        strobeVideoCtx.filter = 'none';
      }

      // 2. Draw raw video frame to display canvas
      if (!isStrobeActive) {
        ctx.filter = cameraFilter;
        ctx.drawImage(stampedVideoCanvas, 0, 0, w, h);
        ctx.filter = 'none';
      } else {
        if (currentSettings.strobeMode === 'flash') {
          const flashDuration = 40; // flash duration in ms
          if (now - lastStrobeTimeRef.current <= flashDuration) {
            ctx.drawImage(strobeVideoCanvas, 0, 0, w, h);
          } else {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
          }
        } else {
          ctx.drawImage(strobeVideoCanvas, 0, 0, w, h);
        }
      }

      // 3. Process frame for tracking (Phase 5)
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

      // 4. Temporal Motion Blur (Only applied to moving objects)
      if (currentSettings.motionBlur > 0) {
        // Accumulate video frames inside the blur canvas
        blurredVideoCtx.filter = cameraFilter;
        blurredVideoCtx.globalAlpha = 1.0 - currentSettings.motionBlur;
        blurredVideoCtx.drawImage(stampedVideoCanvas, 0, 0, blurredVideoCanvas.width, blurredVideoCanvas.height);
        blurredVideoCtx.globalAlpha = 1.0;
        blurredVideoCtx.filter = 'none';

        if (!maskedBlurCanvasRef.current) {
          maskedBlurCanvasRef.current = document.createElement('canvas');
        }
        const maskedBlurCanvas = maskedBlurCanvasRef.current;
        const maskedBlurCtx = maskedBlurCanvas.getContext('2d');

        if (maskedBlurCanvas.width !== video.videoWidth || maskedBlurCanvas.height !== video.videoHeight) {
          maskedBlurCanvas.width = video.videoWidth;
          maskedBlurCanvas.height = video.videoHeight;
        }

        if (maskedBlurCtx) {
          // Clear temp canvas
          maskedBlurCtx.clearRect(0, 0, maskedBlurCanvas.width, maskedBlurCanvas.height);
          
          // Draw the low-res motion mask (stretched to full size)
          maskedBlurCtx.drawImage(procCanvas, 0, 0, maskedBlurCanvas.width, maskedBlurCanvas.height);
          
          // Mask the accumulated blurred video frame
          maskedBlurCtx.globalCompositeOperation = 'source-in';
          maskedBlurCtx.drawImage(blurredVideoCanvas, 0, 0);
          maskedBlurCtx.globalCompositeOperation = 'source-over';
          
          // Draw only the blurred motion area on top of the sharp video
          ctx.drawImage(maskedBlurCanvas, 0, 0, w, h);
        }
      } else {
        // Keep it seeded so it doesn't blink black if turned on
        blurredVideoCtx.filter = cameraFilter;
        blurredVideoCtx.drawImage(stampedVideoCanvas, 0, 0, blurredVideoCanvas.width, blurredVideoCanvas.height);
        blurredVideoCtx.filter = 'none';
      }

      // Effect: Trail processing and rendering
      const shouldProcessTrails = currentSettings.enableTrails;
      const usePov = currentSettings.poiPovEnabled;

      if (shouldProcessTrails) {
        // Effect: Color Cycle updates continuously for smooth hue rotation
        frameCountAbsRef.current++;
        colorCycleAngleRef.current = (colorCycleAngleRef.current + currentSettings.colorCycleSpeed) % 360;

        if (isStrobeTriggered) {
          // 1. Effect: Feedback Zoom and Smoke Drift (only on strobe trigger to avoid smearing and rapid vanishing)
          if (currentSettings.verticalDrift !== 0 || currentSettings.horizontalDrift !== 0 || currentSettings.feedbackZoom !== 1.0) {
            if (!driftCanvasRef.current) {
              driftCanvasRef.current = document.createElement('canvas');
            }
            const tempCanvas = driftCanvasRef.current;
            if (tempCanvas.width !== trailCanvas.width || tempCanvas.height !== trailCanvas.height) {
              tempCanvas.width = trailCanvas.width;
              tempCanvas.height = trailCanvas.height;
            }
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
              tempCtx.drawImage(trailCanvas, 0, 0);
              trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
              
              trailCtx.save();
              // Center for scaling
              trailCtx.translate(trailCanvas.width / 2, trailCanvas.height / 2);
              trailCtx.scale(currentSettings.feedbackZoom, currentSettings.feedbackZoom);
              trailCtx.translate(-trailCanvas.width / 2, -trailCanvas.height / 2);
              
              // Apply drift
              trailCtx.drawImage(tempCanvas, currentSettings.horizontalDrift, currentSettings.verticalDrift);
              trailCtx.restore();
            }
          }

          // 2. Apply fade (only on strobe trigger to preserve trail persistence across intervals)
          const fadeRate = currentSettings.echoFadeRate;
          trailCtx.globalCompositeOperation = 'destination-out';
          trailCtx.fillStyle = `rgba(0, 0, 0, ${fadeRate})`;
          trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);

          // 3. Stroboscopic rendering: Draw new motion mask snapshot onto the trail canvas
          trailCtx.globalCompositeOperation = 'source-over';
          
          const filters = [];
          if (currentSettings.blurAmount > 0) {
            filters.push(`blur(${currentSettings.blurAmount}px)`);
          }
          
          const totalHueShift = (currentSettings.hueRotate + colorCycleAngleRef.current) % 360;
          if (totalHueShift > 0) {
            filters.push(`hue-rotate(${totalHueShift}deg)`);
          }
          
          trailCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';
          
          if (currentSettings.enablePoiMode) {
            const patternCanvas = poiPatternCanvasRef.current || (poiPatternCanvasRef.current = document.createElement('canvas'));
            if (!poiPatternDataRef.current) {
              updatePoiPattern(patternCanvas, currentSettings, poiCustomImageElementRef.current);
              const pCtx = patternCanvas.getContext('2d');
              if (pCtx && patternCanvas.width > 0 && patternCanvas.height > 0) {
                poiPatternDataRef.current = pCtx.getImageData(0, 0, patternCanvas.width, patternCanvas.height);
              }
            }

            if (patternCanvas) {
              const rawBlobs = detectBlobs(motionMaskDataRef.current!, currentSettings.poiMaxPoints);
               const scaleX = trailCanvas.width / procCanvas.width;
              const scaleY = trailCanvas.height / procCanvas.height;
              const currentBlobs = rawBlobs.map(b => ({
                x: b.x * scaleX,
                y: b.y * scaleY,
                angle: b.angle,
                length: b.length,
                aspectRatio: b.aspectRatio
              }));

              if (isPaintingRef.current && hoverPosRef.current) {
                const mouseScaleX = trailCanvas.width / w;
                const mouseScaleY = trailCanvas.height / h;
                const mX = hoverPosRef.current.x * mouseScaleX;
                const mY = hoverPosRef.current.y * mouseScaleY;
                const closeToExisting = currentBlobs.some(b => Math.hypot(b.x - mX, b.y - mY) < 15);
                if (!closeToExisting) {
                  currentBlobs.push({
                    x: mX,
                    y: mY,
                    angle: 0,
                    length: 100,
                    aspectRatio: 2.0
                  });
                }
              }

              const maxMatchDistance = 100;
              trackedPointsRef.current = matchTrackedPoints(
                currentBlobs,
                trackedPointsRef.current,
                maxMatchDistance,
                now,
                () => nextTrackedIdRef.current++
              );

              const patternWidth = patternCanvas.width;
              const patternHeight = patternCanvas.height;
              const imgData = poiPatternDataRef.current;

              if (imgData && imgData.width > 0 && imgData.height > 0 && patternWidth > 0) {
                const povCanvas = povCanvasRef.current;
                const povCtx = povCanvas ? povCanvas.getContext('2d') : null;

                // Clear canvas immediately if key settings change
                const settingsStr = `${currentSettings.poiPatternType}-${currentSettings.poiWidth}-${currentSettings.poiOrientation}-${currentSettings.poiGlowEnabled}-${currentSettings.poiGlowRadius}`;
                if (lastSettingsStrRef.current !== settingsStr) {
                  lastSettingsStrRef.current = settingsStr;
                  if (povCtx && povCanvas) {
                    povCtx.clearRect(0, 0, povCanvas.width, povCanvas.height);
                  }
                }

                const povRetention = currentSettings.poiPovRetention || 400;
                const povFadeMode = currentSettings.poiPovFadeMode || 'exponential';
                const columnSpacing = currentSettings.poiPovColumnSpacing || 3;
                const motionMode = currentSettings.poiPovMotionMode || 'free';
                const glowEnabled = currentSettings.poiGlowEnabled;
                const glowRadius = currentSettings.poiGlowRadius || 6;
                const glowIntensity = currentSettings.poiGlowIntensity || 0.5;
                const ledCountOverride = currentSettings.poiLedCount || 0;

                // Advance global column index
                poiColumnIndexRef.current = (poiColumnIndexRef.current + currentSettings.poiSpeedMultiplier) % patternWidth;

                // 1. Process active tracked points to update trail buffers
                for (const tp of trackedPointsRef.current) {
                  if (tp.lastSeen !== now) continue;

                  // Frame skip interval
                  const frameInterval = currentSettings.poiFrameInterval || 1;
                  if (tp.envelopeFrame % frameInterval !== 0) continue;

                  // Envelope opacity (existing ADSR logic)
                  const T_in = currentSettings.poiFadeInTime || 0;
                  const T_hold = currentSettings.poiHoldTime || 0;
                  const T_out = currentSettings.poiFadeOutTime || 0;
                  const T_wait = currentSettings.poiWaitTime || 0;
                  const T_total = T_in + T_hold + T_out + T_wait;

                  let envelopeFactor = 1.0;
                  if (T_total > 0) {
                    const frameInCycle = tp.envelopeFrame % T_total;
                    if (frameInCycle < T_in) {
                      envelopeFactor = T_in > 0 ? frameInCycle / T_in : 1.0;
                    }
                    else if (frameInCycle < T_in + T_hold) {
                      envelopeFactor = 1.0;
                    }
                    else if (frameInCycle < T_in + T_hold + T_out) {
                      const progress = frameInCycle - (T_in + T_hold);
                      envelopeFactor = T_out > 0 ? 1.0 - (progress / T_out) : 0.0;
                    }
                    else {
                      envelopeFactor = 0.0;
                    }
                  }

                  const baseOpacity = currentSettings.poiOpacity !== undefined ? currentSettings.poiOpacity : 1.0;
                  const finalOpacity = baseOpacity * envelopeFactor;

                  if (finalOpacity <= 0.01) {
                    continue;
                  }

                  const L = currentSettings.poiHeight;
                  const W = currentSettings.poiWidth;
                  const orientation = currentSettings.poiOrientation;
                  const finalL = L > 0 ? L : tp.length;

                  // === Determine column index ===
                  let colIdx = 0;
                  const mappingMode = currentSettings.poiMappingMode || 'time';
                  if (mappingMode === 'time') {
                    colIdx = Math.floor(poiColumnIndexRef.current) % patternWidth;
                  } else if (mappingMode === 'angle') {
                    const normalizedAngle = (tp.angle + Math.PI) / (Math.PI * 2);
                    colIdx = Math.floor(normalizedAngle * patternWidth) % patternWidth;
                    if (colIdx < 0) colIdx += patternWidth;
                  } else if (mappingMode === 'spatial') {
                    const spatialScale = 0.5;
                    colIdx = Math.floor(tp.x * spatialScale) % patternWidth;
                    if (colIdx < 0) colIdx += patternWidth;
                  }

                  if (usePov) {
                    // === NEW POV MODE (refactored sampling) ===
                    const trail = poiTrailBufferRef.current.get(tp.id) || [];

                    const samples: PovSample[] = samplePovColumns({
                      id: tp.id,
                      x: tp.x,
                      y: tp.y,
                      prevX: tp.prevX,
                      prevY: tp.prevY,
                      angle: tp.angle,
                      length: finalL,
                      opacity: finalOpacity,
                      timestamp: now,
                      colIdx,
                      motionMode: motionMode as 'circular' | 'free',
                      circularCenter: {
                        x: currentSettings.poiCenterRelativeX * trailCanvas.width,
                        y: currentSettings.poiCenterRelativeY * trailCanvas.height,
                      },
                      columnSpacing,
                      patternWidth,
                      projectionState: (
                        poiProjectionStateRef.current.get(tp.id)
                        || createPovProjectionState()
                      ),
                      existingTrail: trail,
                    });

                    if (samples.length > 0) {
                      poiProjectionStateRef.current.set(tp.id, samples[samples.length - 1].state);
                      for (const s of samples) {
                        trail.push({
                          x: s.x,
                          y: s.y,
                          angle: s.angle,
                          colIdx: s.colIdx,
                          length: s.length,
                          opacity: s.opacity,
                          timestamp: s.timestamp,
                        });
                      }
                      poiTrailBufferRef.current.set(tp.id, trail);
                    }

                    while (trail.length > 500) {
                      trail.shift();
                    }
                  } else {
                    // === LEGACY MODE (original single-column painting) ===
                    const renderMode = currentSettings.poiRenderMode || 'dots';
                    const drawLEDs = (
                      drawDot: (y_rel: number, colorStr: string) => void
                    ) => {
                      const numLEDsLegacy = Math.max(5, Math.floor(finalL / 8));
                      const px = colIdx % patternWidth;
                      const data = imgData.data;

                      for (let i = 0; i < numLEDsLegacy; i++) {
                        const y_ratio = numLEDsLegacy > 1 ? i / (numLEDsLegacy - 1) : 0.5;
                        const y_rel = -finalL / 2 + y_ratio * finalL;
                        
                        const py = Math.floor(y_ratio * (patternHeight - 1));
                        const idx = (py * patternWidth + px) * 4;
                        const r = data[idx];
                        const g = data[idx+1];
                        const b = data[idx+2];
                        const a = data[idx+3];

                        if (a > 15) {
                          const colorStr = `rgba(${r}, ${g}, ${b}, ${(a / 255) * finalOpacity})`;
                          drawDot(y_rel, colorStr);
                        }
                      }
                    };

                    trailCtx.save();
                    trailCtx.globalAlpha = finalOpacity;

                    if (orientation === 'vertical') {
                      if (renderMode === 'dots') {
                        drawLEDs((y_rel, colorStr) => {
                          trailCtx.fillStyle = colorStr;
                          trailCtx.beginPath();
                          trailCtx.arc(tp.x, tp.y + y_rel, W / 2, 0, Math.PI * 2);
                          trailCtx.fill();
                        });
                      } else {
                        trailCtx.drawImage(
                          patternCanvas,
                          colIdx, 0, 1, patternCanvas.height,
                          tp.x - W / 2, tp.y - finalL / 2, W, finalL
                        );
                      }
                    }
                    else if (orientation === 'horizontal') {
                      if (renderMode === 'dots') {
                        drawLEDs((y_rel, colorStr) => {
                          trailCtx.fillStyle = colorStr;
                          trailCtx.beginPath();
                          trailCtx.arc(tp.x + y_rel, tp.y, W / 2, 0, Math.PI * 2);
                          trailCtx.fill();
                        });
                      } else {
                        trailCtx.drawImage(
                          patternCanvas,
                          colIdx, 0, 1, patternCanvas.height,
                          tp.x - finalL / 2, tp.y - W / 2, finalL, W
                        );
                      }
                    }
                    else if (orientation === 'motion') {
                      let angle = 0;
                      if (tp.prevX !== undefined && tp.prevY !== undefined) {
                        const dx = tp.x - tp.prevX;
                        const dy = tp.y - tp.prevY;
                        if (Math.hypot(dx, dy) > 2) {
                          angle = Math.atan2(dy, dx) + Math.PI / 2;
                        }
                      }
                      trailCtx.translate(tp.x, tp.y);
                      trailCtx.rotate(angle);
                      if (renderMode === 'dots') {
                        drawLEDs((y_rel, colorStr) => {
                          trailCtx.fillStyle = colorStr;
                          trailCtx.beginPath();
                          trailCtx.arc(0, y_rel, W / 2, 0, Math.PI * 2);
                          trailCtx.fill();
                        });
                      } else {
                        trailCtx.drawImage(
                          patternCanvas,
                          colIdx, 0, 1, patternCanvas.height,
                          -W / 2, -finalL / 2, W, finalL
                        );
                      }
                    }
                    else if (orientation === 'radial') {
                      const cx = currentSettings.poiCenterRelativeX * trailCanvas.width;
                      const cy = currentSettings.poiCenterRelativeY * trailCanvas.height;
                      const angle = Math.atan2(tp.y - cy, tp.x - cx);

                      trailCtx.translate(tp.x, tp.y);
                      trailCtx.rotate(angle);
                      if (renderMode === 'dots') {
                        drawLEDs((y_rel, colorStr) => {
                          trailCtx.fillStyle = colorStr;
                          trailCtx.beginPath();
                          trailCtx.arc(0, y_rel, W / 2, 0, Math.PI * 2);
                          trailCtx.fill();
                        });
                      } else {
                        trailCtx.drawImage(
                          patternCanvas,
                          colIdx, 0, 1, patternCanvas.height,
                          -W / 2, -finalL / 2, W, finalL
                        );
                      }
                    }
                    else if (orientation === 'club') {
                      trailCtx.translate(tp.x, tp.y);
                      trailCtx.rotate(tp.angle);
                      if (renderMode === 'dots') {
                        drawLEDs((y_rel, colorStr) => {
                          trailCtx.fillStyle = colorStr;
                          trailCtx.beginPath();
                          trailCtx.arc(0, y_rel, W / 2, 0, Math.PI * 2);
                          trailCtx.fill();
                        });
                      } else {
                        trailCtx.drawImage(
                          patternCanvas,
                          colIdx, 0, 1, patternCanvas.height,
                          -W / 2, -finalL / 2, W, finalL
                        );
                      }
                    }

                    trailCtx.restore();
                  }
                }

                // 2. Render all visible trails in the buffer (POV mode)
                if (usePov && povCanvasRef.current) {
                  const povCanvas = povCanvasRef.current;
                  const povCtx = povCanvas.getContext('2d');
                  if (povCtx) {
                    povCtx.clearRect(0, 0, povCanvas.width, povCanvas.height);

                    const W = currentSettings.poiWidth;
                    const orientation = currentSettings.poiOrientation;

                    for (const [id, trail] of poiTrailBufferRef.current) {
                      // Evict old entries
                      const cutoff = now - povRetention;
                      while (trail.length > 0 && trail[0].timestamp < cutoff) {
                        trail.shift();
                      }

                      if (trail.length === 0) {
                        poiTrailBufferRef.current.delete(id);
                        poiAccumulatedDistRef.current.delete(id);
                        continue;
                      }

                      const cx = currentSettings.poiCenterRelativeX * povCanvas.width;
                      const cy = currentSettings.poiCenterRelativeY * povCanvas.height;

                      for (const entry of trail) {
                        const age = now - entry.timestamp;
                        let fadeFactor = 1.0;
                        if (povFadeMode === 'linear') {
                          fadeFactor = 1.0 - (age / povRetention);
                        } else if (povFadeMode === 'exponential') {
                          fadeFactor = Math.pow(1.0 - (age / povRetention), 2.5);
                        } else if (povFadeMode === 'sharp') {
                          fadeFactor = age < povRetention * 0.8 ? 1.0 : (1.0 - (age - povRetention * 0.8) / (povRetention * 0.2));
                        }
                        fadeFactor = Math.max(0, Math.min(1, fadeFactor));
                        const entryOpacity = entry.opacity * fadeFactor;
                        if (entryOpacity <= 0.01) continue;

                        const geom = calculateLedStripGeometry(
                          entry.x,
                          entry.y,
                          entry.angle,
                          entry.length,
                          entry.motionAngle,
                          orientation,
                          cx,
                          cy,
                          motionMode as 'circular' | 'free'
                        );

                        povCtx.save();

                        if (geom.isRadialOrCircular) {
                          povCtx.translate(geom.translateX, geom.translateY);
                          povCtx.rotate(geom.rotationAngle);
                          povCtx.translate(0, geom.middleOffset);
                        } else {
                          povCtx.translate(geom.translateX, geom.translateY);
                          povCtx.rotate(geom.rotationAngle);
                        }

                        const numLEDs = ledCountOverride > 0 ? ledCountOverride : Math.max(8, Math.floor(entry.length / 5));

                        drawLedColumn(
                          povCtx, imgData, entry.colIdx, numLEDs, entry.length, W, entryOpacity
                        );

                        povCtx.restore();
                      }
                    }
                  }
                }
              }
            }
          } else {
            trackedPointsRef.current = [];
            trailCtx.drawImage(procCanvas, 0, 0, trailCanvas.width, trailCanvas.height);
          }
          trailCtx.filter = 'none';
        }

        // Determine blend mode (fallback to 'screen' if compositeMode is 'none')
        const blendMode = (currentSettings.compositeMode === 'none' || !currentSettings.compositeMode)
          ? 'screen'
          : currentSettings.compositeMode;

        ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
        ctx.drawImage(trailCanvas, 0, 0, w, h);
        if (usePov && povCanvasRef.current) {
          const povCanvas = povCanvasRef.current;
          const glowEnabled = currentSettings.poiGlowEnabled;
          const glowRadius = currentSettings.poiGlowRadius || 6;
          const glowIntensity = currentSettings.poiGlowIntensity || 0.5;

          // 1. Glow pass
          if (glowEnabled && glowRadius > 0 && glowIntensity > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.filter = `blur(${glowRadius}px)`;
            ctx.globalAlpha = glowIntensity;
            ctx.drawImage(povCanvas, 0, 0, w, h);
            ctx.restore();
          }
          // 2. Core pass
          ctx.save();
          ctx.drawImage(povCanvas, 0, 0, w, h);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      }

      // Draw debug binary mask overlay if enabled
      drawDebugOverlay(ctx, procCanvas, w, h, currentSettings.showDebugFeed);

      // Compute FPS
      const fpsResult = updateFpsCounter(now, lastTimeRef.current, frameCountRef.current, setFps);
      lastTimeRef.current = fpsResult.nextLastTime;
      frameCountRef.current = fpsResult.nextFrameCount;

      // Draw Clone Stamp brush and source offset preview if enabled and hovering
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

      // Draw Center of Rotation radial helper if enabled, in radial mode, the settings tab is active, and not exporting/recording
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

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();
  }

  // Video recording controls
  async function startRecording() {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    setRecordedVideoUrl(null);
    setRecordingSeconds(0);
    recordedChunksRef.current = [];

    // Capture the processed canvas stream at the user's selected frame rate
    const targetFps = settings.exportFps || 30;
    const stream = canvas.captureStream(targetFps);

    // Request audio stream from user mic if enabled
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

    // Initialize media recorder with selected bitrate and codec options
    const bitrates = {
      ultra: 30000000,   // 30 Mbps
      high: 15000000,    // 15 Mbps
      medium: 8000000,   // 8 Mbps
      standard: 4000000, // 4 Mbps
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
      console.warn('Selected encoding parameters not supported, trying mimeType only:', e);
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
      
      // Determine the extension based on recorded mimeType
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

  // Full screen toggle helper
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

  // Tuner settings configurations for the responsive phone quick-slider overlay
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

  // Dynamic visual indicator styling (higher setting = more colorful/glowing, lower/off = grayed out)
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

  return (
    <div 
      className="w-full h-full relative bg-black"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 1. Main Interactive Camera Viewport */}
      
        <div
          ref={containerRef}
          className={`absolute inset-0 z-0 bg-black flex items-center justify-center transition-all duration-300 ${
            isFullscreen ? 'fixed inset-0 z-50' : ''
          }`}
        >
          {/* Unused raw video element (hidden offscreen, feed processed on canvas) */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
            crossOrigin="anonymous"
            onDurationChange={handleDurationChange}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={handleSeeked}
          />

          {/* Actual display canvas which merges raw camera + effects overlay */}
          <canvas
            ref={displayCanvasRef}
            className={`w-full h-full object-contain cursor-crosshair ${cameraActive ? 'block' : 'hidden'}`}
            id="effects-viewport"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          />

          {isDragging && cameraActive && (
            <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <div className="bg-blue-600 text-white px-8 py-4 rounded-full font-medium shadow-2xl scale-110">
                 Drop video to load
              </div>
            </div>
          )}

          {!cameraActive && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center p-8 text-center w-[400px] max-w-[90vw] gap-4 backdrop-blur-xl shadow-2xl rounded transition-all duration-200 border ${
              isDragging ? 'bg-blue-900/40 border-blue-500 scale-105' : 'bg-neutral-900/95 border-neutral-800'
            }`}>
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
          )}

          {/* Floaters overlays when Camera is Active */}
          <CanvasHud
            cameraActive={cameraActive}
            isSidebarOpen={isSidebarOpen}
            fps={fps}
            settings={settings}
            supportedMimeTypes={supportedMimeTypes}
            isFullscreen={isFullscreen}
            videoSourceMode={videoSourceMode}
            isPaused={isPaused}
            currentTime={currentTime}
            duration={duration}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            exportConfigured={exportConfigured}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onToggleFullscreen={toggleFullscreen}
            onStopCamera={stopCamera}
            onTogglePlay={handleTogglePlay}
            onScrubChange={handleScrubChange}
            onScrubStart={handleScrubStart}
            onScrubEnd={handleScrubEnd}
            onClearTrails={handleClearTrails}
            onStopRecording={stopRecording}
            onShowExportModal={setShowExportModal}
            onStartRecording={startRecording}
          />
        </div>

        {/* Calibration Instructions (Hidden in Pro Layout) */}
        <div className="hidden">
        <div className="bg-neutral-900 border border-neutral-800 rounded p-4 flex gap-3.5 items-start">
          <div className="p-2 bg-blue-500/10 rounded-sm text-blue-400 border border-neutral-700/50 mt-0.5 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-sans font-medium text-sm text-neutral-200">
              Calibration & Setup Guide
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed mt-1">
              {settings.trackingMode === 'color' 
                ? "Select a neon ball preset on the right, or click directly on any juggling ball in the camera view to track its custom color. For best results, use bright balls on a contrasting background."
                : "Motion detection tracks any moving object regardless of color. For best results, ensure your camera is completely stable and you're juggling against a solid background."}
            </p>
          </div>
        </div>
        </div>

        {/* Export Settings Modal */}
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
                      className="w-full bg-neutral-850 text-xs text-neutral-200 border border-neutral-700 px-3 py-2.5 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-all font-sans"
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
                        className="w-full bg-neutral-850 text-xs text-neutral-200 border border-neutral-700 px-3 py-2.5 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-all font-sans"
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

        {/* 3. Exported Video Preview / Download Card */}
        <AnimatePresence>
          {recordedVideoUrl && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] max-w-[90vw] bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4 shadow-2xl z-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="font-sans font-semibold text-sm text-neutral-200">
                    Recorded Video Export Ready
                  </h3>
                </div>
                <button
                  onClick={() => setRecordedVideoUrl(null)}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8 overflow-hidden rounded-sm bg-black border border-neutral-800 aspect-video">
                  <video
                    src={recordedVideoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="md:col-span-4 flex flex-col gap-3">
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    This file contains the complete live performance with all trail lines, motion speeds,
                    and trajectory curve mappings baked in.
                  </p>

                  <div className="bg-neutral-950/40 border border-neutral-800/80 rounded p-3 flex flex-col gap-2 font-mono text-[10px] text-neutral-400">
                    <div className="flex justify-between">
                      <span>Format:</span>
                      <span className="text-neutral-200 uppercase">{recordedExt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="text-neutral-200">{recordingSeconds}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>File Size:</span>
                      <span className="text-neutral-200">{(recordedSize / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  </div>

                  <a
                    href={recordedVideoUrl}
                    download={`juggling_tracking_${Date.now()}.${recordedExt}`}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-sans font-medium text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Video
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Floating Settings toggle for when camera is not active */}
      {!cameraActive && !isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-14 right-4 z-20 bg-[#0a0a0a]/90 hover:bg-neutral-900 border border-neutral-800 text-neutral-200 py-2 px-3.5 rounded-lg transition-all active:scale-95 flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold tracking-wider font-sans">Settings</span>
        </button>
      )}

      {/* 3. Pro Mode Mobile Tuner Overlay (only visible when camera is active and sidebar is closed) */}
      {cameraActive && !isSidebarOpen && (
        <div className="absolute bottom-28 left-4 right-4 z-20 pointer-events-none flex flex-col items-center gap-3 md:hidden">
          <AnimatePresence>
            {activeTunerKey && (() => {
              const item = tunerSettings.find(s => s.key === activeTunerKey);
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
                      style={item.key === 'hueRotate' && settings.hueRotate > 0 ? { color: `hsl(${settings.hueRotate}, 85%, 65%)` } : { color: '#e5e5e5' }}
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
                  style={item.key === 'hueRotate' && settings.hueRotate > 0 && !isActive ? { color: `hsl(${settings.hueRotate}, 85%, 65%)`, borderColor: `hsla(${settings.hueRotate}, 85%, 65%, 0.3)` } : undefined}
                  title={item.name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* 2. Control Panel Sidebar */}
      <SettingsDrawer
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        setSettings={setSettings}
        originalSettings={originalSettings}
        resetToOriginalSettings={resetToOriginalSettings}
        resetToFactoryDefaults={resetToFactoryDefaults}
        appliedPresetId={appliedPresetId}
        applyPreset={applyPreset}
        getSettingDisplayName={getSettingDisplayName}
        geminiCollapsed={geminiCollapsed}
        setGeminiCollapsed={setGeminiCollapsed}
        geminiActive={geminiActive}
        hasEnvApiKey={hasEnvApiKey}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        handleSaveApiKey={handleSaveApiKey}
        cameraActive={cameraActive}
        runGeminiAnalysis={runGeminiAnalysis}
        isGeminiAnalyzing={isGeminiAnalyzing}
        geminiError={geminiError}
        geminiAnalysisResult={geminiAnalysisResult}
        applyRecommendedSettings={applyRecommendedSettings}
        appliedOption={appliedOption}
        removalMaskCtxRef={removalMaskCtxRef}
        removalMaskCanvasRef={removalMaskCanvasRef}
        startCamera={startCamera}
      />
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <filter id="camera-adjustments">
          <feColorMatrix type="matrix" values={getAdjustmentMatrix()} />
        </filter>
      </svg>
    </div>
  );
}
