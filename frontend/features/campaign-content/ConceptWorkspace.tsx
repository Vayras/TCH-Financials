'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthGuard';
import Button from '@/components/ui/Button';
import styles from './ConceptWorkspace.module.css';
import { api } from '@/lib/api';
import { useGenerateAiIdeasMutation, useExpandAiIdeaMutation, useBriefQuery, useCampaignReferences } from './queries';
import { useSavedSnapshots, useSocialAccounts } from '@/app/creator-portal/kit-queries';


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
  creator_name?: string;
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
  comments: { id: string; revision_id: string; section: string; message: string; visibility: string; created_at: string; author_name?: string }[];
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
  onGoToBrief,
}: {
  campaignId: string;
  displayedBriefId?: string;
  mode?: 'ideas' | 'feedback';
  onGoToIdeas?: () => void;
  onGoToBrief?: () => void;
}) {
  const { email } = useAuth();
  return <Workspace key={`${email}:${campaignId}:${mode}`} campaignId={campaignId} displayedBriefId={displayedBriefId} mode={mode} onGoToIdeas={onGoToIdeas} onGoToBrief={onGoToBrief} />;
}

function Workspace({ campaignId, displayedBriefId, mode, onGoToIdeas, onGoToBrief }: { campaignId: string; displayedBriefId?: string; mode: 'ideas' | 'feedback'; onGoToIdeas?: () => void; onGoToBrief?: () => void }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Concept | 'new' | null>(null);
  const [selected, setSelected] = useState<Concept | null>(null);
  const [aiIdeas, setAiIdeas] = useState<any[]>([]);
  const [aiError, setAiError] = useState('');
  const [panel, setPanel] = useState<'references' | 'ideas' | 'submitted'>('ideas');
  const accounts = useSocialAccounts();
  const snapshots = useSavedSnapshots(accounts.data ?? []);
  const references = useCampaignReferences(campaignId);

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

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('panel');
    if (value === 'references' || value === 'ideas' || value === 'submitted') setPanel(value);
  }, []);

  const selectPanel = (value: 'references' | 'ideas' | 'submitted') => {
    setPanel(value);
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'ideas');
    url.searchParams.set('panel', value);
    window.history.replaceState({}, '', url);
  };

  const handleGenerateAi = async () => {
    setAiError('');
    try {
      const res = await generateAi.mutateAsync(references.data?.items.map((r:any)=>r.id) ?? []);
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

  useEffect(() => {
    const conceptId=new URLSearchParams(window.location.search).get('concept');
    const target=query.data?.items.find(item=>item.id===conceptId);
    if(target) setSelected(target);
  },[query.data]);

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

      {mode === 'ideas' && data.creator ? <div className="campaign-ideas-shell">
        <nav className="campaign-ideas-rail" aria-label="Campaign workspace">
          {([['references', 'References', 'Pick examples that feel like you.'], ['ideas', 'Ideas', 'Turn the brief into a concept.'], ['submitted', 'Submitted', 'Track reviews and decisions.']] as const).map(([value, label, hint]) => (
            <button key={value} type="button" className={`campaign-ideas-rail-item ${panel === value ? 'is-active' : ''}`} onClick={() => selectPanel(value)}>
              <span>{label}</span><small>{hint}</small>
            </button>
          ))}
        </nav>
        <div className="campaign-ideas-panel">
          {aiError && <p role="alert" className="campaign-error">We couldn’t create starting points right now. {aiError}</p>}
          {panel === 'references' && <ReferencePicker campaignId={campaignId} accounts={accounts.data ?? []} snapshots={snapshots.flatMap(s=>s.data?[s.data]:[])} selected={references.data?.items ?? []} onToggle={references.toggle} />}
          {panel === 'ideas' && <>
            {generateAi.isPending && <div className="campaign-skeleton-list" aria-label="Generating ideas"><span/><span/><span/></div>}
            {aiIdeas.length > 0 && !editing && <div className="campaign-generated-list"><div><h3>Generated from your brief</h3><p>Pick a direction, then shape it into your own voice.</p></div><div className="campaign-idea-list">{aiIdeas.map((idea) => <IdeaCard key={idea.id} idea={idea} busy={expandAi.isPending} onExpand={() => void handleExpandAi(idea.id)} />)}</div></div>}
          </>}
          {panel === 'submitted' && <SubmittedPanel items={data.items.filter((item) => item.state !== 'draft')} creator={Boolean(data.creator)} onSelect={setSelected} />}
        </div>
      </div> : null}

      {!data.brief_revision_id && (data.creator || visibleItems.length > 0) && <p className="text-sm">Share the campaign brief to start creating concepts.</p>}
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
          {selected ? <Button onClick={()=>setSelected(null)}>← All concepts</Button> : !visibleItems.length && !(mode === 'ideas' && data.creator) ? (
            <div className="py-6 text-sm">
              {mode === 'feedback'
                ? <><p className="font-medium">No feedback yet</p><p className="mt-1 text-[var(--n-fg-muted)]">Submit a concept to start a review.</p>{onGoToIdeas && <Button className="mt-3" onClick={onGoToIdeas}>Go to ideas</Button>}</>
                : data.creator
                  ? 'No concepts yet. Write your own idea or get three starting points from this brief.'
                  : <><p className="font-medium">{data.brief_revision_id?'No concepts submitted yet':'Share a brief to get started'}</p><p className="mt-1 text-[var(--n-fg-muted)]">{data.brief_revision_id?'Creator submissions will appear here for review.':'Assign creators and share the saved brief so they can prepare their concepts.'}</p>{onGoToBrief&&<Button variant="outline" className="mt-3" onClick={onGoToBrief}>Go to brief</Button>}</>}
            </div>
          ) : mode === 'ideas' && data.creator ? null : (
            <ul className="divide-y">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{item.content.title || 'Untitled concept'}</p>
                    <p className="text-sm text-[var(--n-fg-muted)]">
                      {item.state === 'draft' ? 'Private draft' : item.state === 'submitted' ? 'Waiting for review' : item.state === 'changes_requested' ? 'Changes requested' : 'Approved for production'}
                      {!data.creator ? ` · ${item.creator_name || 'Creator'}` : ''}
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
          {!selected && !(mode === 'ideas' && data.creator) && (data.has_more || page > 1) && <div className="flex items-center gap-3">
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

function StatusPill({ state }: { state: string }) {
  const map: Record<string, [string, string]> = { submitted: ['Waiting for review', 'waitingForReview'], draft: ['Private draft', 'privateDraft'], approved: ['Approved', 'approved'], changes_requested: ['Changes requested', 'rejected'] };
  const [label, variant] = map[state] ?? ['Needs review', 'waitingForReview'];
  return <span className={`campaign-status-pill ${variant}`}>{variant === 'approved' ? '✓ ' : ''}{label}</span>;
}

function SubmittedPanel({ items, creator, onSelect }: { items: Concept[]; creator: boolean; onSelect: (item: Concept) => void }) {
  return <div className="campaign-submitted-panel"><div><h3>Submitted concepts</h3><p>See what is waiting for review and what needs your attention.</p></div>{items.length ? <div className="campaign-submitted-list">{items.map(item => <button type="button" key={item.id} className="campaign-submitted-row" onClick={() => onSelect(item)}><span><strong>{item.content.title || 'Untitled concept'}</strong><small>{creator ? 'Submitted for campaign review' : `Creator ${item.creator_id}`}</small></span><StatusPill state={item.state} /></button>)}</div> : <div className="campaign-empty-state"><strong>No submissions yet</strong><span>Your submitted concepts will appear here.</span></div>}</div>;
}

function IdeaCard({ idea, busy, onExpand }: { idea: any; busy: boolean; onExpand: () => void }) {
  const [open, setOpen] = useState(false);
  return <article className={`campaign-idea-card ${open ? 'is-expanded' : ''}`}><header><span className="campaign-ai-badge">✦ Generated</span>{idea.is_expanded && <span className="campaign-draft-badge">✓ Draft created</span>}</header><button type="button" className="campaign-idea-title" onClick={() => setOpen(!open)}><strong>{idea.title}</strong><span>{open ? 'Hide details' : 'Why it fits'}</span></button><p className="campaign-idea-hook">{idea.hook}</p>{open && <p className="campaign-idea-rationale">{idea.rationale}</p>}<Button disabled={idea.is_expanded || busy} className="campaign-idea-action" onClick={onExpand}>{idea.is_expanded ? 'Draft created' : 'Start a draft'}</Button></article>;
}

function ReferencePicker({campaignId,accounts,snapshots,selected,onToggle}:{campaignId:string;accounts:any[];snapshots:any[];selected:any[];onToggle:(snapshotId:string,postId:string,referenceId?:string)=>void}) {
  const chosen=new Set(selected.map(r=>`${r.snapshot_id}:${r.post_id}`));
  const posts=snapshots.flatMap(s=>(s.posts??[]).slice(0,30).map((p:any)=>({...p,snapshotId:s.id,username:accounts.find(a=>a.id===s.account_id)?.username}))).slice(0,12);
  return <div className="campaign-reference-panel"><div className="campaign-section-heading"><div><h3>References</h3><p>Choose up to three posts that show how you naturally create. These stay private.</p></div><span>{selected.length}/3</span></div>{posts.length ? <div className="campaign-reference-row">{posts.map((p:any)=>{const key=`${p.snapshotId}:${p.platform_post_id}`,active=chosen.has(key);return <button type="button" key={key} disabled={!active&&selected.length>=3} onClick={()=>onToggle(p.snapshotId,p.platform_post_id,selected.find(r=>r.snapshot_id===p.snapshotId&&r.post_id===p.platform_post_id)?.id)} className={`campaign-reference-card ${active?'is-selected':''}`}><div className="campaign-reference-thumb">{p.image_url ? <img src={p.image_url} alt="" /> : <span>{p.content_type||'Post'}</span>}{active && <b>✓</b>}</div><strong>{p.content_type||'Post'}</strong><small>{p.caption||'Untitled post'}</small></button>})}</div> : <div className="campaign-empty-state"><strong>No eligible posts yet</strong><span>Connect a social account and save a snapshot to choose references.</span></div>}</div>;
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

function ConceptDetail({item,creator,canApprove,path,onDone}:{item:Concept;creator:boolean;canApprove:boolean;path:string;onDone:()=>Promise<void>}) {
 const [historyPage,setHistoryPage]=useState(1);
 const history=useBriefQuery<History>(`${path}/${item.id}/history?page=${historyPage}`,true,15000);
 const [message,setMessage]=useState(''),[reviewNote,setReviewNote]=useState('');
 const [section,setSection]=useState('general'),[internal,setInternal]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const perform=async(action:string)=>{
  setBusy(true);setError('');
  try {
   if(action==='comment') {
    await api.post(`${path}/${item.id}/comments`,{revision_id:item.revision_id,section,message,visibility:internal?'internal':'shared'});
    setMessage('');setHistoryPage(1);await history.refetch();
   } else {
    await api.post(`${path}/${item.id}/actions`,{version:item.version,revision_id:item.revision_id,action,message:reviewNote});
    await onDone();
   }
  } catch(e) {setError(errorMessage(e));} finally {setBusy(false);}
 };
 return <div className={styles.review}>
  <header className={styles.header}><div><h3>{item.content.title||'Concept details'}</h3><p>{item.creator_name||'Creator'} · {item.state==='submitted'?'Waiting for review':item.state.replaceAll('_',' ')} · Current revision</p></div></header>
  {item.stale_brief&&<p className={styles.notice}>The campaign brief has changed. Update this concept before submitting or approving it.</p>}
  {!creator&&item.state==='draft'&&<p className={styles.notice}>The creator is preparing a new draft. You are viewing their previous submission.</p>}
  <div className={styles.columns}>
   <section className={styles.concept} aria-label="Concept content">
    <dl>{fields.filter(f=>f!=='title'&&item.content[f]).map(f=><div key={f}><dt>{labels[f]}</dt><dd>{item.content[f]}</dd></div>)}</dl>
    <details className={styles.revisions}><summary>Revision history</summary>
     {history.isError?<p role="alert">Could not load revisions.</p>:!history.data?<p>Loading revisions…</p>:<>
      {history.data.revisions.map(r=><article key={r.id}><p>{new Date(r.created_at).toLocaleString()} · {r.submitted_at?'Submitted':'Private draft'}</p><details><summary>Read revision</summary>{fields.map(f=><p key={f}><strong>{labels[f]}: </strong>{r.content[f]||'—'}</p>)}</details>{history.data!.reviews.filter(v=>v.revision_id===r.id).map(v=><p key={v.revision_id}>{v.decision.replaceAll('_',' ')} · {v.message}</p>)}</article>)}
     </>}
    </details>
    <section className={styles.decision} aria-label="Review decision">
     {creator&&item.state==='draft'&&<Button disabled={busy||item.stale_brief} onClick={()=>void perform('submit')}>Submit for review</Button>}
     {!creator&&item.state==='submitted'&&<><h4>Review decision</h4><label>Note shared with the creator<textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} maxLength={4000} rows={3} placeholder="Explain the changes needed, or leave an approval note."/></label><div className={styles.actions}><Button disabled={busy||!reviewNote.trim()} onClick={()=>void perform('changes_requested')}>Request changes</Button>{canApprove&&<Button disabled={busy||item.stale_brief} onClick={()=>void perform('approved')}>Approve this revision</Button>}</div><p>Decisions apply to this revision and are shared with the creator.</p></>}
    </section>
   </section>
   <aside className={styles.discussion} aria-label="Concept discussion">
    <div className={styles.discussionHeader}><h4>Discussion</h4><p>Keep feedback beside the concept.</p></div>
    <div className={styles.messages} aria-live="polite">
     {history.isError?<div role="alert">Could not load discussion. <Button onClick={()=>void history.refetch()}>Retry</Button></div>:!history.data?<p>Loading discussion…</p>:history.data.comments.length===0?<p className={styles.empty}>No messages yet. Start with a question or feedback for the creator.</p>:[...history.data.comments].reverse().map(c=><article key={c.id} className={c.visibility==='internal'?styles.internal:styles.message}><header><strong>{c.author_name||'Member'}</strong><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time></header><p className={styles.context}>{c.visibility==='internal'?'Agency only':'Shared with creator'} · {c.section==='general'?'General':labels[c.section as keyof Content]||c.section}{c.revision_id!==item.revision_id?' · Earlier revision':''}</p><p className={styles.messageText}>{c.message}</p></article>)}
    </div>
    {(history.data?.has_more||historyPage>1)&&<div className={styles.actions}><Button disabled={historyPage===1} onClick={()=>setHistoryPage(historyPage-1)}>Newer history</Button><Button disabled={!history.data?.has_more} onClick={()=>setHistoryPage(historyPage+1)}>Older history</Button></div>}
    <div className={styles.composer}>
     {!creator&&<label>Visibility<select value={internal?'internal':'shared'} onChange={e=>setInternal(e.target.value==='internal')}><option value="shared">Shared with creator</option><option value="internal">Agency only</option></select></label>}
     <label>About<select value={section} onChange={e=>setSection(e.target.value)}><option value="general">General</option>{fields.filter(f=>f!=='title').map(f=><option key={f} value={f}>{labels[f]}</option>)}</select></label>
     <label className={styles.write}>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} rows={3} placeholder={internal?'Write a private agency note…':'Write to the creator…'}/></label>
     <p>{internal?'Only agency members can see this note.':'This message is visible to the creator.'}</p><Button disabled={busy||!message.trim()} onClick={()=>void perform('comment')}>{busy?'Saving…':internal?'Add agency note':'Send message'}</Button>
    </div>
   </aside>
  </div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </div>;
}
