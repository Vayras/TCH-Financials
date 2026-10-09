'use client';
import {useParams,useSearchParams} from 'next/navigation';
import {Suspense,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/components/AuthGuard';
import {briefPath,useBriefQuery} from '@/features/campaign-content/queries';
import type {AgencyBrief} from '@/features/campaign-content/types';
import styles from './brief.module.css';
import BriefEditor from '@/features/campaign-content/BriefEditor';
import ConceptWorkspace from '@/features/campaign-content/ConceptWorkspace';
export default function CampaignBriefPage(){return <Suspense fallback={<p>Loading brief…</p>}><BriefWorkspace/></Suspense>;}
function BriefWorkspace(){
 const {id}=useParams<{id:string}>(),{email}=useAuth();
 const source=useSearchParams().get('deal');
 const dealId=source&&/^\d+$/.test(source)?source:null;
 const [tab,setTab]=useState<'brief'|'concepts'>('brief');
 const query=useBriefQuery<AgencyBrief>(briefPath(id));
 return <main className={styles.workspace}><Link href={dealId?`/commercial/${dealId}`:"/commercial"} className={styles.back}>← {dealId?"Back to campaign":"Campaign tracking"}</Link><header><h1 className="text-3xl font-normal">{query.data?.campaign.name||'Campaign brief'}</h1><p className="mt-2 text-sm text-[var(--n-fg-muted)]">Set the creative direction, share with your creators, and review their concepts.</p></header>{query.isError?<div role="alert"><p>This brief is unavailable or you do not have access.</p><button className="underline" onClick={()=>void query.refetch()}>Try again</button></div>:query.data?<><div className={styles.tabs} role="tablist" aria-label="Campaign workspace"><button type="button" role="tab" aria-selected={tab==='brief'} aria-controls="admin-panel-brief" className={styles.tab} onClick={()=>setTab('brief')}>Brief</button><button type="button" role="tab" aria-selected={tab==='concepts'} aria-controls="admin-panel-concepts" className={styles.tab} onClick={()=>setTab('concepts')}>Creator concepts</button></div><div hidden={tab!=='brief'} id="admin-panel-brief" role="tabpanel" aria-label="Campaign brief"><BriefEditor key={`${email}:${id}`} id={id} initial={query.data}/></div>{tab==='concepts'&&<div id="admin-panel-concepts" role="tabpanel" aria-label="Creator concepts"><ConceptWorkspace campaignId={id} onGoToBrief={()=>setTab('brief')}/></div>}</>:<p>Loading brief…</p>}</main>;
}
