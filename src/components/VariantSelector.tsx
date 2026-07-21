import React from 'react';

interface VariantSelectorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export default function VariantSelector({ value, onChange }: VariantSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-neutral-400">Pattern Source</span>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-300 outline-none focus:border-blue-500 cursor-pointer"
      >
        <option value="swedish">Swedish Flag</option>
        <option value="youtube">YouTube Logo</option>
        <option value="rainbow">Spectrum Gradient</option>
        <option value="flowers">Concentric Flowers</option>
        <option value="text">Custom Text</option>
        <option value="custom">Custom Image Upload</option>
        <option value="spiral">Spiral Helix (Feathered POV)</option>
        <option value="chevron">Chevron Zigzag (Geometric)</option>
        <option value="mandala">Concentric Mandala (Rings)</option>
      </select>
    </div>
  );
}
