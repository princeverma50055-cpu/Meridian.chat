'use client';

import { Menu, Share2, MoreHorizontal, Pin, Archive, Trash2 } from 'lucide-react';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { useSidebarState } from '@/components/layout/SidebarContext';

export function ChatHeader({ title }: { title: string }) {
  const { openMobile } = useSidebarState();

  return (
    <header className="safe-top flex h-14 items-center justify-between border-b border-slate-border px-3 dark:border-slate-border-dark">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={openMobile}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate hover:bg-surface-light dark:hover:bg-surface-dark-raised md:hidden"
        >
          <Menu size={18} />
        </button>
        <h1 className="truncate text-[14px] font-medium text-ink dark:text-paper">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <button
          aria-label="Share conversation"
          className="hidden rounded-lg p-2 text-slate hover:bg-surface-light dark:hover:bg-surface-dark-raised sm:flex"
        >
          <Share2 size={16} />
        </button>
        <Dropdown
          align="right"
          trigger={
            <button
              aria-label="More options"
              className="rounded-lg p-2 text-slate hover:bg-surface-light dark:hover:bg-surface-dark-raised"
            >
              <MoreHorizontal size={16} />
            </button>
          }
        >
          <DropdownItem>
            <Pin size={14} /> Pin conversation
          </DropdownItem>
          <DropdownItem>
            <Archive size={14} /> Archive
          </DropdownItem>
          <DropdownItem>
            <Trash2 size={14} /> Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
