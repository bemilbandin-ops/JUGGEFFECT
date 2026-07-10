import { Camera, Settings2 } from 'lucide-react';
import TrackingCanvas from './components/TrackingCanvas';

export default function App() {
  return (
    <div className="h-screen w-screen bg-black text-neutral-300 flex flex-col selection:bg-blue-500/30 selection:text-blue-100 font-sans overflow-hidden relative">
      {/* 1. Global HUD Header - Tiny and Out of the Way */}
      <header className="absolute top-0 left-0 right-0 h-10 border-b border-neutral-900 bg-black/80 backdrop-blur-md z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-neutral-400" />
            <h1 className="font-semibold text-xs tracking-widest text-neutral-100 uppercase">
              Juggling Trail Camera
            </h1>
          </div>
          <div className="h-3 w-px bg-neutral-800" />
          <span className="text-[9px] text-neutral-500 font-mono tracking-widest uppercase">
            CV Engine v1.0.4
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[9px] font-mono font-medium text-neutral-400 tracking-wider">
              PRO MODE
            </span>
          </div>
        </div>
      </header>

      {/* 2. Fullscreen Workspace (Takes over completely) */}
      <main className="flex-1 w-full h-full relative">
        <TrackingCanvas />
      </main>
    </div>
  );
}
