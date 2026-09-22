'use client';
import {useState} from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import {useBriefQuery} from '@/features/campaign-content/queries';
import type {SharedBrief} from '@/features/campaign-content/types';
export default function CreatorCampaigns(){
 const [page,setPage]=useState(1);
 const query=useBriefQuery<{items:Omit<SharedBrief,'content'>[];has_more:boolean}>(`/creator-portal/campaign-briefs?page=${page}`);
 return <div className="space-y-6"><header><h1 className="text-3xl font-normal">Campaigns</h1><p className="mt-2 text-sm">Your briefs, deliverables and deadlines in one place.</p></header>{query.isError?<p role="alert">Campaigns are unavailable. <button className="underline" onClick={()=>void query.refetch()}>Try again</button></p>:!query.data?<p>Loading campaigns…</p>:<><div className="grid gap-4 md:grid-cols-2">{query.data.items.map(c=><article key={c.id} className="rounded-2xl border border-[var(--n-border)] bg-[var(--n-bg)] p-6"><p className="text-sm">{c.brand}</p><h2 className="mt-2 text-xl font-medium">{c.name}</h2><p className="my-3 text-xs">Brief version {c.shared_version} · Updated {c.shared_at.slice(0,10)}</p><Link href={`/creator-portal/campaigns/${c.id}/brief`} className="text-sm underline">Open campaign →</Link></article>)}</div>{!query.data.items.length&&<p className="rounded-2xl border p-6">No campaigns yet. Your agency will add one here when you are assigned a brief.</p>}<div className="flex gap-3"><Button variant="outline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><Button variant="outline" disabled={!query.data.has_more} onClick={()=>setPage(p=>p+1)}>Next</Button></div></>}</div>;
}
