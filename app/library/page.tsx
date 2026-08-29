'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Library, FileText } from 'lucide-react';

interface LibraryFile {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
}

export default function LibraryPage() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/files')
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => setFiles(data.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AppShell>
      <ChatHeader title="Library" />
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl">
          {loaded && files.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Library size={32} className="text-cobalt" />
              <p className="text-[13.5px] text-slate">No files uploaded yet.</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-slate-border bg-white px-4 py-3 dark:border-slate-border-dark dark:bg-surface-dark-raised"
              >
                <FileText size={16} className="text-cobalt" />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.fileName}</span>
                <span className="text-[11px] text-slate-light">{f.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
