'use client';

import {
  Brain,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

interface Memory {
  id: string;
  content: string;
  createdAt?: string;
}

interface MemorySettingsProps {
  className?: string;
}

export function MemorySettings({
  className
}: MemorySettingsProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [newMemory, setNewMemory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState('');

  async function loadMemories() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/memories', {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to load memories.');
      }

      const data = await response.json();

      setMemories(
        Array.isArray(data)
          ? data
          : Array.isArray(data.memories)
            ? data.memories
            : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load memories.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMemories();
  }, []);

  async function addMemory() {
    const content = newMemory.replace(/\u0000/g, '').trim();

    if (!content || saving) {
      return;
    }

    if (content.length > 1000) {
      setError('Memory cannot exceed 1,000 characters.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to save memory.'
        );
      }

      const memory =
        data?.memory ||
        data;

      if (memory?.id) {
        setMemories((current) => [
          memory,
          ...current.filter(
            (item) => item.id !== memory.id
          )
        ]);
      } else {
        await loadMemories();
      }

      setNewMemory('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save memory.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory(id: string) {
    if (!id || deletingId) {
      return;
    }

    try {
      setDeletingId(id);
      setError('');

      const response = await fetch(
        `/api/memories/${encodeURIComponent(id)}`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to delete memory.'
        );
      }

      setMemories((current) =>
        current.filter(
          (memory) => memory.id !== id
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete memory.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-border bg-white p-5',
        'dark:border-slate-border-dark dark:bg-surface-dark-raised',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              'bg-cobalt/10 text-cobalt'
            )}
          >
            <Brain size={20} />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink dark:text-paper">
              Memory
            </h3>

            <p className="mt-1 max-w-xl text-xs leading-5 text-slate dark:text-slate-light">
              Allow Meridian to remember useful information
              about you and use it in future conversations.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((value) => !value)}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            enabled
              ? 'bg-cobalt'
              : 'bg-slate-border dark:bg-slate-border-dark'
          )}
          aria-label="Toggle memory"
        >
          <span
            className={cn(
              'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              enabled
                ? 'translate-x-6'
                : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {enabled && (
        <>
          <div className="mt-5">
            <label
              htmlFor="new-memory"
              className="mb-2 block text-xs font-medium text-ink dark:text-paper"
            >
              Add a memory
            </label>

            <div className="flex gap-2">
              <input
                id="new-memory"
                type="text"
                value={newMemory}
                onChange={(event) =>
                  setNewMemory(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    void addMemory();
                  }
                }}
                maxLength={1000}
                placeholder="Example: I prefer concise answers."
                disabled={saving}
                className={cn(
                  'min-w-0 flex-1 rounded-xl border px-3 py-2.5',
                  'border-slate-border bg-white text-sm text-ink outline-none',
                  'placeholder:text-slate-light',
                  'focus:border-cobalt focus:ring-2 focus:ring-cobalt/10',
                  'dark:border-slate-border-dark dark:bg-surface-dark',
                  'dark:text-paper dark:placeholder:text-slate-light'
                )}
              />

              <button
                type="button"
                onClick={() => void addMemory()}
                disabled={
                  saving ||
                  !newMemory.trim()
                }
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2',
                  'bg-cobalt text-white transition-opacity',
                  'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {saving ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={15} />
                )}

                <span className="hidden sm:inline">
                  Add
                </span>
              </button>
            </div>

            <div className="mt-1.5 flex justify-end">
              <span className="text-[10px] text-slate-light">
                {newMemory.length}/1000
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className={cn(
                'mt-3 rounded-xl border px-3 py-2 text-xs',
                'border-red-200 bg-red-50 text-red-700',
                'dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
              )}
            >
              {error}
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-ink dark:text-paper">
                Saved memories
              </h4>

              <span className="text-[10px] text-slate-light">
                {memories.length}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-border py-8 dark:border-slate-border-dark">
                <Loader2
                  size={18}
                  className="animate-spin text-slate"
                />
              </div>
            ) : memories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-border px-4 py-7 text-center dark:border-slate-border-dark">
                <Brain
                  size={22}
                  className="mx-auto text-slate-light"
                />

                <p className="mt-2 text-xs text-slate dark:text-slate-light">
                  No memories saved yet.
                </p>

                <p className="mt-1 text-[10px] text-slate-light">
                  Add something you want Meridian to remember.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className={cn(
                      'group flex items-start gap-3 rounded-xl border p-3',
                      'border-slate-border bg-surface-light/50',
                      'dark:border-slate-border-dark dark:bg-surface-dark'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-ink dark:text-paper">
                        {memory.content}
                      </p>

                      {memory.createdAt && (
                        <p className="mt-1.5 text-[10px] text-slate-light">
                          {new Date(
                            memory.createdAt
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteMemory(memory.id)
                      }
                      disabled={
                        deletingId === memory.id
                      }
                      aria-label={`Delete memory: ${memory.content}`}
                      className={cn(
                        'shrink-0 rounded-lg p-1.5 text-slate-light',
                        'transition-colors hover:bg-red-50 hover:text-red-600',
                        'dark:hover:bg-red-950/30 dark:hover:text-red-400',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'opacity-70 group-hover:opacity-100'
                      )}
                    >
                      {deletingId === memory.id ? (
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
