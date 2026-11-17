import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseCSV,parseHousing,solutionsTotal,provincesWithSolutions,filterRecords,aggregate} from '../src/model.mjs';
import {sameHousing} from '../src/housing-live.mjs';
import {createSurfaces} from '../src/surfaces.mjs';
const original=await fs.readFile(new URL('../data/hoja-original.csv',import.meta.url),'utf8');
const provinces=new Set(parseHousing(original).records.map(r=>r.province));
const serialize=rows=>rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
function sheet(){
 const rows=parseCSV(original),values={'Bolívar':5,'El Oro':2,'Esmeraldas':34,'Galápagos':21,'Guayas':334,'Pastaza':1,'Santa Elena':14};
 for(const row of rows){if(provinces.has(row[0])){row[1]='ignorado';row[13]=String(values[row[0]]??0);}}
 rows[7][1]='ignorado';rows[7][13]='411';return rows;
}

test('N8 es la autoridad nacional y los filtros usan N, sin depender de B',()=>{
 const rows=sheet(),data=parseHousing(serialize(rows));
 assert.equal(solutionsTotal(data),411);assert.equal(provincesWithSolutions(data.records),7);
 assert.equal(data.records.find(r=>r.province==='Guayas').combinedReported,334);
 assert.equal(solutionsTotal(data,filterRecords(data.records,{province:'Guayas'})),334);
 assert.equal(solutionsTotal(data,filterRecords(data.records,{region:'Costa'})),384);
 assert.ok(data.records.every(r=>r.affected===null));
 rows[7][13]='999';const different=parseHousing(serialize(rows));
 assert.equal(aggregate(different.records,'combinedReported').value,411);assert.equal(solutionsTotal(different),999);
 rows[7][13]='';assert.equal(solutionsTotal(parseHousing(serialize(rows))),null);
});

test('cero y vacío no cuentan como provincias con soluciones y B no produce cambios',()=>{
 const rows=sheet(),data=parseHousing(serialize(rows));
 const guayas=rows.find(row=>row[0]==='Guayas');guayas[1]='999999';
 assert.ok(sameHousing(data,parseHousing(serialize(rows))));
 guayas[13]='0';const zero=parseHousing(serialize(rows));assert.equal(provincesWithSolutions(zero.records),6);
 guayas[13]='';const blank=parseHousing(serialize(rows));assert.equal(provincesWithSolutions(blank.records),6);
 assert.equal(blank.records.find(r=>r.province==='Guayas').combinedReported,null);
 assert.equal(zero.records.find(r=>r.province==='Guayas').combinedReported,0);
});

test('el resumen usa soluciones y omite contexto climático sin retirar la sección Clima',()=>{
 const data=parseHousing(serialize(sheet()));
 const state={housing:data,mapMetric:'housing',weatherSource:'exposure',geo:{features:[]},sources:{},region:'',province:'',alerts:{records:[]},exposure:{provinces:[]}};
 const surfaces=createSurfaces({state,esc:v=>String(v??''),fmt:v=>v??'—',date:v=>String(v??''),month:v=>v,signed:v=>v,icon:()=>'',selected:()=>data.records,filters:()=>'',lineChart:()=>'',table:()=>''});
 const html=surfaces.overview();
 assert.match(html,/Soluciones habitacionales a entregarse/);assert.match(html,/>411</);assert.match(html,/334 soluciones habitacionales/);
 assert.ok(!html.includes('Contexto climático'));assert.ok(!html.includes('Beneficiarios pre calificados'));
 assert.match(surfaces.climateView(),/Alertas meteorológicas/);
});
