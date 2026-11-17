import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHousing,parseCSV,solutionsTotal,quality,exportCSV,normalize} from '../src/model.mjs';
const original=await fs.readFile(new URL('../data/hoja-original.csv',import.meta.url),'utf8');
const csv=rows=>rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');

test('una observación provincial no bloquea la lectura del total nacional N8',()=>{
 const rows=parseCSV(original),note='Familia que acoge a damnificado no desea pago por arriendo. Continuarán con la calificación para TP';
 const azuay=rows.find(row=>normalize(row[0])==='azuay');azuay[1]='dato ignorado';rows[7][13]='411';
 const pastaza=rows.find(row=>normalize(row[0])==='pastaza');pastaza[13]=note;pastaza[14]='';
 const data=parseHousing(csv(rows));
 assert.equal(solutionsTotal(data),411);
 const record=data.records.find(row=>row.province==='Pastaza');
 assert.equal(record.combinedReported,null);assert.equal(record.affected,null);assert.equal(record.observations,note);
 assert.deepEqual(data.sourceIssues,[{code:'text_in_total',province:'Pastaza',field:'combinedReported',cell:`N${rows.indexOf(pastaza)+1}`,value:note}]);
 assert.ok(quality(data).some(issue=>issue.title.includes('Pastaza: texto en el total')));
});

test('la tolerancia de notas no acepta números inválidos ni una plantilla alterada',()=>{
 const rows=parseCSV(original);rows.find(row=>normalize(row[0])==='pastaza')[13]='-1';
 assert.throws(()=>parseHousing(csv(rows)),/entero no negativo/);
 const records=parseHousing(original).records;records[0].combinedReported='texto';
 assert.throws(()=>parseHousing(exportCSV(records)),/entero no negativo/);
 const invalid=parseCSV(original);invalid.find(row=>normalize(row[0])==='azuay')[2]='sin dato';
 assert.throws(()=>parseHousing(csv(invalid)),/entero no negativo/);
});
