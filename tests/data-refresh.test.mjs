import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readDataset,preferNewest} from '../src/data-refresh.mjs';
import {refreshOne,sameSnapshot} from '../scripts/refresh.mjs';

const dataset={source:{name:'Prueba',retrievedAt:'2026-11-15T05:00:00Z'},records:[]};
test('la versión estática vuelve a leer los JSON publicados sin caché',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>dataset};};
 await readDataset('alerts',{fetcher});await readDataset('alerts',{fetcher});
 assert.equal(calls.length,2);
 assert.ok(calls.every(call=>call.url==='data/alerts.json'&&call.options.cache==='no-store'));
 await readDataset('alerts',{local:true,fetcher});assert.equal(calls.at(-1).url,'api/alerts');
});
test('un error o un JSON inválido no se acepta como nueva copia',async()=>{
 await assert.rejects(readDataset('alerts',{fetcher:async()=>({ok:false,status:503})}),/503/);
 await assert.rejects(readDataset('alerts',{fetcher:async()=>({ok:true,json:async()=>({})})}),/válida/);
 await assert.rejects(readDataset('../secreto'),/desconocida/);
 const newer={...dataset,source:{...dataset.source,retrievedAt:'2026-11-15T05:10:00Z'}};
 assert.equal(preferNewest(newer,dataset),newer);
 assert.equal(preferNewest(dataset,newer),newer);
 assert.equal(preferNewest(newer,null),newer);
});
test('la comparación conserva cambios de contenido y omite solo la fecha de consulta',()=>{
 const later={records:[],source:{retrievedAt:'2026-11-15T05:10:00Z',name:'Prueba'}};
 assert.ok(sameSnapshot(dataset,later));
 assert.ok(!sameSnapshot(dataset,{...later,records:[{id:'nuevo'}]}));
 assert.ok(!sameSnapshot(dataset,{...later,complete:false}));
});
test('el modo estable conserva la copia idéntica y guarda cambios reales',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dashboard-refresh-'));
 const originalFetch=globalThis.fetch;
 const file=path.join(directory,'data','housing.json');
 try{
  const csv=await fs.readFile(new URL('../data/hoja-original.csv',import.meta.url),'utf8');
  globalThis.fetch=async()=>({ok:true,text:async()=>csv});
  const initial=await refreshOne('housing',{directory});
  initial.source.retrievedAt='2020-01-01T00:00:00Z';
  await fs.writeFile(file,JSON.stringify(initial));
  const before=await fs.readFile(file,'utf8');
  await refreshOne('housing',{directory,preserveUnchanged:true});
  assert.equal(await fs.readFile(file,'utf8'),before);
  initial.records[0].affected=99999;
  await fs.writeFile(file,JSON.stringify(initial));
  const updated=await refreshOne('housing',{directory,preserveUnchanged:true});
  assert.notEqual(updated.records[0].affected,99999);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),updated);
 }finally{
  globalThis.fetch=originalFetch;
  // Only exact files created by this test are removed.
  await fs.unlink(file).catch(()=>{});await fs.unlink(file+'.tmp').catch(()=>{});
  await fs.rmdir(path.join(directory,'data')).catch(()=>{});await fs.rmdir(directory).catch(()=>{});
 }
});
