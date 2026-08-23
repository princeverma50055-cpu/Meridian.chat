'use client';

import { ChevronDown, Check, Eye, Wrench } from 'lucide-react';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import type { ModelOption } from '@/lib/types/chat';

const MODELS: ModelOption[] = [
  {
    id: 'meridian-fast',
    label: 'Meridian Fast',
    provider: 'default',
    description: 'Quick answers, everyday tasks',
    supportsVision: true,
    supportsTools: true
  },
  {
    id: 'meridian-reasoning',
    label: 'Meridian Reasoning',
    provider: 'default',
    description: 'Deeper analysis, complex problems',
    supportsVision: true,
    supportsTools: true
  },
  {
    id: 'meridian-lite',
    label: 'Meridian Lite',
    provider: 'default',
    description: 'Fastest, lightweight tasks',
    supportsVision: false,
    supportsTools: false
  }
];

export { MODELS };

export function ModelSelector({
  selected,
  onSelect
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const current = MODELS.find((m) => m.id === selected) ?? MODELS[0];

  return (
    <Dropdown
      trigger={
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-light dark:text-paper dark:hover:bg-surface-dark-raised">
          {current.label}
          <ChevronDown size={14} className="text-slate" />
        </button>
      }
    >
      {MODELS.map((model) => (
        <DropdownItem key={model.id} onClick={() => onSelect(model.id)} active={model.id === selected}>
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{model.label}</p>
              <p className="truncate text-[12px] text-slate-light">{model.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {model.supportsVision && <Eye size={12} className="text-slate-light" />}
              {model.supportsTools && <Wrench size={12} className="text-slate-light" />}
              {model.id === selected && <Check size={13} className="text-cobalt" />}
            </div>
          </div>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
