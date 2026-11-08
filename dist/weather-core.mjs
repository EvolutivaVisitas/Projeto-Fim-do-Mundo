// Lógica pura de tempo e satélite do MagneTerra (sem DOM, testável em Node).
// Fontes: NASA GIBS (camadas de satélite) e Open-Meteo (previsão/análise recente e reanálise ERA5).
export const GIBS='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const OPEN_METEO={forecast:'https://api.open-meteo.com/v1/forecast',archive:'https://archive-api.open-meteo.com/v1/archive'};
export const CLIMATOLOGY={start:'1991-01-01',end:'2020-12-31',label:'1991–2020',halfWindowDays:7};
const DAY=86400000;

// stepMin: intervalo entre quadros; lagMin: atraso típico da publicação; frames: quadros no controle de tempo.
export const LAYERS={
 geocolor:{label:'GOES-East · GeoColor',gibs:'GOES-East_ABI_GeoColor',tms:'GoogleMapsCompatible_Level7',nativeZoom:7,stepMin:10,lagMin:30,frames:19,
  kind:'Imagem de satélite',note:'Imagem colorida do satélite geoestacionário GOES-East (Américas e Atlântico). Observação de satélite com atraso de algumas dezenas de minutos; à noite a cena usa infravermelho.',legend:'Cores naturais · nuvens em branco'},
 infrared:{label:'GOES-East · infravermelho (banda 13)',gibs:'GOES-East_ABI_Band13_Clean_Infrared',tms:'GoogleMapsCompatible_Level6',nativeZoom:6,stepMin:10,lagMin:30,frames:19,
  kind:'Imagem de satélite',note:'Temperatura de brilho em 10,3 µm: topos de nuvem mais frios aparecem mais claros/coloridos, indicando convecção profunda. Funciona de dia e de noite.',legend:'Topos mais frios = nuvens mais altas'},
 imerg:{label:'Precipitação IMERG (30 min)',gibs:'IMERG_Precipitation_Rate_30min',tms:'GoogleMapsCompatible_Level6',nativeZoom:6,stepMin:30,lagMin:300,frames:13,
  kind:'Estimativa por satélite',note:'Taxa de chuva estimada pela missão GPM/IMERG, média de 30 minutos. É estimativa por satélite (não pluviômetro) e chega com atraso de várias horas.',legend:'Taxa de precipitação estimada (mm/h)'},
 sst:{label:'Anomalia da temperatura do mar (MUR)',gibs:'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies',tms:'GoogleMapsCompatible_Level7',nativeZoom:7,stepMin:1440,lagMin:1440,frames:7,daily:true,
  kind:'Anomalia (produto diário)',note:'Anomalia diária da temperatura da superfície do mar (GHRSST MUR L4), relativa à climatologia de referência do produto (ver metadados NASA GIBS). Só cobre oceanos e é publicada com atraso de ~1 dia.',legend:'Azul = mais frio que o normal · vermelho = mais quente'}
};

const pad=n=>String(n).padStart(2,'0');
export function gibsTime(layer,ms){const d=new Date(ms),day=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;return layer.daily?day:`${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`;}
export function gibsTemplate(layer,ms){return `${GIBS}/${layer.gibs}/default/${gibsTime(layer,ms)}/${layer.tms}/{z}/{y}/{x}.png`;}
export function gibsProbeUrl(layer,ms,z=3,x=2,y=4){return `${GIBS}/${layer.gibs}/default/${gibsTime(layer,ms)}/${layer.tms}/${z}/${y}/${x}.png`;}
export function floorTime(ms,stepMin){const s=stepMin*60000;return Math.floor(ms/s)*s;}
// Primeiro candidato a "mais recente": agora menos o atraso típico, alinhado ao passo. O app confirma por sondagem.
export function firstCandidate(layer,now=Date.now()){return floorTime(now-layer.lagMin*60000,layer.stepMin);}
export function frameTimes(layer,latestMs){const s=layer.stepMin*60000;return Array.from({length:layer.frames},(_,i)=>latestMs-(layer.frames-1-i)*s);}
export function ageLabel(ms,now=Date.now()){const m=Math.round((now-ms)/60000);if(m<0)return 'no futuro';if(m<90)return `${m} min atrás`;const h=m/60;return h<48?`${h.toFixed(1).replace('.',',')} h atrás`:`${Math.round(h/24)} dias atrás`;}

