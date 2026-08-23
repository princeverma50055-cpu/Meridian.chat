'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex gap-1 overflow-x-auto sm:w-44 sm:flex-none sm:flex-col sm:gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors',
              active === tab.id
                ? 'bg-cobalt/10 text-cobalt'
                : 'text-slate hover:bg-surface-light dark:hover:bg-surface-dark-raised'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1">{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}
