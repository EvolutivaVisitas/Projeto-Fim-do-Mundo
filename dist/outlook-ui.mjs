import {collectForecast,forecastSvg} from './weather-core.mjs';
import {collectAlerts} from './alerts-core.mjs';
import {summarize} from './climate-core.mjs';
import {buildOutlook} from './outlook-core.mjs';
const $=id=>document.getElementById(id);
const brt=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' (Brasília)';
let runId=0,chartUrl;
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
const LV=['Normal','Atenção leve','Atenção','Alerta'];
function render(o,fc,label){
 $('otVerdictBox').dataset.level=o.level===null?'n':o.level;$('otLevel').textContent=o.label;$('otVerdict').textContent=o.verdict;$('otCaveat').textContent=o.caveat;
 const grid=$('otItems');grid.replaceChildren();
 for(const i of o.items){const d=el('div',undefined,'otItem'),b=el('span',i.level===null?'Sem dados':LV[i.level],'otBadge');b.dataset.level=i.level===null?'n':i.level;d.append(b,el('small',i.title),el('strong',i.value),el('p',i.detail));if(i.context)d.classList.add('ctx');grid.append(d);}
 const fig=$('otFig');
 if(fc?.forecast){if(chartUrl)URL.revokeObjectURL(chartUrl);chartUrl=URL.createObjectURL(new Blob([forecastSvg(fc.forecast,label)],{type:'image/svg+xml'}));$('otChart').src=chartUrl;fig.hidden=false;}else fig.hidden=true;
 $('otPlace').textContent=label||'ponto escolhido';$('otStamp').textContent='Calculado em '+brt(Date.parse(o.collectedAt));
}
async function run(){
 const id=++runId,pt=window.magneTerraPoint?.()??{lat:-16.758611,lon:-49.344444,label:'Goiânia'};
 $('otRun').disabled=true;$('otStamp').textContent='Calculando previsões e comparando com o normal…';$('otVerdictBox').dataset.level='n';
 try{
  const [fc,al,series]=await Promise.all([collectForecast(pt.lat,pt.lon),collectAlerts(),fetch('climate/global-temperature.json').then(r=>r.ok?r.json():null).catch(()=>null)]);
  if(id!==runId)return;
  render(buildOutlook({forecast:fc,alerts:al,climate:series?summarize(series):null}),fc,pt.label||`${pt.lat.toFixed(2)}, ${pt.lon.toFixed(2)}`);
 }catch(e){if(id===runId){$('otStamp').textContent='Não foi possível calcular agora: '+e.message;$('otVerdict').textContent='Sem dados suficientes. Nada foi estimado.';}}
 finally{if(id===runId)$('otRun').disabled=false;}
}
if($('outlook')){$('otRun').onclick=run;run();}
