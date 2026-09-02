'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Archive,
  ChevronDown,
  FolderKanban,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Loader2
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState
} from 'react';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  activeConversationId?: string;
}

interface Conversation {
  id: string;
  title: string;
  pinned?: boolean;
  archived?: boolean;
  updatedAt?: string;
}

interface ConversationsResponse {
  conversations?: Conversation[];
  hasMore?: boolean;
}

export default function Sidebar({
  open = true,
  onClose,
  activeConversationId
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [loadingConversations, setLoadingConversations] =
    useState(false);

  const [conversationError, setConversationError] =
    useState<string | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }

    return (
      pathname === path ||
      pathname.startsWith(`${path}/`)
    );
  };

  const loadConversations = useCallback(
    async () => {
      try {
        setLoadingConversations(true);
        setConversationError(null);

        const response = await fetch(
          '/api/conversations?page=1&pageSize=100',
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include'
          }
        );

        if (response.status === 401) {
          setConversations([]);
          return;
        }

        if (!response.ok) {
          throw new Error(
            'Failed to load chat history.'
          );
        }

        const data =
          (await response.json()) as ConversationsResponse;

        setConversations(
          Array.isArray(data.conversations)
            ? data.conversations
            : []
        );
      } catch (error) {
        console.error(
          '[sidebar] Failed to load conversations:',
          error
        );

        setConversationError(
          'Unable to load history.'
        );
      } finally {
        setLoadingConversations(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, pathname]);

  useEffect(() => {
    const handleConversationChange =
      () => {
        void loadConversations();
      };

    window.addEventListener(
      'meridian:conversations-changed',
      handleConversationChange
    );

    return () => {
      window.removeEventListener(
        'meridian:conversations-changed',
        handleConversationChange
      );
    };
  }, [loadConversations]);

  const handleDeleteConversation =
    async (
      event: React.MouseEvent,
      id: string
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (deletingId) {
        return;
      }

      const confirmed =
        window.confirm(
          'Delete this conversation? This action cannot be undone.'
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingId(id);

        const response =
          await fetch(
            `/api/conversations/${id}`,
            {
              method: 'DELETE',
              credentials: 'include'
            }
          );

        if (response.status === 401) {
          router.push('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(
            'Failed to delete conversation.'
          );
        }

        setConversations(
          (current) =>
            current.filter(
              (conversation) =>
                conversation.id !== id
            )
        );

        if (
          activeConversationId === id ||
          pathname === `/c/${id}`
        ) {
          router.push('/');
        }

        window.dispatchEvent(
          new Event(
            'meridian:conversations-changed'
          )
        );
      } catch (error) {
        console.error(
          '[sidebar] Delete conversation failed:',
          error
        );

        window.alert(
          'Unable to delete this conversation.'
        );
      } finally {
        setDeletingId(null);
      }
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

  const userName =
    session?.user?.name ||
    session?.user?.email?.split('@')[0] ||
    'Meridian User';

  const userEmail =
    session?.user?.email ||
    'Account';

  const pinned =
    conversations.filter(
      (conversation) =>
        conversation.pinned
    );

  const recent =
    conversations.filter(
      (conversation) =>
        !conversation.pinned
    );

  return (
    <aside className="flex h-full w-full max-w-[280px] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">

      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
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

      {/* New chat */}
      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          <Plus size={17} />
          New chat
        </button>
      </div>

      {/* Main navigation + history */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">

        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Workspace
        </div>

        <div className="space-y-1">
          <SidebarLink
            href="/"
            icon={
              <MessageSquare
                size={17}
              />
            }
            label="Chats"
            active={
              isActive('/') ||
              pathname.startsWith('/c/')
            }
            onClick={onClose}
          />

          <SidebarLink
            href="/search"
            icon={
              <Search size={17} />
            }
            label="Search"
            active={isActive('/search')}
            onClick={onClose}
          />

          <SidebarLink
            href="/projects"
            icon={
              <FolderKanban
                size={17}
              />
            }
            label="Projects"
            active={isActive('/projects')}
            onClick={onClose}
          />

          <SidebarLink
            href="/library"
            icon={
              <Archive size={17} />
            }
            label="Library"
            active={isActive('/library')}
            onClick={onClose}
          />
        </div>

        {/* Chat history */}
        <div className="mt-7">

          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Recent chats
            </span>

            {loadingConversations && (
              <Loader2
                size={13}
                className="animate-spin text-zinc-400"
              />
            )}
          </div>

          {conversationError && (
            <button
              type="button"
              onClick={() =>
                void loadConversations()
              }
              className="mb-2 w-full rounded-lg px-2 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              {conversationError}
              <span className="ml-1 underline">
                Retry
              </span>
            </button>
          )}

          {!loadingConversations &&
            conversations.length === 0 && (
              <div className="px-2 py-2 text-xs leading-5 text-zinc-400">
                Your saved chats will appear here.
              </div>
            )}

          {pinned.length > 0 && (
            <div className="mb-3 space-y-1">
              <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                Pinned
              </div>

              {pinned.map(
                (conversation) => (
                  <ConversationLink
                    key={conversation.id}
                    conversation={conversation}
                    active={
                      activeConversationId ===
                        conversation.id ||
                      pathname ===
                        `/c/${conversation.id}`
                    }
                    deleting={
                      deletingId ===
                      conversation.id
                    }
                    onClick={onClose}
                    onDelete={
                      handleDeleteConversation
                    }
                  />
                )
              )}
            </div>
          )}

          {recent.length > 0 && (
            <div className="space-y-1">
              {recent.map(
                (conversation) => (
                  <ConversationLink
                    key={conversation.id}
                    conversation={conversation}
                    active={
                      activeConversationId ===
                        conversation.id ||
                      pathname ===
                        `/c/${conversation.id}`
                    }
                    deleting={
                      deletingId ===
                      conversation.id
                    }
                    onClick={onClose}
                    onDelete={
                      handleDeleteConversation
                    }
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Account */}
        <div className="mb-2 mt-7 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Account
        </div>

        <div className="space-y-1">
          <SidebarLink
            href="/settings"
            icon={
              <Settings size={17} />
            }
            label="Settings"
            active={isActive('/settings')}
            onClick={onClose}
          />
        </div>
      </nav>

      {/* User menu */}
      <div className="relative shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">

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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              userName
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {userName}
            </div>

            <div className="truncate text-xs text-zinc-500">
              {userEmail}
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

interface ConversationLinkProps {
  conversation: Conversation;
  active: boolean;
  deleting: boolean;
  onClick?: () => void;
  onDelete: (
    event: React.MouseEvent,
    id: string
  ) => void;
}

function ConversationLink({
  conversation,
  active,
  deleting,
  onClick,
  onDelete
}: ConversationLinkProps) {
  const title =
    conversation.title?.trim() ||
    'New chat';

  return (
    <Link
      href={`/c/${conversation.id}`}
      onClick={onClick}
      className={`group flex min-w-0 items-center gap-1 rounded-xl px-2.5 py-2 text-[13px] transition ${
        active
          ? 'bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-white'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
      }`}
    >
      <MessageSquare
        size={14}
        className="shrink-0 text-zinc-400"
      />

      <span className="min-w-0 flex-1 truncate">
        {title}
      </span>

      <button
        type="button"
        disabled={deleting}
        onClick={(event) =>
          onDelete(
            event,
            conversation.id
          )
        }
        aria-label={`Delete ${title}`}
        className="hidden shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 group-hover:block dark:hover:bg-zinc-800"
      >
        {deleting ? (
          <Loader2
            size={13}
            className="animate-spin"
          />
        ) : (
          <MoreHorizontal
            size={14}
          />
        )}
      </button>
    </Link>
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
