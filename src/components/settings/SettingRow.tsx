import { cloneElement, type ReactElement, useId } from 'react';
import type { TrackingSettings } from '../../types';

interface ControlProps {
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-disabled'?: boolean;
  disabled?: boolean;
}

interface SettingRowProps {
  settingKey: keyof TrackingSettings;
  label: string;
  description: string;
  changed?: boolean;
  disabledReason?: string;
  onReset?: () => void;
  children: ReactElement<ControlProps>;
}

export function joinAriaIds(...ids: Array<string | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined;
}

export function SettingRow({
  settingKey,
  label,
  description,
  changed = false,
  disabledReason,
  onReset,
  children,
}: SettingRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  const disabledReasonId = useId();
  const isDisabled = Boolean(disabledReason) || children.props.disabled === true || children.props['aria-disabled'] === true;
  const control = cloneElement(children, {
    'aria-labelledby': joinAriaIds(children.props['aria-labelledby'], labelId),
    'aria-describedby': joinAriaIds(children.props['aria-describedby'], descriptionId, disabledReason ? disabledReasonId : undefined),
    'aria-disabled': isDisabled ? true : children.props['aria-disabled'],
    disabled: isDisabled ? true : children.props.disabled,
    'data-setting-control': true,
  });

  return (
    <div data-setting-key={settingKey} className="flex gap-3 border-b border-neutral-800 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span id={labelId} className="text-sm text-neutral-200">{label}</span>
          {changed && <span className="text-xs text-amber-400">Changed</span>}
        </div>
        <p id={descriptionId} className="mt-0.5 text-xs text-neutral-500">{description}</p>
        {disabledReason && <p id={disabledReasonId} className="mt-1 text-xs text-neutral-400">{disabledReason}</p>}
      </div>
      <div>{control}</div>
      {changed && onReset && (
        <button type="button" className="text-xs text-neutral-400 hover:text-white" onClick={onReset}>
          Reset
        </button>
      )}
    </div>
  );
}

export type { SettingRowProps };
