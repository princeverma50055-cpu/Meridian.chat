import type { ReactNode } from 'react';

export function SettingsRow({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-border py-4 last:border-0 dark:border-slate-border-dark">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-ink dark:text-paper">{label}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-slate">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-cobalt' : 'bg-slate-border dark:bg-slate-border-dark'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
