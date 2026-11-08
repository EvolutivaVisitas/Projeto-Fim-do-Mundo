// Estimativas futuras calculadas pelo próprio app a partir do passado e do presente (métodos estatísticos simples e declarados):
//  1) dias: persistência de anomalias de temperatura (regressão do desvio recente contra o desvio k dias depois, em 30 anos de ERA5);
//  2) meses: persistência de anomalias mensais;
//  3) terremotos: taxa histórica (10 anos, USGS) e probabilidade de Poisson. Isso NÃO prevê onde/quando; é frequência de base;
//  4) temperatura global: extrapolação linear da tendência desde 1970 (NASA GISTEMP) com intervalo de ~90%.
// Estimativa não é previsão certa: cada resultado traz seu intervalo e o limite do método. Dado ausente nunca é preenchido.
import {climatologyTable,dayIndex,monthlyClimatology} from './weather-core.mjs';
const DAY=86400000,mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const iso=ms=>new Date(ms).toISOString().slice(0,10);

// ---------- 1) Dias ----------
// Ajusta, para cada defasagem k, a regressão  anomalia(t+k) = β_k · média das anomalias dos 3 dias até t.
export function fitDailyPersistence(archive,maxLag=14){
 const tab=climatologyTable(archive);if(!tab)return null;
 const d=archive.daily,a=d.time.map((t,i)=>{const v=d.temperature_2m_mean?.[i],c=tab.t[dayIndex(Date.parse(t+'T00:00:00Z'))];return Number.isFinite(v)&&c!==null?v-c:null;});
 const m3=a.map((_,i)=>i>=2&&a[i]!==null&&a[i-1]!==null&&a[i-2]!==null?(a[i]+a[i-1]+a[i-2])/3:null);
 const beta=[null],sigma=[null],r=[null];
 for(let k=1;k<=maxLag;k++){let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for(let i=0;i+k<a.length;i++){const x=m3[i],y=a[i+k];if(x===null||y===null)continue;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;}
  if(n<500)return null;
  const vx=sxx/n-(sx/n)**2,vy=syy/n-(sy/n)**2,cxy=sxy/n-(sx/n)*(sy/n),b=cxy/vx;
  beta.push(b);r.push(cxy/Math.sqrt(vx*vy));sigma.push(Math.sqrt(Math.max(vy-b*b*vx,0)));}
 return {beta,sigma,r,table:tab,n:a.filter(v=>v!==null).length};
}
// recent: {time:[...'AAAA-MM-DD'], temp:[...]} com dias completos já passados (UTC). Usa os 3 últimos dias consecutivos válidos.
export function projectDays(model,recent,modelForecast=[],now=Date.now()){
 if(!model||!recent?.time?.length)return null;
 const today=iso(now),rows=recent.time.map((t,i)=>({t,v:recent.temp?.[i]})).filter(x=>x.t<today);
 const last=rows.slice(-3);if(last.length<3||last.some(x=>!Number.isFinite(x.v)))return null;
 for(let i=1;i<3;i++)if(Date.parse(last[i].t)-Date.parse(last[i-1].t)!==DAY)return null;
 const a0=mean(last.map(x=>x.v-model.table.t[dayIndex(Date.parse(x.t+'T00:00:00Z'))]));
 const base=Date.parse(last[2].t+'T00:00:00Z'),byDate=new Map(modelForecast.map(f=>[f.date,f]));
 const out=[];
 for(let k=1;k<=model.beta.length-1;k++){const ms=base+k*DAY,c=model.table.t[dayIndex(ms)],ea=model.beta[k]*a0,half=1.645*model.sigma[k],f=byDate.get(iso(ms));
  if(iso(ms)<=today)continue;
  out.push({date:iso(ms),k,expectedAnomaly:ea,expected:c+ea,lo:c+ea-half,hi:c+ea+half,r:model.r[k],modelTemp:f?.temp??null,modelAnomaly:f?.anomaly??null});}
 const skill=model.r.findIndex((v,k)=>k>0&&v<0.3);
 return {recentAnomaly:a0,lastObserved:last[2].t,days:out,usefulDays:skill>0?skill-1:model.r.length-1};
}

