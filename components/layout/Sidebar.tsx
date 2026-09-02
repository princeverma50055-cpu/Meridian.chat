'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Archive,
  ChevronDown,
  FolderKanban,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  open = true,
  onClose
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);
  const [loggingOut, setLoggingOut] =
    useState(false);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }

    return pathname === path ||
      pathname.startsWith(`${path}/`);
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await signOut({
        callbackUrl: '/login'
      });
    } catch (error) {
      console.error(
        '[sidebar] Logout failed:',
        error
      );

      setLoggingOut(false);
    }
  };

  const navigate = (path: string) => {
    router.push(path);
    onClose?.();
  };

  if (!open) {
    return null;
  }

  return (
    <aside className="flex h-full w-full max-w-[280px] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
            <Sparkles size={18} />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Meridian AI
          </span>
        </Link>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          <Plus size={17} />
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Workspace
        </div>

        <div className="space-y-1">
          <SidebarLink
            href="/"
            icon={<MessageSquare size={17} />}
            label="Chats"
            active={isActive('/')}
            onClick={onClose}
          />

          <SidebarLink
            href="/search"
            icon={<Search size={17} />}
            label="Search"
            active={isActive('/search')}
            onClick={onClose}
          />

          <SidebarLink
            href="/projects"
            icon={<FolderKanban size={17} />}
            label="Projects"
            active={isActive('/projects')}
            onClick={onClose}
          />

          <SidebarLink
            href="/library"
            icon={<Archive size={17} />}
            label="Library"
            active={isActive('/library')}
            onClick={onClose}
          />
        </div>

        <div className="mb-2 mt-7 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Account
        </div>

        <div className="space-y-1">
          <SidebarLink
            href="/settings"
            icon={<Settings size={17} />}
            label="Settings"
            active={isActive('/settings')}
            onClick={onClose}
          />
        </div>
      </nav>

      <div className="relative border-t border-zinc-200 p-3 dark:border-zinc-800">
        {userMenuOpen && (
          <div className="absolute bottom-[calc(100%+8px)] left-3 right-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Settings size={17} />
              Settings
            </button>

            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Trash2 size={17} />
              Account settings
            </button>

            <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/30"
            >
              <LogOut size={17} />

              {loggingOut
                ? 'Logging out...'
                : 'Log out'}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            setUserMenuOpen(
              (current) => !current
            )
          }
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
          aria-expanded={userMenuOpen}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            M
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              Meridian User
            </div>

            <div className="truncate text-xs text-zinc-500">
              Account
            </div>
          </div>

          <ChevronDown
            size={17}
            className={`shrink-0 text-zinc-500 transition-transform ${
              userMenuOpen
                ? 'rotate-180'
                : ''
            }`}
          />
        </button>
      </div>
    </aside>
  );
}

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarLink({
  href,
  icon,
  label,
  active = false,
  onClick
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-white'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
