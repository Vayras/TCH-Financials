'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import CreatorKitView from '@/components/CreatorKitView';
import type { PublishedKit } from '@/lib/creator-kit';

export default function PublicKitPage() {
  const {slug}=useParams<{slug:string}>();
  const query=useQuery({queryKey:['published-brand-kit',slug],queryFn:async()=>{
    // No creator session or development header is needed for a published kit.
    const response=await fetch(`/api/public/brand-kits/${encodeURIComponent(slug)}`,{cache:'no-store'});
    if(!response.ok)throw new Error(response.status===404?'This brand kit is unavailable or has been unpublished.':'We could not load this brand kit. Please try again.');
    return response.json() as Promise<PublishedKit>;
  },retry:false,staleTime:0,refetchOnMount:'always',refetchOnWindowFocus:true});
  return <main className="public-kit-page"><div className="public-kit-toolbar"><span>Creator brand kit</span>{query.data&&<button onClick={()=>window.print()}>Print / Save as PDF</button>}</div>{query.isLoading?<p>Loading brand kit…</p>:query.error?<p role="alert">{query.error.message}</p>:query.data?<CreatorKitView content={query.data.content} publishedAt={query.data.published_at}/>:null}</main>;
}
