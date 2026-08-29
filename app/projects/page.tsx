'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { FolderKanban } from 'lucide-react';

export default function ProjectsPage() {
  return (
    <AppShell>
      <ChatHeader title="Projects" />
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <FolderKanban size={32} className="text-cobalt" />
        <h1 className="font-display text-xl font-medium text-ink dark:text-paper">
          Projects are coming soon
        </h1>
        <p className="max-w-sm text-[13.5px] text-slate">
          Group files, instructions, and conversations into a shared workspace. Not built yet.
        </p>
      </div>
    </AppShell>
  );
}
