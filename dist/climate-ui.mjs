import {summarize,climateSvg,GISTEMP_SOURCE} from './climate-core.mjs';
import {explainClimate} from './explain.mjs';
import {bindExplain} from './explain-ui.mjs';
const $=id=>document.getElementById(id),fmt=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(v),sg=v=>(v>0?'+':v<0?'−':'')+fmt(Math.abs(v));
let summary=null,url;
function card(label,value,note){const d=document.createElement('div'),a=document.createElement('small'),b=document.createElement('strong'),c=document.createElement('span');a.textContent=label;b.textContent=value;c.textContent=note;d.append(a,b,c);return d;}
async function init(){
 const state=$('climateState');if(!state)return;
 try{
  const r=await fetch('climate/global-temperature.json',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
  const series=await r.json();summary=summarize(series);if(!summary)throw Error('série vazia');
  const age=Date.now()-Date.parse(series.fetchedAt??0);
  state.textContent=`Série ${summary.firstYear}–${summary.latest.year} · último mês com dado: ${summary.latest.monthLabel}/${summary.latest.year} · baixada em ${series.fetchedAt?new Date(series.fetchedAt).toLocaleDateString('pt-BR'):'data desconhecida'}${age>45*86400000?' · arquivo antigo; rode a coleta':''}`;
  const cards=$('climateCards');cards.replaceChildren(
   card('ÚLTIMOS 12 MESES',summary.last12.mean===null?'—':sg(summary.last12.mean)+' °C','vs. média 1951–1980 (NASA GISTEMP)'),
   card(`ANO ${summary.lastFull.year}`,sg(summary.lastFull.value)+' °C',`${summary.lastFull.rank}º mais quente de ${summary.lastFull.of} anos registrados`),
   card('TENDÊNCIA DESDE 1970',summary.trendPerDecade===null?'—':'+'+fmt(summary.trendPerDecade)+' °C/década','regressão linear das médias anuais'));
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([climateSvg(series)],{type:'image/svg+xml'}));$('climateChart').src=url;$('climateChart').hidden=false;$('downloadClimate').href=url;$('downloadClimate').download='temperatura-global.svg';
  $('climateSource').href=GISTEMP_SOURCE.url;
 }catch(e){state.textContent='Série de temperatura global indisponível ('+e.message+'). Rode collect-climate.mjs (ou collect-daily.mjs) e recarregue; nada é estimado.';state.classList.add('error');}
}
bindExplain($('explainClimate'),$('climateExplain'),()=>explainClimate(summary));
init();
