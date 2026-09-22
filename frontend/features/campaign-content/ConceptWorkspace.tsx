'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthGuard';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useGenerateAiIdeasMutation, useExpandAiIdeaMutation, useBriefQuery } from './queries';


const fields = ['title', 'hook', 'outline', 'script', 'cta', 'requirements'] as const;
const labels = {
  title: 'Concept title',
  hook: 'Opening hook',
  outline: 'Content outline',
  script: 'Script',
  cta: 'Call to action',
  requirements: 'How this meets the brief',
};
type Content = Record<(typeof fields)[number], string>;
type Concept = {
  id: string;
  creator_id: string;
  state: string;
  version: number;
  revision_id: string;
  content: Content;
  stale_brief: boolean;
};
type Listing = {
  creator: string | null;
  can_approve: boolean;
  brief_revision_id: string | null;
  items: Concept[];
  has_more: boolean;
};
type History = {
  has_more: boolean;
  revisions: { id: string; content: Content; submitted_at: string | null; created_at: string }[];
  reviews: { revision_id: string; decision: string; message: string }[];
  comments: { id: string; revision_id: string; section: string; message: string; visibility: string }[];
};
const empty: Content = { title: '', hook: '', outline: '', script: '', cta: '', requirements: '' };

function errorMessage(error: unknown) {
  const e = error as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  return e.response?.data?.detail || e.response?.data?.message || e.message || 'Unable to save. Please try again.';
}

export default function ConceptWorkspace({
  campaignId,
  displayedBriefId,
  mode = 'ideas',
  onGoToIdeas,
}: {
  campaignId: string;
  displayedBriefId?: string;
  mode?: 'ideas' | 'feedback';
  onGoToIdeas?: () => void;
}) {
  const { email } = useAuth();
  return <Workspace key={`${email}:${campaignId}:${mode}`} campaignId={campaignId} displayedBriefId={displayedBriefId} mode={mode} onGoToIdeas={onGoToIdeas} />;
}

