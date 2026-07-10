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
  motionThreshold: number; // For motion diff (0-255)
  echoFadeRate: number; // Trail fade speed for flow props
  bgLearningRate: number;
  blurAmount: number;
  hueRotate: number;
  compositeMode: string;
  invertColors: boolean;
  showDebugFeed: boolean; // Show binary threshold mask for debugging
  enableAudioSync: boolean; // Sync video sound with mic
  strobeRate: number;
  colorCycleSpeed: number;
  verticalDrift: number;
  horizontalDrift: number;
  feedbackZoom: number;
  motionBlur: number;
}

