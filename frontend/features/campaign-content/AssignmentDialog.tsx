'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import styles from '@/app/campaigns/[id]/brief/brief.module.css';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { briefPath, useBriefQuery } from './queries';
import type { Assignments, AssignmentOptions } from './types';
export default function AssignmentDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useBriefQuery<Assignments>(`${briefPath(id)}/assignments`);
  return (
    <Dialog
      className={`${styles.workspace} ${styles.dialog}`}
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Campaign access"
      description="Assigned creators see the shared brief and future shared updates."
    >
      {query.isError ? (
        <p role="alert">
          Could not load access settings.{' '}
          <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      ) : query.data ? (
        <AssignmentForm key={query.data.version} id={id} initial={query.data} onClose={onClose} />
      ) : (
        <p>Loading access…</p>
      )}
    </Dialog>
  );
}
function AssignmentForm({
  id,
  initial,
  onClose,
}: {
  id: string;
  initial: Assignments;
  onClose: () => void;
}) {
  const [members, setMembers] = useState(initial.members),
    [creators, setCreators] = useState(initial.creators),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient();
  const options = useBriefQuery<AssignmentOptions>(
    `${briefPath(id)}/assignment-options?search=${encodeURIComponent(search)}&page=${page}`,
  );
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.put(`${briefPath(id)}/assignments`, {
        version: initial.version,
        members: members.map(({ user_id, can_publish }) => ({ user_id, can_publish })),
        creator_ids: creators.map((c) => c.creator_id),
      });
      await client.invalidateQueries({ queryKey: ['campaign-content'] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const availableMembers =
    options.data?.members.filter((m) => !members.some((x) => x.user_id === m.user_id)) ?? [];
  const availableCreators =
    options.data?.creators.filter((c) => !creators.some((x) => x.creator_id === c.creator_id)) ??
    [];

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Team members ({members.length})
            </h3>
          </div>
          {!members.length ? (
            <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-500">
              No team members assigned yet.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {members.map((m) => {
                const label = m.display_name || m.email;
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate font-medium text-slate-800">{label}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600"
                          checked={m.can_publish}
                          onChange={(e) =>
                            setMembers((v) =>
                              v.map((x) =>
                                x.user_id === m.user_id
                                  ? { ...x, can_publish: e.target.checked }
                                  : x,
                              ),
                            )
                          }
                        />
                        Can share
                      </label>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:text-red-600"
                        onClick={() => setMembers((v) => v.filter((x) => x.user_id !== m.user_id))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Creators ({creators.length})
            </h3>
          </div>
          {!creators.length ? (
            <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-500">
              No creators assigned. Add a creator below to share the brief.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {creators.map((c) => (
                <div
                  key={c.creator_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate font-medium text-slate-800">{c.name}</span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-red-600"
                    onClick={() =>
                      setCreators((v) => v.filter((x) => x.creator_id !== c.creator_id))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Add people
          <div className="mt-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email…"
            />
          </div>
        </label>

        {options.isError ? (
          <p role="alert" className="mt-2 text-xs text-red-600">
            Search is unavailable.
          </p>
        ) : options.isFetching ? (
          <p className="mt-2 text-xs text-slate-500">Searching…</p>
        ) : availableMembers.length === 0 && availableCreators.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No matching members or creators found.</p>
        ) : (
          <div className="mt-2.5 max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {availableMembers.map((m) => {
              const label = m.display_name || m.email;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                      {label.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{label}</p>
                      {m.display_name && (
                        <p className="truncate text-xs text-slate-500">{m.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                      Team
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setMembers((v) => [...v, { ...m, can_publish: false }])}
                    >
                      + Add
                    </Button>
                  </div>
                </div>
              );
            })}
            {availableCreators.map((c) => (
              <div
                key={c.creator_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-600">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                    {c.profiles.length > 0 && (
                      <p className="truncate text-xs text-slate-500">
                        {c.profiles.map((p) => p.email).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                    Creator
                  </span>
                  <Button variant="outline" onClick={() => setCreators((v) => [...v, c])}>
                    + Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(page > 1 || options.data?.has_more) && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!options.data?.has_more}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error} Close and reopen to reload if assignments changed.
        </p>
      )}
      <div className={`${styles.dialogActions} border-t border-slate-200 pt-4`}>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save access'}
        </Button>
      </div>
    </div>
  );
}
