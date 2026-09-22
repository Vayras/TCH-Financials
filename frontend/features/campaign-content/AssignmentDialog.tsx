'use client';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {briefPath,useBriefQuery} from './queries';
import type {Assignments,AssignmentOptions} from './types';
export default function AssignmentDialog({id,onClose}:{id:string;onClose:()=>void}) {
 const query=useBriefQuery<Assignments>(`${briefPath(id)}/assignments`);
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}} title="Campaign access" description="Assigned creators see the shared brief and future shared updates.">
 {query.isError?<p role="alert">Could not load access settings. <button onClick={()=>void query.refetch()}>Try again</button></p>:query.data?<AssignmentForm key={query.data.version} id={id} initial={query.data} onClose={onClose}/>:<p>Loading access…</p>}
 </Dialog>;
}
function AssignmentForm({id,initial,onClose}:{id:string;initial:Assignments;onClose:()=>void}) {
 const [members,setMembers]=useState(initial.members),[creators,setCreators]=useState(initial.creators),[search,setSearch]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const client=useQueryClient();
 const options=useBriefQuery<AssignmentOptions>(`${briefPath(id)}/assignment-options?search=${encodeURIComponent(search)}&page=${page}`);
 async function save(){setBusy(true);setError('');try{await api.put(`${briefPath(id)}/assignments`,{version:initial.version,members:members.map(({user_id,can_publish})=>({user_id,can_publish})),creator_ids:creators.map(c=>c.creator_id)});await client.invalidateQueries({queryKey:['campaign-content']});onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="space-y-5"><section><h3 className="font-medium">Assigned members</h3>{members.map(m=><div key={m.user_id} className="mt-2 flex flex-wrap items-center gap-3 text-sm"><span className="break-all">{m.display_name||m.email}</span><label className="flex gap-2"><input type="checkbox" checked={m.can_publish} onChange={e=>setMembers(v=>v.map(x=>x.user_id===m.user_id?{...x,can_publish:e.target.checked}:x))}/>Can share</label><button type="button" className="underline" onClick={()=>setMembers(v=>v.filter(x=>x.user_id!==m.user_id))}>Remove</button></div>)}</section>
 <section><h3 className="font-medium">Assigned creators</h3>{creators.map(c=><div key={c.creator_id} className="mt-2 flex gap-3 text-sm"><span>{c.name}</span><button type="button" className="underline" onClick={()=>setCreators(v=>v.filter(x=>x.creator_id!==c.creator_id))}>Remove</button></div>)}</section>
 <label className="block text-sm">Find a member or creator<Input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Name or email"/></label>
 {options.isError?<p role="alert">Search is unavailable.</p>:options.isFetching?<p className="text-sm">Searching…</p>:<div className="space-y-2">{options.data?.members.filter(m=>!members.some(x=>x.user_id===m.user_id)).map(m=><button type="button" key={m.user_id} className="block text-left text-sm underline" onClick={()=>setMembers(v=>[...v,{...m,can_publish:false}])}>Add member: {m.display_name||m.email}</button>)}{options.data?.creators.filter(c=>!creators.some(x=>x.creator_id===c.creator_id)).map(c=><button type="button" key={c.creator_id} className="block text-left text-sm underline" onClick={()=>setCreators(v=>[...v,c])}>Add creator: {c.name}<span className="block text-xs">{c.profiles.map(p=>p.email).join(', ')}</span></button>)}</div>}
 <div className="flex gap-3"><Button variant="outline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><Button variant="outline" disabled={!options.data?.has_more} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
 {error&&<p role="alert" className="text-sm text-red-700">{error} Close and reopen to reload if assignments changed.</p>}
 <Button disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save access'}</Button></div>;
}
