import * as React from 'react';
import Link from 'next/link';
import type {AlertItem, AlertsPayload} from '@/lib/api';
import type {AlertSectionKey, AlertFilterKey} from '@/lib/types';
import Button from '@/components/ui/Button';
import styles from './alerts.module.css';
import {alertDestination, orderedAlerts} from './flow';

export const ORDER:AlertSectionKey[]=['urgent','payments','docs','health','bd','seasonal'];
export function filterLabel(key:AlertFilterKey) {return {all:'Needs attention',urgent:'Urgent',payments:'Payments',docs:'Documents',health:'Creator health',bd:'Brand opportunities',seasonal:'Seasonal planning'}[key];}
const operational=ORDER.filter(key=>key!=='bd'&&key!=='seasonal');

function AlertRow({item,category,busy,dismiss}:{item:AlertItem;category:AlertSectionKey;busy:boolean;dismiss:(keys:string[])=>void}) {
 const opportunity=category==='seasonal'||category==='bd';
 const href=alertDestination(item);
 return <li className={styles.row}><div className={styles.rowContent}><div className={styles.rowTitle}><h3>{item.title}</h3>{!opportunity&&<span className={styles.severity} data-severity={item.severity}>{item.severity==='high'?'High priority':item.severity==='med'?'Medium':'Low'}</span>}</div><p>{item.detail}</p><div className={styles.rowFooter}><span>{filterLabel(category)}</span><Link href={href} className={styles.action}>{category==='seasonal'?'View campaigns':item.action} →</Link></div></div>{opportunity&&<button type="button" className={styles.dismiss} aria-label={`Dismiss ${item.title}`} title="Dismiss opportunity" disabled={busy} onClick={()=>dismiss([item.key])}>×</button>}</li>;
}

export function AlertsDashboardView({payload,activeSection,setActiveSection,busy,dismiss}: {payload:AlertsPayload;activeSection:AlertFilterKey;setActiveSection:(key:AlertFilterKey)=>void;busy:boolean;dismiss:(keys:string[])=>void}) {
 const [showAllSeasonal,setShowAllSeasonal]=React.useState(false);
 const issues=orderedAlerts(operational.flatMap(category=>payload[category].map(item=>({item,category}))));
 const visible=activeSection==='all'?issues:issues.filter(row=>row.category===activeSection);
 const high=issues.filter(row=>row.item.severity==='high').length;
 const showOperational=activeSection!=='seasonal'&&activeSection!=='bd';
 return <>
  <div className={styles.summary}><strong>{issues.length?`${issues.length} item${issues.length===1?'':'s'} need${issues.length===1?'s':''} attention`:'No outstanding issues'}</strong><span>{high?`${high} high-priority issue${high===1?'':'s'}`:'No high-priority issues'}</span></div>
  <nav className={styles.filters} aria-label="Alert categories">{(['all',...ORDER] as AlertFilterKey[]).map(key=><button type="button" key={key} aria-pressed={activeSection===key} onClick={()=>setActiveSection(key)}>{filterLabel(key)} <span>{key==='all'?issues.length:payload[key].length}</span></button>)}</nav>
  <div className={`${styles.layout} ${activeSection!=='all'?styles.single:''}`}>
   {showOperational&&<section className={styles.panel}><header><h2>{activeSection==='all'?'Needs attention':filterLabel(activeSection)}</h2><span>{visible.length} {visible.length===1?'item':'items'}</span></header>{visible.length?<ul>{visible.map(({item,category})=><AlertRow key={item.key} item={item} category={category} busy={busy} dismiss={dismiss}/>)}</ul>:<div className={styles.empty}><strong>{activeSection==='all'?'You’re up to date':'No matching issues'}</strong><p>{activeSection==='all'?'No unresolved operational alerts right now.':'There are no current alerts in this category.'}</p></div>}</section>}
   <div className={styles.opportunities}>
    {(activeSection==='all'||activeSection==='bd')&&payload.bd.length>0&&<section className={styles.panel}><header><h2>Brand opportunities</h2><span>{payload.bd.length}</span></header><ul>{payload.bd.map(item=><AlertRow key={item.key} item={item} category="bd" busy={busy} dismiss={dismiss}/>)}</ul></section>}
    {(activeSection==='all'||activeSection==='seasonal')&&<section className={styles.panel}><header><div><h2>Upcoming planning opportunities</h2><p>Dates to consider for future campaigns.</p></div><span>{payload.seasonal.length}</span></header>{payload.seasonal.length?<><ul>{payload.seasonal.slice(0,showAllSeasonal?undefined:3).map(item=><AlertRow key={item.key} item={item} category="seasonal" busy={busy} dismiss={dismiss}/>)}</ul>{payload.seasonal.length>3&&<Button className={styles.viewAll} onClick={()=>setShowAllSeasonal(value=>!value)}>{showAllSeasonal?'Show nearest three':`View all ${payload.seasonal.length} dates`}</Button>}</>:<div className={styles.empty}><p>No upcoming dates.</p></div>}</section>}
    {activeSection==='bd'&&!payload.bd.length&&<section className={styles.panel}><div className={styles.empty}><strong>No brand opportunities right now</strong></div></section>}
   </div>
  </div>
  <details className={styles.explanation}><summary>How alerts work</summary><p>Alerts are recalculated from campaign, creator and document records when refreshed. Operational issues remain until their source records are updated. Planning opportunities can be dismissed and restored.</p><p>Inactive creator ≥ {payload.thresholds.inactive_creator_days} days · Invoice overdue ≥ {payload.thresholds.invoice_overdue_days} days · Payment overdue ≥ {payload.thresholds.payment_overdue_days} days · Brand dormant ≥ {payload.thresholds.brand_dormant_days} days · Brand hot ≥ 3 deals/{payload.thresholds.brand_hot_window_days} days · Renewal ≤ {payload.thresholds.renewal_due_days} days · Quarterly decline ≥ {Math.round(payload.thresholds.qoq_drop_pct*100)}%.</p></details>
 </>;
}
