import {CSV_URL,parseHousing,parseOcean,activeAlerts} from './model.mjs';
export const URLS={alerts:'https://servicios.inamhi.gob.ec/wp-json/inamhi/v1/advertencias',cap:'https://cap-sources.s3.amazonaws.com/ec-inamhi-es/rss.xml',ocean:'https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices',erfen:'https://servicios.inamhi.gob.ec/fenomeno-el-nino/'};
export async function getText(url){const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/json, text/plain, application/xml, text/html'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}
function decode(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');}
function tags(xml,name){return [...xml.matchAll(new RegExp('<(?:[\\w-]+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?'+name+'>','gi'))].map(m=>decode(m[1]).trim());}
const tag=(xml,name)=>tags(xml,name)[0]||'';
export function parseCAP(xml,url){if(!/<(?:\w+:)?alert[\s>]/i.test(xml))throw new Error('Documento CAP inválido.');const result={url,kind:'cap'};for(const [key,name] of Object.entries({id:'identifier',status:'status',msgType:'msgType',references:'references',severity:'severity',event:'event',headline:'headline',description:'description',instruction:'instruction',onset:'onset',expires:'expires',issued:'sent'}))result[key]=tag(xml,name);result.area=tags(xml,'areaDesc').join(', ');result.provinces=[];return result;}
export async function housing(){return parseHousing(await getText(CSV_URL));}
export async function ocean(){return {schemaVersion:1,source:{name:'NOAA CPC · OISST mensual',url:URLS.ocean,retrievedAt:new Date().toISOString()},records:parseOcean(await getText(URLS.ocean))};}
export async function alerts(){
 const checkedAt=new Date().toISOString();
 const results=await Promise.allSettled([
  (async()=>{const rss=await getText(URLS.cap);if(!rss.includes('<rss'))throw new Error('Feed CAP inválido.');const links=[...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,30).map(m=>tag(m[1],'link')).filter(u=>/^https:\/\/cap-sources\.s3\.amazonaws\.com\/ec-inamhi-es\/.+\.xml$/.test(u));const responses=await Promise.allSettled(links.map(async u=>parseCAP(await getText(u),u)));const failures=responses.filter(r=>r.status==='rejected').length;return {records:responses.filter(r=>r.status==='fulfilled').map(r=>r.value),complete:failures===0,note:failures?`${failures} documentos CAP no se pudieron leer.`:''};})(),
  (async()=>{const data=JSON.parse(await getText(URLS.alerts));if(!Array.isArray(data.alerts))throw new Error('Formato de advertencias inválido.');return {records:data.alerts.map(a=>({id:a.id,kind:'bulletin',status:'Actual',msgType:'Alert',references:'',severity:a.severity,event:a.event||a.type,headline:a.headline,description:a.description,instruction:a.instruction,area:(a.provinces||a.regions||[]).join(', '),provinces:a.provinces||[],onset:a.onset,expires:a.expires,issued:a.issued,url:a.pdf||URLS.alerts})),complete:!(data.sources||[]).some(s=>s.downloaded===false||/no se encontraron|error/i.test(s.result||'')),note:(data.sources||[]).filter(s=>s.result!=='sin cambios'&&s.result).map(s=>s.result).join('; ')};})()
 ]);
 if(results.every(r=>r.status==='rejected'))throw new Error('INAMHI no respondió en CAP ni advertencias.');
 const feeds=results.map((r,i)=>({name:i===0?'CAP':'Advertencias',ok:r.status==='fulfilled',complete:r.status==='fulfilled'&&r.value.complete,note:r.status==='fulfilled'?r.value.note:r.reason.message}));
 const raw=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.records);const unique=Array.from(new Map(raw.map(a=>[a.id,a])).values());
 return {schemaVersion:1,source:{name:'INAMHI · CAP y advertencias',url:'https://servicios.inamhi.gob.ec/alertas/',retrievedAt:checkedAt},complete:feeds.every(f=>f.complete),feeds,records:unique,activeAtRetrieval:activeAlerts(unique).length};
}
export async function erfen(){
 const html=await getText(URLS.erfen);const matches=[...html.matchAll(/https:\/\/www\.inocar\.mil\.ec\/boletin\/ERFEN\/erfen_(\d{8})\.pdf/g)].map(m=>({date:`${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}`,url:m[0]})).sort((a,b)=>b.date.localeCompare(a.date));
 if(!matches.length)throw new Error('No se pudo localizar el informe ERFEN.');
 return {source:{name:'INAMHI / Comité ERFEN · INOCAR',url:URLS.erfen,retrievedAt:new Date().toISOString()},latest:matches[0],note:'Último enlace localizado en INAMHI. Es un boletín periódico; revisar su período de validez en el PDF.'};
}
export const EXPOSURE_URL='https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/POB_VIV_MM_INU_PARR_STATIS_C1500/FeatureServer/0';
export function summarizeExposure(features){
 const fields=['pob_inu_alt_med','pob_inu_alta','pob_inu_media','pob_mm_ma_alt','pob_mm_muy_alta','pob_mm_alta'];
 if(!features.length)throw new Error('La capa no devolvió parroquias.');
 const rows=features.map(f=>f.attributes);if(rows.some(r=>!r||!r.dpa_despro||fields.some(k=>r[k]!==null&&(typeof r[k]!=='number'||r[k]<0))))throw new Error('La capa contiene campos inesperados.');
 const sum=(list,field)=>{const values=list.map(r=>r[field]).filter(v=>v!==null);return values.length?values.reduce((a,b)=>a+b,0):null;};
 const coverage=Object.fromEntries(fields.map(k=>[k,rows.filter(r=>r[k]!==null).length]));
 const totals=Object.fromEntries(fields.map(k=>[k,sum(rows,k)]));
 const provinces=[...new Set(rows.map(r=>r.dpa_despro))].sort((a,b)=>a.localeCompare(b,'es')).map(province=>{const list=rows.filter(r=>r.dpa_despro===province);return {province,flood:sum(list,'pob_inu_alt_med'),landslide:sum(list,'pob_mm_ma_alt'),parishes:list.length};});
 return {totals,coverage,provinces,parishes:rows.length};
}
export async function exposure(){
 const fields='objectid,dpa_despro,pob_inu_alt_med,pob_inu_alta,pob_inu_media,pob_mm_ma_alt,pob_mm_muy_alta,pob_mm_alta';
 const query=new URLSearchParams({f:'json',where:'1=1',returnGeometry:'false',outFields:fields,orderByFields:'objectid',resultRecordCount:'2000'});
 const [meta,items,count,item]=await Promise.all([
  getText(EXPOSURE_URL+'?f=json').then(JSON.parse),
  getText(EXPOSURE_URL+'/query?'+query).then(JSON.parse),
  getText(EXPOSURE_URL+'/query?where=1%3D1&returnCountOnly=true&f=json').then(JSON.parse),
  getText('https://sgrportal.gestionderiesgos.gob.ec/portal/sharing/rest/content/items/bffe69ebfadd458c82bf377ee0768b35?f=json').then(JSON.parse)
 ]);
 for(const data of [meta,items,count])if(data.error)throw new Error(`ArcGIS: ${data.error.message}`);
 if(!Array.isArray(items.features)||items.exceededTransferLimit||items.features.length!==count.count)throw new Error('Respuesta ArcGIS incompleta. Se conserva el último respaldo.');
 const summary=summarizeExposure(items.features);const editedAt=meta.editingInfo?.lastEditDate?new Date(meta.editingInfo.lastEditDate).toISOString():item.modified?new Date(item.modified).toISOString():null;
 return {schemaVersion:1,source:{name:'SNGR · ArcGIS público',url:'https://alertasecuador.gob.ec/el_nino/zonas-expuestas/',retrievedAt:new Date().toISOString()},complete:true,note:`Análisis de exposición hasta la cota de 1.500 m: ${summary.parishes} parroquias publicadas, ${summary.provinces.length} provincias. No es un registro en tiempo real de incidentes. Se suman solo valores publicados; no se imputan nulos.`,provinces:summary.provinces,coverage:summary.coverage,layers:[
  {title:'Inundaciones',description:'Población expuesta a susceptibilidad alta y media. No sumar a movimientos en masa.',url:EXPOSURE_URL,editedAt,totals:{'Alta + media':summary.totals.pob_inu_alt_med,'Alta':summary.totals.pob_inu_alta,'Media':summary.totals.pob_inu_media},coverage:`${summary.coverage.pob_inu_alt_med}/${summary.parishes} parroquias con dato`},
  {title:'Movimientos en masa',description:'Población expuesta a susceptibilidad muy alta y alta. No equivale a población afectada.',url:EXPOSURE_URL,editedAt,totals:{'Muy alta + alta':summary.totals.pob_mm_ma_alt,'Muy alta':summary.totals.pob_mm_muy_alta,'Alta':summary.totals.pob_mm_alta},coverage:`${summary.coverage.pob_mm_ma_alt}/${summary.parishes} parroquias con dato`}
 ],serviceCatalog:[{name:'Inundaciones · polígonos',url:'https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/ZONAS_SUSCEPTIBLES_INUNDACIONES_CT1500_t/MapServer'},{name:'Movimientos en masa · polígonos',url:'https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/SUSCEPTIBILIDAD_MOV_MASAS_CT1500/FeatureServer/0'}]};
}
