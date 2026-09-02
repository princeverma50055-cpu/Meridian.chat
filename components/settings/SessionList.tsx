'use client';

import {
  CheckCircle2,
  Clock3,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

interface Session {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt?: string;
  lastSeenAt?: string;
  expiresAt?: string;
  current?: boolean;
}

interface SessionListProps {
  className?: string;
}

function getDeviceIcon(userAgent?: string | null) {
  const value = (userAgent || '').toLowerCase();

  if (
    value.includes('mobile') ||
    value.includes('android') ||
    value.includes('iphone')
  ) {
    return Smartphone;
  }

  if (
    value.includes('ipad') ||
    value.includes('tablet')
  ) {
    return Tablet;
  }

  return Monitor;
}

function getDeviceName(userAgent?: string | null) {
  const value = (userAgent || '').toLowerCase();

  if (value.includes('iphone')) return 'iPhone';
  if (value.includes('ipad')) return 'iPad';
  if (value.includes('android')) return 'Android device';
  if (value.includes('windows')) return 'Windows';
  if (value.includes('macintosh')) return 'Mac';
  if (value.includes('linux')) return 'Linux';

  return 'Web browser';
}

function formatDate(value?: string) {
  if (!value) return 'Unknown';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function SessionList({
  className
}: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState('');

  async function loadSessions() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        '/api/security/sessions',
        {
          method: 'GET',
          cache: 'no-store'
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to load sessions.'
        );
      }

      setSessions(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.sessions)
            ? data.sessions
            : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load sessions.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function revokeSession(id: string) {
    if (!id || revokingId) return;

    const session = sessions.find(
      (item) => item.id === id
    );

    if (session?.current) {
      return;
    }

    try {
      setRevokingId(id);
      setError('');

      const response = await fetch(
        `/api/security/sessions/${encodeURIComponent(id)}`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to revoke session.'
        );
      }

      setSessions((current) =>
        current.filter(
          (sessionItem) => sessionItem.id !== id
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to revoke session.'
      );
    } finally {
      setRevokingId(null);
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
      <div>
        <h3 className="text-sm font-semibold text-ink dark:text-paper">
          Active sessions
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate dark:text-slate-light">
          Review devices that are currently signed in to your
          Meridian account.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className={cn(
            'mt-4 rounded-xl border px-3 py-2 text-xs',
            'border-red-200 bg-red-50 text-red-700',
            'dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
          )}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-5 flex items-center justify-center rounded-xl border border-dashed border-slate-border py-10 dark:border-slate-border-dark">
          <Loader2
            size={20}
            className="animate-spin text-slate"
          />
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-border px-4 py-8 text-center dark:border-slate-border-dark">
          <Monitor
            size={24}
            className="mx-auto text-slate-light"
          />

          <p className="mt-2 text-xs text-slate dark:text-slate-light">
            No active sessions found.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(
              session.userAgent
            );

            return (
              <div
                key={session.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3',
                  'border-slate-border bg-surface-light/50',
                  'dark:border-slate-border-dark dark:bg-surface-dark'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    session.current
                      ? 'bg-cobalt/10 text-cobalt'
                      : 'bg-surface-light text-slate',
                    'dark:bg-surface-dark-raised'
                  )}
                >
                  <DeviceIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-ink dark:text-paper">
                      {getDeviceName(
                        session.userAgent
                      )}
                    </p>

                    {session.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cobalt/10 px-2 py-0.5 text-[9px] font-medium text-cobalt">
                        <CheckCircle2 size={10} />
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-light">
                    {session.ipAddress && (
                      <span>
                        IP: {session.ipAddress}
                      </span>
                    )}

                    {session.lastSeenAt && (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={10} />
                        {formatDate(
                          session.lastSeenAt
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {!session.current && (
                  <button
                    type="button"
                    onClick={() =>
                      void revokeSession(session.id)
                    }
                    disabled={
                      revokingId === session.id
                    }
                    aria-label={`Revoke ${getDeviceName(
                      session.userAgent
                    )} session`}
                    className={cn(
                      'shrink-0 rounded-lg p-2 text-slate-light',
                      'transition-colors',
                      'hover:bg-red-50 hover:text-red-600',
                      'dark:hover:bg-red-950/30 dark:hover:text-red-400',
                      'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  >
                    {revokingId === session.id ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
