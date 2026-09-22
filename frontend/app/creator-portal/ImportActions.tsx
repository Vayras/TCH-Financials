'use client';
import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import { activeImport, type SocialAccount } from '@/lib/creator-kit';
import { toast } from 'sonner';

type ImportInput={action:'create-kit'|'update-insights'|'load-more';accountId?:string;username?:string};
export function useCreatorImport(){
  const {creatorId}=useAuth(),client=useQueryClient();
  const keys=React.useRef<Record<string,string>>({});
  return useMutation({mutationFn:async(input:ImportInput)=>{
    const storageKey=`creator-request:${creatorId}:${input.action}:${input.accountId??input.username?.trim().toLowerCase()}`;
    let key=keys.current[storageKey];
    if(!key){try{key=sessionStorage.getItem(storageKey)??'';}catch{}}
    if(!key)key=crypto.randomUUID();keys.current[storageKey]=key;
    try{sessionStorage.setItem(storageKey,key);}catch{}
    const path=input.action==='create-kit'?'create-kit':`${input.accountId}/${input.action}`;
    const result=await api.post<{id:string;state:string}>(`/creator-portal/social-accounts/${path}`,input.action==='create-kit'?{username:input.username}:undefined,{'Idempotency-Key':key});
    delete keys.current[storageKey];try{sessionStorage.removeItem(storageKey);}catch{}
    return result;
  },onSuccess:()=>{client.invalidateQueries({queryKey:['creator-social-accounts',creatorId]});toast.success('On it! Your content will appear here shortly.');},onError:()=>client.invalidateQueries({queryKey:['creator-social-accounts',creatorId]})});
}
export function CreateKitForm(){
  const [username,setUsername]=React.useState('');const request=useCreatorImport();
  return <form className="creator-onboarding" onSubmit={e=>{e.preventDefault();request.mutate({action:'create-kit',username});}}><div className="creator-onboarding-icon" aria-hidden="true">✳</div><div><p className="cf-step">YOUR NEXT CHAPTER</p><h2>Your work deserves a great introduction.</h2><p className="cf-muted">Add your Instagram. We’ll bring together your profile and up to 30 recent posts.</p></div><div className="creator-connect-field"><label className="sr-only" htmlFor="creator-username">Instagram username</label><span aria-hidden="true">@</span><input id="creator-username" placeholder="yourhandle" value={username} onChange={e=>setUsername(e.target.value)} maxLength={300} required/><Button type="submit" variant="primary" disabled={request.isPending||!username.trim()}>{request.isPending?'Getting started…':'Create my kit ↗'}</Button></div>{request.error&&<p className="cf-error" role="alert">{request.error.message}</p>}</form>;
}
export function ImportProgress({account}:{account:SocialAccount}){
  if(activeImport(account.latest_job_state))return <div className="creator-progress" role="status"><span className="creator-pulse"/><div><h3>{account.latest_job_stage==='posts'?'Finding your content’s numbers':'Getting to know your profile'}</h3><p className="cf-muted">You can keep exploring. We’ll save everything when it’s ready.</p></div></div>;
  if(account.latest_job_state==='needs_review'||account.latest_job_state==='failed')return <p className="cf-banner" role="status">We couldn’t finish this update. Your previous content is safe.{account.latest_job_state==='needs_review'?' Please contact your agency for help.':' You can try again later.'}</p>;
  return null;
}
export function InsightActions({account,more=false}:{account:SocialAccount;more?:boolean}){
  const request=useCreatorImport();const busy=request.isPending||activeImport(account.latest_job_state)||account.latest_job_state==='needs_review';
  return <div><div className="cf-actions"><Button variant="primary" disabled={busy} onClick={()=>request.mutate({action:'update-insights',accountId:account.id})}>{busy?'Updating…':'Update insights ↗'}</Button>{more&&<Button variant="outline" disabled={busy} onClick={()=>request.mutate({action:'load-more',accountId:account.id})}>Load more posts</Button>}</div>{request.error&&<p role="alert" className="cf-error" style={{marginTop:10}}>{request.error.message}</p>}</div>;
}
