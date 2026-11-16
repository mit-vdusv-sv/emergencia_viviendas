/**
 * Símbolos territoriales del mapa.
 * - 'alerts': SOLO avisos vigentes del INAMHI que nombran expresamente provincias.
 * - 'exposure': exposición publicada por SNGR, NUNCA clima/incidentes actuales.
 * Los SVG son decorativos; el mapa provincial mantiene la interacción original.
 */
import {activeAlerts,normalize,PROVINCES} from './model.mjs';

const PROVINCE_NAMES=Object.keys(PROVINCES);
const SEVERITY={Extreme:4,Severe:3,Moderate:2,Minor:1,Unknown:0};
const RAIN=/\b(lluvia|lluvias|lluvioso|lluviosas|tormenta|tormentas|precipitacion|precipitaciones|inundacion|inundaciones)\b/;
const LANDSLIDE=/\b(deslizamiento|deslizamientos|movimiento en masa|movimientos en masa|derrumbe|derrumbes|aluvion|aluviones|desprendimiento de rocas|desprendimientos de rocas)\b/;

/** No expandir áreas regionales genéricas a 24 provincias. */
export function namedProvinces(alert){
 const names=Array.isArray(alert.provinces)&&alert.provinces.length
  ?alert.provinces.join(', '):String(alert.area||'');
 const area=` ${normalize(names).replace(/[^a-z0-9]+/g,' ')} `;
 return PROVINCE_NAMES.filter(name=>area.includes(` ${normalize(name)} `));
}

export function getMapHazards({alerts,exposure,mode='exposure',mapMetric='housing',now=Date.now()}={}){
 const provinces=new Map();
 if(mode==='alerts'){
  for(const a of activeAlerts(alerts?.records||[],now)){
   const phenomenon=normalize(`${a.event||''} ${a.headline||''}`);
   const rain=RAIN.test(phenomenon),landslide=LANDSLIDE.test(phenomenon);
   if(!rain&&!landslide)continue;
   for(const name of namedProvinces(a)){
    const current=provinces.get(name)||{province:name,rain:false,landslide:false,source:'alerts',severity:0};
    current.rain||=rain;current.landslide||=landslide;
    current.severity=Math.max(current.severity,SEVERITY[a.severity]||0);
    provinces.set(name,current);
   }
  }
 }else if(mode==='exposure'){
  for(const record of exposure?.provinces||[]){
   const name=PROVINCE_NAMES.find(p=>normalize(p)===normalize(record.province));
   if(!name)continue;
   const rain=Number.isFinite(record.flood)&&record.flood>0;
   const landslide=Number.isFinite(record.landslide)&&record.landslide>0;
   if(rain||landslide)provinces.set(name,{province:name,rain,landslide,source:'exposure'});
  }
 }
 return [...provinces.values()].map(item=>({
  ...item,
  rain:item.rain&&mapMetric!=='landslide',
  landslide:item.landslide&&mapMetric!=='flood',
 })).filter(item=>item.rain||item.landslide);
}

/** Puntos interiores de la geometría provincial del GeoJSON incluido en este proyecto.
 * Longitud/latitud; Galápagos utiliza la misma transformación del recuadro.
 */
export const PROVINCE_ANCHORS={
 'Azuay':[-79.211,-3.093], 'Bolívar':[-79.061,-1.671], 'Carchi':[-77.977,0.778],
 'Cañar':[-78.978,-2.539], 'Chimborazo':[-78.754,-1.989], 'Cotopaxi':[-78.793,-0.778],
 'El Oro':[-79.836,-3.471], 'Esmeraldas':[-79.309,0.750], 'Galápagos':[-90.362,-0.630],
 'Guayas':[-79.924,-1.949], 'Imbabura':[-78.331,0.506], 'Loja':[-79.796,-4.042],
 'Los Ríos':[-79.541,-1.342], 'Manabí':[-80.059,-0.789],
 'Morona Santiago':[-77.737,-2.516], 'Napo':[-77.947,-0.598],
 'Orellana':[-76.216,-0.801], 'Pastaza':[-76.814,-1.799],
 'Pichincha':[-78.505,-0.191], 'Santa Elena':[-80.522,-2.086],
 'Santo Domingo de los Tsáchilas':[-79.092,-0.286], 'Sucumbíos':[-76.674,0.010],
 'Tungurahua':[-78.507,-1.249], 'Zamora Chinchipe':[-78.848,-4.178],
};

function weatherIcon(){
 return `<g class="weather-rain-icon">
  <g class="weather-bob"><path d="M4.1 11.5C1.7 11.5 1.5 8.6 2.8 7.1c.9-1 2.1-1.4 3.2-1.2C7 3.4 9 2.8 11.3 3.5c1.7.5 2.8 2 3 3.6 3.6-.2 4.9 4.7 1 5.3H4.1Z" fill="#fafdff" stroke="#4a789f" stroke-width="1.05" stroke-linejoin="round"/><path d="M5 5.7c1-2.5 3.4-3.9 6.2-3.1" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/></g>
  <path class="weather-rain-drop rain-a" d="m6.4 14-1.1 3.5"/>
  <path class="weather-rain-drop rain-b" d="m10.5 13.9-1.2 3.8"/>
  <path class="weather-rain-drop rain-c" d="m14.4 14-1.1 3.4"/>
 </g>`;
}
function rockIcon(){
 return `<g class="weather-rock-icon">
  <path d="M2 17.8 8.2 12l4.3 5.8Z" fill="#cfb593" stroke="#94785f" stroke-width=".8"/>
  <path class="weather-rock rock-a" d="m7.9 3.5 2.3 1 0.2 2.1-2.6 1.2-2-1.6.4-1.8Z" fill="#907158" stroke="#6c5145" stroke-width=".65"/>
  <path class="weather-rock rock-b" d="m13.5 6.1 2.8 1.3-.3 2.9-2.7 1-1.8-2Z" fill="#ac8967" stroke="#705849" stroke-width=".65"/>
  <path class="weather-rock rock-c" d="m16.9 11.9 2.4 1.1-.3 2.3-2.5.7-1.2-2Z" fill="#81624e" stroke="#664d3d" stroke-width=".65"/>
 </g>`;
}
export function renderMapHazardMarker(item,project,escapeText=x=>String(x)){
 const anchor=PROVINCE_ANCHORS[item.province];if(!anchor)return '';
 const [x,y]=project(anchor,item.province==='Galápagos');
 const double=item.rain&&item.landslide;
 const width=double?31:20;
 const title=item.source==='exposure'
   ?`${item.province}: zona de exposición a ${item.rain?'inundaciones':''}${double?' y ':''}${item.landslide?'movimientos en masa':''}. No indica un evento actual.`
   :`${item.province}: aviso vigente INAMHI sobre ${item.rain?'lluvias':''}${double?' y ':''}${item.landslide?'movimientos en masa':''}.`;
 return `<g class="map-hazard-marker${double?' double':''}" data-hazard-province="${escapeText(item.province)}" transform="translate(${(x-width/2).toFixed(1)} ${(y-10).toFixed(1)})" aria-label="${escapeText(title)}"><title>${escapeText(title)}</title>${item.rain?`<g transform="translate(${double?-1:1} 0)">${weatherIcon()}</g>`:''}${item.landslide?`<g transform="translate(${double?13:0} 0)">${rockIcon()}</g>`:''}</g>`;
}
