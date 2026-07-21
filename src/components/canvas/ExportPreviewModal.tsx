import React from 'react';
import { Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ExportPreviewModalProps {
  recordedVideoUrl: string | null;
  setRecordedVideoUrl: (url: string | null) => void;
  recordedExt: string;
  recordingSeconds: number;
  recordedSize: number;
}

export default function ExportPreviewModal({
  recordedVideoUrl,
  setRecordedVideoUrl,
  recordedExt,
  recordingSeconds,
  recordedSize,
}: ExportPreviewModalProps) {
  return (
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
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
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
  );
}
