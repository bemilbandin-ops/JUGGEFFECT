import { type ReactNode, useId } from 'react';

interface SettingRowProps {
  label: string;
  description: string;
  changed?: boolean;
  disabledReason?: string;
  onReset?: () => void;
  children: ReactNode;
}

export function SettingRow({
  label,
  description,
  changed = false,
  disabledReason,
  onReset,
  children,
}: SettingRowProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex gap-3 border-b border-neutral-800 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span id={labelId} className="text-sm text-neutral-200">{label}</span>
          {changed && <span className="text-xs text-amber-400">Changed</span>}
        </div>
        <p id={descriptionId} className="mt-0.5 text-xs text-neutral-500">{description}</p>
        {disabledReason && <p className="mt-1 text-xs text-neutral-400">{disabledReason}</p>}
      </div>
      <div aria-labelledby={labelId} aria-describedby={descriptionId} aria-disabled={disabledReason ? true : undefined}>
        {children}
      </div>
      {changed && onReset && (
        <button type="button" className="text-xs text-neutral-400 hover:text-white" onClick={onReset}>
          Reset
        </button>
      )}
    </div>
  );
}

export type { SettingRowProps };
