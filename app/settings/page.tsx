'use client';

import { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Tabs } from '@/components/ui/Tabs';
import { SettingsRow, Switch } from '@/components/settings/SettingsRow';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/layout/ThemeProvider';
import { MODELS } from '@/components/chat/ModelSelector';
import { cn } from '@/lib/utils/cn';

export default function SettingsPage() {
  return (
    <AppShell>
      <ChatHeader title="Settings" />
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <Tabs
            defaultTab="general"
            tabs={[
              { id: 'general', label: 'General', content: <GeneralSettings /> },
              { id: 'appearance', label: 'Appearance', content: <AppearanceSettings /> },
              { id: 'ai', label: 'AI', content: <AiSettings /> },
              { id: 'privacy', label: 'Privacy', content: <PrivacySettings /> },
              { id: 'notifications', label: 'Notifications', content: <NotificationSettings /> },
              { id: 'security', label: 'Security', content: <SecuritySettings /> }
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-border bg-white px-4 dark:border-slate-border-dark dark:bg-surface-dark-raised">
      {children}
    </div>
  );
}

function GeneralSettings() {
  const [language, setLanguage] = useState('English');
  const [defaultModel, setDefaultModel] = useState(MODELS[0]?.id || '');

  return (
    <SectionCard>
      <SettingsRow label="Language" description="Interface language">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-slate-border bg-transparent px-2.5 py-1.5 text-[13px] dark:border-slate-border-dark"
        >
          <option>English</option>
          <option>Hindi</option>
          <option>Spanish</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Default model" description="Used for new conversations">
        <select
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          className="rounded-lg border border-slate-border bg-transparent px-2.5 py-1.5 text-[13px] dark:border-slate-border-dark"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </SettingsRow>
      <SettingsRow label="Response style" description="How Meridian formats replies">
        <select className="rounded-lg border border-slate-border bg-transparent px-2.5 py-1.5 text-[13px] dark:border-slate-border-dark">
          <option>Balanced</option>
          <option>Concise</option>
          <option>Detailed</option>
        </select>
      </SettingsRow>
    </SectionCard>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const options = [
    { id: 'light' as const, label: 'Light', icon: Sun },
    { id: 'dark' as const, label: 'Dark', icon: Moon },
    { id: 'system' as const, label: 'System', icon: Monitor }
  ];

  return (
    <SectionCard>
      <div className="py-4">
        <p className="mb-3 text-[13.5px] font-medium text-ink dark:text-paper">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {options.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-[12.5px] font-medium transition-colors',
                theme === id
                  ? 'border-cobalt bg-cobalt/5 text-cobalt'
                  : 'border-slate-border text-slate hover:bg-surface-light dark:border-slate-border-dark dark:hover:bg-surface-dark'
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function AiSettings() {
  const [memoryOn, setMemoryOn] = useState(true);

  return (
    <SectionCard>
      <SettingsRow label="Memory" description="Let Meridian remember details across conversations">
        <Switch checked={memoryOn} onChange={setMemoryOn} />
      </SettingsRow>
      <SettingsRow label="Web search by default" description="Automatically search when helpful">
        <Switch checked={false} onChange={() => {}} />
      </SettingsRow>
      <SettingsRow label="Manage memories" description="View or delete what Meridian remembers">
        <Button variant="outline" size="sm">
          View memories
        </Button>
      </SettingsRow>
    </SectionCard>
  );
}

function PrivacySettings() {
  return (
    <SectionCard>
      <SettingsRow label="Export your data" description="Download all conversations and files">
        <Button variant="outline" size="sm">
          Export
        </Button>
      </SettingsRow>
      <SettingsRow label="Delete all conversations" description="This cannot be undone">
        <Button variant="danger" size="sm">
          Delete all
        </Button>
      </SettingsRow>
      <SettingsRow label="Delete account" description="Permanently remove your account and data">
        <Button variant="danger" size="sm">
          Delete account
        </Button>
      </SettingsRow>
    </SectionCard>
  );
}

function NotificationSettings() {
  const [email, setEmail] = useState(true);
  const [product, setProduct] = useState(false);

  return (
    <SectionCard>
      <SettingsRow label="Email notifications" description="Updates about your conversations">
        <Switch checked={email} onChange={setEmail} />
      </SettingsRow>
      <SettingsRow label="Product updates" description="News about new Meridian features">
        <Switch checked={product} onChange={setProduct} />
      </SettingsRow>
    </SectionCard>
  );
}

function SecuritySettings() {
  return (
    <SectionCard>
      <SettingsRow label="Password" description="Last changed 3 months ago">
        <Button variant="outline" size="sm">
          Change password
        </Button>
      </SettingsRow>
      <SettingsRow label="Active sessions" description="Manage devices signed in to your account">
        <Button variant="outline" size="sm">
          View sessions
        </Button>
      </SettingsRow>
      <SettingsRow label="Connected accounts" description="Google and other linked sign-in methods">
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </SettingsRow>
    </SectionCard>
  );
}
