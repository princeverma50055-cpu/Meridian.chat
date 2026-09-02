'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Archive,
  Edit3,
  FolderKanban,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  instructions: string | null;
  createdAt: string | Date;
};

type ProjectFormState = {
  name: string;
  description: string;
  instructions: string;
};

const EMPTY_FORM: ProjectFormState = {
  name: '',
  description: '',
  instructions: '',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] =
    useState<Project | null>(null);

  const [form, setForm] =
    useState<ProjectFormState>(EMPTY_FORM);

  const [error, setError] = useState('');

  async function loadProjects() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/projects', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to load projects.'
        );
      }

      setProjects(data?.projects ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load projects.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  function openCreate() {
    setEditingProject(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setForm({
      name: project.name ?? '',
      description: project.description ?? '',
      instructions: project.instructions ?? '',
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingProject(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError('Project name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const isEditing = Boolean(editingProject);

      const response = await fetch(
        isEditing
          ? `/api/projects/${editingProject!.id}`
          : '/api/projects',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description:
              form.description.trim() || null,
            instructions:
              form.instructions.trim() || null,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to save project.'
        );
      }

      if (isEditing) {
        setProjects((current) =>
          current.map((project) =>
            project.id === editingProject!.id
              ? data.project
              : project
          )
        );
      } else if (data?.project) {
        setProjects((current) => [
          data.project,
          ...current,
        ]);
      }

      closeForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save project.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(project: Project) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(project.id);
      setError('');

      const response = await fetch(
        `/api/projects/${project.id}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to delete project.'
        );
      }

      setProjects((current) =>
        current.filter(
          (item) => item.id !== project.id
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete project.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>

                <h1 className="text-2xl font-semibold tracking-tight">
                  Projects
                </h1>
              </div>

              <p className="text-sm text-muted-foreground">
                Organize your AI work with custom projects,
                instructions, and context.
              </p>
            </div>

            <Button
              onClick={openCreate}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
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
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Archive className="h-7 w-7 text-muted-foreground" />
              </div>

              <h2 className="text-lg font-semibold">
                No projects yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Create your first project to keep related
                AI conversations and instructions organized.
              </p>

              <Button
                onClick={openCreate}
                className="mt-6"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="group flex min-h-[220px] flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FolderKanban className="h-5 w-5 text-primary" />
                      </div>

                      <h2 className="truncate font-semibold">
                        {project.name}
                      </h2>
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">
                    {project.description ||
                      'No project description added yet.'}
                  </p>

                  {project.instructions && (
                    <div className="mt-4 rounded-xl bg-muted/50 p-3">
                      <p className="mb-1 text-xs font-medium text-foreground">
                        Instructions
                      </p>

                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {project.instructions}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(project)}
                      className="flex-1"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        void handleDelete(project)
                      }
                      disabled={deletingId === project.id}
                    >
                      {deletingId === project.id ? (
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
                      {editingProject
                        ? 'Edit Project'
                        : 'Create Project'}
                    </h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Configure your project context and
                      instructions.
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
                      htmlFor="project-name"
                      className="mb-2 block text-sm font-medium"
                    >
                      Project name
                    </label>

                    <Input
                      id="project-name"
                      value={form.name}
                      maxLength={120}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. Marketing Campaign"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="project-description"
                      className="mb-2 block text-sm font-medium"
                    >
                      Description
                    </label>

                    <Textarea
                      id="project-description"
                      value={form.description}
                      maxLength={1000}
                      rows={4}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description:
                            event.target.value,
                        }))
                      }
                      placeholder="What is this project about?"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="project-instructions"
                      className="mb-2 block text-sm font-medium"
                    >
                      AI instructions
                    </label>

                    <Textarea
                      id="project-instructions"
                      value={form.instructions}
                      maxLength={10000}
                      rows={8}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          instructions:
                            event.target.value,
                        }))
                      }
                      placeholder="Tell Meridian how it should work within this project..."
                      disabled={saving}
                    />

                    <p className="mt-1 text-xs text-muted-foreground">
                      {form.instructions.length}/10000
                    </p>
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
                          {editingProject
                            ? 'Save Changes'
                            : 'Create Project'}
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
