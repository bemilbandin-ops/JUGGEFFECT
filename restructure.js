import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/TrackingCanvas.tsx');
let content = fs.readFileSync(file, 'utf8');

// Normalize line endings to \n so multiline replaces work!
content = content.replace(/\r\n/g, '\n');

// 1. Remove grid wrapper
content = content.replace(
  '<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">',
  '<div className="w-full h-full relative bg-black">'
);

// Replace Video container wrapper
const videoWrapperOld = `<div
          ref={containerRef}
          className={\`relative bg-neutral-900 border border-neutral-800 rounded overflow-hidden flex items-center justify-center aspect-video shadow-md transition-all duration-300 \${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
          }\`}
        >`;
const videoWrapperNew = `<div
          ref={containerRef}
          className={\`absolute inset-0 z-0 bg-black flex items-center justify-center transition-all duration-300 \${
            isFullscreen ? 'fixed inset-0 z-50' : ''
          }\`}
        >`;
content = content.replace(videoWrapperOld, videoWrapperNew);

// Replace Intro Box
const introBoxOld = `<div className="flex flex-col items-center justify-center p-8 text-center max-w-sm gap-4">`;
const introBoxNew = `<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center p-8 text-center w-[400px] max-w-[90vw] gap-4 bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 shadow-2xl rounded">`;
content = content.replace(introBoxOld, introBoxNew);

// Top Status bar
const topBarOld = `<div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">`;
const topBarNew = `<div className="absolute top-14 left-4 right-4 flex items-center justify-between pointer-events-none z-20 pr-[340px]">`;
content = content.replace(topBarOld, topBarNew);

// Bottom Control Bar
const bottomBarOld = `<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-900 px-4 py-2 rounded border border-neutral-800 pointer-events-auto">`;
const bottomBarNew = `<div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-900 px-4 py-2 rounded border border-neutral-800 pointer-events-auto shadow-2xl z-20">`;
content = content.replace(bottomBarOld, bottomBarNew);

// Remove Calibration Instructions
const calibOld = `{/* 2. Calibration Instructions */}`;
const calibNew = `{/* Calibration Instructions (Hidden in Pro Layout) */}\n        <div className="hidden">`;
content = content.replace(calibOld, calibNew);

const exportOld = `{/* 3. Exported Video Preview / Download Card */}`;
const exportNew = `</div>\n        {/* 3. Exported Video Preview / Download Card */}`;
content = content.replace(exportOld, exportNew);

// Exported video preview
const exportBoxOld = `className="bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4 shadow-md"`;
const exportBoxNew = `className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] max-w-[90vw] bg-neutral-900 border border-neutral-800 rounded p-5 flex flex-col gap-4 shadow-2xl z-50"`;
content = content.replace(exportBoxOld, exportBoxNew);

// Control panel wrapper
const sidebarOld = `        </AnimatePresence>
      </div>

      {/* 2. Control Panel & Fine-tuning Sliders */}
      <div className="lg:col-span-4 flex flex-col gap-5">`;

const sidebarNew = `        </AnimatePresence>

      {/* 2. Control Panel Sidebar */}
      <div className="absolute right-0 top-10 bottom-0 w-80 bg-[#0a0a0a]/90 backdrop-blur-2xl border-l border-neutral-800 z-20 overflow-y-auto flex flex-col gap-5 p-4 shadow-2xl">`;
content = content.replace(sidebarOld, sidebarNew);

content = content.replace('<div className="lg:col-span-8 flex flex-col gap-4 sticky top-6 z-10">', '');

fs.writeFileSync(file, content, 'utf8');
console.log('Restructure applied safely.');
