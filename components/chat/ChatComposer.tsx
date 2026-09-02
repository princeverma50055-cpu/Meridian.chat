'use client';

import {
  AlertCircle,
  ArrowUp,
  FileText,
  Globe,
  Loader2,
  Mic,
  Plus,
  Square,
  Telescope,
  Wrench,
  X
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState
} from 'react';

import {
  Dropdown,
  DropdownItem
} from '@/components/ui/Dropdown';
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
  onWebSearchEnabledChange
}: ChatComposerProps) {
  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const recognitionRef =
    useRef<any>(null);

  const recognitionBaseValueRef =
    useRef('');

  const [deepResearchOn, setDeepResearchOn] =
    useState(false);

  const [attachments, setAttachments] =
    useState<PendingAttachment[]>([]);

  const [recording, setRecording] =
    useState(false);

  const [voiceSupported, setVoiceSupported] =
    useState(true);

  const [uploadingCount, setUploadingCount] =
    useState(0);

  useEffect(() => {
    const element =
      textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = 'auto';

    element.style.height =
      `${Math.min(
        element.scrollHeight,
        200
      )}px`;
  }, [value]);

  useEffect(() => {
    const readyAttachments: Attachment[] =
      attachments
        .filter(
          (attachment) =>
            attachment.status === 'ready'
        )
        .map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          type: attachment.mimeType,
          sizeBytes:
            attachment.sizeBytes
        }));

    onAttachedFilesChange(
      readyAttachments
    );
  }, [
    attachments,
    onAttachedFilesChange
  ]);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any)
            .SpeechRecognition ||
          (window as any)
            .webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      recognitionBaseValueRef.current =
        value.trim();
      setRecording(true);
    };

    recognition.onresult = (
      event: any
    ) => {
      let transcript = '';

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i += 1
      ) {
        transcript +=
          event.results[i][0]
            .transcript;
      }

      const cleanTranscript =
        transcript.trim();

      if (!cleanTranscript) {
        return;
      }

      const base =
        recognitionBaseValueRef.current;

      onChange(
        base
          ? `${base} ${cleanTranscript}`
          : cleanTranscript
      );
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current =
      recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }

      recognition.onresult = null;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;

      recognitionRef.current = null;
    };
    // The recognition instance should be created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRecording() {
    const recognition =
      recognitionRef.current;

    if (!recognition) {
      return;
    }

    if (recording) {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }

      setRecording(false);
      return;
    }

    try {
      recognitionBaseValueRef.current =
        value.trim();

      recognition.start();
    } catch {
      setRecording(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        value.trim() &&
        !isGenerating &&
        uploadingCount === 0
      ) {
        onSend();
      }
    }
  }

  function removeAttachment(
    id: string
  ) {
    setAttachments((current) =>
      current.filter(
        (attachment) =>
          attachment.id !== id
      )
    );
  }

  async function uploadFile(
    file: File
  ) {
    const temporaryId =
      `temp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    setAttachments((current) => [
      ...current,
      {
        id: temporaryId,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'uploading'
      }
    ]);

    setUploadingCount(
      (current) => current + 1
    );

    try {
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

      const response =
        await fetch(
          '/api/files/upload',
          {
            method: 'POST',
            body: formData
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        setAttachments((current) =>
          current.map(
            (attachment) =>
              attachment.id ===
              temporaryId
                ? {
                    ...attachment,
                    status: 'error',
                    error:
                      data?.error ||
                      'Upload failed.'
                  }
                : attachment
          )
        );

        return;
      }

      const uploadedFile =
        data?.file;

      if (
        !uploadedFile ||
        typeof uploadedFile.id !==
          'string'
      ) {
        setAttachments((current) =>
          current.map(
            (attachment) =>
              attachment.id ===
              temporaryId
                ? {
                    ...attachment,
                    status: 'error',
                    error:
                      'Invalid upload response.'
                  }
                : attachment
          )
        );

        return;
      }

      const serverStatus =
        uploadedFile.status;

      const status: AttachmentStatus =
        serverStatus === 'ready'
          ? 'ready'
          : serverStatus ===
              'unsupported'
            ? 'unsupported'
            : serverStatus ===
                'error'
              ? 'error'
              : 'error';

      setAttachments((current) =>
        current.map(
          (attachment) =>
            attachment.id ===
            temporaryId
              ? {
                  ...attachment,
                  id: uploadedFile.id,
                  mimeType:
                    uploadedFile.mimeType ||
                    attachment.mimeType,
                  sizeBytes:
                    Number.isFinite(
                      uploadedFile.sizeBytes
                    )
                      ? uploadedFile.sizeBytes
                      : attachment.sizeBytes,
                  status,
                  error:
                    data?.note ||
                    (status === 'unsupported'
                      ? 'This file cannot be used for text-based chat.'
                      : status === 'error'
                        ? 'The file could not be processed.'
                        : undefined)
                }
              : attachment
        )
      );
    } catch {
      setAttachments((current) =>
        current.map(
          (attachment) =>
            attachment.id ===
            temporaryId
              ? {
                  ...attachment,
                  status: 'error',
                  error:
                    'Network error while uploading.'
                }
              : attachment
        )
      );
    } finally {
      setUploadingCount(
        (current) =>
          Math.max(0, current - 1)
      );
    }
  }

  function handleFiles(
    fileList: FileList | null
  ) {
    if (!fileList) {
      return;
    }

    const files =
      Array.from(fileList);

    if (files.length === 0) {
      return;
    }

    void Promise.all(
      files.map((file) =>
        uploadFile(file)
      )
    );

    if (fileInputRef.current) {
      fileInputRef.current.value =
        '';
    }
  }

  const sendDisabled =
    !value.trim() ||
    isGenerating ||
    uploadingCount > 0;

  return (
    <div className="mx-auto w-full max-w-chat px-4 pb-3 pt-2 sm:pb-5">
      <div
        className={cn(
          'rounded-2xl border bg-white shadow-sm transition-colors',
          'border-slate-border focus-within:border-cobalt',
          'dark:border-slate-border-dark dark:bg-surface-dark-raised'
        )}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-border px-3 pt-3 dark:border-slate-border-dark">
            {attachments.map(
              (attachment) => (
                <Tooltip
                  key={attachment.id}
                  content={
                    attachment.error ||
                    attachment.status
                  }
                >
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]',
                      attachment.status ===
                        'error'
                        ? 'bg-red-500/10 text-red-600'
                        : attachment.status ===
                            'unsupported'
                          ? 'bg-amber-500/10 text-amber-700'
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
                      className="text-slate-light transition-colors hover:text-ink dark:hover:text-paper"
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
            onChange(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          maxLength={100000}
          aria-label="Message"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
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
              active={webSearchEnabled}
              onClick={() =>
                onWebSearchEnabledChange(
                  !webSearchEnabled
                )
              }
            />

            <ToggleIconButton
              icon={
                <Telescope
                  size={15}
                />
              }
              label="Deep research"
              active={deepResearchOn}
              onClick={() =>
                setDeepResearchOn(
                  (current) =>
                    !current
                )
              }
            />

            <Tooltip content="Tools">
              <button
                type="button"
                aria-label="Tools"
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate transition-colors hover:bg-surface-light dark:hover:bg-surface-dark sm:flex"
              >
                <Wrench size={15} />
              </button>
            </Tooltip>

            <div className="ml-1 hidden sm:block">
              <ModelSelector
                selected={model}
                onSelect={
                  onModelChange
                }
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
                aria-label={
                  recording
                    ? 'Stop voice input'
                    : 'Start voice input'
                }
                aria-pressed={
                  recording
                }
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-slate transition-colors hover:bg-surface-light disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-surface-dark',
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105 dark:bg-paper dark:text-ink"
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
                  sendDisabled
                }
                aria-label="Send message"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cobalt text-white transition-colors hover:bg-cobalt-dim disabled:cursor-not-allowed disabled:bg-slate-border disabled:text-slate-light"
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
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg px-2 text-slate transition-colors hover:bg-surface-light dark:hover:bg-surface-dark',
          active &&
            'bg-cobalt/10 text-cobalt hover:bg-cobalt/10'
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
