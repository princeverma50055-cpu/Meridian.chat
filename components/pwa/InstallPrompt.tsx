'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { MeridianMark } from '@/components/ui/MeridianMark';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
  }>;
}

const DISMISS_KEY = 'meridian-install-dismissed';

/*
 * Registers the service worker (required for installability) and
 * shows a small custom "Install app" banner when the browser signals
 * the site is installable, instead of relying purely on the browser's
 * own (often easy-to-miss) install icon in the address bar.
 *
 * Renders nothing on browsers that don't support the install prompt
 * (e.g. iOS Safari, Firefox) — the site still works fully there, it
 * just won't offer the one-tap install banner.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // Non-critical — the app works fine without it, it just
        // won't be installable.
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const alreadyDismissed =
      window.localStorage.getItem(DISMISS_KEY) === '1';

    const isStandalone =
      window.matchMedia(
        '(display-mode: standalone)'
      ).matches ||
      // iOS-specific standalone flag
      (window.navigator as unknown as {
        standalone?: boolean;
      }).standalone === true;

    if (alreadyDismissed || isStandalone) {
      return;
    }

    function handleBeforeInstallPrompt(
      event: Event
    ) {
      // Stop the browser's default mini-infobar so our own banner
      // is the single, consistent install entry point.
      event.preventDefault();

      setDeferredPrompt(
        event as BeforeInstallPromptEvent
      );

      setVisible(true);
    }

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt
    );

    function handleInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener(
      'appinstalled',
      handleInstalled
    );

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener(
        'appinstalled',
        handleInstalled
      );
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();

    // The browser-native choice dialog resolves here regardless of
    // outcome — either way, our job (offering the prompt) is done.
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    setVisible(false);

    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        '1'
      );
    } catch {
      // Ignore storage errors (e.g. private browsing).
    }
  }

  if (!visible || !deferredPrompt) {
    return null;
  }

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-border bg-surface-light/95 p-3 shadow-lg backdrop-blur dark:border-slate-border-dark dark:bg-surface-dark-raised/95">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
          <MeridianMark size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink dark:text-paper">
            Install Meridian
          </p>
          <p className="truncate text-[12px] text-slate">
            Add it to your home screen for quick access
          </p>
        </div>

        <button
          type="button"
          onClick={handleInstall}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#3654FF] px-3 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Download size={14} />
          Install
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-slate transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
