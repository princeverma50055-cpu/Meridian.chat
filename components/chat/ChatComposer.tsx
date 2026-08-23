'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Globe, Telescope, Wrench, Mic, ArrowUp, Square, X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Tooltip } from '@/components/ui/Tooltip';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { cn } from '@/lib/utils/cn';

type AttachmentStatus = 'uploading' | 'ready' | 'unsupported' | 'error';

interface PendingAttachment {
  id: string; // temporary client-side id until upload resolves, then the real fileId
  name: string;
  sizeLabel: string;
  status: AttachmentStatus;
  error?: string;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isGenerating: boolean;
  onStop: () => void;
  model: string;
  onModelChange: (id: string) => void;
  conversationId?: string;
  onAttachedFileIdsChange: (fileIds: string[]) => void;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (enabled: boolean) => void;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  isGenerating,
  onStop,
  model,
  onModelChange,
  conversationId,
  onAttachedFileIdsChange,
  webSearchEnabled,
  onWebSearchEnabledChange
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deepResearchOn, setDeepResearchOn] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    const readyIds = attachments.filter((a) => a.status === 'ready').map((a) => a.id);
    onAttachedFileIdsChange(readyIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isGenerating) onSend();
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);

    for (const file of incoming) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setAttachments((prev) => [
        ...prev,
        { id: tempId, name: file.name, sizeLabel: formatBytes(file.size), status: 'uploading' }
      ]);

      const formData = new FormData();
      formData.append('file', file);
      if (conversationId) formData.append('conversationId', conversationId);

      try {
        const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === tempId ? { ...a, status: 'error', error: data.error ?? 'Upload failed' } : a
            )
          );
          continue;
        }

        setAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? { ...a, id: data.file.id, status: data.file.status, error: data.note }
              : a
          )
        );
      } catch {
        setAttachments((prev) =>
          prev.map((a) => (a.id === tempId ? { ...a, status: 'error', error: 'Network error' } : a))
        );
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-chat px-4 pb-3 pt-2 sm:pb-5">
      <div className="rounded-2xl border border-slate-border bg-white shadow-sm transition-colors focus-within:border-cobalt dark:border-slate-border-dark dark:bg-surface-dark-raised">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-border px-3 pt-3 dark:border-slate-border-dark">
            {attachments.map((a) => (
              <Tooltip key={a.id} content={a.error ?? a.status}>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]',
                    a.status === 'error'
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-surface-light dark:bg-surface-dark'
                  )}
                >
                  {a.status === 'uploading' ? (
                    <Loader2 size={13} className="animate-spin text-cobalt" />
                  ) : a.status === 'error' ? (
                    <AlertCircle size={13} />
                  ) : (
                    <FileText size={13} className="text-cobalt" />
                  )}
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <span className="text-slate-light">{a.sizeLabel}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    aria-label={`Remove ${a.name}`}
                    className="text-slate-light hover:text-ink dark:hover:text-paper"
                  >
                    <X size={12} />
                  </button>
                </div>
              </Tooltip>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          className="max-h-[200px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-6 text-ink outline-none placeholder:text-slate-light dark:text-paper"
        />

        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Dropdown
              trigger={
                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark">
                  <Plus size={17} />
                </button>
              }
            >
              <DropdownItem onClick={() => fileInputRef.current?.click()}>
                <FileText size={14} /> Upload file or image
              </DropdownItem>
            </Dropdown>

            <ToggleIconButton
              icon={<Globe size={15} />}
              label="Web search"
              active={webSearchEnabled}
              onClick={() => onWebSearchEnabledChange(!webSearchEnabled)}
            />
            <ToggleIconButton
              icon={<Telescope size={15} />}
              label="Deep research"
              active={deepResearchOn}
              onClick={() => setDeepResearchOn((v) => !v)}
            />
            <Tooltip content="Tools">
              <button className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark sm:flex">
                <Wrench size={15} />
              </button>
            </Tooltip>

            <div className="ml-1 hidden sm:block">
              <ModelSelector selected={model} onSelect={onModelChange} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip content={recording ? 'Stop recording' : 'Voice input'}>
              <button
                onClick={() => setRecording((v) => !v)}
                aria-pressed={recording}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark',
                  recording && 'bg-red-500/10 text-red-500'
                )}
              >
                <Mic size={16} />
              </button>
            </Tooltip>

            {isGenerating ? (
              <button
                onClick={onStop}
                aria-label="Stop generating"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white dark:bg-paper dark:text-ink"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!value.trim()}
                aria-label="Send message"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cobalt text-white transition-colors hover:bg-cobalt-dim disabled:bg-slate-border disabled:text-slate-light"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-light">
        Meridian can make mistakes. Verify important information.
      </p>
    </div>
  );
}

function ToggleIconButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label}>
      <button
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg px-2 text-slate hover:bg-surface-light dark:hover:bg-surface-dark',
          active && 'bg-cobalt/10 text-cobalt hover:bg-cobalt/10'
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
