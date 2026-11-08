// Avisos oficiais repassados de fontes públicas: terremotos já ocorridos (USGS), clima espacial (NOAA SWPC) e desastres (GDACS).
// O MagneTerra NÃO gera alertas próprios nem prevê terremotos/erupções: apenas exibe o que as agências publicaram.
export const ALERT_SOURCES={
 usgs:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
 swpc:'https://services.swpc.noaa.gov/products/alerts.json',
 gdacs:'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,WF&alertlevel=Orange;Red',
 kpForecast:'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
};
export const OFFICIAL_LINKS={usgs:'https://earthquake.usgs.gov/earthquakes/map/',swpc:'https://www.swpc.noaa.gov/products/alerts-watches-and-warnings',gdacs:'https://www.gdacs.org/',inmet:'https://alertas2.inmet.gov.br/'};
const DAY=86400000,TYPES={EQ:'Terremoto',TC:'Ciclone tropical',FL:'Enchente',VO:'Vulcão',WF:'Incêndio florestal',DR:'Seca'};
const utc=s=>Date.parse(/Z$|[+-]\d\d:\d\d$/.test(s)?s:String(s).replace(' ','T')+'Z');
// Só aceita links https (os textos vêm de fontes externas e nunca viram HTML).
export const safeUrl=u=>typeof u==='string'&&/^https:\/\//.test(u)?u:null;

export function parseUsgs(j,now=Date.now()){
 if(!Array.isArray(j?.features))throw Error('Formato USGS inválido');
 return j.features.map(f=>({id:f.id,mag:f.properties?.mag,place:f.properties?.place??'local não informado',time:f.properties?.time,lat:f.geometry?.coordinates?.[1],lon:f.geometry?.coordinates?.[0],depth:f.geometry?.coordinates?.[2],url:safeUrl(f.properties?.url),tsunami:f.properties?.tsunami===1,alert:f.properties?.alert??null}))
  .filter(q=>Number.isFinite(q.mag)&&Number.isFinite(q.time)&&now-q.time<=DAY+3600000&&q.time<=now+3600000).sort((a,b)=>b.mag-a.mag);
}
const KINDS=/^(CONTINUED ALERT|EXTENDED WARNING|ALERT|WATCH|WARNING|SUMMARY)\s*:\s*(.*)$/m;
export function parseSwpc(arr,now=Date.now()){
 if(!Array.isArray(arr))throw Error('Formato SWPC inválido');
 return arr.map(a=>{const t=utc(a.issue_datetime),m=String(a.message??''),k=m.match(KINDS),sc=m.match(/NOAA Scale:\s*([GSR]\d)\b/i);return {time:t,code:(m.match(/Message Code:\s*(\w+)/)||[])[1]??null,kind:k?k[1]:null,text:k?k[2].trim():m.split(/\r?\n/).find(l=>l.trim()&&!/Message Code|Serial|Issue Time/.test(l))?.trim()??'',scale:sc?sc[1].toUpperCase():null};})
  .filter(a=>Number.isFinite(a.time)&&now-a.time<=3*DAY&&a.time<=now+3600000&&a.text).sort((a,b)=>b.time-a.time).slice(0,10);
}
export function parseGdacs(j,now=Date.now()){
 if(!Array.isArray(j?.features))throw Error('Formato GDACS inválido');
 const rank={Red:2,Orange:1};
 return j.features.map(f=>{const p=f.properties??{},c=f.geometry?.type==='Point'?f.geometry.coordinates:[];return {type:TYPES[p.eventtype]??p.eventtype,level:p.alertlevel,name:String(p.name??p.eventname??'').slice(0,160),country:p.country??'',from:p.fromdate?utc(p.fromdate):null,to:p.todate?utc(p.todate):null,current:p.iscurrent===true||p.iscurrent==='true',lat:c[1]??null,lon:c[0]??null,url:safeUrl(p.url?.report)};})
  .filter(e=>rank[e.level]&&(e.current||(e.to!==null&&now-e.to<=7*DAY))).sort((a,b)=>rank[b.level]-rank[a.level]||(b.from??0)-(a.from??0)).slice(0,12);
}
// Previsão de Kp (NOAA SWPC): só intervalos futuros marcados como previstos.
export function parseKpForecast(arr,now=Date.now()){
 if(!Array.isArray(arr))throw Error('Formato da previsão de Kp inválido');
 const rows=arr.filter(r=>r&&r.observed==='predicted').map(r=>({time:utc(r.time_tag),kp:Number(r.kp),scale:r.noaa_scale??null})).filter(r=>Number.isFinite(r.time)&&Number.isFinite(r.kp)&&r.kp>=0&&r.kp<=9&&r.time>now).sort((a,b)=>a.time-b.time);
 if(!rows.length)return null;
 const top=rows.reduce((m,r)=>r.kp>m.kp?r:m,rows[0]);
 return {rows,max:top.kp,maxTime:top.time,hours:Math.round((rows.at(-1).time-now)/3600000)};
}
export async function collectAlerts(now=Date.now(),fetcher=fetch){
 const get=async u=>{const r=await fetcher(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
 const [u,s,g,k]=await Promise.allSettled([get(ALERT_SOURCES.usgs),get(ALERT_SOURCES.swpc),get(ALERT_SOURCES.gdacs),get(ALERT_SOURCES.kpForecast)]);
 const errors=[],pick=(r,name,fn)=>{if(r.status==='rejected'){errors.push(`${name}: fonte indisponível.`);return null;}try{return fn(r.value,now);}catch(e){errors.push(`${name}: ${e.message}.`);return null;}};
 return {collectedAt:new Date(now).toISOString(),quakes:pick(u,'USGS (terremotos)',parseUsgs),space:pick(s,'NOAA SWPC (clima espacial)',parseSwpc),disasters:pick(g,'GDACS (desastres)',parseGdacs),kpForecast:pick(k,'NOAA SWPC (previsão de Kp)',parseKpForecast),errors,
  notes:['INMET (avisos do Brasil) não está integrado: o servidor não aceita consultas diretas do app. Consulte alertas2.inmet.gov.br.']};
}
// Nível de atenção do conjunto, segundo o que as próprias agências classificaram (nunca por critério do app).
// Só conta o que está valendo agora: terremotos das últimas 24 h, desastres em andamento e avisos espaciais das últimas 12 h.
export function alertsLevel(r,now=Date.now()){
 let l=0;
 const top=r?.quakes?.[0]?.mag??0;l=Math.max(l,top>=7?3:top>=6?2:top>=5?1:0);
 for(const d of r?.disasters??[])if(d.current)l=Math.max(l,d.level==='Red'?3:2);
 for(const a of r?.space??[]){if(!a.scale||!/ALERT|WARNING|WATCH/.test(a.kind??'')||now-a.time>12*3600000)continue;const n=Number(a.scale[1]),g=a.scale[0]==='G'?(n>=4?3:n>=3?2:1):(n>=3?3:n>=2?2:1);l=Math.max(l,g);}
 const kf=r?.kpForecast?.max??0;l=Math.max(l,kf>=8?2:kf>=5?1:0);// previsão: no máximo "vale acompanhar"
 return l;
}
