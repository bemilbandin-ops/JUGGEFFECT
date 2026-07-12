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
import { updateBackgroundAndExtractMotion } from '../utils/cv';
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

interface BlobPoint {
  x: number;
  y: number;
  angle: number;
  length: number;
  aspectRatio: number;
}

interface BlobCluster {
  sumX: number;
  sumY: number;
  sumX2: number;
  sumY2: number;
  sumXY: number;
  count: number;
}

function detectBlobs(maskData: ImageData, maxBlobs: number = 3): BlobPoint[] {
  const width = maskData.width;
  const height = maskData.height;
  const data = maskData.data;
  const clusters: BlobCluster[] = [];
  const step = 6;
  const maxDistance = 60;
  const minPoints = 3;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 50) {
        let joined = false;
        for (let i = 0; i < clusters.length; i++) {
          const c = clusters[i];
          const cx = c.sumX / c.count;
          const cy = c.sumY / c.count;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < maxDistance) {
            c.sumX += x;
            c.sumY += y;
            c.sumX2 += x * x;
            c.sumY2 += y * y;
            c.sumXY += x * y;
            c.count++;
            joined = true;
            break;
          }
        }
        if (!joined && clusters.length < maxBlobs + 5) {
          clusters.push({
            sumX: x,
            sumY: y,
            sumX2: x * x,
            sumY2: y * y,
            sumXY: x * y,
            count: 1
          });
        }
      }
    }
  }

  const validClusters = clusters.filter(c => c.count >= minPoints);

  return validClusters
    .sort((a, b) => b.count - a.count)
    .slice(0, maxBlobs)
    .map(c => {
      const xc = c.sumX / c.count;
      const yc = c.sumY / c.count;
      
      // Central moments for angle and length
      const mu20 = c.sumX2 - c.sumX * xc;
      const mu02 = c.sumY2 - c.sumY * yc;
      const mu11 = c.sumXY - c.sumX * yc;
      
      // PCA Orientation
      const angle = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
      
      // Eigenvalue length estimation
      const varX = mu20 / c.count;
      const varY = mu02 / c.count;
      const covXY = mu11 / c.count;
      const term = Math.sqrt((varX - varY) ** 2 + 4 * covXY ** 2);
      const lambda1 = varX + varY + term;
      const lambda2 = varX + varY - term;
      const aspectRatio = Math.sqrt(lambda1 / Math.max(lambda2, 0.1));
      const length = 2 * Math.sqrt(varX + varY + term) * 2.5;

      return {
        x: xc,
        y: yc,
        angle,
        length: Math.max(length, 25),
        aspectRatio: Math.max(aspectRatio, 1.0)
      };
    });
}

/**
 * Draws a single LED column at the current canvas transform origin without glow/blur.
 * Assumes ctx is already translated and rotated so the column goes along the Y axis.
 */
