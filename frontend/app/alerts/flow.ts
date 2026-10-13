import type {AlertItem} from '@/lib/api';
import type {AlertSectionKey} from '@/lib/types';

export function alertDestination(item:AlertItem) {
 const id=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
 if(id(item.meta.deal_id))return `/commercial/${item.meta.deal_id}`;
 if(id(item.meta.creator_id))return `/creators/${item.meta.creator_id}`;
 return `/commercial${typeof item.meta.brand==='string'?`?q=${encodeURIComponent(item.meta.brand)}`:''}`;
}
export function orderedAlerts(rows:{item:AlertItem;category:AlertSectionKey}[]) {
 const rank={high:0,med:1,low:2};
 return [...rows].sort((a,b)=>rank[a.item.severity]-rank[b.item.severity]);
}
