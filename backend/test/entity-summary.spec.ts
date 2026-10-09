import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnalyticsService} from '../src/analytics/analytics.service';
test('entity drill-down contains the same deals used in period totals',async()=>{
 const deal=(id:string,date:string,fee:string)=>({id,confirmationDate:date,eInvoiceDate:null,billingPeriod:date,billingEntity:'TCH',totalFee:fee,agencyFeeInr:'20.00',campaignId:'1',campaign:{name:'Launch'},creatorId:'2',creator:{name:'Kapil'},creatorShares:[],brand:'Brand'});
 const service=new AnalyticsService({getRepository:()=>({find:async()=>[deal('1','2026-09-10','100.25'),deal('2','2026-10-10','200.00')]})} as any);
 const result:any=await service.entitySummary(2026,'','Q2');
 assert.equal(result.entities[0].deals.length,1);
 assert.equal(result.entities[0].deals[0].id,'1');
 assert.equal(result.entities[0].deals[0].bookings,result.grand_total_billing);
 assert.equal(result.entities[0].deals[0].agency_margin,result.grand_total_profit);
});
