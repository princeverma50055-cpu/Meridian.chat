'use client';

import {
  Menu,
  X
} from 'lucide-react';
import {
  useState,
  type ReactNode
} from 'react';
import Sidebar from '@/components/layout/Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({
  children
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar open={true} />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="absolute inset-0 bg-black/50"
          />

          <div className="relative z-10 h-full w-[280px]">
            <div className="absolute right-2 top-3 z-20">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() =>
                  setSidebarOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-md dark:bg-zinc-900 dark:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <Sidebar
              open={true}
              onClose={() =>
                setSidebarOpen(false)
              }
            />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center border-b border-zinc-200 px-3 md:hidden dark:border-zinc-800">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() =>
              setSidebarOpen(true)
            }
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
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

        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
