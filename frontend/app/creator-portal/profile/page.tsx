'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { starterDraft, type KitRecord, type KitDraft, type SocialAccount } from '@/lib/creator-kit';
import { useKit, useKitActions, useSocialAccounts } from '../kit-queries';

export default function CreatorProfilePage() {
  const kit=useKit(), accounts=useSocialAccounts();
  if(kit.isLoading || accounts.isLoading)return <p>Loading your profile…</p>;
  if(kit.error || accounts.error)return <div className="creator-flow"><p role="alert">{kit.error?.message || accounts.error?.message}</p><Button onClick={()=>{kit.refetch();accounts.refetch();}}>Try again</Button></div>;
  if(!kit.data)return null;
  return <ProfileForm key={kit.data.version} kit={kit.data} accounts={accounts.data??[]}/>;
}
function ProfileForm({kit,accounts}:{kit:KitRecord;accounts:SocialAccount[]}) {
  const [draft,setDraft]=React.useState<KitDraft>(()=>starterDraft(kit,accounts));
  const {save}=useKitActions();
  const fields:[keyof KitDraft['profile'],string,string,number][]=[['display_name','Creator name','How you want brands to know you',120],['headline','Headline','Your creative focus in one sentence',200],['niche','Niche','Lifestyle, design, technology…',200],['location','Location','City, country',120],['languages','Languages','English, Hindi…',200],['contact_email','Public business email','Optional — shown on your published kit',254]];
  const set=(field:keyof KitDraft['profile'],value:string)=>setDraft({...draft,profile:{...draft.profile,[field]:value}});
  return <form className="creator-flow" onSubmit={e=>{e.preventDefault();save.mutate({version:kit.version,draft},{onSuccess:()=>toast.success('Profile saved to your draft'),onError:e=>toast.error(e.message)});}}>
    <div className="cf-top"><div><div className="cf-step">YOUR STORY</div><h1>Introduce yourself</h1><p className="cf-muted">Tell brands what makes your work yours.</p></div><Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending?'Saving…':'Save profile'}</Button></div>
    {kit.version===0&&accounts.some(a=>a.profile)&&<p className="cf-banner">Your Instagram introduction is ready to make your own.</p>}
    <div className="cf-panel cf-form">{fields.map(([field,label,placeholder,max])=><label key={field}><span className="cf-label">{label}</span><input className="cf-input" value={draft.profile[field]} onChange={e=>set(field,e.target.value)} placeholder={placeholder} maxLength={max} type={field==='contact_email'?'email':'text'} required={field==='display_name'}/></label>)}<label className="cf-full"><span className="cf-label">Biography</span><textarea className="cf-input" value={draft.profile.biography} onChange={e=>set('biography',e.target.value)} maxLength={5000} placeholder="Tell brands about your work, your perspective and your audience."/></label><label className="cf-full"><span className="cf-label">Services & rates (optional)</span><textarea className="cf-input" value={draft.profile.services} onChange={e=>set('services',e.target.value)} maxLength={2000} placeholder="Describe the collaborations you offer. Include rates only if you want to share them."/></label></div>
    <div className="cf-top"><span className="cf-muted">Saved edits stay private until you publish your kit.</span><Link className="cf-link" href="/creator-portal/portfolio">Next: choose your best work →</Link></div>
  </form>;
}
