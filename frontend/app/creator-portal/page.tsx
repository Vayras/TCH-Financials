'use client';
import Link from 'next/link';
import {useKit,useSocialAccounts,useSavedSnapshots} from './kit-queries';
import {starterDraft,metric,importedDate} from '@/lib/creator-kit';
import {CreatorImage} from '@/components/CreatorKitView';
import {CreateKitForm,ImportProgress} from './ImportActions';
import {useCreatorPortalDealsQuery,useCreatorPortalInvoicesQuery} from './queries';
import {useBriefQuery} from '@/features/campaign-content/queries';
import {homeAttention,type HomeCampaign} from './home-model';
import {inr} from '@/lib/utils';
import styles from './home.module.css';
export default function CreatorOverviewPage(){
 const accounts=useSocialAccounts(),kit=useKit(),snapshots=useSavedSnapshots(accounts.data??[]);
 const campaigns=useBriefQuery<{items:HomeCampaign[];has_more:boolean}>('/creator-portal/campaign-briefs/home');
 const deals=useCreatorPortalDealsQuery(),invoices=useCreatorPortalInvoicesQuery();
 const account=accounts.data?.find(a=>a.snapshot_id),draft=kit.data?starterDraft(kit.data,accounts.data??[]):null;
 const name=(draft?.profile.display_name||account?.profile?.display_name||'creator').split(/[ |]/)[0];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const attention=homeAttention(campaigns.data?.items??[],today);
 const missingInvoices=invoices.data&&deals.data?deals.data.filter(d=>d.creator_payment_status!=='Paid'&&!invoices.data!.some(i=>String(i.deal)===String(d.id))):[];
 const reminder=attention[0]??(missingInvoices.length?{title:`${missingInvoices.length} campaign${missingInvoices.length===1?' needs':'s need'} an invoice`,detail:'Add invoices for your unpaid work.',href:'/creator-portal/invoices',action:'Add invoices'}:null);
 const paid=(deals.data??[]).filter(d=>d.creator_payment_status==='Paid').reduce((sum,d)=>sum+(Number(d.creator_fee)||0),0);
 const pending=(deals.data??[]).filter(d=>d.creator_payment_status!=='Paid').reduce((sum,d)=>sum+(Number(d.creator_fee)||0),0);
 const posts=snapshots.flatMap(s=>s.data?.posts??[]).sort((a,b)=>(b.published_at??'').localeCompare(a.published_at??''));
 const steps=[{title:'Add your profile',href:'/creator-portal/profile',done:!!draft?.profile.biography},{title:'Select featured work',href:'/creator-portal/portfolio',done:!!draft?.featured_posts.length},{title:'Publish your kit',href:'/creator-portal/media-kit',done:!!kit.data?.published_revision}];
 const date=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
 return <div className={styles.home}>
  <header className={styles.welcome}><div><p className={styles.eyebrow}>A LITTLE MORE YOU</p><h1>Hi {name},<br/>make room for what’s next.</h1><p>Your creativity. Your story. Your next collaboration.</p></div><Link className={styles.button} href="/creator-portal/campaigns">View campaigns ↗</Link></header>
  {(reminder||campaigns.isLoading||deals.isLoading||invoices.isLoading||campaigns.isError||deals.isError||invoices.isError)&&<section className={styles.attentionBar}>
   {campaigns.isLoading||deals.isLoading||invoices.isLoading?<p>Checking your next steps…</p>:campaigns.isError||deals.isError||invoices.isError?<p role="alert">Some next steps couldn’t be loaded. <button onClick={()=>{void campaigns.refetch();void deals.refetch();void invoices.refetch();}}>Try again</button></p>:reminder&&<div className={styles.attentionRow}><span className={styles.attentionIcon} aria-hidden="true">↗</span><div><strong>{reminder.title}</strong><p>{reminder.detail}</p></div><Link href={reminder.href}>{reminder.action} →</Link></div>}
  </section>}
  <div className={styles.mainGrid}><section className={styles.panel}><div className={styles.sectionHeader}><div><h2>Your collaborations</h2><p>From a spark of an idea to your next great piece.</p></div><Link href="/creator-portal/campaigns">View all →</Link></div>
   {campaigns.isError?<p role="alert">Campaigns couldn’t be loaded.</p>:campaigns.isLoading?<p>Loading campaigns…</p>:!campaigns.data?.items.length?<p className={styles.muted}>Your agency’s shared briefs will appear here when you’re assigned.</p>:campaigns.data.items.slice(0,4).map(c=>{const next=[...(c.deliverables??[])].filter(d=>d.due_date>=today).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];return <article className={styles.campaign} key={c.id}><p className={styles.eyebrow}>{c.brand}</p><h3>{c.name}</h3><p>{next?`Next brief deadline: ${next.quantity} ${next.format} · ${date(next.due_date)}`:'No upcoming brief deadline recorded'}</p><div className={styles.tags}>{c.concepts.length?c.concepts.map(x=><span key={x.id}>{x.title||'Concept'} · {x.state.replaceAll('_',' ')}</span>):<span>No concept started</span>}</div><div className={styles.links}><Link href={`/creator-portal/campaigns/${c.id}/brief`}>Open brief →</Link><Link href={`/creator-portal/campaigns/${c.id}/brief?view=ideas`}>Work on concepts →</Link>{c.concepts.length>0&&<Link href={`/creator-portal/campaigns/${c.id}/brief?view=feedback`}>Discussion →</Link>}</div></article>;})}
  </section><div className={styles.side}>
   <section className={styles.panel}><div className={styles.sectionHeader}><h2>Earnings</h2><Link href="/creator-portal/payments">Details →</Link></div>{deals.isError?<p role="alert">Earnings couldn’t be loaded.</p>:deals.isLoading?<p>Loading earnings…</p>:<><div className={styles.money}><div><span>Marked paid</span><strong>₹{inr(paid)||'0'}</strong></div><div><span>Awaiting payment</span><strong>₹{inr(pending)||'0'}</strong></div></div><p className={styles.muted}>Recorded creator fees across your work. Payment status is maintained by the agency.</p></>}</section>
   <section className={`${styles.panel} ${styles.kit}`}><span className={styles.kitSpark} aria-hidden="true">✳</span><h2>Your creative calling card</h2>{kit.isLoading||accounts.isLoading?<p>Loading kit…</p>:kit.error||accounts.error?<p role="alert">Brand kit couldn’t be loaded. <button onClick={()=>{void kit.refetch();void accounts.refetch();}}>Try again</button></p>:<><p>{kit.data?.published_revision?'Published':'Private draft'} · {draft?.featured_posts.length??0} featured posts</p>{account&&<p>{metric(account.profile?.followers)} Instagram followers · Snapshot {importedDate(account.collected_at)}</p>}<div className={styles.links}><Link href="/creator-portal/media-kit">Make it yours ↗</Link><Link href="/creator-portal/profile">Edit profile →</Link></div>{steps.some(s=>!s.done)&&<div className={styles.setup}>{steps.filter(s=>!s.done).map(s=><Link key={s.href} href={s.href}>{s.title} →</Link>)}</div>}</>}{!account&&!accounts.isLoading&&!accounts.error&&<CreateKitForm/>}</section>
  </div></div>
  {accounts.data?.map(a=><ImportProgress key={a.id} account={a}/>)}
  {account&&<section className={styles.panel}><div className={styles.sectionHeader}><div><h2>Fresh from your feed</h2><p>A little window into what you create.</p></div><Link href="/creator-portal/portfolio">Content library →</Link></div>{snapshots.some(s=>s.isError)&&<p role="alert">Some content couldn’t be loaded.</p>}<div className={styles.posts}>{posts.slice(0,3).map(post=><article key={post.platform_post_id}><CreatorImage src={post.image_url} alt="" className={styles.thumbnail}/><div><span className={styles.eyebrow}>{post.content_type||'Post'}</span><p>{post.caption?.slice(0,120)||'Untitled post'}</p><p className={styles.muted}>{metric(post.views??post.plays)} views · {metric(post.likes)} likes · {metric(post.comments)} comments</p><Link href="/creator-portal/portfolio">View in library →</Link></div></article>)}</div>{!posts.length&&<p className={styles.muted}>Your imported content will appear here.</p>}</section>}
 </div>;
}
