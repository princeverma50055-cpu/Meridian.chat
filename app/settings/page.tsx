'use client';

import {
  useEffect,
  useState
} from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  Download,
  KeyRound,
  LogOut,
  Monitor,
  Save,
  Shield,
  Trash2,
  User
} from 'lucide-react';

type ProfileData = {
  name: string;
  email: string;
  image: string;
};

type SecuritySession = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current?: boolean;
};

export default function SettingsPage() {
  const { data: session } = useSession();

  const [profile, setProfile] =
    useState<ProfileData>({
      name: '',
      email: '',
      image: ''
    });

  const [password, setPassword] =
    useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

  const [sessions, setSessions] =
    useState<SecuritySession[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [loadingSessions, setLoadingSessions] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [deletingAccount, setDeletingAccount] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');

      const [profileResponse, sessionsResponse] =
        await Promise.all([
          fetch('/api/profile', {
            cache: 'no-store'
          }),
          fetch('/api/security/sessions', {
            cache: 'no-store'
          })
        ]);

      if (profileResponse.ok) {
        const data =
          await profileResponse.json();

        setProfile({
          name: data?.profile?.name ??
            session?.user?.name ??
            '',
          email: data?.profile?.email ??
            session?.user?.email ??
            '',
          image: data?.profile?.image ??
            session?.user?.image ??
            ''
        });
      } else {
        setProfile({
          name:
            session?.user?.name ?? '',
          email:
            session?.user?.email ?? '',
          image:
            session?.user?.image ?? ''
        });
      }

      if (sessionsResponse.ok) {
        const data =
          await sessionsResponse.json();

        setSessions(
          Array.isArray(data?.sessions)
            ? data.sessions
            : []
        );
      }
    } catch (err) {
      console.error(
        '[settings] Failed to load settings:',
        err
      );

      setError(
        'Unable to load your settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (savingProfile) {
      return;
    }

    try {
      setSavingProfile(true);
      setMessage('');
      setError('');

      const response = await fetch(
        '/api/profile',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            name: profile.name.trim(),
            image: profile.image.trim()
          })
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to update profile.'
        );
      }

      setMessage(
        'Profile updated successfully.'
      );
    } catch (err) {
      console.error(
        '[settings] Profile update failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (changingPassword) {
      return;
    }

    if (
      !password.currentPassword ||
      !password.newPassword ||
      !password.confirmPassword
    ) {
      setError(
        'Please fill in all password fields.'
      );
      setMessage('');
      return;
    }

    if (
      password.newPassword !==
      password.confirmPassword
    ) {
      setError(
        'New passwords do not match.'
      );
      setMessage('');
      return;
    }

    if (password.newPassword.length < 8) {
      setError(
        'New password must be at least 8 characters.'
      );
      setMessage('');
      return;
    }

    try {
      setChangingPassword(true);
      setMessage('');
      setError('');

      const response = await fetch(
        '/api/account/password',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            currentPassword:
              password.currentPassword,
            newPassword:
              password.newPassword
          })
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to change password.'
        );
      }

      setPassword({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setMessage(
        'Password changed successfully.'
      );
    } catch (err) {
      console.error(
        '[settings] Password change failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change password.'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);

      const response = await fetch(
        '/api/security/sessions',
        {
          cache: 'no-store'
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to load sessions.'
        );
      }

      setSessions(
        Array.isArray(data?.sessions)
          ? data.sessions
          : []
      );
    } catch (err) {
      console.error(
        '[settings] Session loading failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load sessions.'
      );
    } finally {
      setLoadingSessions(false);
    }
  };

  const revokeSession = async (
    sessionId: string
  ) => {
    if (!sessionId) {
      return;
    }

    try {
      setError('');
      setMessage('');

      const response = await fetch(
        `/api/security/sessions/${sessionId}`,
        {
          method: 'DELETE'
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to revoke session.'
        );
      }

      setSessions((current) =>
        current.filter(
          (item) =>
            item.id !== sessionId
        )
      );

      setMessage(
        'Session revoked successfully.'
      );
    } catch (err) {
      console.error(
        '[settings] Session revoke failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to revoke session.'
      );
    }
  };

  const exportAccount = async () => {
    try {
      setError('');
      setMessage('');

      const response = await fetch(
        '/api/account/export',
        {
          method: 'GET'
        }
      );

      if (!response.ok) {
        const data =
          await response.json().catch(
            () => ({})
          );

        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to export account data.'
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

      anchor.href = url;
      anchor.download =
        `meridian-ai-account-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      setMessage(
        'Your account data has been exported.'
      );
    } catch (err) {
      console.error(
        '[settings] Account export failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to export account data.'
      );
    }
  };

  const deleteAccount = async () => {
    if (deletingAccount) {
      return;
    }

    const confirmed =
      window.confirm(
        'Are you sure you want to permanently delete your Meridian AI account? This action cannot be undone.'
      );

    if (!confirmed) {
      return;
    }

    const secondConfirmation =
      window.confirm(
        'This will permanently delete your account and associated data. Continue?'
      );

    if (!secondConfirmation) {
      return;
    }

    try {
      setDeletingAccount(true);
      setError('');

      const response = await fetch(
        '/api/account/delete',
        {
          method: 'DELETE'
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to delete account.'
        );
      }

      await signOut({
        callbackUrl: '/login'
      });
    } catch (err) {
      console.error(
        '[settings] Account deletion failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete account.'
      );

      setDeletingAccount(false);
    }
  };

  const logout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await signOut({
        callbackUrl: '/login'
      });
    } catch (err) {
      console.error(
        '[settings] Logout failed:',
        err
      );

      setLoggingOut(false);

      setError(
        'Unable to log out. Please try again.'
      );
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-3 h-4 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Settings
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage your Meridian AI account,
            security and data.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <User size={19} />
              <div>
                <h2 className="font-semibold">
                  Profile
                </h2>
                <p className="text-sm text-zinc-500">
                  Update your account information.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Name
              </label>

              <input
                value={profile.name}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-2.5 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Email
              </label>

              <input
                value={profile.email}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Profile image URL
              </label>

              <input
                value={profile.image}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    image: event.target.value
                  }))
                }
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-2.5 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700"
                placeholder="https://..."
              />
            </div>

            <button
              type="button"
              disabled={savingProfile}
              onClick={saveProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              <Save size={16} />
              {savingProfile
                ? 'Saving...'
                : 'Save profile'}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <KeyRound size={19} />
              <div>
                <h2 className="font-semibold">
                  Password
                </h2>
                <p className="text-sm text-zinc-500">
                  Change your Meridian AI password.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <PasswordInput
              label="Current password"
              value={
                password.currentPassword
              }
              onChange={(value) =>
                setPassword((current) => ({
                  ...current,
                  currentPassword: value
                }))
              }
            />

            <PasswordInput
              label="New password"
              value={password.newPassword}
              onChange={(value) =>
                setPassword((current) => ({
                  ...current,
                  newPassword: value
                }))
              }
            />

            <PasswordInput
              label="Confirm new password"
              value={
                password.confirmPassword
              }
              onChange={(value) =>
                setPassword((current) => ({
                  ...current,
                  confirmPassword: value
                }))
              }
            />

            <button
              type="button"
              disabled={changingPassword}
              onClick={changePassword}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              <Shield size={16} />
              {changingPassword
                ? 'Changing...'
                : 'Change password'}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Monitor size={19} />
              <div>
                <h2 className="font-semibold">
                  Active sessions
                </h2>
                <p className="text-sm text-zinc-500">
                  Manage devices currently signed in.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={loadingSessions}
              onClick={loadSessions}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {loadingSessions
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sessions.length === 0 ? (
              <div className="p-5 text-sm text-zinc-500">
                No active sessions found.
              </div>
            ) : (
              sessions.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {item.current
                        ? 'Current session'
                        : 'Signed-in session'}
                    </p>

                    <p className="mt-1 break-all text-xs text-zinc-500">
                      {item.userAgent ||
                        'Unknown device'}
                    </p>

                    {item.ipAddress && (
                      <p className="mt-1 text-xs text-zinc-500">
                        IP: {item.ipAddress}
                      </p>
                    )}
                  </div>

                  {!item.current && (
                    <button
                      type="button"
                      onClick={() =>
                        revokeSession(
                          item.id
                        )
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
            <h2 className="font-semibold">
              Your data
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Download a copy of your Meridian AI
              account data.
            </p>
          </div>

          <div className="p-5">
            <button
              type="button"
              onClick={exportAccount}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <Download size={16} />
              Export account data
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-red-200 bg-white dark:border-red-950 dark:bg-zinc-950">
          <div className="border-b border-red-200 px-5 py-5 dark:border-red-950">
            <div className="flex items-center gap-3">
              <Trash2
                size={19}
                className="text-red-600"
              />

              <div>
                <h2 className="font-semibold text-red-600">
                  Danger zone
                </h2>

                <p className="text-sm text-zinc-500">
                  Permanently delete your account and
                  associated data.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                Delete account
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                This action cannot be undone.
              </p>
            </div>

            <button
              type="button"
              disabled={deletingAccount}
              onClick={deleteAccount}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deletingAccount
                ? 'Deleting...'
                : 'Delete account'}
            </button>
          </div>
        </section>

        <section className="pb-10">
          <button
            type="button"
            disabled={loggingOut}
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <LogOut size={16} />
            {loggingOut
              ? 'Logging out...'
              : 'Log out'}
          </button>
        </section>
      </div>
    </div>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function PasswordInput({
  label,
  value,
  onChange
}: PasswordInputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        type="password"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        autoComplete="new-password"
        className="w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-2.5 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700"
      />
    </div>
  );
}
