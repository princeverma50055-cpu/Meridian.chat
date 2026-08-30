'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { useChat } from '@/lib/hooks/useChat';
import type { Attachment } from '@/lib/types/chat';

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const [input, setInput] = useState('');
  const [model, setModel] = useState('meridian-fast');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { messages, isGenerating, sendMessage, regenerate, stop, editMessage, loadConversation } =
    useChat(params.id);

  useEffect(() => {
    if (!params.id) return;
    loadConversation(params.id).finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function handleSend() {
    if (!input.trim() || isGenerating) return;
    const fileIds = attachedFiles.map((f) => f.id);
    sendMessage(input, model, fileIds, webSearchEnabled, attachedFiles);
    setInput('');
    setAttachedFiles([]);
  }

  const title =
    messages.length > 0 ? messages[0].content.slice(0, 48) : loaded ? 'Conversation' : 'Loading…';

  return (
    <AppShell activeConversationId={params.id}>
      <ChatHeader title={title} />
      <MessageList
        messages={messages}
        onRegenerate={(id) => regenerate(id, model)}
        onEdit={(id, content) => editMessage(id, content, model)}
      />
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isGenerating={isGenerating}
        onStop={stop}
        model={model}
        onModelChange={setModel}
        conversationId={params.id}
        onAttachedFilesChange={setAttachedFiles}
        webSearchEnabled={webSearchEnabled}
        onWebSearchEnabledChange={setWebSearchEnabled}
      />
    </AppShell>
  );
}
