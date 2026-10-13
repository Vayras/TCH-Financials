export type HomeCampaign={id:string;name:string;brand:string;shared_at:string;deliverables:{id:string;format:string;quantity:number;due_date:string}[];concepts:{id:string;state:string;title:string}[]};
export function homeAttention(campaigns:HomeCampaign[],today:string){
 const items:{id:string;title:string;detail:string;href:string;action:string;date:string}[]=[];
 for(const campaign of campaigns){
  for(const concept of campaign.concepts.filter(c=>c.state==='changes_requested')) items.push({id:concept.id,title:'Changes requested',detail:`${campaign.name} · ${concept.title||'Concept'}`,href:`/creator-portal/campaigns/${campaign.id}/brief?view=feedback&concept=${concept.id}`,action:'Review feedback',date:''});
  for(const d of campaign.deliverables??[]) if(d.due_date&&d.due_date>=today&&d.due_date<=new Date(Date.parse(today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)) items.push({id:campaign.id+':'+d.id,title:'Upcoming brief deadline',detail:`${campaign.name} · ${d.quantity} ${d.format}`,href:`/creator-portal/campaigns/${campaign.id}/brief`,action:'Open brief',date:d.due_date});
 }
 return items.sort((a,b)=>a.date.localeCompare(b.date));
}
