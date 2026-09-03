'use client';

import { Menu, X } from 'lucide-react';
import { type ReactNode } from 'react';

import Sidebar from '@/components/layout/Sidebar';
import {
  SidebarStateProvider,
  useSidebarState,
} from '@/components/layout/SidebarContext';

interface AppShellProps {
  children: ReactNode;
  activeConversationId?: string;
}

function AppShellContent({
  children,
  activeConversationId,
}: AppShellProps) {
  const {
    mobileOpen,
    openMobile,
    closeMobile,
  } = useSidebarState();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-ink dark:bg-surface-dark dark:text-paper">
      {/* Desktop sidebar */}
      <div className="hidden h-full w-[280px] shrink-0 md:block">
        <Sidebar
          open
          activeConversationId={activeConversationId}
        />
      </div>

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
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMobile}
              className="absolute right-2 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-md dark:bg-zinc-900 dark:text-zinc-200"
            >
              <X size={18} />
            </button>

            <Sidebar
              open
              onClose={closeMobile}
              activeConversationId={activeConversationId}
            />
          </div>
        </div>
      )}

      {/* Main application area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex h-14 shrink-0 items-center border-b border-slate-border px-3 md:hidden dark:border-slate-border-dark">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={openMobile}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark-raised"
          >
            <Menu size={21} />
          </button>

          <div className="ml-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
              <span className="text-sm font-semibold">
                M
              </span>
            </div>

            <span className="text-sm font-semibold">
              Meridian AI
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Named export
 *
 * Some pages import:
 * import { AppShell } from '@/components/layout/AppShell';
 */
export function AppShell(props: AppShellProps) {
  return (
    <SidebarStateProvider>
      <AppShellContent {...props} />
    </SidebarStateProvider>
  );
}

/**
 * Default export
 *
 * Other pages/components may import:
 * import AppShell from '@/components/layout/AppShell';
 */
export default AppShell;
