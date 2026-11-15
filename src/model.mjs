export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1WoxZ11c5MAoZ6nhcRymTvVK6GkV6kBOG/edit?gid=1128467625';
export const CSV_URL = 'https://docs.google.com/spreadsheets/d/1WoxZ11c5MAoZ6nhcRymTvVK6GkV6kBOG/export?format=csv&gid=1128467625';
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const PROVINCES = {
  'Azuay':'Sierra', 'Bolívar':'Sierra', 'Cañar':'Sierra', 'Carchi':'Sierra', 'Chimborazo':'Sierra', 'Cotopaxi':'Sierra',
  'El Oro':'Costa', 'Esmeraldas':'Costa', 'Galápagos':'Insular', 'Guayas':'Costa', 'Imbabura':'Sierra', 'Loja':'Sierra',
  'Los Ríos':'Costa', 'Manabí':'Costa', 'Morona Santiago':'Amazonía', 'Napo':'Amazonía', 'Orellana':'Amazonía',
  'Pastaza':'Amazonía', 'Pichincha':'Sierra', 'Santa Elena':'Costa', 'Santo Domingo de los Tsáchilas':'Costa',
  'Sucumbíos':'Amazonía', 'Tungurahua':'Sierra', 'Zamora Chinchipe':'Amazonía'
};
export const FIELDS = ['affected','minorIdentified','minorQualified','majorIdentified','majorQualified','rentIdentified','rentQualified','tupeIdentified','tupeQualified','tpIdentified','tpQualified','redUniqueReported','combinedReported'];
export const CANONICAL_HEADERS = ['provincia',...FIELDS,'observaciones'];
export function parseCSV(text) {
  const rows=[]; let row=[], value='', quoted=false;
  text=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(!quoted&&value!==''){throw new Error('Comillas inválidas en el CSV.');}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(value);value='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++; row.push(value);rows.push(row);row=[];value='';}
    else value+=ch;
  }
  if(quoted)throw new Error('El CSV tiene comillas sin cerrar.');
  if(value||row.length){row.push(value);rows.push(row);}
  return rows;
}
function count(value, label) {
  if(value===undefined||String(value).trim()==='')return null;
  if(!/^\d+$/.test(String(value).trim()))throw new Error(`Valor inválido en ${label}: se requiere un entero no negativo o una celda vacía.`);
  const number=Number(value);if(!Number.isSafeInteger(number))throw new Error(`Valor demasiado grande en ${label}.`);return number;
}
export function parseHousing(text,{name='Google Sheets',retrievedAt=new Date().toISOString(),sourceUrl=SHEET_URL}={}) {
  const rows=parseCSV(text); const canonical=normalize(rows[0]?.[0])==='provincia'&&rows[0]?.[1]==='affected';
  if(canonical&&CANONICAL_HEADERS.some((h,i)=>rows[0][i]!==h))throw new Error('Las columnas del CSV no corresponden a la plantilla.');
  if(!canonical){
    const header=rows.find(r=>normalize(r[0])==='provincia');
    if(!header||!normalize(header[1]).includes('hogares')||normalize(header[2])!=='amarillo'||normalize(header[6])!=='rojo')throw new Error('La estructura de la hoja cambió. Usa la plantilla CSV o revisa las columnas originales.');
  }
  const records=[]; const seen=new Set();const lookup=new Map(Object.keys(PROVINCES).map(p=>[normalize(p),p]));
  for(const row of rows.slice(canonical?1:0)) {
    const province=lookup.get(normalize(row[0]));
    if(!province){if(canonical&&row.some(c=>c.trim()))throw new Error(`Provincia desconocida: ${row[0]}`);continue;}
    if(seen.has(province))throw new Error(`Provincia duplicada: ${province}`);seen.add(province);
    const record={province,region:PROVINCES[province]};
    FIELDS.forEach((field,i)=>record[field]=count(row[i+1],`${province}, ${field}`));record.observations=row[14]?.trim()||'';records.push(record);
  }
  if(records.length!==24)throw new Error(`Se esperaban las 24 provincias; se recibieron ${records.length}.`);
  const cutRow=rows.find(r=>normalize(r[0])==='fecha de corte');
  const sourceTotals=rows.find(r=>normalize(r[0])==='total nacional');
  return {schemaVersion:1,source:{name,url:sourceUrl,retrievedAt,reportDate:cutRow?.slice(1).find(c=>c.trim())||null},reportedTotals:sourceTotals?Object.fromEntries(FIELDS.map((f,i)=>[f,count(sourceTotals[i+1],`total ${f}`)])):null,records};
}
export function aggregate(records,field){const values=records.map(r=>r[field]).filter(v=>v!==null&&v!==undefined);return {value:values.length?values.reduce((a,b)=>a+b,0):null,known:values.length,total:records.length};}
export function quality(data){
  const issues=[]; const {records}=data;const total=aggregate(records,'affected').value;
  if(!data.source.reportDate)issues.push({level:'warning',title:'Fecha de corte sin registrar',detail:'La fecha de consulta no indica cuándo ocurrieron las afectaciones. Completa la fecha en la fuente.'});
  const combined=aggregate(records,'combinedReported');
  if(combined.known<24)issues.push({level:'warning',title:`${24-combined.known} provincias sin total amarillo y rojo`,detail:'Los totales provinciales de la columna N están vacíos. No se interpretan como cero.'});
  const reported=data.reportedTotals?.combinedReported;
  if(reported!==null&&reported!==undefined&&total!==null&&reported!==total)issues.push({level:'error',title:`${reported} en el resumen frente a ${total} hogares`,detail:`Hay una diferencia de ${reported-total}. El total de hogares usa la columna B; el resumen amarillo y rojo no se suma a ese total.`});
  for(const r of records){
    const red=[r.rentIdentified,r.tupeIdentified,r.tpIdentified].filter(v=>v!==null);
    const yellow=[r.minorIdentified,r.majorIdentified].filter(v=>v!==null);
    if((r.redUniqueReported!==null&&r.affected!==null&&r.redUniqueReported>r.affected)|| (red.length>1&&r.redUniqueReported===red.reduce((a,b)=>a+b,0)&&r.redUniqueReported>Math.max(...red)))issues.push({level:'warning',title:`${r.province}: revisar casos únicos en rojo`,detail:`La hoja reporta ${r.redUniqueReported} en rojo. Arrendamiento, TUPE y TP pueden corresponder al mismo hogar; no es posible deduplicarlos con estos agregados.`});
    if(r.affected!==null&&r.redUniqueReported!==null&&yellow.length&&Math.max(...yellow)+r.redUniqueReported>r.affected)issues.push({level:'warning',title:`${r.province}: categorías exceden hogares`,detail:'Las categorías amarillo y rojo requieren conciliación con el total de hogares.'});
    for(const base of ['minor','major','rent','tupe','tp'])if(r[base+'Qualified']!==null&&(r[base+'Identified']===null||r[base+'Qualified']>r[base+'Identified']))issues.push({level:'error',title:`${r.province}: calificados sin sustento`,detail:`Revisar ${base}: los calificados deben formar parte de los identificados.`});
  }
  if(records.every(r=>['minor','major','rent','tupe','tp'].every(b=>r[b+'Qualified']===null)))issues.push({level:'warning',title:'Calificación pendiente de información',detail:'Todas las celdas de calificados están vacías. No se puede calcular una tasa de avance ni hogares pendientes de calificar.'});
  for(const f of FIELDS){const a=aggregate(records,f);const n=data.reportedTotals?.[f];if(n!==null&&n!==undefined&&a.known===24&&n!==a.value)issues.push({level:'error',title:`Total nacional no coincide: ${f}`,detail:`La suma provincial es ${a.value} y el resumen indica ${n}.`});}
  return issues;
}
export function filterRecords(records,{region='',province='',search='',onlyAffected=false}={}){return records.filter(r=>(!region||r.region===region)&&(!province||r.province===province)&&(!search||normalize(r.province+' '+r.observations).includes(normalize(search)))&&(!onlyAffected||(r.affected??0)>0));}
function safeCSV(value){let s=value===null||value===undefined?'':String(value);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function exportCSV(records){return '\uFEFF'+[CANONICAL_HEADERS,...records.map(r=>[r.province,...FIELDS.map(f=>r[f]),r.observations])].map(row=>row.map(safeCSV).join(',')).join('\r\n');}
export function parseOcean(text){
  if(!text.includes('NINO1+2')||!text.includes('NINO3.4'))throw new Error('Formato NOAA no reconocido.');
  const records=text.trim().split(/\r?\n/).slice(1).map(line=>line.trim().split(/\s+/).map(Number)).filter(r=>r.length===10&&r.every(Number.isFinite)&&r[1]>=1&&r[1]<=12&&r.slice(2).every(n=>Math.abs(n)<99)).map(r=>({month:`${r[0]}-${String(r[1]).padStart(2,'0')}`,nino12:r[3],nino34:r[9]}));
  if(!records.length)throw new Error('NOAA no devolvió observaciones válidas.');return records.slice(-24);
}
export function activeAlerts(alerts,now=Date.now()){
  const retired=new Set(alerts.flatMap(a=>(a.references||'').split(/\s+/).map(s=>s.split(',')[1]).filter(Boolean)));
  return alerts.filter(a=>a.status==='Actual'&&a.msgType!=='Cancel'&&!retired.has(a.id)&&Number.isFinite(Date.parse(a.expires))&&Date.parse(a.expires)>now&&(!a.onset||Date.parse(a.onset)<=now));
}
