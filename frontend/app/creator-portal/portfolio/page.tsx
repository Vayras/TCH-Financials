'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { CreatorImage } from '@/components/CreatorKitView';
import { InsightActions, ImportProgress } from '../ImportActions';
import { metric, importedDate, sampleInsights, starterDraft, type KitDraft } from '@/lib/creator-kit';
import { useKit, useKitActions, useSavedSnapshots, useSocialAccounts } from '../kit-queries';

export default function ContentLibraryPage() {
  const accounts=useSocialAccounts(),kit=useKit(),actions=useKitActions();
  const snapshots=useSavedSnapshots(accounts.data??[]);
  const [sort,setSort]=React.useState('newest');
  const [accountId,setAccountId]=React.useState('all');
  const rows=snapshots.flatMap(q=>q.data?q.data.posts.map(post=>({post,snapshot:q.data!})):[]).filter(row=>accountId==='all'||row.snapshot.account_id===accountId);
  const insights=sampleInsights(rows.map(r=>r.post));
  const ordered=[...rows].sort((a,b)=>sort==='likes'?(b.post.likes??-1)-(a.post.likes??-1):sort==='comments'?(b.post.comments??-1)-(a.post.comments??-1):(b.post.published_at??'').localeCompare(a.post.published_at??''));
  const draft=kit.data?starterDraft(kit.data,accounts.data??[]):null;
  async function toggle(snapshotId:string,postId:string,ownerAccount:string) {
    if(!kit.data||!draft)return;
    const exists=draft.featured_posts.some(p=>p.snapshot_id===snapshotId&&p.post_id===postId);
    if(!exists&&draft.featured_posts.length>=6){toast.error('Choose up to six featured posts.');return;}
    let next:KitDraft={...draft,featured_posts:exists?draft.featured_posts.filter(p=>!(p.snapshot_id===snapshotId&&p.post_id===postId)):[...draft.featured_posts,{snapshot_id:snapshotId,post_id:postId}]};
    if(!draft.snapshot_ids.includes(snapshotId)) {
      // Updating this account's snapshot is explicit; remove its old featured references to keep the selection consistent.
      const oldIds=kit.data.saved_snapshots.filter(s=>s.account_id===ownerAccount).map(s=>s.id);
      if(oldIds.length&&draft.featured_posts.some(p=>oldIds.includes(p.snapshot_id))) {toast.error('Open your brand kit and choose Use latest insights to keep your featured work up to date.');return;}
      next={...next,snapshot_ids:[...draft.snapshot_ids.filter(id=>!oldIds.includes(id)),snapshotId]};
    }
    try{await actions.save.mutateAsync({version:kit.data.version,draft:next});toast.success(exists?'Removed from draft':'Added to brand-kit draft');}catch(e){toast.error(e instanceof Error?e.message:'Could not save selection');}
  }
  const error=accounts.error||kit.error||snapshots.find(q=>q.error)?.error;
  const loading=accounts.isLoading||kit.isLoading||snapshots.some(q=>q.isLoading);

  const selectedAccount=accounts.data?.find(a=>a.id===accountId)??accounts.data?.[0];
  const values=[{label:'Average likes',value:insights.averageLikes,count:insights.likesSample},{label:'Typical likes',value:insights.medianLikes,count:insights.likesSample},{label:'Average comments',value:insights.averageComments,count:insights.commentsSample}].filter(m=>m.value!==null);
  const views=rows.map(r=>r.post.views).filter((v):v is number=>typeof v==='number');
  if(views.length)values.push({label:'Average video views',value:Math.round(views.reduce((a,b)=>a+b,0)/views.length),count:views.length});
  return <div className="creator-flow"><div className="cf-top"><div><p className="cf-step">YOUR CONTENT LIBRARY</p><h1>Find your strongest work</h1><p className="cf-muted">Review your content, understand what connects and choose what brands should see.</p></div><Link className="creator-button" href="/creator-portal/media-kit">Preview brand kit ↗</Link></div>
    {error&&<p className="cf-banner cf-error" role="alert">{error.message}</p>}
    {(accounts.data?.length??0)>1&&<label className="cf-label">Instagram account <select className="cf-input" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="all">All accounts</option>{accounts.data?.map(a=><option value={a.id} key={a.id}>@{a.username}</option>)}</select></label>}
    {selectedAccount&&<ImportProgress account={selectedAccount}/>}
    {loading?<p className="cf-muted">Bringing your content together…</p>:<>
      {values.length>0?<section><div className="cf-top" style={{marginBottom:16}}><div><h2>Content performance</h2><p className="cf-muted">Based on {rows.length} posts · Updated {importedDate(selectedAccount?.collected_at)}</p></div>{selectedAccount&&<InsightActions account={selectedAccount}/>}</div><div className="creator-insight-grid">{values.map((item,i)=><article className={i===0?'creator-stat featured':'creator-stat'} key={item.label}><p>{item.label}</p><div className="creator-big-number">{metric(item.value)}</div><span className="creator-stat-foot">Per post <span aria-hidden="true">↗</span></span></article>)}</div><details className="creator-method"><summary>About these numbers</summary><p>Calculated from the posts in this view. Each metric uses the posts with an available count, including zero. Typical likes is the median. Views and plays are different measures. Updates happen when you request them.</p>{values.map(v=><p key={v.label}>{v.label}: {v.count} posts</p>)}</details></section>:selectedAccount?<section className="creator-insight-invite"><div><span className="cf-step">MEET YOUR NUMBERS</span><h2>See what connects with your audience.</h2><p className="cf-muted">Bring likes, comments and available video views into your content library.</p></div><InsightActions account={selectedAccount}/></section>:<div className="cf-empty"><h2>Your creative story starts here.</h2><p>Add your Instagram to bring your posts together.</p><Link className="creator-button" href="/creator-portal/socials">Create my kit ↗</Link></div>}
      {!!rows.length&&<><div className="cf-top"><div><h2>Your content <span className="cf-badge">{rows.length}</span></h2><p className="cf-muted">{draft?.featured_posts.length??0} of 6 featured in your brand kit</p></div><label className="creator-sort">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="likes">Most likes</option><option value="comments">Most comments</option></select></label></div>
      <div className="cf-grid">{ordered.map(({post,snapshot})=>{const selected=draft?.featured_posts.some(p=>p.snapshot_id===snapshot.id&&p.post_id===post.platform_post_id);const counts=[post.likes!=null?metric(post.likes)+' likes':null,post.comments!=null?metric(post.comments)+' comments':null,post.views!=null?metric(post.views)+' views':null].filter(Boolean);return <article className="cf-post" key={snapshot.id+':'+post.platform_post_id}><div className="creator-post-visual"><CreatorImage src={post.image_url} alt={post.caption?.slice(0,100)||'Your content'} className="cf-thumb"/><span className="creator-post-format">{post.content_type??'Post'}</span>{selected&&<span className="creator-post-featured">✓ In your kit</span>}</div><div className="cf-post-copy"><p className="cf-muted">{importedDate(post.published_at)}</p><p className="cf-post-caption">{post.caption||'A moment worth sharing.'}</p>{counts.length>0&&<p className="creator-post-counts">{counts.join(' · ')}</p>}<div className="cf-top" style={{marginTop:18}}>{post.url&&<a className="cf-link" href={post.url} target="_blank" rel="noopener noreferrer">View post ↗</a>}<Button variant={selected?'outline':'primary'} disabled={actions.save.isPending} onClick={()=>toggle(snapshot.id,post.platform_post_id,snapshot.account_id)}>{selected?'Remove':'Add to brand kit'}</Button></div></div></article>})}</div>
      {selectedAccount&&rows.length<300&&<div className="creator-load-more"><InsightActions account={selectedAccount} more/>{selectedAccount.coverage?.last_action==='more'&&selectedAccount.coverage.new_posts===0&&<p className="cf-muted">No new posts were found in this update.</p>}</div>}</>}
    </>}
  </div>;
}