export function forecastUrl(lat,lon){return `${OPEN_METEO.forecast}?${new URLSearchParams({latitude:lat.toFixed(4),longitude:lon.toFixed(4),hourly:'temperature_2m,precipitation',current:'temperature_2m,precipitation',past_days:'7',forecast_days:'1',timezone:'UTC'})}`;}
export function archiveUrl(lat,lon){return `${OPEN_METEO.archive}?${new URLSearchParams({latitude:lat.toFixed(4),longitude:lon.toFixed(4),start_date:CLIMATOLOGY.start,end_date:CLIMATOLOGY.end,daily:'temperature_2m_mean,precipitation_sum',timezone:'UTC'})}`;}

const utc=s=>Date.parse(/Z$|[+-]\d\d:\d\d$/.test(s)?s:s+'Z');
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};

// Climatologia aproximada: janela de ±halfWindowDays em torno do mesmo mês/dia em cada ano de referência.
export function buildClimatology(archive,nowMs,halfWindow=CLIMATOLOGY.halfWindowDays){
 const d=archive?.daily;if(!d||!Array.isArray(d.time))return null;
 const temp=new Map(),rain=new Map();d.time.forEach((t,i)=>{temp.set(t,num(d.temperature_2m_mean?.[i]));rain.set(t,num(d.precipitation_sum?.[i]));});
 const now=new Date(nowMs),m=now.getUTCMonth(),day=now.getUTCDate(),y0=Number(CLIMATOLOGY.start.slice(0,4)),y1=Number(CLIMATOLOGY.end.slice(0,4));
 const temps=[],sums=[];
 for(let y=y0;y<=y1;y++){const c=Date.UTC(y,m,day);for(let o=-halfWindow;o<=halfWindow;o++){
  const key=ms=>new Date(ms).toISOString().slice(0,10);
  const t=temp.get(key(c+o*DAY));if(t!==null&&t!==undefined)temps.push(t);
  let s=0,ok=true;for(let k=0;k<7;k++){const r=rain.get(key(c+(o-k)*DAY));if(r===null||r===undefined){ok=false;break;}s+=r;}
  if(ok)sums.push(s);}}
 return {temps:temps.length>=30?{mean:mean(temps),sd:sd(temps),n:temps.length}:null,rain7:sums.length>=30?{mean:mean(sums),sorted:[...sums].sort((a,b)=>a-b),n:sums.length}:null};
}
export function classifyZ(z){if(!Number.isFinite(z))return 'indisponível';const a=Math.abs(z),s=z>0?'acima':'abaixo';return a<1?'dentro da variação típica':a<2?`${s} do normal`:`muito ${s} do normal`;}
export function classifyRain(pct){if(!Number.isFinite(pct))return 'indisponível';return pct<25?'muito abaixo do normal':pct<75?'abaixo do normal':pct<=125?'próxima do normal':pct<=200?'acima do normal':'muito acima do normal';}

