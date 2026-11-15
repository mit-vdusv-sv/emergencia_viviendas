export const REFRESH_INTERVAL=5*60*1000;

export function createAutoRefresh({run,interval=REFRESH_INTERVAL,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,onError=()=>{}}){
 let timer=null,pending=null,stopped=true,nextAt=null;
 function cancel(){if(timer!==null)clearTimer(timer);timer=null;}
 function schedule(){if(stopped)return;nextAt=now()+interval;timer=setTimer(tick,interval);}
 function tick(){
  if(stopped)return Promise.resolve();
  if(pending)return pending;
  cancel();nextAt=null;
  pending=Promise.resolve().then(run).catch(onError).finally(()=>{pending=null;schedule();});
  return pending;
 }
 return {
  start({immediate=false}={}){if(!stopped)return pending||Promise.resolve();stopped=false;if(immediate)return tick();schedule();return Promise.resolve();},
  stop(){stopped=true;cancel();nextAt=null;},
  trigger:tick,
  wake(){return !stopped&&nextAt!==null&&now()>=nextAt?tick():Promise.resolve();},
  get nextAt(){return nextAt;}
 };
}
