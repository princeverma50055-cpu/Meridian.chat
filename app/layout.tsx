import type { Metadata, Viewport } from 'next';
import {
  Space_Grotesk,
  Inter,
  JetBrains_Mono
} from 'next/font/google';

import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { SessionProviderWrapper } from '@/components/layout/SessionProviderWrapper';
import { SidebarStateProvider } from '@/components/layout/SidebarContext';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600']
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600']
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500']
});

export const metadata: Metadata = {
  title: 'Meridian — Your AI. Your Tools. Your Intelligence.',
  description:
    'Meridian is an AI assistant platform for chat, web research, file analysis, and custom agents.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Meridian'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: '#FAFAFA'
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: '#0A0E17'
    }
  ]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before React hydrates, so the correct theme
          class is on <html> for the very first paint — no
          light-then-dark flash on load or after redirects
          (e.g. coming back from the Google sign-in page).
        */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem('meridian-theme');
                  var theme = stored === 'light' || stored === 'dark'
                    ? stored
                    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable}`}
      >
        <SessionProviderWrapper>
          <ThemeProvider>
            <SidebarStateProvider>
              {children}
              <InstallPrompt />
            </SidebarStateProvider>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