// Estatísticas recentes (24 h de temperatura, 7 dias de chuva) de uma resposta horária do Open-Meteo. Não preenche lacunas.
export function recentStats(forecast,now){
 const h=forecast?.hourly;if(!h||!Array.isArray(h.time))return null;
 const rows=h.time.map((t,i)=>({t:utc(t),temp:num(h.temperature_2m?.[i]),rain:num(h.precipitation?.[i])})).filter(r=>Number.isFinite(r.t)&&r.t<=now);
 const last24=rows.filter(r=>r.t>now-DAY&&r.temp!==null),last7=rows.filter(r=>r.t>now-7*DAY&&r.rain!==null),cur=forecast.current;
 return {current:cur&&num(cur.temperature_2m)!==null?{time:new Date(utc(cur.time)).toISOString(),temperature:cur.temperature_2m,precipitation:num(cur.precipitation)}:null,
  temp:last24.length?{mean24h:mean(last24.map(r=>r.temp)),hours:last24.length,complete:last24.length>=22}:null,
  rain:last7.length?{sum7d:last7.reduce((s,r)=>s+r.rain,0),hours:last7.length,complete:last7.length>=160}:null};
}
// Compara com a climatologia {temps:{mean,sd,n}, rain7:{mean,n,sorted?}}; modifica e devolve temp/rain.
export function compareClimatology(temp,rain,clim){
 if(clim?.temps&&temp){temp.climMean=clim.temps.mean;temp.climSd=clim.temps.sd;temp.climN=clim.temps.n;temp.anomaly=temp.mean24h-clim.temps.mean;temp.z=temp.anomaly/clim.temps.sd;temp.label=classifyZ(temp.z);}
 if(clim?.rain7&&rain){const c=clim.rain7;rain.climMean=c.mean;rain.climN=c.n;rain.anomaly=rain.sum7d-c.mean;rain.pct=c.mean>0.5?rain.sum7d/c.mean*100:null;rain.percentile=c.sorted?c.sorted.filter(v=>v<=rain.sum7d).length/c.sorted.length*100:null;rain.label=rain.pct===null?'referência muito seca':classifyRain(rain.pct);}
}
// Compara as últimas 24 h (temperatura média) e 7 dias (chuva acumulada) com a climatologia. Não preenche lacunas.
export function buildAnomaly(forecast,archive,lat,lon,now=Date.now(),errors=[]){
 const out={collectedAt:new Date(now).toISOString(),lat,lon,elevation:num(forecast?.elevation),current:null,temp:null,rain:null,climatology:CLIMATOLOGY.label,errors:[...errors],notes:[]};
 const r=recentStats(forecast,now);
 if(r){out.current=r.current;out.temp=r.temp;out.rain=r.rain;}else if(!out.errors.length)out.errors.push('Previsão/análise recente indisponível.');
 const clim=archive?buildClimatology(archive,now):null;
 if(!clim&&forecast)out.errors.push('Climatologia ERA5 indisponível; anomalias não calculadas.');
 compareClimatology(out.temp,out.rain,clim);
 if(out.temp&&!out.temp.complete)out.notes.push('Cobertura horária parcial nas últimas 24 h.');
 if(out.rain&&!out.rain.complete)out.notes.push('Cobertura horária parcial nos últimos 7 dias.');
 return out;
}

