import {skyOutlook} from './sky-core.mjs';
import {explainSky} from './explain.mjs';
import {bindExplain} from './explain-ui.mjs';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const f0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v),f1=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(v);
const brt=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const rel=(ms,now)=>{const d=(ms-now)/86400000,a=Math.abs(d);if(a<1/48)return 'agora';const s=a<1?`${f0(a*24)} h`:a<60?`${f0(a)} ${Math.round(a)===1?'dia':'dias'}`:`${f1(a/30.44)} meses`;return d>0?'em '+s:'há '+s;};
let sky=null,label='',rels=[],timer;
function cell(tr,text){const td=document.createElement('td');td.textContent=text;tr.append(td);return td;}
function row(tbody,cells,ms){const tr=document.createElement('tr'),tds=cells.map(c=>cell(tr,c));if(ms!==undefined)rels.push({td:tds.at(-1),ms});tbody.append(tr);}
// Ícone da Lua desenhado em SVG (sem innerHTML). No hemisfério sul a Lua crescente aparece iluminada à esquerda.
function moonIcon(elong,south,size=76){
 const r=40,De=elong>180?360-elong:elong,c=Math.cos((180-De)*Math.PI/180),svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','-50 -50 100 100');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('role','img');svg.setAttribute('aria-label','Fase atual da Lua');
 const dark=document.createElementNS(NS,'circle');dark.setAttribute('r',r);dark.setAttribute('class','moonDark');svg.append(dark);
 const lit=document.createElementNS(NS,'path');lit.setAttribute('class','moonLit');
 lit.setAttribute('d',`M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${(r*Math.abs(c)).toFixed(2)} ${r} 0 0 ${c>0?1:0} 0 ${-r} Z`);
 const mirror=(elong<180)===south;lit.setAttribute('transform',mirror?'scale(-1 1)':'');svg.append(lit);
 return svg;
}
function localText(e){
 if(!e.horizon)return 'Escolha um ponto na seção “Tempo e satélite”';
 if(e.kind==='lunar')return e.horizon==='acima'?'Lua visível (acima do horizonte)':e.horizon==='abaixo'?'Lua abaixo do horizonte: não visível':'Lua no horizonte: incerto';
 return e.horizon==='abaixo'?'Sol abaixo do horizonte: não visível':'Depende da faixa do eclipse';
}
function render(){
 const now=Date.parse(sky.collectedAt),m=sky.moon,south=(sky.point?.lat??0)<0;rels=[];
 $('skyPlace').textContent=label||'ponto escolhido';
 const box=$('skyMoon');box.replaceChildren(moonIcon(m.elong,south));
 const t=document.createElement('div');const s=document.createElement('strong');s.textContent=m.stage;const p=document.createElement('p');p.textContent=`${f0(m.illum*100)}% iluminada · ${f1(m.age)} dias desde a lua nova · ${m.waxing?'crescendo':'minguando'}`;t.append(s,p);box.append(t);
 const ph=$('skyPhases');ph.replaceChildren();for(const e of sky.phases)row(ph,[brt(e.ms),e.name,rel(e.ms,now)],e.ms);
 const kinds={central:'central',parcial:'parcial',incerto:'tipo incerto',total:'total',penumbral:'penumbral'};
 const ec=$('skyEclipses');ec.replaceChildren();
 if(sky.eclipses.length)for(const e of sky.eclipses)row(ec,[brt(e.ms),`${e.kind==='solar'?'Solar':'Lunar'} · ${kinds[e.q]}`,localText(e),rel(e.ms,now)],e.ms);else row(ec,['Nenhum eclipse calculado','','','']);
 const se=$('skySeasons');se.replaceChildren();for(const e of sky.seasons)row(se,[brt(e.ms),`${e.name} (${e.season})`,rel(e.ms,now)],e.ms);
 $('skyStamp').textContent='Calculado em '+brt(now)+' (Brasília), no seu navegador, sem internet. Horários em Brasília.';
}
function run(){
 const pt=window.magneTerraPoint?.()??{lat:-16.758611,lon:-49.344444,label:'Goiânia'};label=pt.label||`${pt.lat.toFixed(2)}, ${pt.lon.toFixed(2)}`;
 try{sky=skyOutlook(Date.now(),pt);render();}
 catch(e){$('skyStamp').textContent='Não foi possível calcular agora: '+e.message;$('skyStamp').classList.add('error');}
}
// Atualiza só os "em X dias" a cada minuto, sem refazer as tabelas.
function tick(){if(document.hidden||!sky)return;const now=Date.now();for(const r of rels)r.td.textContent=rel(r.ms,now);}
if($('sky')){
 $('skyRun').onclick=run;
 bindExplain($('skyExplainBtn'),$('skyExplain'),()=>explainSky(sky,label));
 run();timer=setInterval(tick,60000);
}
