'use client';

import {
  Bot,
  MoreHorizontal,
  Pencil,
  Trash2,
  Globe,
  Lock
} from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils/cn';

export interface AgentCardData {
  id: string;
  name: string;
  description?: string | null;
  systemInstructions?: string | null;
  model: string;
  avatarUrl?: string | null;
  visibility?: string | null;
  createdAt?: string;
}

interface AgentCardProps {
  agent: AgentCardData;
  onOpen?: (agent: AgentCardData) => void;
  onEdit?: (agent: AgentCardData) => void;
  onDelete?: (agent: AgentCardData) => void;
  className?: string;
}

function getModelLabel(model: string): string {
  const labels: Record<string, string> = {
    'meridian-fast': 'Meridian Fast',
    'meridian-reasoning': 'Meridian Reasoning',
    'meridian-lite': 'Meridian Lite'
  };

  return labels[model] ?? model;
}

export function AgentCard({
  agent,
  onOpen,
  onEdit,
  onDelete,
  className
}: AgentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const description =
    agent.description?.trim() ||
    agent.systemInstructions?.trim() ||
    'No agent description yet.';

  const isPublic = agent.visibility === 'public';

  return (
    <article
      className={cn(
        'group relative rounded-2xl border p-4 transition-all',
        'border-slate-border bg-white',
        'hover:-translate-y-0.5 hover:shadow-sm',
        'dark:border-slate-border-dark dark:bg-surface-dark-raised',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(agent)}
        className="block w-full text-left"
        aria-label={`Open agent ${agent.name}`}
      >
        <div className="flex items-start gap-3">
          {agent.avatarUrl ? (
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-border dark:border-slate-border-dark">
              <img
                src={agent.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cobalt/10 text-cobalt">
              <Bot size={19} />
            </div>
          )}

          <div className="min-w-0 flex-1 pr-8">
            <h3 className="truncate text-sm font-semibold text-ink dark:text-paper">
              {agent.name}
            </h3>

            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate dark:text-slate-light">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="truncate rounded-md bg-surface-light px-2 py-1 text-[10px] font-medium text-slate dark:bg-surface-dark dark:text-slate-light">
            {getModelLabel(agent.model)}
          </span>

          <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-light">
            {isPublic ? <Globe size={11} /> : <Lock size={11} />}
            {isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        {agent.createdAt && (
          <div className="mt-3 text-[10px] text-slate-light">
            Created {new Date(agent.createdAt).toLocaleDateString()}
          </div>
        )}
      </button>

      {(onEdit || onDelete) && (
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            aria-label={`Agent actions for ${agent.name}`}
            aria-expanded={menuOpen}
            className={cn(
              'rounded-lg p-1.5 text-slate-light transition-colors',
              'hover:bg-surface-light hover:text-ink',
              'dark:hover:bg-surface-dark dark:hover:text-paper'
            )}
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div
              className={cn(
                'absolute right-0 top-9 z-20 min-w-[150px] overflow-hidden rounded-xl border p-1 shadow-lg',
                'border-slate-border bg-white',
                'dark:border-slate-border-dark dark:bg-surface-dark-raised'
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(agent);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                    'text-ink hover:bg-surface-light',
                    'dark:text-paper dark:hover:bg-surface-dark'
                  )}
                >
                  <Pencil size={14} />
                  Edit agent
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(agent);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                    'text-red-600 hover:bg-red-50',
                    'dark:text-red-400 dark:hover:bg-red-950/30'
                  )}
                >
                  <Trash2 size={14} />
                  Delete agent
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
