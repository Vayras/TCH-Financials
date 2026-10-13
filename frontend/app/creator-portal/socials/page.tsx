'use client';
import * as React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { CreatorImage } from '@/components/CreatorKitView';
import { importedDate, metric } from '@/lib/creator-kit';
import { useSocialAccounts } from '../kit-queries';
import { CreateKitForm, ImportProgress, InsightActions } from '../ImportActions';
export default function CreatorSocialsPage(){
  const query=useSocialAccounts();const[adding,setAdding]=React.useState(false);
  return <div className="creator-flow"><div className="cf-top"><div><p className="cf-step">YOUR CONNECTIONS</p><h1>Your connected profiles</h1><p className="cf-muted">Manage the profiles used for your brand kit and content insights.</p></div><Button variant="outline" onClick={()=>setAdding(!adding)}>+ Add Instagram</Button></div>
    {query.isLoading?<p>Loading your accounts…</p>:query.error?<p role="alert">We couldn’t load your accounts. <button onClick={()=>query.refetch()}>Try again</button></p>:<>{(!query.data?.length||adding)&&<CreateKitForm/>}{query.data?.map(account=><section className="cf-panel" key={account.id}><div className="cf-top"><div className="cf-actions"><CreatorImage src={account.profile?.image_url??null} alt={account.username} className="brand-kit-avatar"/><div><h2>{account.profile?.display_name||account.username}</h2><a className="cf-muted" href={account.profile_url} target="_blank" rel="noopener noreferrer">Instagram · @{account.username} ↗</a></div></div>{account.collected_at&&<span className="cf-badge">Updated {importedDate(account.collected_at)}</span>}</div><ImportProgress account={account}/>{account.profile&&<div className="cf-metrics">{[['Followers',account.profile.followers],['Posts',account.profile.posts_count],['Following',account.profile.following]].filter(([,v])=>v!==null).map(([label,value])=><div key={String(label)}><p className="cf-muted">{label}</p><div className="cf-metric-value">{metric(value as number)}</div></div>)}</div>}<div className="cf-top" style={{marginTop:24}}><Link href="/creator-portal/portfolio" className="cf-link">Explore your content ↗</Link><InsightActions account={account}/></div></section>)}</>}
  </div>;
}
