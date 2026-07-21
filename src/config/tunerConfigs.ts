import React from 'react';
import {
  Waves,
  Activity,
  Sparkles,
  Sliders,
  Maximize2,
  Camera,
} from 'lucide-react';
import { TrackingSettings } from '../types';

export function getTunerSettings(
  settings: TrackingSettings,
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>
) {
  return [
    {
      key: 'echoFadeRate',
      name: 'Trail Length',
      icon: Waves,
      min: 0,
      max: 100,
      step: 1,
      getValue: () => Math.round((1 - settings.echoFadeRate) * 100),
      setValue: (val: number) => setSettings((prev) => ({ ...prev, echoFadeRate: 1 - val / 100 })),
      format: (val: number) => (val === 0 ? '0% (Off)' : val === 100 ? 'Infinite' : `${val}% retention`),
    },
    {
      key: 'motionThreshold',
      name: 'Sensitivity',
      icon: Activity,
      min: 15,
      max: 120,
      step: 1,
      getValue: () => 135 - settings.motionThreshold,
      setValue: (val: number) => setSettings((prev) => ({ ...prev, motionThreshold: 135 - val })),
      format: (val: number) => `${val}%`,
    },
    {
      key: 'blurAmount',
      name: 'Trail Glow',
      icon: Sparkles,
      min: 0,
      max: 20,
      step: 1,
      getValue: () => settings.blurAmount,
      setValue: (val: number) => setSettings((prev) => ({ ...prev, blurAmount: val })),
      format: (val: number) => `${val}px`,
    },
    {
      key: 'hueRotate',
      name: 'Hue Shift',
      icon: Sliders,
      min: 0,
      max: 360,
      step: 1,
      getValue: () => settings.hueRotate,
      setValue: (val: number) => setSettings((prev) => ({ ...prev, hueRotate: val })),
      format: (val: number) => `${val}°`,
    },
    {
      key: 'feedbackZoom',
      name: 'Feedback Zoom',
      icon: Maximize2,
      min: 0.95,
      max: 1.1,
      step: 0.005,
      getValue: () => settings.feedbackZoom,
      setValue: (val: number) => setSettings((prev) => ({ ...prev, feedbackZoom: val })),
      format: (val: number) => (val === 1.0 ? '100% (Off)' : `${((val - 1) * 100).toFixed(1)}%`),
    },
    {
      key: 'strobeRate',
      name: 'Strobe Rate',
      icon: Camera,
      min: 0,
      max: 2.0,
      step: 0.05,
      getValue: () => settings.strobeRate,
      setValue: (val: number) => setSettings((prev) => ({ ...prev, strobeRate: val })),
      format: (val: number) => (val === 0 ? 'Off' : `Every ${val.toFixed(2)}s`),
    },
  ];
}

export function getSettingColor(key: string, settings: TrackingSettings): string {
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
}

export function getAdjustmentMatrix(settings: TrackingSettings): string {
  const t = settings.temperature / 100;
  const p = settings.tint / 100;

  const r_scale = 1 + t * 0.15 + p * 0.08;
  const g_scale = 1 + t * 0.05 - p * 0.15;
  const b_scale = 1 - t * 0.15 + p * 0.08;

  return `${r_scale} 0 0 0 0 0 ${g_scale} 0 0 0 0 0 ${b_scale} 0 0 0 0 0 1 0`;
}
