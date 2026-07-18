import { type ReactNode, useEffect, useState } from 'react';
import type { TrackingSettings } from '../../types';

const OPEN_SECTIONS_KEY = 'juggeffect_open_sections';

interface EffectSectionProps {
  id: string;
  title: string;
  summary: string;
  enabled?: boolean;
  enabledSettingKey?: keyof TrackingSettings;
  onEnabledChange?: (enabled: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}

function savedOpenSections(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_SECTIONS_KEY) ?? 'null');
    return Array.isArray(saved) && saved.every((value) => typeof value === 'string') ? saved : null;
  } catch {
    return null;
  }
}

export function EffectSection({
  id,
  title,
  summary,
  enabled,
  enabledSettingKey,
  onEnabledChange,
  onOpenChange,
  defaultOpen = false,
  children,
}: EffectSectionProps) {
  const [isOpen, setIsOpen] = useState(() => savedOpenSections()?.includes(id) ?? defaultOpen);

  useEffect(() => onOpenChange?.(isOpen), [isOpen, onOpenChange]);

  return (
    <details
      id={id}
      open={isOpen}
      tabIndex={-1}
      className="rounded-lg border border-neutral-800 bg-neutral-900/70"
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open);
        const openSections = new Set(savedOpenSections() ?? []);
        if (event.currentTarget.open) openSections.add(id);
        else openSections.delete(id);
        try {
          localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify([...openSections]));
        } catch {
          // Settings remain usable when storage is unavailable.
        }
      }}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 px-3 py-2.5 marker:content-none">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-100">{title}</span>
          <span className="block truncate text-xs text-neutral-500">{summary}</span>
        </span>
        {enabled !== undefined && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`Enable ${title}`}
            data-setting-key={enabledSettingKey}
            data-setting-control
            className={`min-h-10 rounded px-3 py-1 text-xs ${enabled ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEnabledChange?.(!enabled);
            }}
          >
            {enabled ? 'On' : 'Off'}
          </button>
        )}
      </summary>
      <div className="border-t border-neutral-800 px-3 py-3">{children}</div>
    </details>
  );
}

export type { EffectSectionProps };