// ---------- 2) Meses ----------
export function fitMonthlyPersistence(archive,maxLag=3){
 const mc=monthlyClimatology(archive);if(!mc)return null;
 const by=new Map();archive.daily.time.forEach((t,i)=>{const v=archive.daily.temperature_2m_mean?.[i];if(!Number.isFinite(v))return;const k=t.slice(0,7),e=by.get(k)??{s:0,n:0};e.s+=v;e.n++;by.set(k,e);});
 const keys=[...by.keys()].sort(),an=keys.map(k=>{const e=by.get(k);return e.n>=25?e.s/e.n-mc[Number(k.slice(5,7))-1].tMean:null;});
 const m3=an.map((_,i)=>i>=2&&an[i]!==null&&an[i-1]!==null&&an[i-2]!==null?(an[i]+an[i-1]+an[i-2])/3:null);
 const beta=[null],sigma=[null],r=[null];
 for(let h=1;h<=maxLag;h++){let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;for(let i=0;i+h<an.length;i++){const x=m3[i],y=an[i+h];if(x===null||y===null)continue;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;}
  if(n<100)return null;const vx=sxx/n-(sx/n)**2,vy=syy/n-(sy/n)**2,cxy=sxy/n-(sx/n)*(sy/n),b=cxy/vx;beta.push(b);r.push(cxy/Math.sqrt(vx*vy));sigma.push(Math.sqrt(Math.max(vy-b*b*vx,0)));}
 return {beta,sigma,r,clim:mc};
}
// monthlyRows: saída de buildMonthlyAnomalies (12 meses completos, o último é o mês anterior ao atual).
export function projectMonths(model,monthlyRows,now=Date.now()){
 if(!model||!monthlyRows?.length)return null;
 const last3=monthlyRows.slice(-3);if(last3.length<3||last3.some(r=>r.tempAnomaly===null))return null;
 const a0=mean(last3.map(r=>r.tempAnomaly)),d=new Date(now),out=[];
 for(let h=1;h<=model.beta.length-1;h++){const dt=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+h-1,1)),m=dt.getUTCMonth(),c=model.clim[m].tMean,ea=model.beta[h]*a0,half=1.645*model.sigma[h];
  out.push({year:dt.getUTCFullYear(),month:m,expectedAnomaly:ea,expected:c+ea,lo:c+ea-half,hi:c+ea+half,r:model.r[h]});}
 return {recentAnomaly:a0,months:out};
}

// ---------- 3) Terremotos: frequência histórica (Poisson) ----------
const MS_YEAR=365.25*DAY;
export function quakeCountUrl(minMag,now,years=10,place){const p=new URLSearchParams({format:'geojson',starttime:iso(now-years*MS_YEAR),endtime:iso(now),minmagnitude:String(minMag)});if(place){p.set('latitude',place.lat.toFixed(3));p.set('longitude',place.lon.toFixed(3));p.set('maxradiuskm',String(place.radiusKm??500));}return 'https://earthquake.usgs.gov/fdsnws/event/1/count?'+p;}
// Probabilidade de ao menos um evento em `days` dias, dado o número de eventos em `years` anos (processo de Poisson).
export function poissonAtLeastOne(count,years,days){if(!Number.isFinite(count)||count<0)return null;const rate=count/(years*365.25);return 1-Math.exp(-rate*days);}
export async function collectQuakeRates(lat,lon,now=Date.now(),fetcher=fetch,years=10,radiusKm=500){
 const get=async url=>{const r=await fetcher(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!Number.isFinite(j.count))throw Error('resposta inválida');return {count:j.count,capped:j.maxAllowed!==undefined&&j.count>=j.maxAllowed};};
 const spec=[['global',5,null],['global',6,null],['global',7,null],['local',4.5,{lat,lon,radiusKm}],['local',5,{lat,lon,radiusKm}],['local',6,{lat,lon,radiusKm}]];
 const res=await Promise.allSettled(spec.map(([,m,p])=>get(quakeCountUrl(m,now,years,p))));
 const rows=spec.map(([scope,mag],i)=>{const r=res[i];if(r.status==='rejected')return {scope,mag,count:null,error:true};const c=r.value;return {scope,mag,count:c.count,capped:c.capped,p7:poissonAtLeastOne(c.count,years,7),p30:poissonAtLeastOne(c.count,years,30),perYear:c.count/years};});
 return {years,radiusKm,rows,collectedAt:new Date(now).toISOString(),errors:rows.some(r=>r.error)?['USGS (contagem histórica): parte das consultas falhou.']:[]};
}

