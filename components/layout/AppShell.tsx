'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar, type ConversationSummary } from '@/components/layout/Sidebar';
import { SidebarStateProvider, useSidebarState } from '@/components/layout/SidebarContext';

function ShellInner({
  children,
  activeConversationId
}: {
  children: ReactNode;
  activeConversationId?: string;
}) {
  const { mobileOpen, closeMobile } = useSidebarState();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/conversations')
      .then((res) => (res.ok ? res.json() : { conversations: [] }))
      .then((data) => {
        if (!cancelled) setConversations(data.conversations ?? []);
      })
      // No backend configured yet (see README) — sidebar just shows no recent
      // conversations rather than fabricating fake history.
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-paper dark:bg-ink">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function AppShell({
  children,
  activeConversationId
}: {
  children: ReactNode;
  activeConversationId?: string;
}) {
  return (
    <SidebarStateProvider>
      <ShellInner activeConversationId={activeConversationId}>{children}</ShellInner>
    </SidebarStateProvider>
  );
}
