'use client';

import { FolderKanban, Loader2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';

export interface ProjectFormData {
  id?: string;
  name: string;
  description: string;
  instructions: string;
}

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  mode?: 'create' | 'edit';
  loading?: boolean;
  onSubmit: (data: ProjectFormData) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export function ProjectForm({
  initialData,
  mode = 'create',
  loading = false,
  onSubmit,
  onCancel,
  className
}: ProjectFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(
    initialData?.description ?? ''
  );
  const [instructions, setInstructions] = useState(
    initialData?.instructions ?? ''
  );
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initialData?.name ?? '');
    setDescription(initialData?.description ?? '');
    setInstructions(initialData?.instructions ?? '');
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const cleanInstructions = instructions.trim();

    if (!cleanName) {
      setError('Project name is required.');
      return;
    }

    if (cleanName.length > 120) {
      setError('Project name must be 120 characters or less.');
      return;
    }

    if (cleanDescription.length > 1000) {
      setError('Description must be 1000 characters or less.');
      return;
    }

    if (cleanInstructions.length > 10000) {
      setError('Instructions must be 10,000 characters or less.');
      return;
    }

    await onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      name: cleanName,
      description: cleanDescription,
      instructions: cleanInstructions
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'w-full max-w-2xl rounded-2xl border p-5',
        'border-slate-border bg-white',
        'dark:border-slate-border-dark dark:bg-surface-dark-raised',
        className
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cobalt/10 text-cobalt">
            <FolderKanban size={19} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-ink dark:text-paper">
              {mode === 'edit' ? 'Edit project' : 'Create project'}
            </h2>
            <p className="mt-0.5 text-xs text-slate dark:text-slate-light">
              Organize your chats, files and AI instructions.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close project form"
            className="rounded-lg p-1.5 text-slate-light transition-colors hover:bg-surface-light hover:text-ink dark:hover:bg-surface-dark dark:hover:text-paper"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="project-name"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            Project name
          </label>

          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Marketing Campaign"
            maxLength={120}
            autoFocus
            disabled={loading}
          />
        </div>

        <div>
          <label
            htmlFor="project-description"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            Description
          </label>

          <Textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this project about?"
            rows={3}
            maxLength={1000}
            disabled={loading}
          />

          <div className="mt-1 text-right text-[10px] text-slate-light">
            {description.length}/1000
          </div>
        </div>

        <div>
          <label
            htmlFor="project-instructions"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            AI instructions
          </label>

          <Textarea
            id="project-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Tell Meridian how it should behave inside this project..."
            rows={7}
            maxLength={10000}
            disabled={loading}
          />

          <div className="mt-1 text-right text-[10px] text-slate-light">
            {instructions.length}/10000
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
          >
            {error}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}

        <Button type="submit" disabled={loading || !name.trim()}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {mode === 'edit' ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}
