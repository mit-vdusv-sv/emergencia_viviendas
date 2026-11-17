import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readHousingDirect,createHousingSync,sameHousing,HOUSING_INTERVAL} from '../src/housing-live.mjs';
import {parseHousing,aggregate} from '../src/model.mjs';
const csv=await fs.readFile(new URL('../data/hoja-original.csv',import.meta.url),'utf8');
const baseline=parseHousing(csv);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function clock(){let time=0,id=0;const timers=new Map();return {now:()=>time,setTimer:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;},clearTimer:key=>timers.delete(key),async advance(ms){time+=ms;for(const [key,timer] of [...timers])if(timer.at<=time){timers.delete(key);await timer.fn();}await flush();}};}

test('vivienda consulta directamente la hoja sin API local ni archivos publicados',async()=>{
 const calls=[];let text=csv;
 const fetcher=async(url,options)=>{calls.push({url:new URL(url),options});return {ok:true,text:async()=>text};};
 const a=await readHousingDirect({fetcher,now:()=>1000});
 text=csv.replace('Azuay,0,','Azuay,100,');
 // El contador evita reutilizar la URL incluso en el mismo milisegundo.
 const b=await readHousingDirect({fetcher,now:()=>1000});
 assert.equal(calls[0].url.origin,'https://docs.google.com');
 assert.equal(calls[0].url.searchParams.get('gid'),'1128467625');
 assert.equal(calls[0].url.searchParams.get('format'),'csv');
 assert.notEqual(calls[0].url.href,calls[1].url.href);
 assert.ok(calls.every(c=>c.options.cache==='no-store'&&c.options.credentials==='omit'));
 assert.equal(a.records.length,24);assert.equal(aggregate(a.records,'affected').value,331);
 assert.equal(aggregate(b.records,'affected').value,431);
 assert.ok(!sameHousing(a,b));
 assert.ok(sameHousing(a,{...a,source:{...a.source,retrievedAt:'2020-01-01T00:00:00Z'}}));
});

test('los cambios llegan por el ciclo de tres segundos sin esperar al de cinco minutos',async()=>{
 const time=clock();let current=baseline,reads=0,changed=[];
 const updated=structuredClone(baseline);updated.records[0].affected=100;
 const sync=createHousingSync({...time,getCurrent:()=>current,read:async()=>++reads===1?baseline:updated,onData:(data,meta)=>{current=data;changed.push(meta.changed);}});
 await sync.start({immediate:true});assert.equal(reads,1);
 await time.advance(HOUSING_INTERVAL-1);assert.equal(reads,1);
 await time.advance(1);assert.equal(reads,2);assert.equal(aggregate(current.records,'affected').value,431);
 assert.deepEqual(changed,[false,true]);
 sync.stop();await time.advance(300000);assert.equal(reads,2);
 await sync.start({immediate:true});assert.equal(reads,3);sync.stop();
});

test('una solicitud lenta no se duplica ni sobrescribe una importación concurrente',async()=>{
 let resolve,imported=false,reads=0,delivered=0;
 const sync=createHousingSync({getCurrent:()=>baseline,isImported:()=>imported,read:()=>{reads++;return new Promise(done=>resolve=done);},onData:()=>delivered++});
 const first=sync.refresh(),second=sync.refresh();assert.equal(first,second);
 await flush();assert.equal(reads,1);
 imported=true;resolve(baseline);assert.deepEqual(await first,{skipped:true});assert.equal(delivered,0);
 await sync.refresh();assert.equal(reads,1);
});

test('una caída conserva los datos y permite recuperarse incluso ante un fallo síncrono',async()=>{
 const time=clock();let current=baseline,failed=true,reads=0,status=[];
 const sync=createHousingSync({...time,getCurrent:()=>current,read:()=>{reads++;if(failed)throw new Error('sin conexión');return Promise.resolve(baseline);},onData:data=>current=data,onStatus:value=>status.push(value)});
 assert.equal((await sync.refresh()).ok,false);assert.equal(current,baseline);
 await sync.start({immediate:true});assert.equal(reads,1);
 failed=false;await time.advance(HOUSING_INTERVAL);assert.equal(reads,2);
 assert.deepEqual(status,['error','live']);sync.stop();
 await assert.rejects(readHousingDirect({fetcher:async()=>({ok:false,status:503})}),/503/);
 await assert.rejects(readHousingDirect({fetcher:async()=>({ok:true,text:async()=>'<html>Login</html>'})}),/estructura/);
});
