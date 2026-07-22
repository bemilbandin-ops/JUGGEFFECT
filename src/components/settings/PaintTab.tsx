import React from 'react';
import { Trash2, Info } from 'lucide-react';
import { TrackingSettings } from '../../types';

export interface PaintTabProps {
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
  removalMaskCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
  removalMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  removalMaskRevisionRef: React.MutableRefObject<number>;
}

export default function PaintTab({
  settings,
  setSettings,
  removalMaskCtxRef,
  removalMaskCanvasRef,
  removalMaskRevisionRef,
}: PaintTabProps) {
  return (
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
                  removalMaskRevisionRef.current++;
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
  );
}