// ---------- 4) Temperatura global: tendência linear ----------
export function projectGlobalTemp(series,targets=[2030,2040,2050],from=1970){
 const full=(series?.years??[]).filter(y=>y.annual!==null&&y.year>=from);if(full.length<25)return null;
 const n=full.length,xs=full.map(y=>y.year),ys=full.map(y=>y.annual),mx=mean(xs),my=mean(ys),sxx=xs.reduce((s,x)=>s+(x-mx)**2,0),slope=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/sxx,icpt=my-slope*mx;
 const s=Math.sqrt(xs.reduce((q,x,i)=>q+(ys[i]-(icpt+slope*x))**2,0)/(n-2));
 return {from:xs[0],to:xs.at(-1),slopePerDecade:slope*10,residualSd:s,points:targets.map(year=>{const v=icpt+slope*year,se=s*Math.sqrt(1+1/n+(year-mx)**2/sxx);return {year,value:v,lo:v-1.645*se,hi:v+1.645*se};})};
}

// ---------- Modelo pré-calculado (para não depender da API de 30 anos) ----------
const rd=(a,n=4)=>a.slice(1).map(v=>Math.round(v*10**n)/10**n);
export function serializeModels(daily,monthly){return daily&&monthly?{d:{beta:rd(daily.beta),sigma:rd(daily.sigma),r:rd(daily.r)},m:{beta:rd(monthly.beta),sigma:rd(monthly.sigma),r:rd(monthly.r),tMean:monthly.clim.map(c=>Math.round(c.tMean*100)/100)}}:null;}
export function modelsFromEntry(entry){const m=entry?.model;if(!m?.d||!m?.m||!entry.t)return null;const pad=a=>[null,...a];return {daily:{beta:pad(m.d.beta),sigma:pad(m.d.sigma),r:pad(m.d.r),table:{t:entry.t}},monthly:{beta:pad(m.m.beta),sigma:pad(m.m.sigma),r:pad(m.m.r),clim:m.m.tMean.map(t=>({tMean:t}))}};}
// Anomalia mensal dos últimos 12 meses completos contra a média mensal do modelo (clim[m].tMean). Mês incompleto fica null.
export function monthRowsFromClim(recent,clim,now=Date.now()){
 const d=recent?.daily;if(!clim||!d||!Array.isArray(d.time))return null;
 const by=new Map();d.time.forEach((t,i)=>{const v=d.temperature_2m_mean?.[i];if(!Number.isFinite(v))return;const k=t.slice(0,7),e=by.get(k)??{s:0,n:0};e.s+=v;e.n++;by.set(k,e);});
 const n0=new Date(now),rows=[];
 for(let k=12;k>=1;k--){const dt=new Date(Date.UTC(n0.getUTCFullYear(),n0.getUTCMonth()-k,1)),y=dt.getUTCFullYear(),m=dt.getUTCMonth(),days=new Date(Date.UTC(y,m+1,0)).getUTCDate(),e=by.get(y+'-'+String(m+1).padStart(2,'0'));
  rows.push({year:y,month:m,tempAnomaly:e&&e.n>=days*.95?e.s/e.n-clim[m].tMean:null});}
 return rows;
}
// ---------- Orquestração e gráfico ----------
import {OPEN_METEO,climArchive,collectForecast,recentMonthsUrl,nearestPlace} from './weather-core.mjs';
const jget=async(url,fetcher)=>{const r=await fetcher(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
export function recentDailyUrl(lat,lon){return `${OPEN_METEO.forecast}?${new URLSearchParams({latitude:lat.toFixed(4),longitude:lon.toFixed(4),daily:'temperature_2m_mean',past_days:'14',forecast_days:'1',timezone:'UTC'})}`;}
// Junta passado (30 anos ERA5 + 14 dias recentes + 12 meses) e presente para estimar o futuro. Cada parte falha sozinha, sem inventar.
export async function collectProjection(lat,lon,now=Date.now(),fetcher=fetch,globalSeries=null){
 const errors=[];
 const [arch,rec,fc,mon,qr]=await Promise.allSettled([climArchive(lat,lon,fetcher),jget(recentDailyUrl(lat,lon),fetcher),collectForecast(lat,lon,now,fetcher),jget(recentMonthsUrl(lat,lon,now),fetcher),collectQuakeRates(lat,lon,now,fetcher)]);
 let days=null,months=null,model=null;
 let mm=null,source='ERA5 (consulta direta)';
 if(arch.status==='fulfilled'){model=fitDailyPersistence(arch.value);mm=fitMonthlyPersistence(arch.value);}
 else{// limite da API: usa o modelo pré-calculado do lugar da lista mais próximo, se houver
  try{const table=await jget('climate/places-climatology.json',fetcher),n=nearestPlace(lat,lon,table),pm=n?modelsFromEntry(table.places[n.place.id]):null;if(pm){model=pm.daily;mm=pm.monthly;source=`modelo pré-calculado de ${n.place.name} (a ${Math.round(n.km)} km)`;}}catch{}}
 if(model||mm){
  if(model&&rec.status==='fulfilled'){days=projectDays(model,{time:rec.value.daily?.time??[],temp:rec.value.daily?.temperature_2m_mean??[]},fc.status==='fulfilled'?fc.value.forecast?.days??[]:[],now);if(!days)errors.push('Dias recentes incompletos: sem estimativa estatística para os próximos dias.');}
  if(mm&&mon.status==='fulfilled'){months=projectMonths(mm,monthRowsFromClim(mon.value,mm.clim,now),now);if(!months)errors.push('Meses recentes incompletos: sem estimativa para os próximos meses.');}
 }else errors.push('Open-Meteo (ERA5 de 30 anos) indisponível ou no limite: sem estimativas de temperatura para os próximos dias e meses.');
 if(rec.status==='rejected')errors.push('Open-Meteo (dias recentes): fonte indisponível.');
 const quakes=qr.status==='fulfilled'?qr.value:null;if(qr.status==='rejected')errors.push('USGS (contagem histórica): fonte indisponível.');else errors.push(...qr.value.errors);
 return {lat,lon,days,months,quakes,source,global:globalSeries?projectGlobalTemp(globalSeries):null,errors,collectedAt:new Date(now).toISOString()};
}
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Estimativa estatística (linha + faixa de 90%) e, quando existir, a previsão do modelo (pontos), para os próximos dias.
export function projectionSvg(days,label=''){
 if(!days?.length)return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 120"><text x="20" y="60" font-family="sans-serif" font-size="18">Estimativa indisponível</text></svg>';
 const W=1000,left=60,top=60,h=190,vals=days.flatMap(d=>[d.lo,d.hi,d.modelTemp].filter(v=>v!==null&&v!==undefined)),min=Math.floor(Math.min(...vals)-1),max=Math.ceil(Math.max(...vals)+1),sx=i=>left+(i+.5)*W/days.length,sy=v=>top+(max-v)/(max-min)*h;
 const txt=(x,y,t,extra='')=>`<text x="${x}" y="${y}" font-family="sans-serif" font-size="12" fill="#526579" ${extra}>${xml(t)}</text>`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 380"><rect width="1100" height="380" fill="#f7fafc"/><text x="${left}" y="28" font-family="sans-serif" font-size="18" fill="#16344c">Estimativa estatística da temperatura média${label?' · '+xml(label):''}</text>`;
 for(let v=min;v<=max;v+=Math.max(1,Math.round((max-min)/5)))s+=`<path d="M${left} ${sy(v).toFixed(1)}H${left+W}" stroke="#dce4ec"/>`+txt(left-8,sy(v)+4,v+' °C','text-anchor="end"');
 s+=`<path d="${days.map((d,i)=>(i?'L':'M')+sx(i).toFixed(1)+' '+sy(d.hi).toFixed(1)).join(' ')} ${[...days].reverse().map((d,j)=>'L'+sx(days.length-1-j).toFixed(1)+' '+sy(d.lo).toFixed(1)).join(' ')}Z" fill="#2c5bb5" opacity=".15"/>`;
 s+=`<path d="${days.map((d,i)=>(i?'L':'M')+sx(i).toFixed(1)+' '+sy(d.expected).toFixed(1)).join(' ')}" fill="none" stroke="#2c5bb5" stroke-width="2.5"/>`;
 days.forEach((d,i)=>{if(d.modelTemp!==null&&d.modelTemp!==undefined)s+=`<circle cx="${sx(i).toFixed(1)}" cy="${sy(d.modelTemp).toFixed(1)}" r="4.5" fill="#c5431e"><title>${d.date}: modelo ${d.modelTemp.toFixed(1)} °C · estimativa ${d.expected.toFixed(1)} °C (${d.lo.toFixed(1)} a ${d.hi.toFixed(1)})</title></circle>`;s+=txt(sx(i)-12,top+h+22,d.date.slice(8,10)+'/'+d.date.slice(5,7));});
 s+=txt(left,top+h+50,'Linha azul e faixa: estimativa do passado (média e intervalo de 90%). Pontos vermelhos: previsão do modelo meteorológico.')+txt(left,top+h+70,'Quando os dois divergem, prefira o modelo: o passado só ajuda nos primeiros dias.')+'</svg>';
 return s;
}
