'use client';

import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import {
  Bot,
  Edit3,
  Plus,
  Trash2,
  X,
  Globe,
  Lock,
  Loader2
} from 'lucide-react';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Button } from '@/components/ui/Button';
import {
  Input,
  Textarea
} from '@/components/ui/Input';
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
  createdAt: string;
};

type AgentForm = {
  name: string;
  description: string;
  systemInstructions: string;
  model: string;
  avatarUrl: string;
  visibility: 'private' | 'public';
};

const EMPTY_FORM: AgentForm = {
  name: '',
  description: '',
  systemInstructions: '',
  model:
    MODELS[0]?.id ??
    'meridian-fast',
  avatarUrl: '',
  visibility: 'private'
};

function getModelLabel(
  modelId: string
): string {
  const model =
    MODELS.find(
      (item) =>
        item.id === modelId
    );

  return (
    model?.label ??
    modelId
  );
}

export default function AgentsPage() {
  const [agents, setAgents] =
    useState<Agent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState('');

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<AgentForm>(
      EMPTY_FORM
    );

  async function loadAgents() {
    setLoading(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/agents',
          {
            method: 'GET',
            cache: 'no-store'
          }
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        const message =
          typeof data ===
            'object' &&
          data !== null &&
          'error' in data &&
          typeof (
            data as {
              error?: unknown;
            }
          ).error === 'string'
            ? (
                data as {
                  error: string;
                }
              ).error
            : 'Failed to load agents.';

        throw new Error(
          message
        );
      }

      const parsed =
        typeof data ===
          'object' &&
        data !== null &&
        'agents' in data &&
        Array.isArray(
          (
            data as {
              agents?: unknown;
            }
          ).agents
        )
          ? (
              data as {
                agents: unknown[];
              }
            ).agents
          : [];

      const safeAgents =
        parsed.filter(
          (
            item
          ): item is Agent =>
            typeof item ===
              'object' &&
            item !== null &&
            typeof (
              item as Agent
            ).id === 'string' &&
            typeof (
              item as Agent
            ).name === 'string' &&
            typeof (
              item as Agent
            ).model === 'string'
        );

      setAgents(
        safeAgents
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load agents.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM
    });
    setError('');
    setModalOpen(true);
  }

  function openEdit(
    agent: Agent
  ) {
    setEditingId(agent.id);

    setForm({
      name: agent.name,
      description:
        agent.description ??
        '',
      systemInstructions:
        agent.systemInstructions ??
        '',
      model:
        agent.model,
      avatarUrl:
        agent.avatarUrl ??
        '',
      visibility:
        agent.visibility ===
        'public'
          ? 'public'
          : 'private'
    });

    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM
    });
  }

  function updateField<
    K extends keyof AgentForm
  >(
    field: K,
    value: AgentForm[K]
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value
      })
    );
  }

  async function saveAgent(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name =
      form.name.trim();

    if (!name) {
      setError(
        'Agent name is required.'
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name,
        description:
          form.description.trim(),
        systemInstructions:
          form.systemInstructions.trim(),
        model:
          form.model,
        avatarUrl:
          form.avatarUrl.trim(),
        visibility:
          form.visibility
      };

      const endpoint =
        editingId
          ? `/api/agents/${editingId}`
          : '/api/agents';

      const response =
        await fetch(
          endpoint,
          {
            method: editingId
              ? 'PATCH'
              : 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify(
              payload
            )
          }
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        const message =
          typeof data ===
            'object' &&
          data !== null &&
          'error' in data &&
          typeof (
            data as {
              error?: unknown;
            }
          ).error === 'string'
            ? (
                data as {
                  error: string;
                }
              ).error
            : 'Failed to save agent.';

        throw new Error(
          message
        );
      }

      setModalOpen(false);
      setEditingId(null);
      setForm({
        ...EMPTY_FORM
      });

      await loadAgents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save agent.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent(
    agent: Agent
  ) {
    const confirmed =
      window.confirm(
        `Delete "${agent.name}" permanently?`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      agent.id
    );
    setError('');

    try {
      const response =
        await fetch(
          `/api/agents/${agent.id}`,
          {
            method: 'DELETE'
          }
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        const message =
          typeof data ===
            'object' &&
          data !== null &&
          'error' in data &&
          typeof (
            data as {
              error?: unknown;
            }
          ).error === 'string'
            ? (
                data as {
                  error: string;
                }
              ).error
            : 'Failed to delete agent.';

        throw new Error(
          message
        );
      }

      setAgents(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              agent.id
          )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete agent.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <ChatHeader title="Agents" />

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-border px-4 py-3 dark:border-slate-border-dark md:px-6">
          <div>
            <h1 className="text-lg font-semibold text-ink dark:text-paper">
              Custom Agents
            </h1>
            <p className="mt-0.5 text-[13px] text-slate">
              Create AI agents with custom instructions and models.
            </p>
          </div>

          <Button
            size="sm"
            onClick={openCreate}
          >
            <Plus size={16} />
            New Agent
          </Button>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 md:mx-6">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2
                size={24}
                className="animate-spin text-cobalt"
              />
            </div>
          ) : agents.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt">
                <Bot size={28} />
              </div>

              <h2 className="text-lg font-semibold text-ink dark:text-paper">
                No agents yet
              </h2>

              <p className="mt-1 max-w-md text-sm text-slate">
                Create your first custom AI agent with its own instructions, model and visibility.
              </p>

              <Button
                className="mt-5"
                onClick={openCreate}
              >
                <Plus size={16} />
                Create Agent
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map(
                (agent) => (
                  <article
                    key={agent.id}
                    className="rounded-2xl border border-slate-border bg-white p-4 shadow-sm dark:border-slate-border-dark dark:bg-surface-dark-raised"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {agent.avatarUrl ? (
                          <img
                            src={
                              agent.avatarUrl
                            }
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cobalt/10 text-cobalt">
                            <Bot size={21} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h2 className="truncate font-semibold text-ink dark:text-paper">
                            {agent.name}
                          </h2>

                          <p className="truncate text-xs text-slate">
                            {getModelLabel(
                              agent.model
                            )}
                          </p>
                        </div>
                      </div>

                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-light px-2 py-1 text-[11px] text-slate dark:bg-surface-dark">
                        {agent.visibility ===
                        'public' ? (
                          <Globe
                            size={11}
                          />
                        ) : (
                          <Lock
                            size={11}
                          />
                        )}

                        {agent.visibility ===
                        'public'
                          ? 'Public'
                          : 'Private'}
                      </span>
                    </div>

                    {agent.description && (
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate">
                        {
                          agent.description
                        }
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-border pt-3 dark:border-slate-border-dark">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          openEdit(
                            agent
                          )
                        }
                        disabled={
                          deletingId ===
                          agent.id
                        }
                      >
                        <Edit3
                          size={14}
                        />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          void deleteAgent(
                            agent
                          )
                        }
                        disabled={
                          deletingId ===
                          agent.id
                        }
                      >
                        {deletingId ===
                        agent.id ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2
                            size={14}
                          />
                        )}
                        Delete
                      </Button>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-ink">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-border bg-white px-5 py-4 dark:border-slate-border-dark dark:bg-ink">
              <div>
                <h2 className="font-semibold text-ink dark:text-paper">
                  {editingId
                    ? 'Edit Agent'
                    : 'Create Agent'}
                </h2>
                <p className="mt-0.5 text-xs text-slate">
                  Configure how your agent behaves.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={saving}
                className="rounded-lg p-2 text-slate transition hover:bg-surface-light dark:hover:bg-surface-dark-raised"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={
                saveAgent
              }
              className="space-y-5 p-5"
            >
              <div>
                <label
                  htmlFor="agent-name"
                  className="mb-1.5 block text-sm font-medium text-ink dark:text-paper"
                >
                  Name
                </label>

                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      'name',
                      event.target
                        .value
                    )
                  }
                  maxLength={120}
                  placeholder="e.g. Marketing Expert"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="agent-description"
                  className="mb-1.5 block text-sm font-medium text-ink dark:text-paper"
                >
                  Description
                </label>

                <Textarea
                  id="agent-description"
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    updateField(
                      'description',
                      event.target
                        .value
                    )
                  }
                  maxLength={1000}
                  rows={3}
                  placeholder="What is this agent designed to do?"
                />
              </div>

              <div>
                <label
                  htmlFor="agent-instructions"
                  className="mb-1.5 block text-sm font-medium text-ink dark:text-paper"
                >
                  System Instructions
                </label>

                <Textarea
                  id="agent-instructions"
                  value={
                    form.systemInstructions
                  }
                  onChange={(event) =>
                    updateField(
                      'systemInstructions',
                      event.target
                        .value
                    )
                  }
                  maxLength={20000}
                  rows={8}
                  placeholder="Define the agent's role, behavior, tone, rules and objectives..."
                />

                <p className="mt-1 text-right text-[11px] text-slate">
                  {
                    form
                      .systemInstructions
                      .length
                  }{' '}
                  / 20,000
                </p>
              </div>

              <div>
                <label
                  htmlFor="agent-model"
                  className="mb-1.5 block text-sm font-medium text-ink dark:text-paper"
                >
                  Model
                </label>

                <select
                  id="agent-model"
                  value={
                    form.model
                  }
                  onChange={(event) =>
                    updateField(
                      'model',
                      event.target
                        .value
                    )
                  }
                  className="h-10 w-full rounded-xl border border-slate-border bg-white px-3.5 text-sm text-ink outline-none focus:border-cobalt dark:border-slate-border-dark dark:bg-surface-dark-raised dark:text-paper"
                >
                  {MODELS.map(
                    (model) => (
                      <option
                        key={
                          model.id
                        }
                        value={
                          model.id
                        }
                      >
                        {model.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="agent-avatar"
                  className="mb-1.5 block text-sm font-medium text-ink dark:text-paper"
                >
                  Avatar URL
                </label>

                <Input
                  id="agent-avatar"
                  type="url"
                  value={
                    form.avatarUrl
                  }
                  onChange={(event) =>
                    updateField(
                      'avatarUrl',
                      event.target
                        .value
                    )
                  }
                  placeholder="https://..."
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink dark:text-paper">
                  Visibility
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateField(
                        'visibility',
                        'private'
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition ${
                      form.visibility ===
                      'private'
                        ? 'border-cobalt bg-cobalt/5'
                        : 'border-slate-border dark:border-slate-border-dark'
                    }`}
                  >
                    <Lock
                      size={17}
                      className="mb-2 text-cobalt"
                    />

                    <div className="text-sm font-medium text-ink dark:text-paper">
                      Private
                    </div>

                    <div className="mt-1 text-xs text-slate">
                      Only you can use this agent.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateField(
                        'visibility',
                        'public'
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition ${
                      form.visibility ===
                      'public'
                        ? 'border-cobalt bg-cobalt/5'
                        : 'border-slate-border dark:border-slate-border-dark'
                    }`}
                  >
                    <Globe
                      size={17}
                      className="mb-2 text-cobalt"
                    />

                    <div className="text-sm font-medium text-ink dark:text-paper">
                      Public
                    </div>

                    <div className="mt-1 text-xs text-slate">
                      Allow others to discover this agent.
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-border pt-4 dark:border-slate-border-dark">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={
                    closeModal
                  }
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving && (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {editingId
                    ? 'Save Changes'
                    : 'Create Agent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
