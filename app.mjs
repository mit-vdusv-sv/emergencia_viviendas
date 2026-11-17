import {createSurfaces} from './src/surfaces.mjs';
import {createAutoRefresh} from './src/auto-refresh.mjs';
import {createHousingSync} from './src/housing-live.mjs';
import {readDataset,preferNewest} from './src/data-refresh.mjs';
import {aggregate,quality,filterRecords,normalize,parseHousing,exportCSV,PROVINCES,activeAlerts} from './src/model.mjs';
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':new Intl.NumberFormat('es-EC').format(n);
const signed=n=>n===null||n===undefined?'—':`${n>0?'+':''}${n.toFixed(2).replace('.',',')}`;
const date=(d,long=false)=>d?new Intl.DateTimeFormat('es-EC',{dateStyle:long?'medium':'short',...(String(d).includes('T')?{timeStyle:'short'}:{}),timeZone:'America/Guayaquil'}).format(new Date(String(d).length===10?d+'T12:00:00-05:00':d)):'Sin registrar';
const month=d=>new Intl.DateTimeFormat('es-EC',{month:'short',year:'numeric',timeZone:'America/Guayaquil'}).format(new Date(d+'-15T12:00:00-05:00'));
const icons={grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',cloud:'<path d="M7 17a5 5 0 1 1 1-10 7 7 0 0 1 13 4 4 4 0 0 1-2 6M8 20l-1 2m6-2-1 2m6-2-1 2"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',refresh:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m2 11v-3a6 6 0 0 0-3-5"/>',check:'<path d="m8 12 3 3 6-7M12 3l8 3v7c0 5-8 9-8 9s-8-4-8-9V6Z"/>',tool:'<path d="m14 6 4 4m-9 3-6 6 2 2 6-6m2-3a6 6 0 0 0 7-8l-4 4-3-3 4-4a6 6 0 0 0-6 8Z"/>',warning:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',wave:'<path d="M2 8c4-8 6 8 10 0s6 8 10 0M2 16c4-8 6 8 10 0s6 8 10 0"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',file:'<path d="M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8m-8 4h6"/>'};
function icon(name,cls=''){return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.grid}</svg>`;}
function mountIcons(){document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
const state={mapMetric:'housing',weatherSource:'exposure',view:'panorama',housing:null,alerts:null,ocean:null,erfen:null,exposure:null,geo:null,region:'',province:'',search:'',onlyAffected:false,sort:'affected',local:false,imported:false,refreshing:false,housingConnection:'connecting',sources:{}};
let toastTimer;
let autoRefresh;
let housingSync;
const externalSources=['alerts','ocean','erfen','exposure'];
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),7000);}
function store(key,value){try{localStorage.setItem('sentinela.'+key,JSON.stringify(value));return true;}catch{return false;}}
function saved(key){try{return JSON.parse(localStorage.getItem('sentinela.'+key));}catch{return null;}}
async function load(name){const local=saved(name);let bundled=null;try{bundled=await readDataset(name);}catch{}return preferNewest(local,bundled);}
const selected=()=>filterRecords(state.housing.records,{...state,search:state.view==='vivienda'?state.search:'',onlyAffected:state.view==='vivienda'?state.onlyAffected:false});
function latestOcean(){return state.ocean?.records?.at(-1);}
function filters(){return `<div class="filters"><select id="region" aria-label="Filtrar por región"><option value="">Todas las regiones</option>${['Costa','Sierra','Amazonía','Insular'].map(r=>`<option ${state.region===r?'selected':''}>${r}</option>`).join('')}</select><select id="province" aria-label="Filtrar por provincia"><option value="">Todas las provincias</option>${Object.keys(PROVINCES).filter(p=>!state.region||PROVINCES[p]===state.region).map(p=>`<option ${state.province===p?'selected':''}>${esc(p)}</option>`).join('')}</select>${(state.province||state.region||(state.view==='vivienda'&&(state.search||state.onlyAffected)))?'<button class="link-button" id="clear">Limpiar filtros</button>':''}</div>`;}
const types=[['minor','Reparación menor','yellow'],['major','Reparación mayor','yellow'],['rent','Bono de arrendamiento','red'],['tupe','TUPE','red'],['tp','TP','red']];
function sorted(records){return records.toSorted((a,b)=>state.sort==='province'?a.province.localeCompare(b.province,'es'):(b[state.sort]??-1)-(a[state.sort]??-1)||a.province.localeCompare(b.province,'es'));}
function table(records,full=false){const rows=sorted(records);const shown=full?rows:rows.slice(0,7);return `<section class="panel table-panel"><div class="panel-head"><div><h2>Reporte provincial de vivienda</h2><p>${state.province?esc(state.province):state.region||'Cobertura nacional'} · las celdas pendientes se muestran como «—»</p></div>${!full?'<a class="link-button" href="#vivienda">Ver 24 provincias ↗</a>':'<span class="tag">DETALLE DE LA FUENTE</span>'}</div><div class="table-toolbar"><label class="search-wrap">${icon('search')}<input id="search" type="search" placeholder="Buscar provincia u observación" aria-label="Buscar provincia u observación" value="${esc(state.search)}"></label><div class="filters"><select id="sort" aria-label="Orden de la tabla"><option value="affected" ${state.sort==='affected'?'selected':''}>Más hogares primero</option><option value="province" ${state.sort==='province'?'selected':''}>Provincia A–Z</option><option value="minorIdentified" ${state.sort==='minorIdentified'?'selected':''}>Reparación menor</option></select><label class="toggle"><input id="only-affected" type="checkbox" ${state.onlyAffected?'checked':''}>Solo con afectación</label></div></div><div class="table-scroll"><table><thead><tr><th>Provincia</th><th>Beneficiarios</th><th>Rep. menor</th>${full?'<th>Rep. mayor</th>':''}<th>Arrendamiento</th><th>TUPE</th><th>TP</th>${full?'<th>Rojo reportado*</th><th>Total A+R*</th><th>Observaciones</th>':''}<th>Calificación</th></tr></thead><tbody>${shown.map(r=>`<tr><td><button class="province-button" data-detail="${esc(r.province)}"><i class="row-dot ${(r.affected??0)>0?'has-data':''}"></i>${esc(r.province)}</button></td><td class="number">${fmt(r.affected)}<div class="mini-bar"><i style="width:${(r.affected??0)/Math.max(1,...state.housing.records.map(r=>r.affected??0))*100}%"></i></div></td><td class="number">${fmt(r.minorIdentified)}</td>${full?`<td class="number">${fmt(r.majorIdentified)}</td>`:''}<td class="number">${fmt(r.rentIdentified)}</td><td class="number">${fmt(r.tupeIdentified)}</td><td class="number">${fmt(r.tpIdentified)}</td>${full?`<td class="number">${fmt(r.redUniqueReported)}</td><td class="number">${fmt(r.combinedReported)}</td><td class="note-cell" title="${esc(r.observations)}">${esc(r.observations)||'—'}</td>`:''}<td><span class="pill gray">${types.some(([k])=>r[k+'Qualified']!==null)?'Ver detalle':'Sin dato'}</span></td></tr>`).join('')}</tbody></table>${!rows.length?'<div class="table-empty">No hay provincias que coincidan con estos filtros.</div>':''}</div><div class="table-foot"><span>${shown.length} de ${rows.length} provincias del filtro</span><span>${full?'*Totales reportados por la fuente, sujetos a conciliación.':'Selecciona una provincia para ver el detalle.'}</span></div></section>`;}
function lineChart(){const rows=state.ocean?.records?.slice(-12)||[];if(!rows.length)return '<p class="info-block">No hay observaciones disponibles.</p>';const W=620,H=250,left=45,right=30,top=20,bottom=35;const min=Math.floor(Math.min(0,...rows.flatMap(r=>[r.nino12,r.nino34]))),max=Math.ceil(Math.max(1,...rows.flatMap(r=>[r.nino12,r.nino34])));const x=i=>left+i*(W-left-right)/(rows.length-1||1),y=v=>H-bottom-(v-min)*(H-top-bottom)/(max-min);const ticks=Array.from({length:max-min+1},(_,i)=>min+i);const path=k=>rows.map((r,i)=>`${i?'L':'M'}${x(i)},${y(r[k])}`).join(' ');return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Anomalías mensuales Niño 1+2 y Niño 3.4 en grados Celsius">${ticks.map(t=>`<line x1="${left}" y1="${y(t)}" x2="${W-right}" y2="${y(t)}" stroke="${t===0?'#afbed3':'#e7edf5'}" ${t===0?'stroke-dasharray="4 4"':''}/><text x="${left-12}" y="${y(t)+3}" text-anchor="end" font-size="9" fill="#8fa0b7">${t}°</text>`).join('')}${rows.map((r,i)=>i%2===0||i===rows.length-1?`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="9" fill="#8fa0b7">${esc(month(r.month))}</text>`:'').join('')}<path d="${path('nino12')}" fill="none" stroke="#C49A15" stroke-width="2.5"/><path d="${path('nino34')}" fill="none" stroke="#1B4F89" stroke-width="2.5"/>${rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.nino12)}" r="3" fill="#C49A15"><title>${month(r.month)} · Niño 1+2: ${signed(r.nino12)} °C</title></circle><circle cx="${x(i)}" cy="${y(r.nino34)}" r="3" fill="#1B4F89"><title>${month(r.month)} · Niño 3.4: ${signed(r.nino34)} °C</title></circle>`).join('')}</svg>`;}
const surfaces=createSurfaces({state,esc,fmt,date,month,signed,icon,selected,filters,lineChart,table});
function renderConnection(){
 const label=$('#connection-label');
 label.textContent=state.imported?'CSV propio':state.housingConnection==='live'?'Sheets · directo':state.housingConnection==='error'?'Vivienda · respaldo':'Conectando Sheets';
 label.title=state.imported?'La base importada se conserva hasta volver a Google Sheets.':state.housingConnection==='live'?'Lectura directa de Google Sheets cada 3 segundos con la pestaña visible. Última comprobación: '+new Intl.DateTimeFormat('es-EC',{timeStyle:'medium',timeZone:'America/Guayaquil'}).format(new Date(state.housing.source.retrievedAt)):state.housingConnection==='error'?'Google Sheets no respondió. Se conserva la última copia válida y se reintenta automáticamente.':'Consultando Google Sheets directamente. Las fuentes institucionales se revisan por separado cada cinco minutos.';
 const climate=state.view==='clima';const source=climate?state.alerts?.source:state.housing?.source;
 const origin=climate?'INAMHI':state.imported?'CSV propio':state.housingConnection==='live'?'Google Sheets':'Vivienda · respaldo';
 $('#source-strip').innerHTML='<span><i class="live-dot"></i><b>'+esc(origin)+'</b> · '+(climate||state.housingConnection!=='live'?'copia del ':'consulta ')+date(source?.retrievedAt)+'</span>';
}
function render(){
 if(!state.housing)return;
 state.view=['panorama','vivienda','clima','fuentes'].includes(location.hash.slice(1))?location.hash.slice(1):'panorama';
 const names={panorama:['Resumen','Emergencias de vivienda','Beneficiarios pre calificados y atención por provincia.'],vivienda:['Vivienda','Afectación de viviendas','Beneficiarios pre calificados por provincia.'],clima:['Clima','Alertas y clima','Selecciona un aviso para ver su detalle.'],fuentes:['Datos y fuentes','Datos y fuentes','Copias disponibles y procedencia de la información.']};
 const [nav,title,subtitle]=names[state.view];document.title=nav+' · Atención Fenomeno del Niño';
 $('#breadcrumb-current').textContent=nav;$('#page-title').textContent=title;$('#page-subtitle').textContent=subtitle;
 $('#export').hidden=state.view!=='vivienda';
 document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.view===state.view);if(a.dataset.view===state.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 renderConnection();
 $('#view').innerHTML=state.view==='panorama'?surfaces.overview():state.view==='vivienda'?surfaces.housingView():state.view==='clima'?surfaces.climateView():surfaces.sourcesView();
 bindView();mountIcons();
}
function bindView(){
 document.querySelectorAll('[data-map-mode]').forEach(button=>button.addEventListener('click',()=>{state.mapMetric=button.dataset.mapMode;render();}));
 document.querySelectorAll('[data-weather-source]').forEach(button=>button.addEventListener('click',()=>{state.weatherSource=button.dataset.weatherSource;render();}));
 document.querySelectorAll('[data-status-route]').forEach(button=>button.addEventListener('click',()=>{location.hash=button.dataset.statusRoute;}));
 document.querySelectorAll('[data-alert-group]').forEach(button=>button.addEventListener('click',()=>alertDetail(Number(button.dataset.alertGroup))));
 $('#region')?.addEventListener('change',e=>{state.region=e.target.value;state.province='';render();});$('#province')?.addEventListener('change',e=>{state.province=e.target.value;render();});$('#clear')?.addEventListener('click',()=>{Object.assign(state,{region:'',province:'',search:'',onlyAffected:false});render();});
 $('#search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.search=e.target.value;render();$('#search')?.focus();$('#search')?.setSelectionRange(pos,pos);});$('#only-affected')?.addEventListener('change',e=>{state.onlyAffected=e.target.checked;render();});$('#sort')?.addEventListener('change',e=>{state.sort=e.target.value;render();});
 document.querySelectorAll('[data-province]').forEach(p=>{const select=()=>{state.province=state.province===p.dataset.province?'':p.dataset.province;if(state.province&&state.region&&PROVINCES[state.province]!==state.region)state.region='';render();};p.addEventListener('click',select);p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});});
 document.querySelectorAll('[data-exposure-detail]').forEach(b=>b.addEventListener('click',()=>exposureDetail(b.dataset.exposureDetail)));
 document.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>detail(b.dataset.detail)));$('#import')?.addEventListener('click',()=>$('#import-file').click());$('#template')?.addEventListener('click',()=>download(exportCSV(Object.keys(PROVINCES).map(province=>({province,observations:'',...Object.fromEntries(['affected',...types.flatMap(([k])=>[k+'Identified',k+'Qualified']),'redUniqueReported','combinedReported'].map(f=>[f,null]))}))),'sentinela-plantilla.csv'));$('#restore')?.addEventListener('click',restore);
}
function detail(province){const r=state.housing.records.find(r=>r.province===province);if(!r)return;$('#dialog-content').innerHTML=`<div class="eyebrow">REPORTE PROVINCIAL · ${esc(r.region)}</div><h2>${esc(r.province)}</h2><p><b>${fmt(r.affected)} beneficiarios pre calificados</b> · corte ${esc(state.housing.source.reportDate||'sin registrar')}</p><table><thead><tr><th>Modalidad</th><th>Identificados</th><th>Calificados</th></tr></thead><tbody>${types.map(([key,label])=>`<tr><td>${label}</td><td>${fmt(r[key+'Identified'])}</td><td>${fmt(r[key+'Qualified'])}</td></tr>`).join('')}</tbody></table><p>Rojo reportado: <b>${fmt(r.redUniqueReported)}</b>. Total amarillo y rojo reportado: <b>${fmt(r.combinedReported)}</b>. Sujetos a conciliación; no se suman a los beneficiarios pre calificados.</p><div class="dialog-notes"><h3>Observación de la fuente</h3><p>${esc(r.observations)||'Sin observaciones registradas.'}</p></div><p class="small">«—» indica información pendiente. Un 0 es un valor registrado.</p>`;$('#detail-dialog').showModal();}
function download(content,name){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function restore(){state.imported=false;localStorage.removeItem('sentinela.imported');state.housingConnection='connecting';renderConnection();await refreshHousing(false);}
async function refreshHousing(silent=true){
 if(!housingSync)return {skipped:true};
 const result=await housingSync.refresh();
 if(!silent)toast(result.skipped?'Se conserva el CSV importado.':result.ok?'Google Sheets consultado directamente.':'Google Sheets no respondió. Se conserva el respaldo.');
 return result;
}
async function checkServer(){
 try{const response=await fetch('api/status',{cache:'no-store',signal:AbortSignal.timeout(3000)});state.local=response.ok&&(await response.json()).local===true;}catch{state.local=false;}
 return state.local;
}
async function refresh(names=externalSources,silent=false){
 if(state.refreshing)return;
 state.refreshing=true;$('#refresh').disabled=true;
 await checkServer();
 $('#refresh [data-icon]')?.classList.add('spin');
 let success=0,failed=0;
 await Promise.all(names.map(async name=>{
  try{const data=await readDataset(name,{local:state.local});
   state[name]=state.local?data:preferNewest(state[name],data);state.sources[name]=state.local?'live':'snapshot';store(name,state[name]);success++;
  }catch{state.sources[name]='error';failed++;}
 }));
 state.refreshing=false;$('#refresh').disabled=false;$('#refresh [data-icon]')?.classList.remove('spin');render();
 if(!silent||failed)toast(success+(state.local?' fuentes institucionales consultadas.':' copias institucionales revisadas.')+(failed?' '+failed+' sin respuesta: se conserva el respaldo.':''));
}
$('#refresh').addEventListener('click',()=>Promise.all([refreshHousing(false),refresh()]));$('#export').addEventListener('click',()=>download(exportCSV(selected()),`sentinela-vivienda-${new Date().toLocaleDateString('en-CA',{timeZone:'America/Guayaquil'})}.csv`));$('#dialog-close').addEventListener('click',()=>$('#detail-dialog').close());$('#detail-dialog').addEventListener('click',e=>{if(e.target===$('#detail-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5e6)throw new Error('El archivo supera 5 MB.');const data=parseHousing(await file.text(),{name:`CSV local · ${file.name}`,sourceUrl:'',retrievedAt:new Date().toISOString()});state.housing=data;state.imported=true;const persisted=store('imported',data);render();toast(persisted?'CSV validado: 24 provincias. Guardado en este navegador.':'CSV cargado en esta sesión. El navegador no permitió guardarlo.');}catch(err){toast(err.message);}e.target.value='';});
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0});});
async function init(){
 mountIcons();$('#today').textContent=new Intl.DateTimeFormat('es-EC',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Guayaquil'}).format(new Date());
 await Promise.all(['housing','alerts','ocean','erfen','exposure'].map(async name=>{state[name]=await load(name);state.sources[name]='snapshot';}));
 const imported=saved('imported');if(imported?.records?.length===24){state.housing=imported;state.imported=true;}
 try{const response=await fetch('data/provincias.geojson');state.geo=await response.json();}catch{state.geo={features:[]};}
 housingSync=createHousingSync({getCurrent:()=>state.housing,isImported:()=>state.imported,onData:(data,{changed})=>{
  const wasLive=state.sources.housing==='live';state.housing=data;state.sources.housing='live';state.housingConnection='live';
  if(changed||!wasLive)store('housing',data);
  if(changed||!wasLive)render();else renderConnection();
 },onStatus:status=>{
  const changed=state.housingConnection!==status;state.housingConnection=status;
  if(status==='error')state.sources.housing='error';
  if(state.housing){if(changed&&state.view==='fuentes')render();else renderConnection();}
 }});
 if(state.housing)render();else $('#view').innerHTML='<div class="info-block">Conectando con Google Sheets…</div>';
 if(!document.hidden)housingSync.start({immediate:true});
 autoRefresh=createAutoRefresh({run:()=>refresh(state.local?['alerts']:externalSources,true),onError:()=>{state.refreshing=false;render();}});
 autoRefresh.start();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)housingSync.stop();else{housingSync.start({immediate:true});refreshHousing();render();autoRefresh.wake();}});
 window.addEventListener('focus',()=>{if(!document.hidden)refreshHousing();});
 window.addEventListener('online',()=>{refreshHousing();autoRefresh.trigger();});
 window.addEventListener('pageshow',()=>{if(!document.hidden)refreshHousing();autoRefresh.wake();});
 void refresh(undefined,true);
}
icons.mountain='<path d="m2 21 8-17 4 9 2-4 6 12H2Z"/>';
function alertDetail(index){
 const group=surfaces.alertGroups()[index];if(!group)return;
 const latest=group.messages.toSorted((a,b)=>Date.parse(b.issued)-Date.parse(a.issued))[0];
 $('#dialog-content').innerHTML='<div class="eyebrow">INAMHI · AVISO METEOROLÓGICO</div><h2>'+esc(surfaces.displayName(group.area))+'</h2><p><b>'+esc(group.event)+'</b></p><p>Vigente hasta '+date(group.expires)+'</p><div class="dialog-section"><h3>Qué se prevé</h3><p>'+esc(latest.description||'Consulta el mensaje original.')+'</p></div><details class="explain"><summary>Recomendaciones del emisor</summary><p class="preserve-lines">'+esc(latest.instruction||'Sin indicaciones adicionales.')+'</p></details><details class="explain"><summary>'+group.messages.length+' mensajes originales de esta zona</summary><p>La tarjeta muestra la severidad máxima publicada para la misma zona, fenómeno y expiración.</p>'+group.messages.map(message=>'<p>'+esc(message.severity)+' · '+date(message.issued)+' <a href="'+esc(message.url)+'" target="_blank" rel="noopener noreferrer">Abrir CAP ↗</a></p>').join('')+'</details>';
 $('#detail-dialog').showModal();
}
init();

function exposureDetail(province){const r=state.exposure?.provinces?.find(p=>normalize(p.province)===normalize(province));$('#dialog-content').innerHTML=`<div class="eyebrow">SNGR · EXPOSICIÓN POTENCIAL</div><h2>${esc(province)}</h2><p>Análisis de exposición hasta 1.500 m. Los valores no equivalen a personas afectadas.</p><table><thead><tr><th>Amenaza</th><th>Personas estimadas</th></tr></thead><tbody><tr><td>Inundaciones · alta + media</td><td>${fmt(r?.flood)}</td></tr><tr><td>Movimientos en masa · muy alta + alta</td><td>${fmt(r?.landslide)}</td></tr></tbody></table><p>${r?r.parishes+' parroquias publicadas en esta provincia.':'Provincia sin cobertura en la capa disponible.'} No se suman las dos amenazas.</p><p>Consulta del servicio: ${date(state.exposure?.source.retrievedAt)}.</p><a class="link-button" target="_blank" rel="noopener noreferrer" href="https://alertasecuador.gob.ec/el_nino/zonas-expuestas/">Consultar fuente oficial ↗</a>`;$('#detail-dialog').showModal();}
