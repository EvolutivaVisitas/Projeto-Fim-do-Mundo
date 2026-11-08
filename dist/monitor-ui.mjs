import {collectReport,auroraSvg,kpSvg} from './monitor-core.mjs';
import {explainDaily} from './explain.mjs';
import {bindExplain,renderExplanation} from './explain-ui.mjs';
const $=id=>document.getElementById(id);let index=[],land,urls=[];
function localDate(s){return new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília)';}
let current;
bindExplain($('explainDaily'),$('dailyExplain'),()=>explainDaily(current));
const sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1).replace('.',',');
function weatherText(w){if(!w)return 'Sem registro de tempo/satélite neste boletim. Veja a seção Tempo e satélite para a consulta ao vivo.';const a=w.anomaly,t=a.temp?.anomaly,r=a.rain?.anomaly,sat=Object.values(w.satellite).filter(s=>s.latestFrame).map(s=>`${s.label}: ${new Date(s.latestFrame).toISOString().slice(0,16).replace('T',' ')} UTC`);return `Tempo em ${w.point.name} na coleta: `+(t===undefined?'anomalia de temperatura indisponível':`temperatura ${sg(t)} °C vs. normal ERA5 (${a.temp.label})`)+'; '+(r===undefined?'anomalia de chuva indisponível':`chuva em 7 dias ${sg(r)} mm vs. normal (${a.rain.label})`)+'. '+(sat.length?'Último quadro de satélite publicado — '+sat.join(' · ')+'. ':'')+w.note+(a.errors.length?' '+a.errors.join(' '):'');}
function show(report,archived){for(const url of urls)URL.revokeObjectURL(url);urls=[];const now=Date.now(),age=now-Date.parse(report.collectedAt);$('dailyStamp').textContent=`${archived?'Boletim arquivado':'Consulta ao vivo'} · coletado em ${localDate(report.collectedAt)} · janela de 24h`;$('dailySummary').textContent=report.summary;$('dailyKp').textContent=report.max===null?'Sem dados':report.max.toFixed(2).replace('.',',');$('dailyCoverage').textContent=`${report.rows.length} estimativas · ${report.coverage}`;$('dailyState').textContent=(age>36*3600000?'Boletim antigo. ':'')+(report.stale?'Kp atrasado ou indisponível. ':'')+(report.errors.length?report.errors.join(' '):'');
 const map=auroraSvg(report,land),chart=kpSvg(report);for(const [image,link,svg,name] of [['dailyMap','downloadDailyMap',map,'mapa-aurora.svg'],['dailyChart','downloadDailyChart',chart,'kp-24h.svg']]){const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));urls.push(url);$(image).src=url;$(link).href=url;$(link).download=name;}
 $('auroraTime').textContent=report.aurora?`Previsão para ${localDate(report.aurora.forecast)}. Retrato da previsão no momento da coleta; não representa todas as ocorrências do dia.`:'A fonte de aurora não retornou dados válidos.';
 $('dailyWeather').textContent=weatherText(report.weather);current=report;if(!$('dailyExplain').hidden)renderExplanation($('dailyExplain'),explainDaily(current));
 $('dailyContent').hidden=false;
}
async function loadSaved(path){const r=await fetch(path);if(!r.ok)throw Error('Não foi possível abrir o boletim.');show(await r.json(),true);}
async function live(){const b=$('refreshDaily');b.disabled=true;$('dailyState').textContent='Consultando NOAA SWPC…';try{const report=await collectReport();show(report,false);$('reportDate').value='live';}catch(e){$('dailyState').textContent='Consulta ao vivo indisponível. '+e.message;if(index.length)await loadSaved(index[0].json);}finally{b.disabled=false;}}
async function init(){try{const r=await fetch('land.geojson');if(r.ok)land=await r.json();}catch{}try{const r=await fetch('reports/index.json');if(r.ok)index=await r.json();for(const entry of index){const opt=document.createElement('option');opt.value=entry.json;opt.textContent=entry.date.split('-').reverse().join('/')+' · boletim salvo';$('reportDate').append(opt);}if(index.length){$('reportDate').value=index[0].json;await loadSaved(index[0].json);}else await live();}catch(e){$('dailyState').textContent=e.message;}}
$('refreshDaily').onclick=live;$('reportDate').onchange=()=>{const p=$('reportDate').value;if(p==='live')live();else loadSaved(p).catch(e=>$('dailyState').textContent=e.message);};
init();
