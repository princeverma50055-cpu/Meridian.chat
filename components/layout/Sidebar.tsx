'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  FolderKanban,
  Bot,
  Library,
  Settings,
  X
} from 'lucide-react';
import { MeridianMark } from '@/components/ui/MeridianMark';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils/cn';

export interface ConversationSummary {
  id: string;
  title: string;
}

interface SidebarProps {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  conversations,
  activeConversationId,
  mobileOpen,
  onMobileClose
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-slate-border bg-surface-light transition-all duration-200 dark:border-slate-border-dark dark:bg-surface-dark md:static md:z-auto',
          collapsed ? 'md:w-[64px]' : 'md:w-[272px]',
          mobileOpen ? 'w-[280px] translate-x-0' : '-translate-x-full md:translate-x-0 md:w-auto'
        )}
      >
        {/* Header */}
        <div className="safe-top flex items-center justify-between px-3 pt-3">
          <Link href="/" className="flex items-center gap-2 px-1.5 py-2">
            <MeridianMark size={22} />
            {!collapsed && (
              <span className="font-display text-[15px] font-medium tracking-tight">
                Meridian
              </span>
            )}
          </Link>
          <button
            className="hidden rounded-lg p-1.5 text-slate hover:bg-slate-border/40 md:block"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button
            className="rounded-lg p-1.5 text-slate hover:bg-slate-border/40 md:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary actions */}
        <div className="mt-2 flex flex-col gap-1 px-2">
          <SidebarLink href="/" icon={<Plus size={17} />} label="New chat" collapsed={collapsed} primary />
          <SidebarLink href="/search" icon={<Search size={17} />} label="Search" collapsed={collapsed} />
        </div>

        {/* Sections */}
        <nav className="mt-4 flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
          {!collapsed && conversations.length > 0 && (
            <SidebarSection label="Recent">
              {conversations.map((c) => (
                <SidebarLink
                  key={c.id}
                  href={`/c/${c.id}`}
                  label={c.title}
                  collapsed={collapsed}
                  active={c.id === activeConversationId}
                  truncate
                />
              ))}
            </SidebarSection>
          )}

          <SidebarSection label={collapsed ? undefined : 'Workspace'}>
            <SidebarLink
              href="/projects"
              icon={<FolderKanban size={17} />}
              label="Projects"
              collapsed={collapsed}
            />
            <SidebarLink href="/agents" icon={<Bot size={17} />} label="Agents" collapsed={collapsed} />
            <SidebarLink href="/library" icon={<Library size={17} />} label="Library" collapsed={collapsed} />
          </SidebarSection>
        </nav>

        {/* Footer */}
        <div className="safe-bottom border-t border-slate-border px-2 py-2 dark:border-slate-border-dark">
          <SidebarLink
            href="/settings"
            icon={<Settings size={17} />}
            label="Settings"
            collapsed={collapsed}
          />
          <Link
            href="/profile"
            className={cn(
              'mt-1 flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-border/30',
              collapsed && 'justify-center'
            )}
          >
            <Avatar name="Prince Verma" size={26} />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">Prince Verma</p>
                <p className="truncate text-[11px] text-slate">Free plan</p>
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}

function SidebarSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      {label && (
        <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-light">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  collapsed,
  active,
  primary,
  truncate
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
  collapsed: boolean;
  active?: boolean;
  primary?: boolean;
  truncate?: boolean;
}) {
  const content = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] transition-colors',
        collapsed && 'justify-center px-0 py-2.5',
        primary && 'border border-cobalt/30 text-cobalt hover:bg-cobalt/5',
        active && 'bg-cobalt/10 font-medium text-cobalt',
        !active && !primary && 'text-ink hover:bg-slate-border/30 dark:text-paper'
      )}
    >
      {icon}
      {!collapsed && <span className={cn(truncate && 'truncate')}>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return <Tooltip content={label}>{content}</Tooltip>;
  }
  return content;
}
