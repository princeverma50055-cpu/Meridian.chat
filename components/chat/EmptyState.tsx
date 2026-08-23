'use client';

import { Search as SearchIcon, PenLine, FileText, Wrench, Lightbulb, Globe } from 'lucide-react';
import { MeridianMark } from '@/components/ui/MeridianMark';

const SUGGESTIONS = [
  { icon: Globe, label: 'Research a topic', prompt: 'Research the current state of ' },
  { icon: PenLine, label: 'Write something', prompt: 'Help me write ' },
  { icon: FileText, label: 'Analyze a file', prompt: 'Analyze this file and tell me ' },
  { icon: Wrench, label: 'Build something', prompt: 'Help me build ' },
  { icon: Lightbulb, label: 'Explain a concept', prompt: 'Explain ' },
  { icon: SearchIcon, label: 'Search the web', prompt: 'Search the web for ' }
];

export function EmptyState({ onSuggestion }: { onSuggestion: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <MeridianMark size={34} />
      <h1 className="mt-5 font-display text-2xl font-medium tracking-tight text-ink dark:text-paper">
        How can I help you today?
      </h1>

      <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            onClick={() => onSuggestion(prompt)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-border bg-white px-3 py-4 text-center transition-colors hover:border-cobalt/40 hover:bg-cobalt/5 dark:border-slate-border-dark dark:bg-surface-dark-raised"
          >
            <Icon size={17} className="text-cobalt" />
            <span className="text-[12.5px] font-medium text-ink dark:text-paper">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
