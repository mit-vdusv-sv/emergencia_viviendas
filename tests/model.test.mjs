import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHousing,parseCSV,aggregate,quality,filterRecords,exportCSV,parseOcean,activeAlerts,solutionsTotal} from '../src/model.mjs';
import {parseCAP,summarizeExposure} from '../src/connectors.mjs';
const original=await fs.readFile(new URL('../data/hoja-original.csv',import.meta.url),'utf8');
const housing=parseHousing(original);
test('el total usa N8 y la columna B queda fuera del modelo activo',()=>{
 assert.equal(housing.records.length,24);assert.equal(solutionsTotal(housing),379);assert.ok(housing.records.every(r=>r.affected===null));
 assert.equal(aggregate(housing.records,'minorIdentified').value,283);assert.equal(aggregate(housing.records,'rentIdentified').value,48);
 assert.equal(aggregate(housing.records,'minorQualified').value,null);assert.equal(housing.records.find(r=>r.province==='Manabí').combinedReported,null);
 assert.equal(housing.source.reportDate,null);assert.equal(housing.reportedTotals.combinedReported,379);
 assert.ok(quality(housing).some(i=>i.title.includes('sin dato de soluciones')));
 assert.ok(!quality(housing).some(i=>i.detail.includes('columna B')));
 assert.ok(quality(housing).some(i=>i.title.includes('Esmeraldas')&&i.title.includes('únicos')));
});
test('CSV entrecomillado, ceros y vacíos sobreviven exportación/importación',()=>{
 const records=structuredClone(housing.records);records[0].observations='Una observación, con "comillas"\ny salto';
 const imported=parseHousing(exportCSV(records),{name:'CSV local'});assert.deepEqual(imported.records,records);
 assert.equal(parseCSV('"a,b","c"\r\n"d","e"')[0][0],'a,b');assert.throws(()=>parseCSV('"sin cerrar'));
});
test('rechaza una base incompleta, duplicados y valores negativos sin reemplazar datos',()=>{
 assert.throws(()=>parseHousing(exportCSV(housing.records.slice(1))),/24 provincias/);
 const copy=structuredClone(housing.records);copy[0].province=copy[1].province;assert.throws(()=>parseHousing(exportCSV(copy)),/duplicada/);
 const negative=structuredClone(housing.records);negative[0].combinedReported=-1;assert.throws(()=>parseHousing(exportCSV(negative)),/entero no negativo/);
 assert.throws(()=>parseHousing(original.replace('AMARILLO','DISTINTO')),/estructura/);
});
test('exportación neutraliza fórmulas y filtros conservan observaciones',()=>{
 const r=structuredClone(housing.records[0]);r.observations='=HYPERLINK("https://ejemplo.test")';assert.ok(exportCSV([r]).includes("'=HYPERLINK"));
 const solutions=structuredClone(housing.records);solutions.find(r=>r.province==='Guayas').combinedReported=334;
 assert.deepEqual(filterRecords(solutions,{region:'Costa',onlyAffected:true}).map(r=>r.province),['Guayas']);
 assert.equal(filterRecords(housing.records,{search:'EVIN'})[0].province,'Manabí');
 assert.equal(filterRecords(housing.records,{search:'galapagos'})[0].province,'Galápagos');
});
test('NOAA usa las columnas de anomalía correctas y excluye faltantes',()=>{
 const out=parseOcean('YR MON NINO1+2 ANOM NINO3 ANOM NINO4 ANOM NINO3.4 ANOM\n2026 9 25.27 4.69 28.65 3.64 29.62 .95 29.60 2.84\n2026 10 99.99 99.99 99.99 99.99 99.99 99.99 99.99 99.99');
 assert.deepEqual(out,[{month:'2026-09',nino12:4.69,nino34:2.84}]);assert.throws(()=>parseOcean('error HTML'));
});
test('CAP excluye vencidos, ensayos, inicio futuro y mensajes cancelados/reemplazados',()=>{
 const now=Date.parse('2026-11-14T22:00:00Z');const base={status:'Actual',msgType:'Alert',references:'',onset:'2026-11-14T10:00:00Z',expires:'2026-11-15T10:00:00Z'};
 const messages=[{...base,id:'a'},{...base,id:'b',msgType:'Update',references:'sender,a,2026-11-14'},{...base,id:'c',expires:'2026-11-13T00:00:00Z'},{...base,id:'d',status:'Test'},{...base,id:'e',onset:'2026-11-16T00:00:00Z'},{...base,id:'f',expires:''}];
 assert.deepEqual(activeAlerts(messages,now).map(a=>a.id),['b']);assert.equal(activeAlerts([...messages,{...base,id:'cancel',msgType:'Cancel',references:'sender,b,time'}],now).length,0);
 const xml='<alert><identifier>x</identifier><status>Actual</status><info><event>Lluvia &amp; tormenta</event><area><areaDesc>Guayas</areaDesc></area></info></alert>';
 assert.equal(parseCAP(xml,'https://example.test').event,'Lluvia & tormenta');assert.throws(()=>parseCAP('<html>error</html>',''));
});
test('exposición suma valores publicados sin sumar amenazas ni imputar nulos',()=>{
 const row={dpa_despro:'GUAYAS',pob_inu_alt_med:100,pob_inu_alta:60.2,pob_inu_media:40.1,pob_mm_ma_alt:50,pob_mm_muy_alta:30,pob_mm_alta:20};
 const out=summarizeExposure([{attributes:row},{attributes:{...row,pob_inu_alt_med:null}}]);
 assert.equal(out.totals.pob_inu_alt_med,100);assert.equal(out.coverage.pob_inu_alt_med,1);assert.equal(out.provinces[0].landslide,100);assert.equal(out.parishes,2);
 assert.throws(()=>summarizeExposure([{attributes:{dpa_despro:'GUAYAS'}}]),/inesperados/);
});
