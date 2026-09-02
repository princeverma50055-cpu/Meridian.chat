'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Bot,
  Edit3,
  Globe2,
  Loader2,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { MODELS } from '@/components/chat/ModelSelector';

type Agent = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemInstructions: string | null;
  model: string;
  avatarUrl: string | null;
  visibility: string;
  createdAt: string | Date;
};

type AgentFormState = {
  name: string;
  description: string;
  systemInstructions: string;
  model: string;
  avatarUrl: string;
  visibility: 'private' | 'public';
};

const DEFAULT_MODEL =
  MODELS[0]?.id || 'meridian-fast';

const EMPTY_FORM: AgentFormState = {
  name: '',
  description: '',
  systemInstructions: '',
  model: DEFAULT_MODEL,
  avatarUrl: '',
  visibility: 'private',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );

  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] =
    useState<Agent | null>(null);

  const [form, setForm] =
    useState<AgentFormState>(EMPTY_FORM);

  const [error, setError] = useState('');

  async function loadAgents() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/agents', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to load agents.'
        );
      }

      setAgents(data?.agents ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load agents.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  function openCreate() {
    setEditingAgent(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(agent: Agent) {
    setEditingAgent(agent);

    setForm({
      name: agent.name ?? '',
      description: agent.description ?? '',
      systemInstructions:
        agent.systemInstructions ?? '',
      model: agent.model || DEFAULT_MODEL,
      avatarUrl: agent.avatarUrl ?? '',
      visibility:
        agent.visibility === 'public'
          ? 'public'
          : 'private',
    });

    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingAgent(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError('Agent name is required.');
      return;
    }

    if (form.avatarUrl.trim()) {
      try {
        const url = new URL(form.avatarUrl.trim());

        if (
          url.protocol !== 'http:' &&
          url.protocol !== 'https:'
        ) {
          throw new Error();
        }
      } catch {
        setError(
          'Avatar URL must be a valid HTTP or HTTPS URL.'
        );
        return;
      }
    }

    try {
      setSaving(true);
      setError('');

      const isEditing = Boolean(editingAgent);

      const response = await fetch(
        isEditing
          ? `/api/agents/${editingAgent!.id}`
          : '/api/agents',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description:
              form.description.trim() || null,
            systemInstructions:
              form.systemInstructions.trim() || null,
            model: form.model,
            avatarUrl:
              form.avatarUrl.trim() || null,
            visibility: form.visibility,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to save agent.'
        );
      }

      if (isEditing) {
        setAgents((current) =>
          current.map((agent) =>
            agent.id === editingAgent!.id
              ? data.agent
              : agent
          )
        );
      } else if (data?.agent) {
        setAgents((current) => [
          data.agent,
          ...current,
        ]);
      }

      closeForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save agent.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agent: Agent) {
    const confirmed = window.confirm(
      `Delete "${agent.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(agent.id);
      setError('');

      const response = await fetch(
        `/api/agents/${agent.id}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to delete agent.'
        );
      }

      setAgents((current) =>
        current.filter(
          (item) => item.id !== agent.id
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete agent.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  function modelLabel(modelId: string) {
    return (
      MODELS.find((model) => model.id === modelId)
        ?.name || modelId
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>

                <h1 className="text-2xl font-semibold tracking-tight">
                  Agents
                </h1>
              </div>

              <p className="text-sm text-muted-foreground">
                Create custom AI agents with their own
                instructions, model, and visibility.
              </p>
            </div>

            <Button
              onClick={openCreate}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </div>

          {error && !showForm && (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Bot className="h-7 w-7 text-muted-foreground" />
              </div>

              <h2 className="text-lg font-semibold">
                No agents yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Create a custom AI agent for a specific
                workflow, role, or task.
              </p>

              <Button
                onClick={openCreate}
                className="mt-6"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <article
                  key={agent.id}
                  className="group flex min-h-[250px] flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {agent.avatarUrl ? (
                        <img
                          src={agent.avatarUrl}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-xl object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display =
                              'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">
                          {agent.name}
                        </h2>

                        <p className="truncate text-xs text-muted-foreground">
                          {modelLabel(agent.model)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="shrink-0 text-muted-foreground"
                      title={
                        agent.visibility === 'public'
                          ? 'Public'
                          : 'Private'
                      }
                    >
                      {agent.visibility === 'public' ? (
                        <Globe2 className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">
                    {agent.description ||
                      'No agent description added yet.'}
                  </p>

                  {agent.systemInstructions && (
                    <div className="mt-4 rounded-xl bg-muted/50 p-3">
                      <p className="mb-1 text-xs font-medium text-foreground">
                        System instructions
                      </p>

                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {agent.systemInstructions}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(agent)}
                      className="flex-1"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        void handleDelete(agent)
                      }
                      disabled={deletingId === agent.id}
                    >
                      {deletingId === agent.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-4">
                  <div>
                    <h2 className="font-semibold">
                      {editingAgent
                        ? 'Edit Agent'
                        : 'Create Agent'}
                    </h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Define how your custom AI agent should
                      behave.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-5 p-5"
                >
                  {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="agent-name"
                      className="mb-2 block text-sm font-medium"
                    >
                      Agent name
                    </label>

                    <Input
                      id="agent-name"
                      value={form.name}
                      maxLength={120}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. SEO Expert"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="agent-description"
                      className="mb-2 block text-sm font-medium"
                    >
                      Description
                    </label>

                    <Textarea
                      id="agent-description"
                      value={form.description}
                      maxLength={1000}
                      rows={3}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description:
                            event.target.value,
                        }))
                      }
                      placeholder="What is this agent designed to do?"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="agent-instructions"
                      className="mb-2 block text-sm font-medium"
                    >
                      System instructions
                    </label>

                    <Textarea
                      id="agent-instructions"
                      value={form.systemInstructions}
                      maxLength={20000}
                      rows={8}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          systemInstructions:
                            event.target.value,
                        }))
                      }
                      placeholder="Define the agent's role, behavior, rules, and response style..."
                      disabled={saving}
                    />

                    <p className="mt-1 text-xs text-muted-foreground">
                      {form.systemInstructions.length}/20000
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="agent-model"
                      className="mb-2 block text-sm font-medium"
                    >
                      Model
                    </label>

                    <select
                      id="agent-model"
                      value={form.model}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          model: event.target.value,
                        }))
                      }
                      disabled={saving}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {MODELS.map((model) => (
                        <option
                          key={model.id}
                          value={model.id}
                        >
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="agent-avatar"
                      className="mb-2 block text-sm font-medium"
                    >
                      Avatar URL
                    </label>

                    <Input
                      id="agent-avatar"
                      type="url"
                      value={form.avatarUrl}
                      maxLength={2000}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          avatarUrl: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/avatar.png"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">
                      Visibility
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            visibility: 'private',
                          }))
                        }
                        disabled={saving}
                        className={`rounded-xl border p-4 text-left transition ${
                          form.visibility === 'private'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Private
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Only you can use this agent.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            visibility: 'public',
                          }))
                        }
                        disabled={saving}
                        className={`rounded-xl border p-4 text-left transition ${
                          form.visibility === 'public'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Globe2 className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Public
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Designed to be shareable.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={closeForm}
                      disabled={saving}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="submit"
                      disabled={
                        saving || !form.name.trim()
                      }
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          {editingAgent
                            ? 'Save Changes'
                            : 'Create Agent'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
