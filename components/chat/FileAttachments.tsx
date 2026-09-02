'use client';

import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Image as ImageIcon,
  X
} from 'lucide-react';

import type { Attachment } from '@/lib/types/chat';
import { cn } from '@/lib/utils/cn';

interface FileAttachmentsProps {
  files: Attachment[];
  onRemove?: (fileId: string) => void;
  compact?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return ImageIcon;
  }

  if (mimeType.startsWith('audio/')) {
    return FileAudio;
  }

  if (mimeType.startsWith('video/')) {
    return FileVideo;
  }

  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return FileSpreadsheet;
  }

  if (
    mimeType.includes('zip') ||
    mimeType.includes('compressed') ||
    mimeType.includes('archive')
  ) {
    return FileArchive;
  }

  if (
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('text/')
  ) {
    return FileCode2;
  }

  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('document')
  ) {
    return FileText;
  }

  return FileType;
}

function getPreviewUrl(file: Attachment): string | null {
  const candidate = file as Attachment & {
    url?: string;
    previewUrl?: string;
  };

  if (
    file.type.startsWith('image/') &&
    typeof candidate.previewUrl === 'string' &&
    candidate.previewUrl
  ) {
    return candidate.previewUrl;
  }

  if (
    file.type.startsWith('image/') &&
    typeof candidate.url === 'string' &&
    candidate.url
  ) {
    return candidate.url;
  }

  return null;
}

export function FileAttachments({
  files,
  onRemove,
  compact = false,
  className
}: FileAttachmentsProps) {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        className
      )}
    >
      {files.map((file) => {
        const Icon = getFileIcon(file.type);
        const previewUrl = getPreviewUrl(file);

        return (
          <div
            key={file.id}
            className={cn(
              'group relative flex items-center gap-2 rounded-xl border',
              'border-slate-border bg-white dark:border-slate-border-dark',
              'dark:bg-surface-dark-raised',
              compact
                ? 'min-w-0 px-2 py-1.5'
                : 'min-w-[180px] max-w-[280px] px-2.5 py-2'
            )}
          >
            {previewUrl ? (
              <div
                className={cn(
                  'shrink-0 overflow-hidden rounded-lg bg-surface-light',
                  'dark:bg-surface-dark',
                  compact
                    ? 'h-7 w-7'
                    : 'h-10 w-10'
                )}
              >
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg',
                  'bg-surface-light text-cobalt',
                  'dark:bg-surface-dark',
                  compact
                    ? 'h-7 w-7'
                    : 'h-10 w-10'
                )}
              >
                <Icon
                  size={compact ? 15 : 18}
                />
              </div>
            )}

            <div className="min-w-0 flex-1 pr-1">
              <p
                className={cn(
                  'truncate font-medium text-ink dark:text-paper',
                  compact
                    ? 'max-w-[130px] text-[11.5px]'
                    : 'max-w-[190px] text-[12.5px]'
                )}
                title={file.name}
              >
                {file.name}
              </p>

              {!compact && (
                <p className="mt-0.5 text-[10.5px] text-slate-light">
                  {formatFileSize(file.sizeBytes)}
                </p>
              )}
            </div>

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                aria-label={`Remove ${file.name}`}
                className={cn(
                  'absolute right-1 top-1 rounded-full p-1',
                  'bg-white/90 text-slate shadow-sm transition-colors',
                  'hover:bg-surface-light hover:text-ink',
                  'dark:bg-surface-dark-raised/90',
                  'dark:hover:bg-surface-dark',
                  'dark:hover:text-paper',
                  compact
                    ? 'opacity-0 group-hover:opacity-100'
                    : 'opacity-100'
                )}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