function drawLedColumn(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  colIdx: number,
  numLEDs: number,
  length: number,    // total length of the LED strip in canvas pixels
  dotWidth: number,  // diameter of each LED dot
  opacity: number
) {
  const pWidth = imgData.width;
  const pHeight = imgData.height;
  const data = imgData.data;

  // Wrap column index safely
  const px = ((colIdx % pWidth) + pWidth) % pWidth;

  for (let i = 0; i < numLEDs; i++) {
    const y_ratio = numLEDs > 1 ? i / (numLEDs - 1) : 0.5;
    const y_pos = -length / 2 + y_ratio * length;

    const py = Math.floor(y_ratio * (pHeight - 1));
    const idx = (py * pWidth + px) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a <= 15) continue;

    const ledAlpha = (a / 255) * opacity;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ledAlpha})`;
    ctx.beginPath();
    ctx.arc(0, y_pos, dotWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updatePoiPattern(
  canvas: HTMLCanvasElement,
  currentSettings: TrackingSettings,
  customImageElement: HTMLImageElement | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const type = currentSettings.poiPatternType;

  if (type === 'swedish') {
    canvas.width = 160;
    canvas.height = 100;
    ctx.fillStyle = '#005293';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FECC02';
    ctx.fillRect(0, 40, 160, 20);
    ctx.fillRect(50, 0, 20, 100);
  }
  else if (type === 'youtube') {
    canvas.width = 150;
    canvas.height = 100;
    // Keep background transparent to avoid erasing trails
    ctx.fillStyle = '#FF0000';
    const r = 20;
    const x = 15, y = 15, w = 120, h = 70;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(60, 35);
    ctx.lineTo(60, 65);
    ctx.lineTo(95, 50);
    ctx.closePath();
    ctx.fill();
  }
  else if (type === 'rainbow') {
    canvas.width = 256;
    canvas.height = 64;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.17, '#ff00ff');
    grad.addColorStop(0.33, '#0000ff');
    grad.addColorStop(0.5, '#00ffff');
    grad.addColorStop(0.67, '#00ff00');
    grad.addColorStop(0.83, '#ffff00');
    grad.addColorStop(1, '#ff0000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  else if (type === 'flowers') {
    canvas.width = 300;
    canvas.height = 128;
    // Keep background transparent to avoid erasing trails
    const colors = ['#FF2A85', '#00FFCC', '#FFE600', '#FF7F00', '#9D00FF'];
    for (let c = 0; c < 3; c++) {
      const cx = 50 + c * 100;
      const cy = 64;
      const r = 24;
      ctx.fillStyle = colors[c % colors.length];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  else if (type === 'text') {
    const text = currentSettings.poiText || 'JUGGLE';
    const textColor = currentSettings.poiTextColor || '#ff2a85';
    ctx.font = 'bold 36px sans-serif';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(text).width;
    canvas.width = Math.max(textWidth + 40, 100);
    canvas.height = 64;
    // Keep background transparent to avoid erasing trails
    ctx.fillStyle = textColor;
    ctx.font = 'bold 36px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  else if (type === 'custom') {
    if (customImageElement && customImageElement.complete && customImageElement.naturalWidth > 0) {
      canvas.width = customImageElement.naturalWidth;
      canvas.height = customImageElement.naturalHeight;
      ctx.drawImage(customImageElement, 0, 0);
    } else {
      canvas.width = 100;
      canvas.height = 64;
      ctx.fillStyle = '#222222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Image Uploaded', 50, 32);
    }
  }
  else if (type === 'spiral') {
    // Creates a repeating spiral/helix pattern that produces the feathered look from reference images
    canvas.width = 360;
    canvas.height = 72;
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normX = x / canvas.width;
        const normY = y / canvas.height;
        const angle = normX * Math.PI * 6; // 3 full spirals across the width
        const wave = Math.sin(angle + normY * Math.PI * 4) * 0.5 + 0.5;
        const h = (normX * 240 + 200) % 360; // Cyan to magenta hue sweep
        const s = 85 + wave * 15;
        const l = 20 + wave * 55;
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  else if (type === 'chevron') {
    // Creates repeating chevron/zigzag geometry — produces triangular patterns when spun
    canvas.width = 256;
    canvas.height = 80;
    const colors = ['#FF2A85', '#00FFCC', '#3B82F6', '#A855F7'];
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normY = y / canvas.height;
        const phase = (x / 32) * Math.PI * 2;
        const zigzag = Math.abs(((normY * 4 + Math.sin(phase) * 0.3) % 1) * 2 - 1);
        const band = Math.floor(normY * 4) % colors.length;
        if (zigzag > 0.15) {
          ctx.fillStyle = colors[band];
          ctx.globalAlpha = 0.3 + zigzag * 0.7;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
  else if (type === 'mandala') {
    // Creates concentric hexagonal/circular patterns — produces the mandala look from reference image 3
    canvas.width = 360;
    canvas.height = 80;
    const palette = ['#FF0040', '#00FF80', '#FFE600', '#00BFFF', '#FF6600', '#FFFFFF'];
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normX = x / canvas.width;
        const normY = y / canvas.height;
        const ring = Math.floor((normY * 5 + Math.sin(normX * Math.PI * 12) * 0.15) % palette.length);
        const edgeFade = 1 - Math.abs(Math.sin(normX * Math.PI * 12 + normY * Math.PI * 6)) * 0.3;
        if (edgeFade > 0.4) {
          ctx.fillStyle = palette[ring];
          ctx.globalAlpha = edgeFade;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
}

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

  const getCameraFilterString = (currentSettings: TrackingSettings) => {
    const filters = [];
    if (currentSettings.exposure !== 0) {
      filters.push(`brightness(${1 + currentSettings.exposure / 100})`);
    }
    if (currentSettings.contrast !== 0) {
      filters.push(`contrast(${1 + currentSettings.contrast / 100})`);
    }
    if (currentSettings.saturation !== 0) {
      filters.push(`saturate(${1 + currentSettings.saturation / 100})`);
    }
    if (currentSettings.temperature !== 0 || currentSettings.tint !== 0) {
      filters.push(`url(#camera-adjustments)`);
    }
    return filters.length > 0 ? filters.join(' ') : 'none';
  };

  const getTrackingFilterString = (currentSettings: TrackingSettings) => {
    const filters = [];
    if (currentSettings.exposure !== 0) {
      filters.push(`brightness(${1 + currentSettings.exposure / 100})`);
    }
    if (currentSettings.contrast !== 0) {
      filters.push(`contrast(${1 + currentSettings.contrast / 100})`);
    }
    if (currentSettings.saturation !== 0) {
      filters.push(`saturate(${1 + currentSettings.saturation / 100})`);
    }
    return filters.length > 0 ? filters.join(' ') : 'none';
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

      // Initialize and resize stampedVideoCanvasRef
      if (!stampedVideoCanvasRef.current) {
        stampedVideoCanvasRef.current = document.createElement('canvas');
      }
      const stampedVideoCanvas = stampedVideoCanvasRef.current;
      const stampedVideoCtx = stampedVideoCanvas.getContext('2d');
      if (stampedVideoCanvas.width !== video.videoWidth || stampedVideoCanvas.height !== video.videoHeight) {
        stampedVideoCanvas.width = video.videoWidth;
        stampedVideoCanvas.height = video.videoHeight;
      }

      // Initialize and resize removalMaskCanvasRef (preserving painted path)
      if (!removalMaskCanvasRef.current) {
        removalMaskCanvasRef.current = document.createElement('canvas');
        removalMaskCtxRef.current = removalMaskCanvasRef.current.getContext('2d');
      }
      const removalMaskCanvas = removalMaskCanvasRef.current;
      const removalMaskCtx = removalMaskCtxRef.current;
      if (removalMaskCanvas.width !== video.videoWidth || removalMaskCanvas.height !== video.videoHeight) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = removalMaskCanvas.width;
        tempCanvas.height = removalMaskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx && removalMaskCanvas.width > 0 && removalMaskCanvas.height > 0) {
          tempCtx.drawImage(removalMaskCanvas, 0, 0);
        }
        removalMaskCanvas.width = video.videoWidth;
        removalMaskCanvas.height = video.videoHeight;
        if (removalMaskCtx) {
          removalMaskCtx.lineCap = 'round';
          removalMaskCtx.lineJoin = 'round';
          removalMaskCtx.clearRect(0, 0, removalMaskCanvas.width, removalMaskCanvas.height);
          if (tempCanvas.width > 0 && tempCanvas.height > 0) {
            removalMaskCtx.drawImage(tempCanvas, 0, 0, removalMaskCanvas.width, removalMaskCanvas.height);
          }
        }
      }

      if (video.paused || video.ended) {
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

        ctx.filter = cameraFilter;
        ctx.drawImage(stampedVideoCanvas, 0, 0, w, h);
        ctx.filter = 'none';

        if (currentSettings.enableTrails && trailCanvasRef.current) {
          const blendMode = (currentSettings.compositeMode === 'none' || !currentSettings.compositeMode)
            ? 'screen'
            : currentSettings.compositeMode;
          ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
          ctx.drawImage(trailCanvasRef.current, 0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
        }

        if (currentSettings.showDebugFeed && processingCanvasRef.current) {
          ctx.globalAlpha = 0.65;
          ctx.drawImage(processingCanvasRef.current, 0, 0, w, h);
          ctx.globalAlpha = 1.0;
        }

        if (currentSettings.cloneStampEnabled && isHoveringRef.current && hoverPosRef.current) {
          const mouseX = hoverPosRef.current.x;
          const mouseY = hoverPosRef.current.y;
          const brushSize = currentSettings.cloneStampBrushSize;
          const offsetX = currentSettings.cloneStampOffsetX;
          const offsetY = currentSettings.cloneStampOffsetY;
          const sourceX = mouseX + offsetX;
          const sourceY = mouseY + offsetY;
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(mouseX, mouseY);
          ctx.lineTo(sourceX, sourceY);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(mouseX, mouseY, brushSize / 2, 0, Math.PI * 2);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(sourceX, sourceY, brushSize / 2, 0, Math.PI * 2);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(sourceX, sourceY, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
          
          ctx.restore();
        }

        if (currentSettings.enablePoiMode && 
            currentSettings.poiOrientation === 'radial' && 
            activeTabRef.current === 'poi' && 
            !isRecordingRef.current) {
          const cx = currentSettings.poiCenterRelativeX * w;
          const cy = currentSettings.poiCenterRelativeY * h;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, 15, 0, Math.PI * 2);
          ctx.arc(cx, cy, 30, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy);
          ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Center of Rotation', cx, cy - 45);
          ctx.restore();
        }

        animationFrameIdRef.current = requestAnimationFrame(render);
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

      const isStrobeActive = currentSettings.strobeRate > 0;
      let isStrobeTriggered = false;
      if (!isStrobeActive) {
        isStrobeTriggered = true;
      } else {
        if (now - lastStrobeTimeRef.current >= currentSettings.strobeRate * 1000) {
          isStrobeTriggered = true;
          lastStrobeTimeRef.current = now;
        }
      }

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

      // 3. Process frame for tracking
      // Draw frame to low-res canvas for high performance (using sharp video)
      procCtx.filter = trackingFilter;
      procCtx.drawImage(stampedVideoCanvas, 0, 0, procCanvas.width, procCanvas.height);
      procCtx.filter = 'none';
      
      let procImageData: ImageData;
      try {
        procImageData = procCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
      } catch (err) {
        console.warn('Failed to get tracking image data (possibly tainted canvas):', err);
        // Fallback to empty image data to prevent crash
        procImageData = new ImageData(procCanvas.width, procCanvas.height);
      }

      if (!bgDataRef.current || bgDataRef.current.length !== procImageData.data.length) {
        bgDataRef.current = new Float32Array(procImageData.data.length);
        for(let i=0; i<procImageData.data.length; i++) bgDataRef.current[i] = procImageData.data[i];
      }
      if (!motionMaskDataRef.current || motionMaskDataRef.current.width !== procCanvas.width) {
        motionMaskDataRef.current = new ImageData(procCanvas.width, procCanvas.height);
      }

      updateBackgroundAndExtractMotion(
        procImageData,
        bgDataRef.current,
        motionMaskDataRef.current,
        currentSettings.motionThreshold,
        currentSettings.bgLearningRate,
        currentSettings.invertColors,
        currentSettings.enableLightTracking,
        currentSettings.lightThreshold,
        currentSettings.edgeAntiAliasing
      );

      // Write the motion mask pixels to procCanvas immediately so we can use it for blur overlay and trails
      procCtx.putImageData(motionMaskDataRef.current, 0, 0);

      // Apply Line Smoothness (Anti-aliasing/Blur) to the mask
      if (currentSettings.lineSmoothness > 0) {
        if (!smoothingCanvasRef.current) {
          smoothingCanvasRef.current = document.createElement('canvas');
        }
        const smoothCanvas = smoothingCanvasRef.current;
        if (smoothCanvas.width !== procCanvas.width || smoothCanvas.height !== procCanvas.height) {
          smoothCanvas.width = procCanvas.width;
          smoothCanvas.height = procCanvas.height;
        }
        const smoothCtx = smoothCanvas.getContext('2d');
        if (smoothCtx) {
           smoothCtx.clearRect(0, 0, smoothCanvas.width, smoothCanvas.height);
           smoothCtx.filter = `blur(${currentSettings.lineSmoothness}px)`;
           smoothCtx.drawImage(procCanvas, 0, 0);
           smoothCtx.filter = 'none';
           
           procCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
           procCtx.drawImage(smoothCanvas, 0, 0);
        }
      }

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
      if (currentSettings.showDebugFeed) {
        ctx.globalAlpha = 0.65;
        ctx.drawImage(procCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }


      // Compute FPS
      frameCountRef.current++;
      const delta = now - lastTimeRef.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      // Draw Clone Stamp brush and source offset preview if enabled and hovering
      if (currentSettings.cloneStampEnabled && isHoveringRef.current && hoverPosRef.current && ctx) {
        const mouseX = hoverPosRef.current.x;
        const mouseY = hoverPosRef.current.y;
        const brushSize = currentSettings.cloneStampBrushSize;
        const offsetX = currentSettings.cloneStampOffsetX;
        const offsetY = currentSettings.cloneStampOffsetY;
        const sourceX = mouseX + offsetX;
        const sourceY = mouseY + offsetY;
        
        ctx.save();
        
        // 1. Draw connecting dashed line
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY);
        ctx.lineTo(sourceX, sourceY);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'; // Blue-500 semi-transparent
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        
        // 2. Draw destination brush circle (where details will be painted)
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, brushSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#3b82f6'; // Blue-500
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
        // Add a small center dot
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        
        // 3. Draw source clone circle (where details are copied from)
        ctx.beginPath();
        ctx.arc(sourceX, sourceY, brushSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#10b981'; // Emerald-500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        // Add a small center dot
        ctx.beginPath();
        ctx.arc(sourceX, sourceY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        
        ctx.restore();
      }

      // Draw Center of Rotation radial helper if enabled, in radial mode, the settings tab is active, and not exporting/recording
      if (currentSettings.enablePoiMode && 
          currentSettings.poiOrientation === 'radial' && 
          activeTabRef.current === 'poi' && 
          !isRecordingRef.current && 
          ctx) {
        const cx = currentSettings.poiCenterRelativeX * w;
        const cy = currentSettings.poiCenterRelativeY * h;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // Blue-500
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy);
        ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Center of Rotation', cx, cy - 45);
        ctx.restore();
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

  // Formatter for recorded time
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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
          {cameraActive && (
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
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
                    onClick={toggleFullscreen}
                    className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-900 text-neutral-300 p-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                    title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={stopCamera}
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
                      onClick={handleTogglePlay}
                      className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                      title={isPaused ? "Play" : "Pause"}
                    >
                      {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                    </button>

                    {/* Time Display */}
                    <span className="text-[11px] font-mono text-neutral-400 select-none shrink-0">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    {/* Progress Slider (Scrubber) */}
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.05}
                      value={currentTime}
                      onChange={handleScrubChange}
                      onMouseDown={handleScrubStart}
                      onTouchStart={handleScrubStart}
                      onMouseUp={handleScrubEnd}
                      onTouchEnd={handleScrubEnd}
                      className="flex-1 accent-blue-500 h-1.5 rounded-lg bg-neutral-800 appearance-none cursor-pointer hover:bg-neutral-750 transition-all [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                    />

                    {/* Clear Trails Button */}
                    <button
                      onClick={handleClearTrails}
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
                    onClick={stopRecording}
                    className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all"
                  >
                    <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                    <span>Stop ({formatTime(recordingSeconds)})</span>
                  </button>
                ) : !exportConfigured ? (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white active:scale-95 py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all border border-amber-500/30"
                    title="Configure Export Settings"
                  >
                    <Sliders className="w-3.5 h-3.5 font-sans" />
                    <span className="font-sans">Configure Export Quality First</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={startRecording}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10 font-sans"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Record Overlay</span>
                    </button>
                    <button
                      onClick={() => setShowExportModal(true)}
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
          )}
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
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-neutral-400">Pattern Source</span>
                            <select
                              value={settings.poiPatternType}
                              onChange={(e) =>
                                setSettings((prev) => ({ ...prev, poiPatternType: e.target.value as any }))
                              }
                              className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="swedish">Swedish Flag</option>
                              <option value="youtube">YouTube Logo</option>
                              <option value="rainbow">Spectrum Gradient</option>
                              <option value="flowers">Concentric Flowers</option>
                              <option value="text">Custom Text</option>
                              <option value="custom">Custom Image Upload</option>
                              <option value="spiral">Spiral Helix (Feathered POV)</option>
                              <option value="chevron">Chevron Zigzag (Geometric)</option>
                              <option value="mandala">Concentric Mandala (Rings)</option>
                            </select>
                          </div>

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
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <filter id="camera-adjustments">
          <feColorMatrix type="matrix" values={getAdjustmentMatrix()} />
        </filter>
      </svg>
    </div>
  );
}
