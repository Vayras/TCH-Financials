'use client';
import {useParams} from 'next/navigation';
import {useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/components/AuthGuard';
import {briefPath,useBriefQuery} from '@/features/campaign-content/queries';
import type {AgencyBrief} from '@/features/campaign-content/types';
import BriefEditor from '@/features/campaign-content/BriefEditor';
import ConceptWorkspace from '@/features/campaign-content/ConceptWorkspace';
export default function CampaignBriefPage(){
 const {id}=useParams<{id:string}>(),{email}=useAuth();
 const [tab,setTab]=useState<'brief'|'concepts'>('brief');
 const query=useBriefQuery<AgencyBrief>(briefPath(id));
 return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><Link href="/commercial" className="text-sm underline">← Campaign tracking</Link><header><h1 className="text-3xl font-normal">{query.data?.campaign.name||'Campaign brief'}</h1><p className="mt-2 text-sm text-[var(--n-fg-muted)]">Edit the brief, then review creator concepts in one workspace.</p></header>{query.isError?<div role="alert"><p>This brief is unavailable or you do not have access.</p><button className="underline" onClick={()=>void query.refetch()}>Try again</button></div>:query.data?<><div className="flex w-fit gap-1 rounded-full border border-[var(--n-border)] bg-[var(--n-bg)] p-1" role="tablist" aria-label="Campaign workspace"><button type="button" role="tab" aria-selected={tab==='brief'} aria-controls="admin-panel-brief" className={`rounded-full px-4 py-2 text-sm ${tab==='brief'?'bg-white shadow-sm':''}`} onClick={()=>setTab('brief')}>Brief</button><button type="button" role="tab" aria-selected={tab==='concepts'} aria-controls="admin-panel-concepts" className={`rounded-full px-4 py-2 text-sm ${tab==='concepts'?'bg-white shadow-sm':''}`} onClick={()=>setTab('concepts')}>Creator concepts</button></div>{tab==='brief'&&<div id="admin-panel-brief" role="tabpanel" aria-label="Campaign brief"><BriefEditor key={`${email}:${id}`} id={id} initial={query.data}/></div>}{tab==='concepts'&&<div id="admin-panel-concepts" role="tabpanel" aria-label="Creator concepts"><ConceptWorkspace campaignId={id}/></div>}</>:<p>Loading brief…</p>}</main>;
}
