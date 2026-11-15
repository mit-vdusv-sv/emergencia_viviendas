import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {refreshOne} from '../scripts/refresh.mjs';
test('una fuente caída conserva íntegro el último respaldo',async()=>{
 const file=new URL('../data/housing.json',import.meta.url);const before=await fs.readFile(file,'utf8');const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('Fallo de red simulado');};
 try{await assert.rejects(refreshOne('housing'),/Fallo de red simulado/);}finally{globalThis.fetch=originalFetch;}
 assert.equal(await fs.readFile(file,'utf8'),before);
});
