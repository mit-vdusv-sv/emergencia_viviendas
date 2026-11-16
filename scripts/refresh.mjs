import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as connectors from '../src/connectors.mjs';
import {SOURCE_NAMES} from '../src/data-refresh.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Evita publicar otra copia cuando solo cambió la hora de consulta.
export function sameSnapshot(a,b){
 const normalize=value=>{
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,key==='source'?normalize(Object.fromEntries(Object.entries(value[key]).filter(([field])=>field!=='retrievedAt'))):normalize(value[key])]));
  return value;
 };
 return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
export async function refreshOne(name,{directory=root,preserveUnchanged=false}={}){
 if(!SOURCE_NAMES.includes(name))throw new Error('Fuente desconocida.');
 const value=await connectors[name]();const target=path.join(directory,'data',`${name}.json`);
 if(preserveUnchanged){
  try{const previous=JSON.parse(await fs.readFile(target,'utf8'));if(sameSnapshot(previous,value))return previous;}
  catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 }
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target+'.tmp',JSON.stringify(value,null,2));await fs.rename(target+'.tmp',target);return value;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),preserveUnchanged=args.includes('--stable');
 const names=args.filter(arg=>arg!=='--stable');if(!names.length)names.push(...SOURCE_NAMES);
 if(names.some(name=>!SOURCE_NAMES.includes(name)))throw new Error('Fuente desconocida.');
 const results=await Promise.allSettled(names.map(async name=>{const data=await refreshOne(name,{preserveUnchanged});console.log(`${name}: copia válida ${data.source.retrievedAt}`);}));
 results.forEach((r,i)=>{if(r.status==='rejected')console.error(`${names[i]}: se conserva el respaldo; ${r.reason.message}`);});if(results.every(r=>r.status==='rejected'))process.exitCode=1;
}
