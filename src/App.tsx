import { Activity, Sparkles, Award } from 'lucide-react';
import TrackingCanvas from './components/TrackingCanvas';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* 1. Header Navigation */}
      <header className="border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px]">
              <div className="w-full h-full bg-neutral-950 rounded-[11px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="font-sans font-bold text-base tracking-tight text-neutral-100 flex items-center gap-1.5">
                Juggling Trail Camera
              </h1>
              <p className="text-[10px] text-neutral-500 font-mono">
                REAL-TIME TRAJECTORY & MOTION EFFECT ENGINE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-medium text-neutral-300">
              PRO ANALYSIS ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Layout */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Intro Hero Section */}
        <div className="relative overflow-hidden bg-neutral-900/40 border border-neutral-900 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SPORT VISION SCIENCE FOR PERFORMERS</span>
            </div>
            <h2 className="font-sans font-extrabold text-2xl text-neutral-100 tracking-tight">
              Visualize Trajectories & Motion Trails Live
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Track juggling balls, clubs, or rings in real time. Customize glow trails, highlight parabolic apexes, 
              and capture complete sessions as downloadable videos with visual effects mapped dynamically.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-xs text-neutral-500 font-mono">STABILIZATION</span>
              <span className="text-sm font-semibold text-emerald-400">Auto-Adaptive</span>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div className="flex flex-col items-end">
              <span className="text-xs text-neutral-500 font-mono">RESOLUTION</span>
              <span className="text-sm font-semibold text-neutral-200">60 FPS Native</span>
            </div>
          </div>
        </div>

        {/* Core Canvas Application */}
        <TrackingCanvas />
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-neutral-900/60 bg-neutral-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500 font-mono">
            &copy; 2026 Juggling Trail Camera &bull; Built with real-time HSV color segmentation
          </p>
          <div className="flex items-center gap-6 text-xs text-neutral-500 font-mono">
            <span>PORT: 3000 (SECURED)</span>
            <span>STATUS: READY</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
