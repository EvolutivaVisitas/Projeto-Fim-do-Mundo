import {collectProjection,projectionSvg} from './projection-core.mjs';
import {explainProjection} from './explain.mjs';
import {bindExplain} from './explain-ui.mjs';
const $=id=>document.getElementById(id),f1=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(v);
const pct=v=>v===null||v===undefined?'—':v*100<1?'<1%':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v*100)+'%';
const MN=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
let proj=null,label='',runId=0,chartUrl;
function row(tbody,cells,cls){const tr=document.createElement('tr');if(cls)tr.className=cls;for(const c of cells){const td=document.createElement('td');td.textContent=c;tr.append(td);}tbody.append(tr);}
function render(p){
 $('prState').textContent=`Calculado em ${new Date(p.collectedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (Brasília) para ${label}${p.days||p.months?'. Base do histórico: '+p.source:''}. ${p.errors.join(' ')}`.trim();$('prState').classList.toggle('error',p.errors.length>0);
 // dias
 if(p.days){if(chartUrl)URL.revokeObjectURL(chartUrl);chartUrl=URL.createObjectURL(new Blob([projectionSvg(p.days.days,label)],{type:'image/svg+xml'}));$('prChart').src=chartUrl;$('prDaysFig').hidden=false;
  $('prDaysText').textContent=`Últimos 3 dias: ${f1(Math.abs(p.days.recentAnomaly))} °C ${p.days.recentAnomaly>=0?'acima':'abaixo'} do normal. O passado só ajuda a estimar até ~${p.days.usefulDays} dias à frente.`;}
 else{$('prDaysFig').hidden=true;$('prDaysText').textContent='Sem estimativa para os próximos dias: faltaram dados recentes ou o histórico de 30 anos. Nada foi preenchido.';}
 // meses
 const mb=$('prMonths');mb.replaceChildren();
 if(p.months)for(const m of p.months.months)row(mb,[`${MN[m.month]}/${m.year}`,f1(m.expected)+' °C',`${f1(m.lo)} a ${f1(m.hi)} °C`,(m.expectedAnomaly>=0?'+':'−')+f1(Math.abs(m.expectedAnomaly))+' °C']);
 else row(mb,['Sem estimativa (dados insuficientes)','','','']);
 // terremotos
 const qb=$('prQuakes');qb.replaceChildren();
 if(p.quakes)for(const q of p.quakes.rows){const name=(q.scope==='global'?'Mundo':`Até ${p.quakes.radiusKm} km do ponto`)+` · M ${String(q.mag).replace('.',',')}+`;
  if(q.count===null)row(qb,[name,'—','—','—']);else row(qb,[name,f1(q.perYear)+(q.capped?'+ (contagem limitada)':''),pct(q.p7),pct(q.p30)]);}
 else row(qb,['Sem dados do USGS','','','']);
 // global
 const gb=$('prGlobal');gb.replaceChildren();
 if(p.global)for(const g of p.global.points)row(gb,[String(g.year),(g.value>=0?'+':'−')+f1(Math.abs(g.value))+' °C',`${f1(g.lo)} a ${f1(g.hi)} °C`]);
 else row(gb,['Sem série global','','']);
 $('prGlobalNote').textContent=p.global?`Tendência linear desde ${p.global.from}: +${f1(p.global.slopePerDecade)} °C por década (base 1951–1980).`:'';
}
async function run(){
 const id=++runId,pt=window.magneTerraPoint?.()??{lat:-16.758611,lon:-49.344444,label:'Goiânia'};label=pt.label||`${pt.lat.toFixed(2)}, ${pt.lon.toFixed(2)}`;
 $('prRun').disabled=true;$('prState').textContent='Calculando a partir do passado e do presente…';$('prState').classList.remove('error');
 try{const series=await fetch('climate/global-temperature.json').then(r=>r.ok?r.json():null).catch(()=>null);
  const p=await collectProjection(pt.lat,pt.lon,Date.now(),fetch,series);if(id!==runId)return;proj=p;render(p);}
 catch(e){if(id===runId)$('prState').textContent='Não foi possível calcular agora: '+e.message;}
 finally{if(id===runId)$('prRun').disabled=false;}
}
if($('projection')){$('prRun').onclick=run;bindExplain($('prExplainBtn'),$('prExplain'),()=>explainProjection(proj,label));run();}
