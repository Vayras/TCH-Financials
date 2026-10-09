export function reportTotals(deals: {confirmed_this_week:boolean;active_now:boolean;campaign_id:string|null;total_fee:string;agency_fee_inr:string}[]) {
 const confirmed=deals.filter(d=>d.confirmed_this_week);
 return {confirmed:confirmed.length,bookings:confirmed.reduce((n,d)=>n+Number(d.total_fee),0),margin:confirmed.reduce((n,d)=>n+Number(d.agency_fee_inr),0),active:new Set(deals.filter(d=>d.active_now && d.campaign_id).map(d=>d.campaign_id)).size};
}
