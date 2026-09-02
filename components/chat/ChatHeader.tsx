'use client';

import {
  Archive,
  Check,
  Loader2,
  Menu,
  MoreHorizontal,
  Pin,
  Trash2,
  Share2
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Dropdown,
  DropdownItem
} from '@/components/ui/Dropdown';
import { Tooltip } from '@/components/ui/Tooltip';
import { useSidebarState } from '@/components/layout/SidebarContext';

interface ChatHeaderProps {
  title: string;
}

export function ChatHeader({
  title
}: ChatHeaderProps) {
  const { openMobile } =
    useSidebarState();

  const router = useRouter();

  const params = useParams<{
    id?: string;
  }>();

  const conversationId =
    typeof params?.id === 'string'
      ? params.id
      : undefined;

  const [busy, setBusy] =
    useState<
      'share' |
      'pin' |
      'archive' |
      'delete' |
      null
    >(null);

  const [shared, setShared] =
    useState(false);

  async function updateConversation(
    body: Record<string, unknown>
  ) {
    if (!conversationId || busy) {
      return null;
    }

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to update conversation.'
        );
      }

      return data;
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to update conversation.'
      );

      return null;
    }
  }

  async function handleShare() {
    if (!conversationId || busy) {
      return;
    }

    setBusy('share');

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            share: true
          })
        }
      );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to create share link.'
        );
      }

      const token =
        data?.conversation?.shareToken;

      if (
        typeof token !== 'string' ||
        !token
      ) {
        throw new Error(
          'Share token was not returned.'
        );
      }

      const shareUrl =
        `${window.location.origin}/api/share/${token}`;

      try {
        await navigator.clipboard.writeText(
          shareUrl
        );
      } catch {
        window.prompt(
          'Copy this share link:',
          shareUrl
        );
        return;
      }

      setShared(true);

      window.setTimeout(() => {
        setShared(false);
      }, 1800);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to create share link.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function handlePin() {
    if (!conversationId || busy) {
      return;
    }

    setBusy('pin');

    const result =
      await updateConversation({
        pinned: true
      });

    setBusy(null);

    if (result) {
      router.refresh();
    }
  }

  async function handleArchive() {
    if (!conversationId || busy) {
      return;
    }

    setBusy('archive');

    const result =
      await updateConversation({
        archived: true
      });

    setBusy(null);

    if (result) {
      router.push('/');
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!conversationId || busy) {
      return;
    }

    const confirmed =
      window.confirm(
        'Delete this conversation permanently? This action cannot be undone.'
      );

    if (!confirmed) {
      return;
    }

    setBusy('delete');

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}`,
        {
          method: 'DELETE'
        }
      );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to delete conversation.'
        );
      }

      router.push('/');
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to delete conversation.'
      );
      setBusy(null);
    }
  }

  const isBusy = busy !== null;

  return (
    <header className="safe-top flex h-14 items-center justify-between border-b border-slate-border px-3 dark:border-slate-border-dark">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={openMobile}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate transition-colors hover:bg-surface-light dark:hover:bg-surface-dark-raised md:hidden"
        >
          <Menu size={18} />
        </button>

        <h1 className="truncate text-[14px] font-medium text-ink dark:text-paper">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        {conversationId && (
          <Tooltip
            content={
              shared
                ? 'Share link copied'
                : 'Share conversation'
            }
          >
            <button
              type="button"
              onClick={handleShare}
              disabled={isBusy}
              aria-label="Share conversation"
              className="hidden rounded-lg p-2 text-slate transition-colors hover:bg-surface-light disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-surface-dark-raised sm:flex"
            >
              {busy === 'share' ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : shared ? (
                <Check size={16} />
              ) : (
                <Share2 size={16} />
              )}
            </button>
          </Tooltip>
        )}

        {conversationId && (
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                aria-label="More options"
                disabled={isBusy}
                className="rounded-lg p-2 text-slate transition-colors hover:bg-surface-light disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-surface-dark-raised"
              >
                {isBusy ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <MoreHorizontal size={16} />
                )}
              </button>
            }
          >
            <DropdownItem
              onClick={handleShare}
            >
              <Share2 size={14} />
              Share conversation
            </DropdownItem>

            <DropdownItem
              onClick={handlePin}
            >
              <Pin size={14} />
              Pin conversation
            </DropdownItem>

            <DropdownItem
              onClick={handleArchive}
            >
              <Archive size={14} />
              Archive conversation
            </DropdownItem>

            <DropdownItem
              onClick={handleDelete}
            >
              <Trash2
                size={14}
                className="text-red-500"
              />
              <span className="text-red-600 dark:text-red-400">
                Delete conversation
              </span>
            </DropdownItem>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
