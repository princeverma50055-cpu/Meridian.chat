import type { Source } from '@/lib/types/chat';

export function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-border bg-white px-3 py-2 text-[12.5px] transition-colors hover:border-cobalt/40 dark:border-slate-border-dark dark:bg-surface-dark-raised"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cobalt/10 text-[10px] font-medium text-cobalt">
        {source.id}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink dark:text-paper">{source.title}</span>
        <span className="block truncate text-slate-light">{source.domain}</span>
      </span>
    </a>
  );
}
