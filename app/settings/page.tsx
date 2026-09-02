'use client';

import { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Trash2,
  Download,
  LogOut,
  X
} from 'lucide-react';
import {
  signOut,
  useSession
} from 'next-auth/react';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Tabs } from '@/components/ui/Tabs';
import {
  SettingsRow,
  Switch
} from '@/components/settings/SettingsRow';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/layout/ThemeProvider';
import { MODELS } from '@/components/chat/ModelSelector';
import { cn } from '@/lib/utils/cn';

export default function SettingsPage() {
  return (
    <AppShell>
      <ChatHeader title="Settings" />

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <Tabs
            defaultTab="general"
            tabs={[
              {
                id: 'general',
                label: 'General',
                content: <General />
              },
              {
                id: 'appearance',
                label: 'Appearance',
                content: <Appearance />
              },
              {
                id: 'ai',
                label: 'AI',
                content: <AI />
              },
              {
                id: 'privacy',
                label: 'Privacy',
                content: <Privacy />
              },
              {
                id: 'security',
                label: 'Security',
                content: <Security />
              }
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}

function Card({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-border bg-white px-4 dark:border-slate-border-dark dark:bg-surface-dark-raised">
      {children}
    </div>
  );
}

function General() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [model, setModel] = useState(
    MODELS[0]?.id || ''
  );
  const [style, setStyle] = useState('balanced');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/profile', {
      cache: 'no-store'
    })
      .then((r) => r.json())
      .then((d) => {
        setName(d.user?.name || '');
        setEmail(d.user?.email || '');

        const p =
          d.profile?.preferences || {};

        setModel(
          p.defaultModel ||
            MODELS[0]?.id ||
            ''
        );

        setStyle(
          p.responseStyle || 'balanced'
        );
      })
      .catch((error) => {
        console.error(
          'Failed to load profile:',
          error
        );
      });
  }, []);

  async function save() {
    setBusy(true);

    try {
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify({
          name,
          preferences: {
            defaultModel: model,
            responseStyle: style
          }
        })
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        alert(
          d.error ||
            'Failed to save settings.'
        );
        return;
      }

      alert('Settings saved.');
    } catch (error) {
      console.error(
        'Settings save error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SettingsRow
        label="Name"
        description={email}
      >
        <input
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          maxLength={80}
          className="w-40 rounded-lg border border-slate-border bg-transparent px-2.5 py-1.5 text-sm dark:border-slate-border-dark"
        />
      </SettingsRow>

      <SettingsRow
        label="Default model"
        description="Used for new conversations"
      >
        <select
          value={model}
          onChange={(e) =>
            setModel(e.target.value)
          }
          className="rounded-lg border border-slate-border bg-transparent px-2.5 py-1.5 text-sm dark:border-slate-border-dark"
        >
          {MODELS.map((m) => (
            <option
              key={m.id}
              value={m.id}
            >
              {m.label}
            </option>
          ))}
        </select>
      </SettingsRow>

      <SettingsRow
        label="Response style"
        description="How Meridian formats replies"
      >
        <select
          value={style}
          onChange={(e) =>
            setStyle(e.target.value)
          }
          className="rounded-lg border border-slate-border bg-transparent px-2.5 py-1.5 text-sm dark:border-slate-border-dark"
        >
          <option value="balanced">
            Balanced
          </option>

          <option value="concise">
            Concise
          </option>

          <option value="detailed">
            Detailed
          </option>
        </select>
      </SettingsRow>

      <div className="flex justify-end py-4">
        <Button
          size="sm"
          onClick={save}
          disabled={busy}
        >
          {busy
            ? 'Saving…'
            : 'Save changes'}
        </Button>
      </div>
    </Card>
  );
}

function Appearance() {
  const {
    theme,
    setTheme
  } = useTheme();

  return (
    <Card>
      <div className="py-4">
        <p className="mb-3 text-sm font-medium">
          Theme
        </p>

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: 'light',
              label: 'Light',
              icon: Sun
            },
            {
              id: 'dark',
              label: 'Dark',
              icon: Moon
            },
            {
              id: 'system',
              label: 'System',
              icon: Monitor
            }
          ].map(
            ({
              id,
              label,
              icon: Icon
            }) => (
              <button
                key={id}
                onClick={() =>
                  setTheme(id as any)
                }
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-xs font-medium',
                  theme === id
                    ? 'border-cobalt bg-cobalt/5 text-cobalt'
                    : 'border-slate-border text-slate dark:border-slate-border-dark'
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            )
          )}
        </div>
      </div>
    </Card>
  );
}

