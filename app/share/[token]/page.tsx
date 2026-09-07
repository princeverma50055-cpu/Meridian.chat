import { notFound } from 'next/navigation';

import { getSharedConversation } from '@/lib/db/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SharedMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string | Date;
}

function formatDate(value: string | Date) {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return '';
  }
}

export default async function SharedConversationPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const safeToken =
    typeof token === 'string' ? token.trim() : '';

  const data = safeToken
    ? await getSharedConversation(safeToken)
    : null;

  if (!data) {
    notFound();
  }

  const { conversation, messages } = data;
  const visibleMessages = (
    messages as SharedMessage[]
  ).filter((message) => message.role !== 'system');

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col gap-6 overflow-y-auto px-4 py-10 sm:px-6">
      <header className="border-b border-black/10 pb-6 dark:border-white/10">
        <p className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
          Shared conversation · Meridian AI
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-white">
          {conversation.title || 'Untitled conversation'}
        </h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {formatDate(conversation.createdAt)}
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {visibleMessages.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            This conversation has no messages yet.
          </p>
        ) : (
          visibleMessages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-2xl bg-black px-4 py-3 text-white dark:bg-white dark:text-black'
                  : 'mr-auto max-w-[85%] rounded-2xl bg-black/5 px-4 py-3 text-black dark:bg-white/10 dark:text-white'
              }
            >
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                {message.content}
              </p>
            </article>
          ))
        )}
      </div>

      <footer className="mt-auto border-t border-black/10 pt-6 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        Shared read-only from Meridian AI. This link will stop working if the
        owner revokes sharing.
      </footer>
    </main>
  );
}
