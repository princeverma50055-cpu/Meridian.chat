'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import {
  Plus,
  Globe,
  Telescope,
  Wrench,
  Mic,
  ArrowUp,
  Square,
  X,
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';

import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Tooltip } from '@/components/ui/Tooltip';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { cn } from '@/lib/utils/cn';
import type { Attachment } from '@/lib/types/chat';

type AttachmentStatus =
  | 'uploading'
  | 'ready'
  | 'unsupported'
  | 'error';

interface PendingAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
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

  onAttachedFilesChange: (
    files: Attachment[]
  ) => void;

  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (
    enabled: boolean
  ) => void;

  deepResearchEnabled: boolean;
  onDeepResearchEnabledChange: (
    enabled: boolean
  ) => void;
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
  onAttachedFilesChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  deepResearchEnabled,
  onDeepResearchEnabledChange
}: ChatComposerProps) {
  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const recognitionRef =
    useRef<any>(null);

  const [attachments, setAttachments] =
    useState<PendingAttachment[]>([]);

  const [recording, setRecording] =
    useState(false);

  const [voiceSupported, setVoiceSupported] =
    useState(true);

  /*
   * ---------------------------------------------------------
   * Auto resize textarea
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const el = textareaRef.current;

    if (!el) return;

    el.style.height = 'auto';
    el.style.height = `${Math.min(
      el.scrollHeight,
      200
    )}px`;
  }, [value]);

  /*
   * ---------------------------------------------------------
   * Expose only successfully uploaded files
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const readyFiles: Attachment[] =
      attachments
        .filter(
          (attachment) =>
            attachment.status === 'ready'
        )
        .map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          type: attachment.mimeType,
          sizeBytes: attachment.sizeBytes
        }));

    onAttachedFilesChange(readyFiles);

    // onAttachedFilesChange intentionally excluded
    // because parent setter is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  /*
   * ---------------------------------------------------------
   * Browser speech recognition
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    let baseValue = '';

    recognition.onstart = () => {
      baseValue = value;
    };

    recognition.onresult = (event: any) => {
      let transcript = '';

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i += 1
      ) {
        transcript +=
          event.results[i][0].transcript;
      }

      const nextValue = baseValue
        ? `${baseValue} ${transcript}`
        : transcript;

      onChange(nextValue);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }

      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    };

    // Speech recognition is initialized once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRecording() {
    if (!recognitionRef.current) return;

    if (recording) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors.
      }

      setRecording(false);
      return;
    }

    try {
      recognitionRef.current.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * Keyboard send
   * ---------------------------------------------------------
   */

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        value.trim() &&
        !isGenerating
      ) {
        onSend();
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * File upload
   * ---------------------------------------------------------
   */

  async function handleFiles(
    fileList: FileList | null
  ) {
    if (!fileList) return;

    const incomingFiles =
      Array.from(fileList);

    for (const file of incomingFiles) {
      const temporaryId =
        `temp-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      setAttachments((previous) => [
        ...previous,
        {
          id: temporaryId,
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          status: 'uploading'
        }
      ]);

      const formData =
        new FormData();

      formData.append(
        'file',
        file
      );

      if (conversationId) {
        formData.append(
          'conversationId',
          conversationId
        );
      }

      try {
        const response =
          await fetch(
            '/api/files/upload',
            {
              method: 'POST',
              body: formData
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setAttachments(
            (previous) =>
              previous.map(
                (attachment) =>
                  attachment.id ===
                  temporaryId
                    ? {
                        ...attachment,
                        status: 'error',
                        error:
                          data.error ??
                          'Upload failed'
                      }
                    : attachment
              )
          );

          continue;
        }

        const uploadedFile =
          data.file;

        setAttachments(
          (previous) =>
            previous.map(
              (attachment) =>
                attachment.id ===
                temporaryId
                  ? {
                      ...attachment,
                      id: uploadedFile.id,
                      mimeType:
                        uploadedFile.mimeType,
                      sizeBytes:
                        uploadedFile.sizeBytes,
                      status:
                        uploadedFile.status,
                      error:
                        data.note
                    }
                  : attachment
            )
        );
      } catch {
        setAttachments(
          (previous) =>
            previous.map(
              (attachment) =>
                attachment.id ===
                temporaryId
                  ? {
                      ...attachment,
                      status: 'error',
                      error:
                        'Network error'
                    }
                  : attachment
            )
        );
      }
    }

    /*
     * Allow selecting the same file again.
     */
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeAttachment(
    attachmentId: string
  ) {
    setAttachments((previous) =>
      previous.filter(
        (attachment) =>
          attachment.id !==
          attachmentId
      )
    );
  }

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="mx-auto w-full max-w-chat px-4 pb-3 pt-2 sm:pb-5">
      <div className="rounded-2xl border border-slate-border bg-white shadow-sm transition-colors focus-within:border-cobalt dark:border-slate-border-dark dark:bg-surface-dark-raised">

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-border px-3 pt-3 dark:border-slate-border-dark">
            {attachments.map(
              (attachment) => (
                <Tooltip
                  key={attachment.id}
                  content={
                    attachment.error ??
                    attachment.status
                  }
                >
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]',
                      attachment.status ===
                        'error'
                        ? 'bg-red-500/10 text-red-600'
                        : 'bg-surface-light dark:bg-surface-dark'
                    )}
                  >
                    {attachment.status ===
                    'uploading' ? (
                      <Loader2
                        size={13}
                        className="animate-spin text-cobalt"
                      />
                    ) : attachment.status ===
                      'error' ? (
                      <AlertCircle
                        size={13}
                      />
                    ) : (
                      <FileText
                        size={13}
                        className="text-cobalt"
                      />
                    )}

                    <span className="max-w-[140px] truncate">
                      {attachment.name}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        removeAttachment(
                          attachment.id
                        )
                      }
                      aria-label={`Remove ${attachment.name}`}
                      className="text-slate-light hover:text-ink dark:hover:text-paper"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </Tooltip>
              )
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
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
              onChange={(event) =>
                handleFiles(
                  event.target.files
                )
              }
            />

            <Dropdown
              trigger={
                <button
                  type="button"
                  aria-label="Add attachment"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark"
                >
                  <Plus size={17} />
                </button>
              }
            >
              <DropdownItem
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <FileText size={14} />
                Upload file or image
              </DropdownItem>
            </Dropdown>

            <ToggleIconButton
              icon={
                <Globe size={15} />
              }
              label="Web search"
              active={
                webSearchEnabled
              }
              onClick={() =>
                onWebSearchEnabledChange(
                  !webSearchEnabled
                )
              }
            />

            <ToggleIconButton
              icon={
                <Telescope size={15} />
              }
              label="Deep research"
              active={
                deepResearchEnabled
              }
              onClick={() =>
                onDeepResearchEnabledChange(
                  !deepResearchEnabled
                )
              }
            />

            <Tooltip content="Tools">
              <button
                type="button"
                aria-label="Tools"
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark sm:flex"
              >
                <Wrench size={15} />
              </button>
            </Tooltip>

            <div className="ml-1 hidden sm:block">
              <ModelSelector
                selected={model}
                onSelect={onModelChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip
              content={
                !voiceSupported
                  ? 'Voice input not supported in this browser'
                  : recording
                    ? 'Stop recording'
                    : 'Voice input'
              }
            >
              <button
                type="button"
                onClick={
                  toggleRecording
                }
                disabled={
                  !voiceSupported
                }
                aria-pressed={
                  recording
                }
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-surface-light dark:hover:bg-surface-dark disabled:opacity-40',
                  recording &&
                    'bg-red-500/10 text-red-500 hover:bg-red-500/10'
                )}
              >
                <Mic size={16} />
              </button>
            </Tooltip>

            {isGenerating ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white dark:bg-paper dark:text-ink"
              >
                <Square
                  size={13}
                  fill="currentColor"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={
                  !value.trim()
                }
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
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={label}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg px-2 text-slate hover:bg-surface-light dark:hover:bg-surface-dark',
          active &&
            'bg-cobalt/10 text-cobalt hover:bg-cobalt/10'
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
