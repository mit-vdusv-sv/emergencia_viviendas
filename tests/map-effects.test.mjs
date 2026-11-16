import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getMapHazards,namedProvinces,renderMapHazardMarker,PROVINCE_ANCHORS} from '../src/map-effects.mjs';
import {PROVINCES} from '../src/model.mjs';

const sampleExposure={provinces:[
 {province:'GUAYAS',flood:12,landslide:45},
 {province:'PICHINCHA',flood:0,landslide:8},
 {province:'CARCHI',flood:null,landslide:null},
]};
const now=Date.parse('2026-11-16T14:00:00-05:00');
const alert=(area,event,expires='2026-11-18T20:00:00-05:00')=>({
 id:`${area}:${event}`,status:'Actual',msgType:'Alert',references:'',severity:'Severe',
 onset:'2026-11-15T09:00:00-05:00',area,event,expires
});

test('exposición territorial crea los iconos disponibles sin tratar nulos como eventos',()=>{
 const result=getMapHazards({exposure:sampleExposure,mode:'exposure'});
 assert.deepEqual(result.map(r=>[r.province,r.rain,r.landslide]),[
  ['Guayas',true,true],['Pichincha',false,true]
 ]);
 assert.equal(getMapHazards({exposure:sampleExposure,mode:'exposure',mapMetric:'flood'}).length,1);
 assert.equal(getMapHazards({exposure:sampleExposure,mode:'exposure',mapMetric:'landslide'}).length,2);
});

test('avisos INAMHI requieren provincia explícita y vigencia, nunca generalizan la región',()=>{
 const alerts={records:[
  alert('Guayas, Los Ríos','Lluvias y tormentas eléctricas'),
  alert('Pichincha','Movimientos en masa'),
  alert('Litoral y estribación de cordillera occidental','Lluvias y tormentas eléctricas'),
  alert('Esmeraldas','Lluvias', '2026-11-15T07:00:00-05:00'),
 ]};
 const result=getMapHazards({alerts,mode:'alerts',now});
 assert.deepEqual(result.map(r=>r.province).sort(),['Guayas','Los Ríos','Pichincha']);
 assert.equal(result.find(r=>r.province==='Pichincha').landslide,true);
 assert.equal(result.find(r=>r.province==='Guayas').rain,true);
 assert.deepEqual(namedProvinces({area:'Santo Domingo de los Tsáchilas, Zamora Chinchipe'}),['Santo Domingo de los Tsáchilas','Zamora Chinchipe']);
 assert.deepEqual(namedProvinces({area:'Toda la región costa'}),[]);
});

test('copia original del INAMHI carece de alertas vigentes al 16 de noviembre de 2026',()=>{
 const alerts=JSON.parse(readFileSync(new URL('../data/alerts.json',import.meta.url)));
 assert.deepEqual(getMapHazards({alerts,mode:'alerts',now}),[]);
});

test('24 anclas cartográficas y SVG sin bloquear el clic provincial',()=>{
 assert.deepEqual(Object.keys(PROVINCE_ANCHORS).sort(),Object.keys(PROVINCES).sort());
 const svg=renderMapHazardMarker({province:'Guayas',rain:true,landslide:true,source:'exposure'},([x,y])=>[x,y]);
 assert.match(svg,/map-hazard-marker/);
 assert.match(svg,/weather-rain-icon/);
 assert.match(svg,/weather-rock-icon/);
 assert.match(svg,/No indica un evento actual/);
});