function Workspace({ campaignId, displayedBriefId, mode, onGoToIdeas }: { campaignId: string; displayedBriefId?: string; mode: 'ideas' | 'feedback'; onGoToIdeas?: () => void }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Concept | 'new' | null>(null);
  const [selected, setSelected] = useState<Concept | null>(null);
  const [aiIdeas, setAiIdeas] = useState<any[]>([]);
  const [aiError, setAiError] = useState('');

  const path = `/campaigns/${encodeURIComponent(campaignId)}/concepts`;
  const query = useBriefQuery<Listing>(`${path}?page=${page}`);
  const savedIdeas = useBriefQuery<{ ideas: any[] }>(
    `/campaigns/${encodeURIComponent(campaignId)}/ai-ideas`,
    mode === 'ideas' && Boolean(query.data?.creator)
  );

  const generateAi = useGenerateAiIdeasMutation(campaignId);
  const expandAi = useExpandAiIdeaMutation(campaignId);

  useEffect(() => {
    if (savedIdeas.data?.ideas) setAiIdeas(savedIdeas.data.ideas);
  }, [savedIdeas.data]);

  const handleGenerateAi = async () => {
    setAiError('');
    try {
      const res = await generateAi.mutateAsync();
      if (res.ideas) setAiIdeas(res.ideas);
    } catch (e) {
      setAiError(errorMessage(e));
    }
  };

  const handleExpandAi = async (ideaId: string) => {
    setAiError('');
    try {
      await expandAi.mutateAsync(ideaId);
      await refresh();
    } catch (e) {
      setAiError(errorMessage(e));
    }
  };

  if (query.isError)
    return (
      <section role="alert" className="rounded-2xl border p-5">
        Campaign ideas could not be loaded.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Try again
        </button>
      </section>
    );
  if (!query.data) return <p>Loading concepts…</p>;
  const data = query.data;
  const visibleItems = mode === 'feedback' ? data.items.filter((item) => item.state !== 'draft') : data.items;
  const refresh = async () => {
    setEditing(null);
    setSelected(null);
    await query.refetch();
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-5 text-[var(--n-fg)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">{mode === 'feedback' ? 'Feedback' : 'Campaign ideas'}</h2>
          <p className="mt-1 text-sm text-[var(--n-fg-muted)]">
            {mode === 'feedback'
              ? 'See decisions and requested changes on your submitted concepts.'
              : data.creator
                ? 'Use the brief to write an idea, then send it for review.'
                : 'Review creator submissions against the shared brief.'}
          </p>
        </div>
        {mode === 'ideas' && data.creator && !editing && (
          <div className="flex gap-2">
            <Button
              disabled={!data.brief_revision_id || generateAi.isPending}
              onClick={() => void handleGenerateAi()}
            >
              {generateAi.isPending ? 'Reading the brief…' : '✨ Get 3 ideas from this brief'}
            </Button>
            <Button
              disabled={!data.brief_revision_id}
              onClick={() => {
                setSelected(null);
                setEditing('new');
              }}
            >
              Write a concept
            </Button>
          </div>
        )}
      </header>

      {mode === 'ideas' && aiError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">We couldn’t create starting points right now. {aiError}</p>}

      {mode === 'ideas' && aiIdeas.length > 0 && !editing && (
        <div className="my-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div><h3 className="text-sm font-medium text-amber-900">✨ AI starting points</h3><p className="mt-1 text-xs text-amber-900/80">These ideas use the campaign brief and your saved creator profile. Review and adapt them before submitting.</p></div>
          <div className="grid gap-3 md:grid-cols-3">
            {aiIdeas.map((idea) => (
              <div key={idea.id} className="flex flex-col justify-between rounded-lg border bg-white p-4 shadow-sm">
                <div>
                  <h4 className="font-semibold text-sm">{idea.title}</h4>
                  <p className="mt-1 text-xs text-amber-800 font-medium"><span className="font-semibold">Why it fits: </span>{idea.rationale}</p>
                  <p className="mt-2 text-xs text-gray-600 line-clamp-3"><span className="font-medium">Hook:</span> {idea.hook}</p>
                </div>
                <Button
                  disabled={idea.is_expanded || expandAi.isPending}
                  className="mt-3 text-xs w-full"
                  onClick={() => void handleExpandAi(idea.id)}
                >
                  {idea.is_expanded ? 'Draft created' : 'Start a draft from this'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.brief_revision_id && <p className="text-sm">Share the campaign brief to start creating concepts.</p>}
      {editing ? (
        <ConceptEditor
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          path={path}
          briefId={displayedBriefId ?? data.brief_revision_id!}
          onDone={refresh}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          {!visibleItems.length ? (
            <div className="py-6 text-sm">
              {mode === 'feedback'
                ? <><p className="font-medium">No feedback yet</p><p className="mt-1 text-[var(--n-fg-muted)]">Submit a concept to start a review.</p>{onGoToIdeas && <Button className="mt-3" onClick={onGoToIdeas}>Go to ideas</Button>}</>
                : data.creator
                  ? 'No concepts yet. Write your own idea or get three starting points from this brief.'
                  : 'Submitted concepts will appear here for review.'}
            </div>
          ) : (
            <ul className="divide-y">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{item.content.title || 'Untitled concept'}</p>
                    <p className="text-sm text-[var(--n-fg-muted)]">
                      {item.state === 'draft' ? 'Private draft' : item.state === 'submitted' ? 'Waiting for review' : item.state === 'changes_requested' ? 'Changes requested' : 'Approved for production'}
                      {!data.creator ? ` · Creator ${item.creator_id}` : ''}
                      {item.stale_brief ? ' · Brief updated' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setSelected(item)}>Review concept</Button>
                    {data.creator && (
                      <Button
                        onClick={() => {
                          setSelected(null);
                          setEditing(item);
                        }}
                      >
                        Edit draft
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(data.has_more || page > 1) && <div className="flex items-center gap-3">
            <Button
              disabled={page === 1}
              onClick={() => {
                setSelected(null);
                setPage(page - 1);
              }}
            >
              Previous
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              disabled={!data.has_more}
              onClick={() => {
                setSelected(null);
                setPage(page + 1);
              }}
            >
              Next
            </Button>
          </div>}
          {selected && (
            <ConceptDetail
              key={selected.id + ':' + selected.version}
              item={selected}
              creator={Boolean(data.creator)}
              canApprove={data.can_approve}
              path={path}
              onDone={refresh}
            />
          )}
        </>
      )}
    </section>
  );
}
function ConceptEditor({
  item,
  path,
  briefId,
  onDone,
  onCancel,
}: {
  item: Concept | null;
  path: string;
  briefId: string;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState<Content>(item?.content ?? empty);
  const [ack, setAck] = useState(!item?.stale_brief);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [baseBrief] = useState(briefId);

  const dirty = JSON.stringify(content) !== JSON.stringify(item?.content ?? empty);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { version: item?.version ?? 0, brief_revision_id: baseBrief, content };
      if (item) await api.put(`${path}/${item.id}`, body);
      else await api.post(path, body);
      await onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--n-border)] bg-[#FAF9F5] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{item ? 'Edit Concept Draft' : 'Create New Concept'}</h3>
        <span className="text-xs text-gray-500">Drafts stay private until submitted</span>
      </div>

      {item?.stale_brief && (
        <label className="flex items-center gap-2 rounded-xl bg-amber-100 p-3 text-xs text-amber-900 font-medium">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I have read the updated brief and adapted this concept draft.
        </label>
      )}

      {/* Grid-based Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-xs font-medium text-gray-700 md:col-span-2">
          {labels.title}
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-[var(--n-border)] bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            maxLength={200}
            value={content.title}
            onChange={(e) => setContent({ ...content, title: e.target.value })}
            placeholder="e.g. 3-Step Morning Skincare Routine"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          {labels.hook}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--n-border)] bg-white p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={2}
            maxLength={4000}
            value={content.hook}
            onChange={(e) => setContent({ ...content, hook: e.target.value })}
            placeholder="Opening 3-second hook audio/visual..."
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          {labels.cta}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--n-border)] bg-white p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={2}
            maxLength={4000}
            value={content.cta}
            onChange={(e) => setContent({ ...content, cta: e.target.value })}
            placeholder="Call to action text..."
          />
        </label>

        <label className="block text-xs font-medium text-gray-700 md:col-span-2">
          {labels.outline}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--n-border)] bg-white p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={3}
            maxLength={4000}
            value={content.outline}
            onChange={(e) => setContent({ ...content, outline: e.target.value })}
            placeholder="Step by step flow outline..."
          />
        </label>

        <label className="block text-xs font-medium text-gray-700 md:col-span-2">
          {labels.script}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--n-border)] bg-white p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={4}
            maxLength={12000}
            value={content.script}
            onChange={(e) => setContent({ ...content, script: e.target.value })}
            placeholder="Full video script or spoken dialog..."
          />
        </label>

        <label className="block text-xs font-medium text-gray-700 md:col-span-2">
          {labels.requirements}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--n-border)] bg-white p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={2}
            maxLength={4000}
            value={content.requirements}
            onChange={(e) => setContent({ ...content, requirements: e.target.value })}
            placeholder="How this fulfills mandatory guidelines..."
          />
        </label>
      </div>

      {error && <p role="alert" className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button disabled={busy || !ack} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save draft'}
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm('Discard your unsaved changes?')) onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ConceptDetail({item,creator,canApprove,path,onDone}:{item:Concept;creator:boolean;canApprove:boolean;path:string;onDone:()=>Promise<void>}){
 const [historyPage,setHistoryPage]=useState(1);
 const history=useBriefQuery<History>(`${path}/${item.id}/history?page=${historyPage}`);
 const [message,setMessage]=useState(''),[section,setSection]=useState('general'),[internal,setInternal]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const perform=async(action:string)=>{setBusy(true);setError('');try{if(action==='comment'){await api.post(`${path}/${item.id}/comments`,{revision_id:item.revision_id,section,message,visibility:internal?'internal':'shared'});setMessage('');await history.refetch();}else{await api.post(`${path}/${item.id}/actions`,{version:item.version,revision_id:item.revision_id,action,message});await onDone();}}catch(e){setError(errorMessage(e));}finally{setBusy(false);}};
 return <div className="space-y-4 border-t pt-5"><h3 className="text-lg font-medium">{item.content.title||'Concept details'}</h3>{item.stale_brief&&<p className="rounded-lg bg-amber-50 p-3 text-sm">The campaign brief has changed. Update this concept before submitting or approving it.</p>}{!creator&&item.state==='draft'&&<p className="text-sm">The creator is preparing a new draft. This is their previous submission.</p>}
  <dl className="space-y-3">{fields.filter(f=>item.content[f]).map(f=><div key={f}><dt className="text-sm text-[var(--n-fg-muted)]">{labels[f]}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{item.content[f]}</dd></div>)}</dl>
  <label className="block text-sm">Feedback or review note<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} className="mt-1 w-full rounded-lg border p-3" rows={3}/></label>
  <div className="flex flex-wrap items-center gap-3"><label className="text-sm">Section <select className="rounded border p-1" value={section} onChange={e=>setSection(e.target.value)}><option value="general">General</option>{fields.map(f=><option key={f} value={f}>{labels[f]}</option>)}</select></label>{!creator&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/>Agency-only comment</label>}<Button disabled={busy||!message.trim()} onClick={()=>void perform('comment')}>Add comment</Button></div>
  <div className="flex flex-wrap gap-2">{creator&&item.state==='draft'&&<Button disabled={busy||item.stale_brief} onClick={()=>void perform('submit')}>Submit for review</Button>}{!creator&&item.state==='submitted'&&<><Button disabled={busy||!message.trim()||internal} onClick={()=>void perform('changes_requested')}>Request changes</Button>{canApprove&&<Button disabled={busy||item.stale_brief||internal} onClick={()=>void perform('approved')}>Approve this revision</Button>}<p className="w-full text-xs">Review notes are shared with the creator.</p></>}</div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  <details><summary className="cursor-pointer text-sm">Revision history & discussion</summary>{history.isError?<p role="alert">Could not load history.</p>:!history.data?<p>Loading history…</p>:<div className="mt-3 space-y-4">
   {history.data.revisions.map(r=><article key={r.id} className="rounded-lg border p-3 text-sm"><p>{r.created_at.replace('T',' ').slice(0,19)} · {r.submitted_at?'Submitted':'Private draft'} · {r.id.slice(0,8)}</p><details className="mt-2"><summary>Read revision</summary>{fields.map(f=><p key={f} className="mt-2 whitespace-pre-wrap"><span className="font-medium">{labels[f]}: </span>{r.content[f]||'—'}</p>)}</details>{history.data!.reviews.filter(v=>v.revision_id===r.id).map(v=><p key={v.revision_id} className="mt-2">{v.decision.replaceAll('_',' ')} · {v.message}</p>)}</article>)}
   <h4 className="text-sm font-medium">Comments</h4>{history.data.comments.map(c=><p key={c.id} className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{c.visibility==='internal'?'Agency only · ':''}Revision {c.revision_id.slice(0,8)} · {c.section}: {c.message}</p>)}
   <div className="flex gap-2"><Button disabled={historyPage===1} onClick={()=>setHistoryPage(historyPage-1)}>Newer history</Button><Button disabled={!history.data.has_more} onClick={()=>setHistoryPage(historyPage+1)}>Older history</Button></div>
  </div>}</details>
 </div>;
}
