'use client';
import * as React from 'react';
import Link from 'next/link';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {inr} from '@/lib/utils';
import type {TeamMember} from '@/components/ResponsibleMemberSelect';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Textarea from '@/components/ui/Textarea';
import QueryErrorState from '@/components/QueryErrorState';
import LegacyReports from './LegacyReports';
import styles from './reports.module.css';
import formStyles from '@/components/CreatorFormModal.module.css';
import {toast} from 'sonner';
import {reportTotals} from './report-totals';
type DealRow={id:string;responsible_member_id:string|null;tch_poc:string;campaign_id:string|null;campaign:string|null;brand:string;total_fee:string;agency_fee_inr:string;active_now:boolean;confirmed_this_week:boolean;confirmation_date:string|null};
type Note={member_id:string;note:string;version:number};
type Report={members:TeamMember[];deals:DealRow[];notes:Note[]};
function currentWeek(){const d=new Date();d.setDate(d.getDate()+(4-d.getDay()+7)%7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export default function TeamReports(){
 const [week,setWeek]=React.useState(currentWeek);
 const [selected,setSelected]=React.useState<TeamMember|null>(null);
 const [note,setNote]=React.useState('');
 const [noteVersion,setNoteVersion]=React.useState(0);
 const client=useQueryClient();
 const {data,isLoading,error,refetch}=useQuery({queryKey:['automatic-team-reports',week],queryFn:()=>api.get<Report>(`/employee-reports/automatic?week=${week}`),enabled:Boolean(week)});
 const save=useMutation({mutationFn:()=>api.put('/employee-reports/note',{member_id:selected?.id,week,note,version:noteVersion}),onSuccess:()=>{client.invalidateQueries({queryKey:['automatic-team-reports']});setSelected(null);toast.success('Weekly note saved.');},onError:(e:Error)=>toast.error(e.message)});
 const members=data ? [...data.members,{id:'unassigned',display_name:'Unassigned',email:''}] : [];
 const start=new Date(`${week}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-6);
 return <section className={styles.workspace}>
  <header className={styles.header}><div><h1>Team reports</h1><p>Confirmed work and agency margin, calculated from owned deals.</p></div><label>Week ending (Thursday)<input aria-label="Week ending Thursday" type="date" value={week} onChange={e=>setWeek(e.target.value)} /></label></header>
  <p>Reporting period: {Number.isFinite(start.getTime()) ? start.toISOString().slice(0,10) : '—'} – {week}. Active campaigns reflect their current status.</p>
  {isLoading ? <p>Loading reports…</p> : error ? <QueryErrorState description={error.message} onRetry={()=>refetch()} /> : data && <>
   <div className={styles.list}>{members.map(member=>{
    const deals=data.deals.filter(d=>member.id==='unassigned' ? !d.responsible_member_id || !data.members.some(m=>m.id===d.responsible_member_id) : d.responsible_member_id===member.id);
    const totals=reportTotals(deals);
    const saved=data.notes.find(n=>n.member_id===member.id);
    return <article key={member.id} className={styles.autoReport}>
     <div><h2>{member.display_name || member.email}</h2>{member.id==='unassigned' && <p>Review ownership in each deal before assigning credit.</p>}</div>
     <div><span>Deals confirmed</span><strong>{totals.confirmed}</strong></div><div><span>Bookings confirmed</span><strong>₹{inr(totals.bookings) || '0'}</strong></div><div><span>Agency margin confirmed</span><strong>₹{inr(totals.margin) || '0'}</strong></div><div><span>Active now</span><strong>{totals.active}</strong></div>
     <details className={styles.figures}><summary>View deals ({deals.length})</summary>{deals.length ? deals.map(d=><p key={d.id}><Link href={`/commercial/${d.id}/`}>{d.campaign || d.brand || `Deal ${d.id}`}</Link> · {d.confirmed_this_week ? `Confirmed ${d.confirmation_date} · ₹${inr(Number(d.total_fee)) || '0'}` : 'Outside selected week'}{d.active_now && ' · Active now'}{member.id==='unassigned' && d.tch_poc && ` · Previous POC: ${d.tch_poc}`}</p>) : <p>No confirmed or currently active deals.</p>}</details>
     {member.id!=='unassigned' && <div className={styles.weeklyNote}><p>{saved?.note || 'No weekly note yet.'}</p><Button variant="outline" onClick={()=>{setSelected(member);setNote(saved?.note || '');setNoteVersion(saved?.version || 0);}}>{saved ? 'Edit weekly note' : 'Add weekly note'}</Button></div>}
    </article>;
   })}</div>
   <p>Outreach and barter / PR confirmations: not tracked automatically.</p>
  </>}
  <details><summary>Historical manual reports</summary><LegacyReports /></details>
  <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}} title={`Weekly note · ${selected?.display_name || selected?.email || ''}`} className={formStyles.dialog} footer={<><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button variant="primary" disabled={save.isPending} onClick={()=>save.mutate()}>{save.isPending ? 'Saving…' : 'Save note'}</Button></>}><label>Wins, blockers and next-week priorities<Textarea value={note} maxLength={10000} onChange={e=>setNote(e.target.value)} /></label></Dialog>
 </section>;
}
