export interface Point {
  x: number; // Normalized coordinate [0, 1] relative to canvas width
  y: number; // Normalized coordinate [0, 1] relative to canvas height
  time: number;
}

export interface HSV {
  h: number; // [0, 360]
  s: number; // [0, 100]
  v: number; // [0, 100]
}

export interface TrackingSettings {
  enableTrails: boolean; // Toggle to render motion trails
  motionThreshold: number; // For motion diff (0-255)
  enableLightTracking: boolean; // Toggle to filter by brightness
  lightThreshold: number; // Minimum brightness to track (0-255)
  echoFadeRate: number; // Trail fade speed for flow props
  bgLearningRate: number;
  blurAmount: number;
  hueRotate: number;
  compositeMode: string;
  invertColors: boolean;
  showDebugFeed: boolean; // Show binary threshold mask for debugging
  enableAudioSync: boolean; // Sync video sound with mic
  strobeRate: number;
  strobeMode: 'freeze' | 'flash';
  colorCycleSpeed: number;
  verticalDrift: number;
  horizontalDrift: number;
  feedbackZoom: number;
  motionBlur: number;
  lineSmoothness: number;
  edgeAntiAliasing: number;
  exportQuality: 'standard' | 'medium' | 'high' | 'ultra';
  exportFps: 30 | 60;
  exportMimeType: string;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  cloneStampEnabled: boolean;
  cloneStampOffsetX: number;
  cloneStampOffsetY: number;
  cloneStampBrushSize: number;
  cloneStampFeather: number;
  enablePoiMode: boolean;
  poiPatternType: 'rainbow' | 'flowers' | 'spiral' | 'chevron' | 'mandala' | 'plasma' | 'starburst' | 'plaid' | 'wave';
  poiHeight: number;
  poiWidth: number;
  poiOrientation: 'vertical' | 'horizontal' | 'motion' | 'radial' | 'club';
  poiCenterRelativeX: number;
  poiCenterRelativeY: number;
  poiSpeedMultiplier: number;
  poiMaxPoints: number;
  poiMappingMode: 'time' | 'angle' | 'spatial';
  poiRenderMode: 'solid' | 'dots';
  poiOpacity: number;
  poiFadeInTime: number;
  poiHoldTime: number;
  poiFadeOutTime: number;
  poiWaitTime: number;
  poiFrameInterval: number;
  // === NEW POV FIELDS ===
  poiPovEnabled: boolean;           // Toggle between old single-column mode and new POV sweep mode
  poiPovRetention: number;          // How long (ms) painted columns stay visible before fading (e.g., 300 = 300ms of trailing columns visible)
  poiPovFadeMode: 'linear' | 'exponential' | 'sharp'; // How the trail fades: linear = even fade, exponential = quick drop, sharp = hard cutoff
  poiPovColumnSpacing: number;      // Minimum pixel distance the club must travel before the next image column is painted (e.g., 4 = new column every 4px of movement)
  poiPovMotionMode: 'free' | 'circular'; // 'free' = paint along any motion path, 'circular' = optimize for spinning/circular motion (image wraps around rotation)
  poiGlowEnabled: boolean;          // Toggle LED glow/bloom halos
  poiGlowRadius: number;            // Radius of the glow halo in pixels (e.g., 8)
  poiGlowIntensity: number;         // Glow brightness multiplier 0.0–1.0
  poiLedCount: number;              // Override number of simulated LEDs per column (0 = auto from club length)
}

