'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Bot } from 'lucide-react';

export default function AgentsPage() {
  return (
    <AppShell>
      <ChatHeader title="Agents" />
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <Bot size={32} className="text-cobalt" />
        <h1 className="font-display text-xl font-medium text-ink dark:text-paper">
          Custom agents are coming soon
        </h1>
        <p className="max-w-sm text-[13.5px] text-slate">
          Build agents with their own instructions, tools, and personality. Not built yet.
        </p>
      </div>
    </AppShell>
  );
}
