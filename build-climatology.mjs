// Gera/retoma dist/climate/places-climatology.json: climatologia ERA5 1991–2020 (Open-Meteo) para cada lugar de dist/places.mjs.
// Retomável: lugares já presentes no arquivo são pulados; o arquivo é gravado a cada lote. Respeita os limites gratuitos da API
// (por minuto/hora: espera; por dia: grava o que tem e termina — rode de novo depois). Rode raramente: a climatologia não muda diariamente.
import fs from 'node:fs/promises';
import {PLACES} from './dist/places.mjs';
import {CLIMATOLOGY,OPEN_METEO,climatologyTable} from './dist/weather-core.mjs';
import {fitDailyPersistence,fitMonthlyPersistence,serializeModels} from './dist/projection-core.mjs';
const FILE='dist/climate/places-climatology.json',BATCH=5,sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Ordem de prioridade: intercala continentes para que um arquivo parcial já cubra o mundo todo.
function interleaved(){const groups=new Map();for(const p of PLACES){if(!groups.has(p.continent))groups.set(p.continent,[]);groups.get(p.continent).push(p);}
 const lists=[...groups.values()],out=[];for(let i=0;lists.some(l=>i<l.length);i++)for(const l of lists)if(i<l.length)out.push(l[i]);return out;}
let out={version:1,period:CLIMATOLOGY.label,halfWindowDays:CLIMATOLOGY.halfWindowDays,source:'Open-Meteo Historical Weather API (ERA5), CC BY 4.0',generatedAt:new Date().toISOString(),places:{}};
try{const prev=JSON.parse(await fs.readFile(FILE,'utf8'));if(prev.period===out.period&&prev.halfWindowDays===out.halfWindowDays)out=prev;}catch{}
const save=async()=>{out.generatedAt=new Date().toISOString();await fs.mkdir('dist/climate',{recursive:true});await fs.writeFile(FILE,JSON.stringify(out));};
async function archive(group){
 const url=`${OPEN_METEO.archive}?${new URLSearchParams({latitude:group.map(p=>p.lat.toFixed(3)).join(','),longitude:group.map(p=>p.lon.toFixed(3)).join(','),start_date:CLIMATOLOGY.start,end_date:CLIMATOLOGY.end,daily:'temperature_2m_mean,precipitation_sum',timezone:'UTC'})}`;
 for(let attempt=0;attempt<8;attempt++){
  const r=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(r.ok){const j=await r.json();return Array.isArray(j)?j:[j];}
  if(r.status===429){
   const reason=(await r.json().catch(()=>({}))).reason??'';
   if(/daily/i.test(reason))return 'daily';
   if(/hourly/i.test(reason)){const now=new Date(),wait=(60-now.getMinutes())*60000-now.getSeconds()*1000+60000;console.log(`limite horário; aguardando ${Math.round(wait/60000)} min`);await sleep(wait);continue;}
   console.log('limite por minuto; aguardando 70 s');await sleep(70000);continue;
  }
  if(r.status<500)throw Error('HTTP '+r.status);
  await sleep(20000*(attempt+1));
 }
 throw Error('API indisponível; tente mais tarde');
}
const todo=interleaved().filter(p=>!out.places[p.id]||!out.places[p.id].model);
console.log(`${Object.keys(out.places).length} lugares já prontos; ${todo.length} a gerar`);
for(let i=0;i<todo.length;i+=BATCH){
 const group=todo.slice(i,i+BATCH),arr=await archive(group);
 if(arr==='daily'){console.log('limite diário da API atingido; progresso salvo. Rode novamente amanhã para completar.');break;}
 group.forEach((p,j)=>{const t=climatologyTable(arr[j]);if(t){const model=serializeModels(fitDailyPersistence(arr[j]),fitMonthlyPersistence(arr[j]));out.places[p.id]=model?{...t,model}:t;}else console.error('sem climatologia:',p.name);});
 await save();console.log(`${Object.keys(out.places).length}/${PLACES.length}`);
 await sleep(3000);
}
await save();
console.log('lugares com climatologia:',Object.keys(out.places).length,'de',PLACES.length);