const memo=new Map();
export async function collectAnomaly(lat,lon,now=Date.now(),fetcher=fetch){
 const key=`${Math.round(lat*4)/4},${Math.round(lon*4)/4}`;
 const get=async url=>{const r=await fetcher(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
 const errors=[];
 const arcP=memo.get(key)??get(archiveUrl(lat,lon));memo.set(key,arcP);
 const [f,a]=await Promise.allSettled([get(forecastUrl(lat,lon)),arcP]);
 if(f.status==='rejected')errors.push('Open-Meteo (previsão/análise): fonte indisponível.');
 if(a.status==='rejected'){errors.push('Open-Meteo (ERA5): fonte indisponível.');memo.delete(key);}
 return buildAnomaly(f.status==='fulfilled'?f.value:null,a.status==='fulfilled'?a.value:null,lat,lon,now,errors);
}

// ---- Arquivo diário (usado por collect-daily.mjs; o navegador reutiliza findLatestFrame) ----
export const DAILY_POINT={name:'Goiânia',lat:-16.758611,lon:-49.344444};
// Recua um passo por vez até achar um quadro realmente publicado; devolve null se nenhum existir.
export async function findLatestFrame(layer,probe,now=Date.now(),tries=30){let ms=firstCandidate(layer,now);for(let i=0;i<tries;i++,ms-=layer.stepMin*60000)if(await probe(gibsProbeUrl(layer,ms)))return ms;return null;}
export async function collectDailyWeather(now=Date.now(),fetcher=fetch){
 const probe=async url=>{try{return (await fetcher(url,{method:'HEAD',signal:AbortSignal.timeout(8000)})).ok;}catch{return false;}};
 const keys=Object.keys(LAYERS);
 const [anomaly,...times]=await Promise.all([collectAnomaly(DAILY_POINT.lat,DAILY_POINT.lon,now,fetcher),...keys.map(k=>findLatestFrame(LAYERS[k],probe,now))]);
 const satellite=Object.fromEntries(keys.map((k,i)=>[k,{label:LAYERS[k].label,kind:LAYERS[k].kind,latestFrame:times[i]===null?null:new Date(times[i]).toISOString(),ageMinutes:times[i]===null?null:Math.round((now-times[i])/60000)}]));
 return {capturedAt:new Date(now).toISOString(),point:DAILY_POINT,anomaly,satellite,note:'Retrato do instante da coleta: anomalia pontual (Open-Meteo vs. ERA5) e hora do quadro de satélite mais recente publicado pela NASA GIBS. As imagens não são arquivadas; não representa o dia inteiro.'};
}

// ---- Panorama global: climatologia pré-calculada por lugar + coleta recente em lote ----
const LEAP=Date.UTC(2024,0,1);
export const DOY_COUNT=366;
// Índice 0..365 do mês/dia (calendário bissexto), usado para consultar a tabela de climatologia.
export function dayIndex(ms){const d=new Date(ms);return Math.round((Date.UTC(2024,d.getUTCMonth(),d.getUTCDate())-LEAP)/DAY);}
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
// Mesma definição de buildClimatology (±halfWindow dias, mesmo mês/dia em 1991–2020), calculada para os 366 dias do ano.
export function climatologyTable(archive,halfWindow=CLIMATOLOGY.halfWindowDays){
 const d=archive?.daily;if(!d||!Array.isArray(d.time))return null;
 const t0=Date.UTC(1991,0,1),n=d.time.length,y0=1991,y1=2020;
 if(d.time[0]!=='1991-01-01'||d.time[n-1]!=='2020-12-31'||n!==Math.round((Date.UTC(2021,0,1)-t0)/DAY))return null;
 const T=Float64Array.from(d.time,(_,i)=>num(d.temperature_2m_mean?.[i])??NaN),R=Float64Array.from(d.time,(_,i)=>num(d.precipitation_sum?.[i])??NaN);
 const cnt=new Int32Array(n+1),sum=new Float64Array(n+1);
 for(let i=0;i<n;i++){const ok=Number.isFinite(R[i]);cnt[i+1]=cnt[i]+(ok?1:0);sum[i+1]=sum[i]+(ok?R[i]:0);}
 const t=[],s=[],r=[];
 for(let k=0;k<DOY_COUNT;k++){
  const dt=new Date(LEAP+k*DAY),m=dt.getUTCMonth(),day=dt.getUTCDate(),temps=[],sums=[];
  for(let y=y0;y<=y1;y++){const c=Math.round((Date.UTC(y,m,day)-t0)/DAY);
   for(let o=-halfWindow;o<=halfWindow;o++){const i=c+o;if(i>=0&&i<n&&Number.isFinite(T[i]))temps.push(T[i]);const e=c+o,b=e-6;if(b>=0&&e<n&&cnt[e+1]-cnt[b]===7)sums.push(sum[e+1]-sum[b]);}}
  if(temps.length>=30&&sums.length>=30){t.push(r2(mean(temps)));s.push(r2(sd(temps)));r.push(r2(mean(sums)));}else{t.push(null);s.push(null);r.push(null);}
 }
 return {t,s,r};
}
export function climFromTable(entry,ms){if(!entry)return null;const k=dayIndex(ms),m=entry.t[k],sdv=entry.s[k],rm=entry.r[k];return {temps:m!==null&&sdv>0?{mean:m,sd:sdv,n:null}:null,rain7:rm!==null?{mean:rm,n:null}:null};}
export function multiForecastUrl(places){return `${OPEN_METEO.forecast}?${new URLSearchParams({latitude:places.map(p=>p.lat.toFixed(3)).join(','),longitude:places.map(p=>p.lon.toFixed(3)).join(','),hourly:'temperature_2m,precipitation',current:'temperature_2m,precipitation',past_days:'7',forecast_days:'1',timezone:'UTC'})}`;}
const round=(v,n=1)=>v===undefined||v===null||!Number.isFinite(v)?null:Math.round(v*10**n)/10**n;
// Anomalia recente de todos os lugares usando a climatologia pré-calculada; lotes que falham viram linhas sem dados.
export async function collectGlobalWeather(places,table,now=Date.now(),fetcher=fetch,batch=25){
 const rows=[],errors=[];
 for(let i=0;i<places.length;i+=batch){
  const group=places.slice(i,i+batch);let arr=null;
  try{const r=await fetcher(multiForecastUrl(group),{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();arr=Array.isArray(j)?j:[j];if(arr.length!==group.length)throw Error('resposta incompleta');}
  catch(e){errors.push(`Open-Meteo: lote ${i/batch+1} indisponível (${e.message}).`);arr=null;}
  group.forEach((p,j)=>{
   const base={id:p.id,name:p.name,country:p.country,continent:p.continent,lat:p.lat,lon:p.lon},st=arr?recentStats(arr[j],now):null;
   if(!st||!st.temp){rows.push({...base,status:'sem dados'});return;}
   compareClimatology(st.temp,st.rain,climFromTable(table?.places?.[p.id],now));
   rows.push({...base,status:'ok',tempMean24h:round(st.temp.mean24h,2),tempAnomaly:round(st.temp.anomaly,2),z:round(st.temp.z,2),tempLabel:st.temp.label??null,tempComplete:st.temp.complete,rain7d:st.rain?round(st.rain.sum7d,1):null,rainPct:round(st.rain?.pct,0),rainLabel:st.rain?.label??null,rainComplete:st.rain?.complete??null});
  });
 }
 return {collectedAt:new Date(now).toISOString(),climatology:CLIMATOLOGY.label+' (±'+CLIMATOLOGY.halfWindowDays+' dias)',count:rows.length,withData:rows.filter(r=>r.status==='ok').length,errors,places:rows,note:'Lista curada de lugares, não uma grade global regular. Anomalia = análise/previsão de curto prazo Open-Meteo (24 h; chuva em 7 dias) menos climatologia ERA5 pré-calculada. Aproximação; regiões fora da lista não aparecem.'};
}
export async function searchPlace(name,fetcher=fetch){
 const q=String(name??'').trim();if(q.length<2)return [];
 const r=await fetcher(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({name:q,count:'6',language:'pt',format:'json'})}`,{signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const j=await r.json();
 return (j.results??[]).filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).map(x=>({name:x.name,region:x.admin1??'',country:x.country??'',lat:x.latitude,lon:x.longitude}));
}

// ---- Anomalias mensais do lugar: últimos 12 meses completos vs. 1991–2020 (mesma fonte ERA5, sem misturar modelos) ----
const getJson=async(url,fetcher)=>{const r=await fetcher(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
// Arquivo de 30 anos do ponto (compartilhado com collectAnomaly pela mesma chave de cache).
export function climArchive(lat,lon,fetcher=fetch){const key=`${Math.round(lat*4)/4},${Math.round(lon*4)/4}`;const p=memo.get(key)??getJson(archiveUrl(lat,lon),fetcher);memo.set(key,p);p.catch(()=>memo.delete(key));return p;}
export function recentMonthsRange(now=Date.now()){const d=new Date(now),y=d.getUTCFullYear(),m=d.getUTCMonth();return {start:new Date(Date.UTC(y,m-12,1)).toISOString().slice(0,10),end:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)};}
export function recentMonthsUrl(lat,lon,now=Date.now()){const r=recentMonthsRange(now);return `${OPEN_METEO.archive}?${new URLSearchParams({latitude:lat.toFixed(4),longitude:lon.toFixed(4),start_date:r.start,end_date:r.end,daily:'temperature_2m_mean,precipitation_sum',timezone:'UTC'})}`;}
// Climatologia mensal: média (e desvio entre anos) da temperatura e total médio de chuva de cada mês do ano.
export function monthlyClimatology(archive){
 const d=archive?.daily;if(!d||!Array.isArray(d.time))return null;
 const byYM=new Map();
 d.time.forEach((t,i)=>{const temp=num(d.temperature_2m_mean?.[i]),rain=num(d.precipitation_sum?.[i]);const k=t.slice(0,7),e=byYM.get(k)??{n:0,t:0,tn:0,r:0,rn:0};e.n++;if(temp!==null){e.t+=temp;e.tn++;}if(rain!==null){e.r+=rain;e.rn++;}byYM.set(k,e);});
 const out=Array.from({length:12},()=>({temps:[],rains:[]}));
 for(const [k,e] of byYM){const m=Number(k.slice(5,7))-1,days=new Date(Date.UTC(Number(k.slice(0,4)),m+1,0)).getUTCDate();if(e.tn>=days*.95)out[m].temps.push(e.t/e.tn);if(e.rn>=days*.95)out[m].rains.push(e.r/e.rn*days);}
 if(out.some(o=>o.temps.length<20||o.rains.length<20))return null;
 return out.map(o=>({tMean:mean(o.temps),tSd:sd(o.temps),rMean:mean(o.rains)}));
}
export function buildMonthlyAnomalies(recent,climArch,now=Date.now()){
 const clim=monthlyClimatology(climArch),d=recent?.daily;if(!clim||!d||!Array.isArray(d.time))return null;
 const byYM=new Map();
 d.time.forEach((t,i)=>{const temp=num(d.temperature_2m_mean?.[i]),rain=num(d.precipitation_sum?.[i]),k=t.slice(0,7),e=byYM.get(k)??{t:0,tn:0,r:0,rn:0};if(temp!==null){e.t+=temp;e.tn++;}if(rain!==null){e.r+=rain;e.rn++;}byYM.set(k,e);});
 const now0=new Date(now),rows=[];
 for(let k=12;k>=1;k--){const dt=new Date(Date.UTC(now0.getUTCFullYear(),now0.getUTCMonth()-k,1)),y=dt.getUTCFullYear(),m=dt.getUTCMonth(),days=new Date(Date.UTC(y,m+1,0)).getUTCDate(),e=byYM.get(`${y}-${pad(m+1)}`),c=clim[m];
  const row={year:y,month:m,tempMean:null,tempAnomaly:null,z:null,rain:null,rainPct:null};
  if(e&&e.tn>=days*.95){row.tempMean=e.t/e.tn;row.tempAnomaly=row.tempMean-c.tMean;row.z=c.tSd>0?row.tempAnomaly/c.tSd:null;}
  if(e&&e.rn>=days*.95){row.rain=e.r/e.rn*days;row.rainPct=c.rMean>1?row.rain/c.rMean*100:null;}
  rows.push(row);}
 return rows;
}
export async function collectMonthly(lat,lon,now=Date.now(),fetcher=fetch){
 const [r,a]=await Promise.allSettled([getJson(recentMonthsUrl(lat,lon,now),fetcher),climArchive(lat,lon,fetcher)]);
 const errors=[];if(r.status==='rejected')errors.push('Open-Meteo (últimos 12 meses): fonte indisponível.');if(a.status==='rejected')errors.push('Open-Meteo (ERA5): fonte indisponível.');
 const rows=r.status==='fulfilled'&&a.status==='fulfilled'?buildMonthlyAnomalies(r.value,a.value,now):null;
 if(!rows&&!errors.length)errors.push('Dados insuficientes para calcular as anomalias mensais.');
 return {lat,lon,rows,errors,climatology:CLIMATOLOGY.label,collectedAt:new Date(now).toISOString()};
}
const PT_MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Dois gráficos de barras: anomalia de temperatura (°C) e chuva em % do normal. Meses sem dado completo ficam vazios.
export function monthlySvg(rows,label=''){
 if(!rows?.length)return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 120"><text x="20" y="60" font-family="sans-serif" font-size="18">Anomalias mensais indisponíveis</text></svg>';
 const W=1000,left=60,bw=W/rows.length,txt=(x,y,t,extra='')=>`<text x="${x}" y="${y}" font-family="sans-serif" font-size="12" fill="#526579" ${extra}>${xml(t)}</text>`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 560"><rect width="1100" height="560" fill="#f7fafc"/><text x="${left}" y="26" font-family="sans-serif" font-size="18" fill="#16344c">Últimos 12 meses${label?' · '+xml(label):''} · comparação com 1991–2020 (ERA5)</text>`;
 const temps=rows.map(r=>r.tempAnomaly).filter(v=>v!==null),tmax=Math.max(2,...temps.map(Math.abs)),ty0=130,th=80;
 s+=txt(left,50,'Temperatura média do mês: anomalia (°C)')+`<path d="M${left} ${ty0}H${left+W}" stroke="#7b8b99"/>`+txt(left-8,ty0+4,'0','text-anchor="end"')+txt(left-8,ty0-th+4,'+'+tmax.toFixed(0),'text-anchor="end"')+txt(left-8,ty0+th+4,'−'+tmax.toFixed(0),'text-anchor="end"');
 rows.forEach((r,i)=>{const x=left+i*bw+4;if(r.tempAnomaly!==null){const h=Math.abs(r.tempAnomaly)/tmax*th,y=r.tempAnomaly>=0?ty0-h:ty0;s+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-8).toFixed(1)}" height="${Math.max(h,1).toFixed(1)}" fill="${r.tempAnomaly>=0?'#c5431e':'#2c5bb5'}"><title>${PT_MONTHS[r.month]}/${r.year}: ${r.tempAnomaly>0?'+':''}${r.tempAnomaly.toFixed(1)} °C</title></rect>`;}else s+=txt(x+bw/2-8,ty0+4,'s/d','text-anchor="middle"');
  s+=txt(x+bw/2-4,ty0+th+24,PT_MONTHS[r.month]+(r.month===0||i===0?" '"+String(r.year).slice(2):''),'text-anchor="middle"');});
 const ry0=470,rh=130,rmax=Math.max(200,...rows.map(r=>r.rainPct??0)),sy=v=>ry0-v/rmax*rh;
 s+=txt(left,300,'Chuva do mês: % do normal (100% = normal)')+`<path d="M${left} ${ry0}H${left+W}" stroke="#7b8b99"/><path d="M${left} ${sy(100).toFixed(1)}H${left+W}" stroke="#2e7d5b" stroke-dasharray="5 4"/>`+txt(left-8,sy(100)+4,'100%','text-anchor="end"')+txt(left-8,ry0+4,'0%','text-anchor="end"');
 rows.forEach((r,i)=>{const x=left+i*bw+4;if(r.rainPct!==null){const y=sy(Math.min(r.rainPct,rmax));s+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-8).toFixed(1)}" height="${Math.max(ry0-y,1).toFixed(1)}" fill="#3d7ea6"><title>${PT_MONTHS[r.month]}/${r.year}: ${Math.round(r.rainPct)}% do normal (${r.rain.toFixed(0)} mm)</title></rect>`;}else s+=txt(x+bw/2-8,ry0-6,'s/d','text-anchor="middle"');});
 s+=txt(left,540,'Fonte: Open-Meteo (reanálise ERA5). “s/d” = mês sem dados completos; nada é preenchido.')+'</svg>';
 return s;
}

// ---- Previsão de anomalias: próximos dias (Open-Meteo, até 16 dias) contra a climatologia ERA5 da mesma data ----
export function forecastDailyUrl(lat,lon){return `${OPEN_METEO.forecast}?${new URLSearchParams({latitude:lat.toFixed(4),longitude:lon.toFixed(4),daily:'temperature_2m_mean,precipitation_sum',forecast_days:'16',timezone:'UTC'})}`;}
// Só dias futuros (a partir de amanhã, UTC). Valores ausentes ficam null; nada é preenchido.
export function buildForecastAnomalies(fc,archive,now=Date.now()){
 const d=fc?.daily;if(!d||!Array.isArray(d.time))return null;
 const today=new Date(now).toISOString().slice(0,10),days=[];
 d.time.forEach((t,i)=>{if(t<=today)return;const temp=num(d.temperature_2m_mean?.[i]),rain=num(d.precipitation_sum?.[i]),c=archive?buildClimatology(archive,Date.parse(t+'T12:00:00Z')):null;
  const row={date:t,temp,rain,climMean:c?.temps?.mean??null,anomaly:null,z:null};
  if(temp!==null&&c?.temps){row.anomaly=temp-c.temps.mean;row.z=row.anomaly/c.temps.sd;}
  days.push(row);});
 if(!days.length)return null;
 let rain=null;const first7=days.slice(0,7);
 if(first7.length===7&&first7.every(r=>r.rain!==null)){const sum=first7.reduce((s,r)=>s+r.rain,0),c=archive?buildClimatology(archive,Date.parse(first7[6].date+'T12:00:00Z')):null;
  rain={sum,climMean:c?.rain7?.mean??null,pct:c?.rain7&&c.rain7.mean>.5?sum/c.rain7.mean*100:null};}
 return {days,rain,generatedFor:today};
}
export async function collectForecast(lat,lon,now=Date.now(),fetcher=fetch){
 const [f,a]=await Promise.allSettled([getJson(forecastDailyUrl(lat,lon),fetcher),climArchive(lat,lon,fetcher)]);
 const errors=[];if(f.status==='rejected')errors.push('Open-Meteo (previsão): fonte indisponível.');if(a.status==='rejected')errors.push('Open-Meteo (ERA5): fonte indisponível; sem comparação com o normal.');
 const fc=f.status==='fulfilled'?buildForecastAnomalies(f.value,a.status==='fulfilled'?a.value:null,now):null;
 if(f.status==='fulfilled'&&!fc)errors.push('Previsão sem dados válidos.');
 return {lat,lon,forecast:fc,errors,collectedAt:new Date(now).toISOString(),hasClimatology:!!fc&&fc.days.some(r=>r.anomaly!==null)};
}
// Barras da anomalia prevista de temperatura por dia. Dias além de 7 saem mais claros (previsão menos confiável).
export function forecastSvg(fc,label=''){
 const days=fc?.days;
 if(!days?.length)return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 120"><text x="20" y="60" font-family="sans-serif" font-size="18">Previsão indisponível</text></svg>';
 const W=1000,left=60,bw=W/days.length,vals=days.map(r=>r.anomaly).filter(v=>v!==null),amax=Math.max(3,...vals.map(Math.abs)),y0=170,h=110,txt=(x,y,t,extra='')=>`<text x="${x}" y="${y}" font-family="sans-serif" font-size="12" fill="#526579" ${extra}>${xml(t)}</text>`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 330"><rect width="1100" height="330" fill="#f7fafc"/><text x="${left}" y="26" font-family="sans-serif" font-size="18" fill="#16344c">Previsão: temperatura média diária vs. normal 1991–2020 (°C)${label?' · '+xml(label):''}</text>`;
 s+=`<path d="M${left} ${y0}H${left+W}" stroke="#7b8b99"/>`+txt(left-8,y0+4,'0','text-anchor="end"')+txt(left-8,y0-h+4,'+'+amax.toFixed(0),'text-anchor="end"')+txt(left-8,y0+h+4,'−'+amax.toFixed(0),'text-anchor="end"');
 days.forEach((r,i)=>{const x=left+i*bw+3,op=i<7?1:.5;
  if(r.anomaly!==null){const hh=Math.abs(r.anomaly)/amax*h,y=r.anomaly>=0?y0-hh:y0;s+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-6).toFixed(1)}" height="${Math.max(hh,1).toFixed(1)}" fill="${r.anomaly>=0?'#c5431e':'#2c5bb5'}" opacity="${op}"><title>${r.date}: ${r.anomaly>0?'+':''}${r.anomaly.toFixed(1)} °C (previsto ${r.temp.toFixed(1)} °C)</title></rect>`;}else s+=txt(x+bw/2-6,y0+4,'s/d','text-anchor="middle"');
  s+=txt(x+bw/2-3,y0+h+24,r.date.slice(8,10)+'/'+r.date.slice(5,7),'text-anchor="middle"');});
 s+=txt(left,y0+h+54,'Barras claras: mais de 7 dias à frente, previsão menos confiável. “s/d” = sem comparação disponível.')+txt(left,y0+h+74,'Fonte: Open-Meteo (modelos de previsão) e reanálise ERA5. Tendência, não garantia.')+'</svg>';
 return s;
}
