import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/TrackingCanvas.tsx');
let content = fs.readFileSync(file, 'utf8');

// Theming replacements to match "Pro Studio Utility"
// Remove rounded-2xl -> rounded
content = content.replace(/rounded-2xl/g, 'rounded');
content = content.replace(/rounded-xl/g, 'rounded-sm');
// Remove glowing emeralds -> functional blues/neutrals
content = content.replace(/emerald-500\/10/g, 'blue-500/10');
content = content.replace(/emerald-500\/20/g, 'neutral-700/50');
content = content.replace(/emerald-400\/90/g, 'neutral-300');
content = content.replace(/text-emerald-400/g, 'text-blue-400');
content = content.replace(/bg-emerald-500/g, 'bg-blue-600');
content = content.replace(/bg-emerald-600/g, 'bg-blue-700');
content = content.replace(/border-emerald-500\/20/g, 'border-neutral-700');
content = content.replace(/shadow-emerald-500\/10/g, 'shadow-none');
content = content.replace(/accent-emerald-500/g, 'accent-blue-500');
content = content.replace(/focus-within:border-emerald-500/g, 'focus-within:border-blue-500');
content = content.replace(/focus:border-emerald-500/g, 'focus:border-blue-500');
content = content.replace(/shadow-xl/g, 'shadow-md');
content = content.replace(/shadow-2xl/g, 'shadow-md');

// Refine typography and structural backgrounds
content = content.replace(/bg-neutral-900\/60/g, 'bg-neutral-900');
content = content.replace(/bg-neutral-950\/50/g, 'bg-neutral-950');
content = content.replace(/bg-neutral-950\/40/g, 'bg-neutral-900');
content = content.replace(/border-neutral-800\/80/g, 'border-neutral-800');
content = content.replace(/bg-neutral-950\/90 backdrop-blur-md/g, 'bg-neutral-900');
content = content.replace(/bg-neutral-950\/85 backdrop-blur-md/g, 'bg-neutral-900');

// Record button should be red
content = content.replace(
  /className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-neutral-950 py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all shadow-none"/g,
  'className="bg-red-600 hover:bg-red-700 active:scale-95 text-white py-1.5 px-4 rounded font-medium text-xs flex items-center gap-2 transition-all"'
);

// Record border
content = content.replace(
  /rounded-full border border-neutral-800\/90 pointer-events-auto shadow-md/g,
  'rounded border border-neutral-800 pointer-events-auto'
);

// Button text color fix
content = content.replace(/text-neutral-950/g, 'text-white');


fs.writeFileSync(file, content, 'utf8');
console.log('TrackingCanvas styling updated successfully.');
