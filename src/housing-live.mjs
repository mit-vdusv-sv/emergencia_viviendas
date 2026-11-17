import {CSV_URL,parseHousing} from './model.mjs';
import {createAutoRefresh} from './auto-refresh.mjs';

export const HOUSING_INTERVAL=3000;
let requestNumber=0;

export async function readHousingDirect({fetcher=globalThis.fetch,now=Date.now}={}){
 const url=new URL(CSV_URL);
 url.searchParams.set('_',`${now()}-${++requestNumber}`);
 const response=await fetcher(url.href,{
  cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error(`Google Sheets respondió HTTP ${response.status}.`);
 return parseHousing(await response.text(),{retrievedAt:new Date(now()).toISOString()});
}

export function sameHousing(a,b){
 const content=data=>data?{records:data.records,reportedTotals:data.reportedTotals??null,sourceIssues:data.sourceIssues??[],reportDate:data.source?.reportDate??null}:null;
 return JSON.stringify(content(a))===JSON.stringify(content(b));
}

export function createHousingSync({getCurrent,isImported=()=>false,onData=()=>{},onStatus=()=>{},read=readHousingDirect,now=Date.now,...timers}){
 let pending=null,failures=0,retryAt=0;
 function refresh({automatic=false}={}){
  if(isImported())return Promise.resolve({skipped:true});
  if(pending)return pending;
  if(automatic&&now()<retryAt)return Promise.resolve({skipped:true});
  pending=(async()=>{
   try{
    const data=await Promise.resolve().then(read);
    // Una importación hecha durante la solicitud también se conserva.
    if(isImported())return {skipped:true};
    const changed=!sameHousing(getCurrent(),data);
    failures=0;retryAt=0;
    onData(data,{changed});onStatus('live');
    return {ok:true,changed};
   }catch(error){
    if(isImported())return {skipped:true};
    failures++;retryAt=now()+Math.min(60000,HOUSING_INTERVAL*2**Math.min(failures-1,5));
    onStatus('error',error);
    return {ok:false,error};
   }finally{pending=null;}
  })();
  return pending;
 }
 const clock=createAutoRefresh({run:()=>refresh({automatic:true}),interval:HOUSING_INTERVAL,now,...timers});
 return {start:clock.start,stop:clock.stop,wake:clock.wake,refresh,get nextAt(){return clock.nextAt;}};
}
