'use client';

import {
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils/cn';

export interface ProjectCardData {
  id: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  createdAt?: string;
}

interface ProjectCardProps {
  project: ProjectCardData;
  onOpen?: (project: ProjectCardData) => void;
  onEdit?: (project: ProjectCardData) => void;
  onDelete?: (project: ProjectCardData) => void;
  className?: string;
}

export function ProjectCard({
  project,
  onOpen,
  onEdit,
  onDelete,
  className
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const description =
    project.description?.trim() ||
    project.instructions?.trim() ||
    'No project description yet.';

  function handleOpen() {
    onOpen?.(project);
  }

  return (
    <article
      className={cn(
        'group relative rounded-2xl border p-4',
        'border-slate-border bg-white transition-all',
        'hover:-translate-y-0.5 hover:shadow-sm',
        'dark:border-slate-border-dark dark:bg-surface-dark-raised',
        className
      )}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="block w-full text-left"
        aria-label={`Open project ${project.name}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              'bg-cobalt/10 text-cobalt'
            )}
          >
            <FolderKanban size={19} />
          </div>

          <div className="min-w-0 flex-1 pr-8">
            <h3 className="truncate text-sm font-semibold text-ink dark:text-paper">
              {project.name}
            </h3>

            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate dark:text-slate-light">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-light">
          <span>
            {project.createdAt
              ? new Date(
                  project.createdAt
                ).toLocaleDateString()
              : 'Project'}
          </span>

          <span className="opacity-0 transition-opacity group-hover:opacity-100">
            Open project →
          </span>
        </div>
      </button>

      {(onEdit || onDelete) && (
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            aria-label={`Project actions for ${project.name}`}
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
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(project);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                    'text-ink hover:bg-surface-light',
                    'dark:text-paper dark:hover:bg-surface-dark'
                  )}
                >
                  <Pencil size={14} />
                  Edit project
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(project);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                    'text-red-600 hover:bg-red-50',
                    'dark:text-red-400 dark:hover:bg-red-950/30'
                  )}
                >
                  <Trash2 size={14} />
                  Delete project
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
