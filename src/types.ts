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
  poiPatternType: 'swedish' | 'youtube' | 'rainbow' | 'flowers' | 'text' | 'custom';
  poiText: string;
  poiTextColor: string;
  poiCustomImage: string | null;
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
}

