'use client';

import {
  Bot,
  ChevronDown,
  Globe,
  Loader2,
  Lock,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';

export interface AgentFormData {
  id?: string;
  name: string;
  description: string;
  systemInstructions: string;
  model: string;
  avatarUrl: string;
  visibility: 'private' | 'public';
}

interface AgentFormProps {
  initialData?: Partial<AgentFormData>;
  mode?: 'create' | 'edit';
  loading?: boolean;
  onSubmit: (data: AgentFormData) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

const MODEL_OPTIONS = [
  {
    id: 'meridian-fast',
    name: 'Meridian Fast',
    description: 'Fast everyday responses.'
  },
  {
    id: 'meridian-reasoning',
    name: 'Meridian Reasoning',
    description: 'Deeper reasoning for complex tasks.'
  },
  {
    id: 'meridian-lite',
    name: 'Meridian Lite',
    description: 'Lightweight and efficient.'
  }
] as const;

export function AgentForm({
  initialData,
  mode = 'create',
  loading = false,
  onSubmit,
  onCancel,
  className
}: AgentFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(
    initialData?.description ?? ''
  );
  const [systemInstructions, setSystemInstructions] = useState(
    initialData?.systemInstructions ?? ''
  );
  const [model, setModel] = useState(
    initialData?.model ?? 'meridian-fast'
  );
  const [avatarUrl, setAvatarUrl] = useState(
    initialData?.avatarUrl ?? ''
  );
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    initialData?.visibility === 'public' ? 'public' : 'private'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initialData?.name ?? '');
    setDescription(initialData?.description ?? '');
    setSystemInstructions(initialData?.systemInstructions ?? '');
    setModel(initialData?.model ?? 'meridian-fast');
    setAvatarUrl(initialData?.avatarUrl ?? '');
    setVisibility(
      initialData?.visibility === 'public' ? 'public' : 'private'
    );
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const cleanInstructions = systemInstructions.trim();
    const cleanAvatarUrl = avatarUrl.trim();

    if (!cleanName) {
      setError('Agent name is required.');
      return;
    }

    if (cleanName.length > 120) {
      setError('Agent name must be 120 characters or less.');
      return;
    }

    if (cleanDescription.length > 1000) {
      setError('Description must be 1000 characters or less.');
      return;
    }

    if (cleanInstructions.length > 20000) {
      setError('System instructions must be 20,000 characters or less.');
      return;
    }

    if (cleanAvatarUrl.length > 1000) {
      setError('Avatar URL is too long.');
      return;
    }

    if (
      cleanAvatarUrl &&
      !/^https?:\/\/[^\s]+$/i.test(cleanAvatarUrl)
    ) {
      setError('Avatar URL must be a valid HTTP or HTTPS URL.');
      return;
    }

    if (!MODEL_OPTIONS.some((item) => item.id === model)) {
      setError('Please select a valid model.');
      return;
    }

    await onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      name: cleanName,
      description: cleanDescription,
      systemInstructions: cleanInstructions,
      model,
      avatarUrl: cleanAvatarUrl,
      visibility
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
            <Bot size={19} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-ink dark:text-paper">
              {mode === 'edit' ? 'Edit agent' : 'Create agent'}
            </h2>

            <p className="mt-0.5 text-xs text-slate dark:text-slate-light">
              Give your AI agent its own behavior and personality.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close agent form"
            className="rounded-lg p-1.5 text-slate-light transition-colors hover:bg-surface-light hover:text-ink dark:hover:bg-surface-dark dark:hover:text-paper"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="agent-name"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            Agent name
          </label>

          <Input
            id="agent-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Marketing Expert"
            maxLength={120}
            autoFocus
            disabled={loading}
          />
        </div>

        <div>
          <label
            htmlFor="agent-description"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            Description
          </label>

          <Textarea
            id="agent-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this agent specialize in?"
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
            htmlFor="agent-instructions"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            System instructions
          </label>

          <Textarea
            id="agent-instructions"
            value={systemInstructions}
            onChange={(event) =>
              setSystemInstructions(event.target.value)
            }
            placeholder="Define how this agent should think, respond and behave..."
            rows={8}
            maxLength={20000}
            disabled={loading}
          />

          <div className="mt-1 text-right text-[10px] text-slate-light">
            {systemInstructions.length}/20000
          </div>
        </div>

        <div>
          <label
            htmlFor="agent-model"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            Model
          </label>

          <div className="relative">
            <select
              id="agent-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={loading}
              className={cn(
                'h-10 w-full appearance-none rounded-xl border px-3.5 pr-9 text-sm outline-none transition-colors',
                'border-slate-border bg-white text-ink focus:border-cobalt',
                'dark:border-slate-border-dark dark:bg-surface-dark-raised dark:text-paper'
              )}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {option.description}
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-light"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="agent-avatar"
            className="mb-1.5 block text-xs font-medium text-ink dark:text-paper"
          >
            Avatar URL
            <span className="ml-1 font-normal text-slate-light">
              (optional)
            </span>
          </label>

          <Input
            id="agent-avatar"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/avatar.png"
            maxLength={1000}
            disabled={loading}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ink dark:text-paper">
            Visibility
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setVisibility('private')}
              disabled={loading}
              aria-pressed={visibility === 'private'}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                visibility === 'private'
                  ? 'border-cobalt bg-cobalt/5'
                  : 'border-slate-border hover:bg-surface-light dark:border-slate-border-dark dark:hover:bg-surface-dark'
              )}
            >
              <Lock
                size={17}
                className={
                  visibility === 'private'
                    ? 'mt-0.5 text-cobalt'
                    : 'mt-0.5 text-slate-light'
                }
              />

              <span>
                <span className="block text-xs font-medium text-ink dark:text-paper">
                  Private
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-light">
                  Only you can use this agent.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('public')}
              disabled={loading}
              aria-pressed={visibility === 'public'}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                visibility === 'public'
                  ? 'border-cobalt bg-cobalt/5'
                  : 'border-slate-border hover:bg-surface-light dark:border-slate-border-dark dark:hover:bg-surface-dark'
              )}
            >
              <Globe
                size={17}
                className={
                  visibility === 'public'
                    ? 'mt-0.5 text-cobalt'
                    : 'mt-0.5 text-slate-light'
                }
              />

              <span>
                <span className="block text-xs font-medium text-ink dark:text-paper">
                  Public
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-light">
                  Allow the agent to be shared publicly.
                </span>
              </span>
            </button>
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
          {mode === 'edit' ? 'Save changes' : 'Create agent'}
        </Button>
      </div>
    </form>
  );
}
