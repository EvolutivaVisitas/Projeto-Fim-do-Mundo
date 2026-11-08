import {explainSelection} from './explain.mjs';
import {renderExplanation} from './explain-ui.mjs';
import {summarize} from './climate-core.mjs';
const $=id=>document.getElementById(id);
const cache={};
// Busca cada arquivo uma vez; em falha devolve null (a explicação diz que o dado está indisponível, sem estimar).
async function json(path){if(path in cache)return cache[path];try{const r=await fetch(path);if(!r.ok)throw Error('HTTP '+r.status);cache[path]=await r.json();}catch{return null;}return cache[path];}
// Região analisada no painel (se houver análise regional do tipo escolhido).
function region(kind){const st=window.magneTerraState?.();const d=st?.data;if(!d||d.mode!==kind||d.scope==='global'||!Array.isArray(d.points)||!d.points.length)return undefined;
 const v=d.points.map(p=>p.value).filter(Number.isFinite);if(!v.length)return undefined;return {radius:d.radius,lat:d.lat,lon:d.lon,min:Math.min(...v),max:Math.max(...v),count:d.points.length};}
const kinds=()=>[['magnetic','exMagnetic'],['gravity','exGravity'],['climate','exClimate']].filter(([,id])=>$(id).checked).map(([k])=>k);
async function build(){
 const ks=kinds(),[magnetic,gravity,series]=await Promise.all([ks.includes('magnetic')?json('global/magnetic-summary.json'):null,ks.includes('gravity')?json('global/gravity-summary.json'):null,ks.includes('climate')?json('climate/global-temperature.json'):null]);
 const regions={};for(const k of ['magnetic','gravity']){const r=ks.includes(k)?region(k):undefined;if(r)regions[k]=r;}
 return explainSelection({kinds:ks,magnetic,gravity,climate:series?summarize(series):null,regions});
}
async function show(){const box=$('selectionExplain');box.hidden=false;box.className='explain lvln';box.textContent='Preparando a explicação…';try{renderExplanation(box,await build());$('explainSelection').textContent='Esconder explicação';}catch(e){box.textContent='Não foi possível gerar a explicação: '+e.message;}}
if($('explainSelection')){
 $('explainSelection').onclick=()=>{if(!$('selectionExplain').hidden){$('selectionExplain').hidden=true;$('explainSelection').textContent='Explicar selecionadas';return;}show();};
 for(const id of ['exMagnetic','exGravity','exClimate'])$(id).onchange=()=>{if(!$('selectionExplain').hidden)show();};
 // Ao trocar o tipo de anomalia no painel, marca também o tipo escolhido (sem desmarcar os outros).
 $('mode')?.addEventListener('change',()=>{const id={magnetic:'exMagnetic',gravity:'exGravity',climate:'exClimate'}[$('mode').value];if(id){$(id).checked=true;if(!$('selectionExplain').hidden)show();}});
}