function AI() {
  const [memory, setMemory] =
    useState(true);

  const [web, setWeb] =
    useState(false);

  const [memories, setMemories] =
    useState<any[]>([]);

  const [newMemory, setNewMemory] =
    useState('');

  async function load() {
    try {
      const [
        profileResponse,
        memoriesResponse
      ] = await Promise.all([
        fetch('/api/profile', {
          cache: 'no-store'
        }),
        fetch('/api/memories', {
          cache: 'no-store'
        })
      ]);

      const profileData =
        await profileResponse.json();

      const memoriesData =
        await memoriesResponse.json();

      setMemory(
        profileData.profile?.preferences
          ?.memoryEnabled !== false
      );

      setWeb(
        profileData.profile?.preferences
          ?.webSearchDefault === true
      );

      setMemories(
        memoriesData.memories || []
      );
    } catch (error) {
      console.error(
        'Failed to load AI settings:',
        error
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(
    key: string,
    value: boolean
  ) {
    try {
      const r = await fetch(
        '/api/profile',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            preferences: {
              [key]: value
            }
          })
        }
      );

      if (!r.ok) {
        const d = await r
          .json()
          .catch(() => ({}));

        alert(
          d.error ||
            'Failed to save preference.'
        );

        return;
      }

      await load();
    } catch (error) {
      console.error(
        'AI setting update error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    }
  }

  async function add() {
    const content =
      newMemory.trim();

    if (!content) {
      return;
    }

    try {
      const r = await fetch(
        '/api/memories',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            content
          })
        }
      );

      const d = await r
        .json()
        .catch(() => ({}));

      if (!r.ok) {
        alert(
          d.error ||
            'Failed to save memory.'
        );
        return;
      }

      setNewMemory('');
      await load();
    } catch (error) {
      console.error(
        'Memory creation error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    }
  }

  async function removeMemory(
    id: string
  ) {
    try {
      const r = await fetch(
        '/api/memories/' + id,
        {
          method: 'DELETE'
        }
      );

      if (!r.ok) {
        const d = await r
          .json()
          .catch(() => ({}));

        alert(
          d.error ||
            'Failed to delete memory.'
        );

        return;
      }

      await load();
    } catch (error) {
      console.error(
        'Memory deletion error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    }
  }

  return (
    <Card>
      <SettingsRow
        label="Memory"
        description="Remember useful details across chats"
      >
        <Switch
          checked={memory}
          onChange={(value) =>
            save(
              'memoryEnabled',
              value
            )
          }
        />
      </SettingsRow>

      <SettingsRow
        label="Web search by default"
        description="Allow search automatically when enabled by the assistant"
      >
        <Switch
          checked={web}
          onChange={(value) =>
            save(
              'webSearchDefault',
              value
            )
          }
        />
      </SettingsRow>

      <div className="border-t border-slate-border py-4 dark:border-slate-border-dark">
        <p className="mb-3 text-sm font-medium">
          Saved memories
        </p>

        <div className="mb-4 flex gap-2">
          <input
            value={newMemory}
            onChange={(e) =>
              setNewMemory(
                e.target.value
              )
            }
            maxLength={1000}
            placeholder="Add something Meridian should remember…"
            className="min-w-0 flex-1 rounded-xl border border-slate-border bg-transparent px-3 py-2 text-sm dark:border-slate-border-dark"
          />

          <Button
            size="sm"
            onClick={add}
            disabled={
              !newMemory.trim()
            }
          >
            Add
          </Button>
        </div>

        {memories.length === 0 ? (
          <p className="text-sm text-slate">
            No saved memories.
          </p>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="mb-2 flex items-start justify-between gap-3 rounded-xl bg-surface-light p-3 text-sm dark:bg-surface-dark"
            >
              <span className="break-words">
                {m.content}
              </span>

              <button
                type="button"
                onClick={() =>
                  removeMemory(m.id)
                }
                aria-label="Delete memory"
              >
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function Privacy() {
  const [busy, setBusy] =
    useState(false);

  async function exportData() {
    window.location.href =
      '/api/account/export';
  }

  async function clear() {
    if (
      !confirm(
        'Delete all conversations? This cannot be undone.'
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const r = await fetch(
        '/api/conversations/all',
        {
          method: 'DELETE'
        }
      );

      const d = await r
        .json()
        .catch(() => ({}));

      if (!r.ok) {
        alert(
          d.error ||
            'Failed to delete conversations.'
        );
        return;
      }

      alert(
        'All conversations deleted.'
      );
    } catch (error) {
      console.error(
        'Delete conversations error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function account() {
    if (
      !confirm(
        'Permanently delete your Meridian account and all data?'
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const r = await fetch(
        '/api/account/delete',
        {
          method: 'DELETE'
        }
      );

      const d = await r
        .json()
        .catch(() => ({}));

      if (!r.ok) {
        alert(
          d.error ||
            'Failed to delete account.'
        );
        return;
      }

      await signOut({
        callbackUrl: '/login'
      });
    } catch (error) {
      console.error(
        'Account deletion error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SettingsRow
        label="Export your data"
        description="Download conversations, files metadata and memories"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={exportData}
        >
          <Download size={14} />
          Export
        </Button>
      </SettingsRow>

      <SettingsRow
        label="Delete all conversations"
        description="Permanently delete every conversation"
      >
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={clear}
        >
          <Trash2 size={14} />
          Delete all
        </Button>
      </SettingsRow>

      <SettingsRow
        label="Delete account"
        description="Permanently remove your account and all related data"
      >
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={account}
        >
          <Trash2 size={14} />
          Delete account
        </Button>
      </SettingsRow>
    </Card>
  );
}

function PasswordChange() {
  const [current, setCurrent] =
    useState('');

  const [next, setNext] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  async function save() {
    if (next.length < 8) {
      alert(
        'New password must be at least 8 characters.'
      );
      return;
    }

    if (next.length > 128) {
      alert(
        'New password must be 128 characters or fewer.'
      );
      return;
    }

    setBusy(true);

    try {
      const r = await fetch(
        '/api/account/password',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json'
          },
          cache: 'no-store',
          body: JSON.stringify({
            currentPassword: current,
            newPassword: next
          })
        }
      );

      const d: {
        error?: string;
        message?: string;
      } = await r
        .json()
        .catch(() => ({}));

      if (!r.ok) {
        alert(
          d.error ||
            'Password update failed. Please try again.'
        );
        return;
      }

      setCurrent('');
      setNext('');

      alert(
        d.message ||
          'Password updated successfully.'
      );
    } catch (error) {
      console.error(
        'Password update request failed:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-y border-slate-border py-4 dark:border-slate-border-dark">
      <p className="mb-1 text-sm font-medium">
        Password
      </p>

      <p className="mb-3 text-xs text-slate">
        Set or change your email/password sign-in
        password.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) =>
            setCurrent(e.target.value)
          }
          placeholder="Current password (if set)"
          className="rounded-xl border border-slate-border bg-transparent px-3 py-2 text-sm dark:border-slate-border-dark"
        />

        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={next}
          onChange={(e) =>
            setNext(e.target.value)
          }
          placeholder="New password (8+ characters)"
          className="rounded-xl border border-slate-border bg-transparent px-3 py-2 text-sm dark:border-slate-border-dark"
        />
      </div>

      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={
            busy ||
            next.length < 8
          }
        >
          {busy
            ? 'Saving…'
            : 'Save password'}
        </Button>
      </div>
    </div>
  );
}

function Security() {
  const {
    data: session
  } = useSession();

  const [sessions, setSessions] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  async function load() {
    setLoading(true);

    try {
      const r = await fetch(
        '/api/security/sessions',
        {
          cache: 'no-store'
        }
      );

      const d = await r
        .json()
        .catch(() => ({}));

      if (!r.ok) {
        console.error(
          'Failed to load sessions:',
          d.error
        );

        setSessions([]);
        return;
      }

      setSessions(
        d.sessions || []
      );
    } catch (error) {
      console.error(
        'Sessions loading error:',
        error
      );

      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revokeSession(
    id: string
  ) {
    try {
      const r = await fetch(
        '/api/security/sessions/' +
          id,
        {
          method: 'DELETE'
        }
      );

      const d = await r
        .json()
        .catch(() => ({}));

      if (!r.ok) {
        alert(
          d.error ||
            'Failed to revoke session.'
        );
        return;
      }

      await load();
    } catch (error) {
      console.error(
        'Session revoke error:',
        error
      );

      alert(
        'Network error. Please try again.'
      );
    }
  }

  return (
    <Card>
      <SettingsRow
        label="Current account"
        description={
          session?.user?.email || ''
        }
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            signOut({
              callbackUrl: '/login'
            })
          }
        >
          <LogOut size={14} />
          Log out
        </Button>
      </SettingsRow>

      <PasswordChange />

      <SettingsRow
        label="Active sessions"
        description="Revoke sessions that are no longer trusted"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          disabled={loading}
        >
          {loading
            ? 'Refreshing…'
            : 'Refresh'}
        </Button>
      </SettingsRow>

      <div className="border-t border-slate-border py-4 dark:border-slate-border-dark">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate">
            No active sessions found.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-surface-light p-3 text-sm dark:bg-surface-dark"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {s.current
                    ? 'This device'
                    : 'Signed-in device'}
                </div>

                <div className="text-xs text-slate">
                  Last active{' '}
                  {new Date(
                    s.lastSeenAt
                  ).toLocaleString()}
                </div>

                {s.userAgent && (
                  <div className="mt-1 truncate text-xs text-slate">
                    {s.userAgent}
                  </div>
                )}
              </div>

              {!s.current && (
                <button
                  type="button"
                  onClick={() =>
                    revokeSession(
                      s.id
                    )
                  }
                  className="shrink-0 text-xs text-red-600 hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <SettingsRow
        label="Connected accounts"
        description="Google and email/password are supported"
      >
        <span className="text-sm text-slate">
          {session?.user?.email
            ? 'Connected'
            : '—'}
        </span>
      </SettingsRow>
    </Card>
  );
}
