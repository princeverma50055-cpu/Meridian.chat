'use client';

import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { SidebarStateProvider, useSidebarState } from '@/components/layout/SidebarContext';

interface AppShellProps {
  children: ReactNode;
  activeConversationId?: string;
}

export function AppShell({
  children,
  activeConversationId
}: AppShellProps) {
  return (
    <SidebarStateProvider>
      <AppShellInner activeConversationId={activeConversationId}>
        {children}
      </AppShellInner>
    </SidebarStateProvider>
  );
}

function AppShellInner({
  children,
  activeConversationId
}: {
  children: ReactNode;
  activeConversationId?: string;
}) {
  const {
    mobileOpen,
    closeMobile,
    openMobile
  } = useSidebarState();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white text-ink dark:bg-ink dark:text-paper">
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[280px] shrink-0 md:block">
        <Sidebar
          open={true}
          activeConversationId={activeConversationId}
        />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={closeMobile}
            className="absolute inset-0 bg-black/50"
          />

          <div className="relative z-10 h-full w-[280px]">
            <div className="absolute right-2 top-3 z-30">
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMobile}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-ink shadow-md dark:bg-surface-dark-raised dark:text-paper"
              >
                <X size={18} />
              </button>
            </div>

            <Sidebar
              open={true}
              onClose={closeMobile}
              activeConversationId={activeConversationId}
            />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="safe-top flex h-14 shrink-0 items-center border-b border-slate-border px-3 dark:border-slate-border-dark md:hidden">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={openMobile}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate transition hover:bg-surface-light dark:hover:bg-surface-dark"
          >
            <Menu size={21} />
          </button>

          <div className="ml-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
              <span className="text-sm font-semibold">
                M
              </span>
            </div>

            <span className="text-sm font-semibold text-ink dark:text-paper">
              Meridian AI
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;
