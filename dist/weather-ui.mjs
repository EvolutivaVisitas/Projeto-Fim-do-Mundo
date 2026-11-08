import {LAYERS,gibsTemplate,findLatestFrame,frameTimes,ageLabel,collectAnomaly,collectMonthly,monthlySvg,collectForecast,forecastSvg,searchPlace} from './weather-core.mjs';
import {explainPoint,explainGlobal,explainMonthly,explainForecast} from './explain.mjs';
import {bindExplain,renderExplanation} from './explain-ui.mjs';
let lastAnomaly=null,pointLabel='';
const $=id=>document.getElementById(id),fmt=(v,n=1)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:n,minimumFractionDigits:n}).format(v),sign=v=>(v>0?'+':v<0?'−':'')+fmt(Math.abs(v));
const brt=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' (Brasília)';
let map,sat,marker,global,markers,frames=[],layerKey='geocolor',timer,loadId=0,point={lat:-16.758611,lon:-49.344444},started=false;
function probe(url){return new Promise(ok=>{const img=new Image(),t=setTimeout(()=>{img.src='';ok(false);},8000);img.onload=()=>{clearTimeout(t);ok(true);};img.onerror=()=>{clearTimeout(t);ok(false);};img.src=url;});}
const findLatest=layer=>findLatestFrame(layer,probe);
function setFrame(i){const layer=LAYERS[layerKey];i=Math.max(0,Math.min(frames.length-1,i));$('wxSlider').value=i;const ms=frames[i];sat.setUrl(gibsTemplate(layer,ms));$('wxFrameTime').textContent=layer.daily?new Date(ms).toISOString().slice(0,10)+' (UTC, produto diário)':brt(ms)+' · '+new Date(ms).toISOString().slice(11,16)+' UTC';$('wxFrameAge').textContent=i===frames.length-1?`Quadro mais recente publicado · ${ageLabel(ms)}`:`${ageLabel(ms)}`;}
function stop(){clearInterval(timer);timer=undefined;$('wxPlay').textContent='▶ Reproduzir';}
async function loadLayer(){stop();const id=++loadId,layer=LAYERS[layerKey];$('wxNote').textContent=layer.note;$('wxLegend').textContent=layer.legend;$('wxKind').textContent=layer.kind;$('wxStatus').textContent='Procurando o quadro mais recente publicado…';$('wxStatus').classList.remove('error');
 const latest=await findLatest(layer);if(id!==loadId)return;
 if(latest===null){frames=[];sat.setUrl('');$('wxStatus').textContent='A NASA GIBS não retornou quadros recentes para esta camada. Nada é exibido no lugar.';$('wxStatus').classList.add('error');$('wxFrameTime').textContent='—';$('wxFrameAge').textContent='';return;}
 frames=frameTimes(layer,latest);$('wxSlider').max=frames.length-1;$('wxSlider').disabled=false;$('wxPlay').disabled=false;setFrame(frames.length-1);$('wxStatus').textContent='Fonte: NASA GIBS. Arraste o controle para ver as mudanças nos quadros anteriores.';}
function play(){if(timer){stop();return;}let i=Number($('wxSlider').value);if(i>=frames.length-1)i=0;setFrame(i);$('wxPlay').textContent='⏸ Pausar';timer=setInterval(()=>{i++;if(i>=frames.length){stop();return;}setFrame(i);},700);}
function row(label,value,note=''){return `<div><small>${label}</small><strong>${value}</strong>${note?`<span>${note}</span>`:''}</div>`;}
function refreshExplain(){if(!$('wxExplain').hidden)renderExplanation($('wxExplain'),explainPoint(lastAnomaly,pointLabel));}
function renderAnomaly(a){lastAnomaly=a;refreshExplain();const box=$('wxCards');let html='';
 if(a.current)html+=row('AGORA (modelo)',`${fmt(a.current.temperature)} °C`,`Chuva na última hora: ${a.current.precipitation===null?'—':fmt(a.current.precipitation)+' mm'} · ${brt(Date.parse(a.current.time))}`);
 if(a.temp){const t=a.temp;html+=row('TEMPERATURA · 24 H',t.z===undefined?`${fmt(t.mean24h)} °C`:`${sign(t.anomaly)} °C`,t.z===undefined?'Sem climatologia para comparar.':`Média ${fmt(t.mean24h)} °C vs. normal ${fmt(t.climMean)} °C (desvio ${fmt(t.climSd)} °C). ${t.label}, z = ${sign(t.z)}.`);}
 else html+=row('TEMPERATURA · 24 H','Sem dados','A fonte não retornou temperatura válida.');
 if(a.rain){const r=a.rain;html+=row('CHUVA · 7 DIAS',r.anomaly===undefined?`${fmt(r.sum7d)} mm`:`${sign(r.anomaly)} mm`,r.anomaly===undefined?'Sem climatologia para comparar.':`Acumulado ${fmt(r.sum7d)} mm vs. normal ${fmt(r.climMean)} mm${r.pct===null?'':' ('+fmt(r.pct,0)+'%)'}. ${r.label}; percentil ${fmt(r.percentile,0)}.`);}
 else html+=row('CHUVA · 7 DIAS','Sem dados','A fonte não retornou precipitação válida.');
 box.innerHTML=html;
 $('wxAnomalyNote').textContent=`Ponto ${fmt(a.lat,3)}, ${fmt(a.lon,3)}${a.elevation===null?'':' · modelo a '+fmt(a.elevation,0)+' m'} · consulta ${brt(Date.parse(a.collectedAt))}. Climatologia ERA5 ${a.climatology} (±7 dias em torno da data). ${a.notes.join(' ')} ${a.errors.join(' ')}`.trim();$('wxAnomalyNote').classList.toggle('error',a.errors.length>0);}
let monthly=null,monthlyUrl,monthlyId=0;
function resetMonthly(){monthlyId++;monthly=null;$('monthlyFig').hidden=true;$('explainMonthly').hidden=true;$('monthlyExplain').hidden=true;$('explainMonthly').textContent='Explicar em linguagem simples';$('monthlyState').textContent='';$('monthlyState').classList.remove('error');$('loadMonthly').disabled=false;}
// Últimos 12 meses completos do ponto escolhido, só sob demanda (cada consulta usa a cota gratuita da Open-Meteo).
async function loadMonthly(){const id=++monthlyId;$('loadMonthly').disabled=true;$('monthlyState').textContent='Consultando os últimos 12 meses (Open-Meteo / ERA5)…';$('monthlyState').classList.remove('error');
 let m;try{m=await collectMonthly(point.lat,point.lon);}catch(e){m={rows:null,errors:['Consulta indisponível: '+e.message]};}
 if(id!==monthlyId)return;$('loadMonthly').disabled=false;monthly=m;
 if(!m.rows){$('monthlyState').textContent=m.errors.join(' ');$('monthlyState').classList.add('error');$('monthlyFig').hidden=true;$('explainMonthly').hidden=true;return;}
 if(monthlyUrl)URL.revokeObjectURL(monthlyUrl);monthlyUrl=URL.createObjectURL(new Blob([monthlySvg(m.rows,pointLabel)],{type:'image/svg+xml'}));$('monthlyChart').src=monthlyUrl;$('downloadMonthly').href=monthlyUrl;$('downloadMonthly').download='ultimos-12-meses.svg';$('monthlyFig').hidden=false;$('explainMonthly').hidden=false;
 $('monthlyState').textContent='Meses completos dos últimos 12, comparados à média mensal ERA5 1991–2020. Meses sem dados completos aparecem como “s/d”.';}
let forecast=null,forecastUrl,forecastId=0;
function resetForecast(){forecastId++;forecast=null;$('forecastFig').hidden=true;$('explainForecast').hidden=true;$('forecastExplain').hidden=true;$('explainForecast').textContent='Explicar em linguagem simples';$('forecastState').textContent='';$('forecastState').classList.remove('error');$('loadForecast').disabled=false;}
// Previsão dos próximos dias do ponto escolhido, só sob demanda (usa a cota gratuita da Open-Meteo).
async function loadForecast(){const id=++forecastId;$('loadForecast').disabled=true;$('forecastState').textContent='Consultando a previsão (Open-Meteo)…';$('forecastState').classList.remove('error');
 let r;try{r=await collectForecast(point.lat,point.lon);}catch(e){r={forecast:null,errors:['Consulta indisponível: '+e.message]};}
 if(id!==forecastId)return;$('loadForecast').disabled=false;forecast=r;
 if(!r.forecast){$('forecastState').textContent=r.errors.join(' ');$('forecastState').classList.add('error');$('forecastFig').hidden=true;$('explainForecast').hidden=true;return;}
 if(forecastUrl)URL.revokeObjectURL(forecastUrl);forecastUrl=URL.createObjectURL(new Blob([forecastSvg(r.forecast,pointLabel)],{type:'image/svg+xml'}));$('forecastChart').src=forecastUrl;$('downloadForecast').href=forecastUrl;$('downloadForecast').download='previsao-anomalias.svg';$('forecastFig').hidden=false;$('explainForecast').hidden=false;
 $('forecastState').textContent=(r.hasClimatology?'Previsão dos próximos dias comparada à média ERA5 1991–2020 ('+r.climateSource+'). ':'Previsão sem comparação com o normal (climatologia indisponível). ')+r.errors.join(' ');if(r.errors.length)$('forecastState').classList.add('error');}
let anomalyId=0;
// Só a consulta mais recente atualiza a tela: cliques rápidos não deixam uma resposta antiga sobrescrever a nova.
async function anomaly(){const id=++anomalyId;$('wxAnomalyNote').textContent='Consultando Open-Meteo (análise recente e 30 anos de ERA5)…';$('wxAnomalyNote').classList.remove('error');$('wxCards').replaceChildren();lastAnomaly=null;
 try{const a=await collectAnomaly(point.lat,point.lon);if(id===anomalyId)renderAnomaly(a);}catch(e){if(id!==anomalyId)return;$('wxAnomalyNote').textContent='Consulta indisponível: '+e.message;$('wxAnomalyNote').classList.add('error');}}
function select(lat,lon,label){pointLabel=label??'';resetMonthly();resetForecast();point={lat:Math.max(-89,Math.min(89,lat)),lon:((lon+180)%360+360)%360-180};marker?.remove();marker=L.circleMarker([point.lat,point.lon],{radius:7,color:'#fff',weight:3,fillColor:'#101b2b',fillOpacity:1}).addTo(map);$('wxPoint').textContent=(label?label+' · ':'')+`${fmt(point.lat,3)}, ${fmt(point.lon,3)}`;anomaly();}
function start(){if(started||typeof L==='undefined')return;started=true;
 map=L.map('wxMap',{worldCopyJump:true,minZoom:2,maxZoom:10}).setView([-16.76,-49.34],4);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19}).addTo(map);
 sat=L.tileLayer('',{opacity:.85,maxNativeZoom:7,maxZoom:10,attribution:'NASA GIBS · GOES (NOAA/NASA) · IMERG · GHRSST MUR'}).addTo(map);
 map.on('click',e=>select(e.latlng.lat,e.latlng.lng));
 for(const [key,l] of Object.entries(LAYERS)){const o=document.createElement('option');o.value=key;o.textContent=l.label;$('wxLayer').append(o);}
 $('wxLayer').onchange=()=>{layerKey=$('wxLayer').value;loadLayer();};$('wxSlider').oninput=()=>{stop();setFrame(Number($('wxSlider').value));};$('wxPlay').onclick=play;
 $('wxOpacity').oninput=()=>sat.setOpacity(Number($('wxOpacity').value));$('wxRefresh').onclick=()=>{loadLayer();anomaly();};
 loadLayer();select(point.lat,point.lon);}
// ---- Panorama global (arquivo coletado pelo coletor) e busca de lugares ----
const zColor=z=>z===null||z===undefined?'#8a96a3':z>=0?`hsl(${40-Math.min(z,3)/3*30} 80% ${72-Math.min(z,3)*9}%)`:`hsl(215 70% ${72+Math.max(z,-3)*9}%)`;
const cell=(tr,text,cls)=>{const td=document.createElement('td');td.textContent=text;if(cls)td.className=cls;tr.append(td);return td;};
const signed=(v,unit)=>v===null||v===undefined?'—':(v>0?'+':v<0?'−':'')+fmt(Math.abs(v))+unit;
function filtered(){const c=$('wxCont').value,q=$('wxFilter').value.trim().toLowerCase(),s=$('wxSort').value,list=global.places.filter(p=>(!c||p.continent===c)&&(!q||(p.name+' '+p.country).toLowerCase().includes(q)));
 if(s==='name')return list.sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 const key={hot:p=>-p.tempAnomaly,cold:p=>p.tempAnomaly,wet:p=>-p.rainPct,dry:p=>p.rainPct}[s],usable=p=>p.status==='ok'&&(s==='wet'||s==='dry'?p.rainPct!==null:p.tempAnomaly!==null);
 return [...list.filter(usable).sort((a,b)=>key(a)-key(b)),...list.filter(p=>!usable(p))];}
function goPlace(p){map.setView([p.lat,p.lon],6);select(p.lat,p.lon,p.name+', '+p.country);$('wxMap').scrollIntoView({behavior:'smooth',block:'center'});}
function renderGlobal(){const list=filtered(),body=$('wxRows');body.replaceChildren();markers.clearLayers();
 for(const p of list){const tr=document.createElement('tr'),ok=p.status==='ok';cell(tr,p.name);cell(tr,p.country);
  if(!ok)cell(tr,'Sem dados válidos nesta coleta').colSpan=4;
  else{cell(tr,fmt(p.tempMean24h)+' °C');cell(tr,signed(p.tempAnomaly,' °C')+(p.tempLabel&&p.tempLabel!=='dentro da variação típica'?' · '+p.tempLabel:''),'strong');cell(tr,p.rain7d===null?'—':fmt(p.rain7d)+' mm');cell(tr,p.rainPct===null?'—':fmt(p.rainPct,0)+'%');}
  const td=document.createElement('td'),b=document.createElement('button');b.textContent='Ver ↗';b.onclick=()=>goPlace(p);td.append(b);tr.append(td);body.append(tr);
  const m=L.circleMarker([p.lat,p.lon],{radius:7,color:'#fff',weight:1.5,fillColor:zColor(ok?p.z:null),fillOpacity:.95,bubblingMouseEvents:false}).addTo(markers),tip=document.createElement('div');
  tip.textContent=p.name+', '+p.country+': '+(ok?signed(p.tempAnomaly,' °C')+' vs. normal':'sem dados');m.bindPopup(tip);m.on('click',()=>select(p.lat,p.lon,p.name+', '+p.country));}
 if(!list.length){const tr=document.createElement('tr');cell(tr,'Nenhum lugar corresponde ao filtro.').colSpan=7;body.append(tr);}}
async function loadGlobal(){
 try{const r=await fetch('reports/weather-latest.json',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);global=await r.json();}
 catch(e){$('wxGlobalStamp').textContent='Panorama global indisponível: ainda não há coleta publicada ('+e.message+'). A busca de lugares e o mapa continuam funcionando.';$('wxGlobalStamp').classList.add('error');return;}
 const age=Date.now()-Date.parse(global.collectedAt);
 $('wxGlobalStamp').textContent=`Coleta em ${brt(Date.parse(global.collectedAt))} · ${global.withData} de ${global.count} lugares com dados · climatologia ${global.climatology}${age>36*3600000?' · coleta antiga, não representa o momento atual':''}`;
 $('wxGlobalNote').textContent=global.note+(global.errors.length?' '+global.errors.join(' '):'');$('wxGlobalNote').classList.toggle('error',global.errors.length>0);
 for(const c of new Set(global.places.map(p=>p.continent))){const o=document.createElement('option');o.value=c;o.textContent=c;$('wxCont').append(o);}
 markers=L.layerGroup().addTo(map);
 for(const id of ['wxCont','wxSort'])$(id).onchange=renderGlobal;$('wxFilter').oninput=renderGlobal;
 $('wxMarkers').onchange=()=>{if($('wxMarkers').checked)markers.addTo(map);else markers.remove();};
 renderGlobal();}
function li(text,cls){const e=document.createElement('li');e.textContent=text;if(cls)e.className=cls;return e;}
$('wxSearch').onsubmit=async e=>{e.preventDefault();const box=$('wxResults');box.replaceChildren();
 try{const found=await searchPlace($('wxQuery').value);if(!found.length){box.append(li('Nenhum lugar encontrado.'));return;}
  for(const p of found){const item=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=[p.name,p.region,p.country].filter(Boolean).join(', ');b.onclick=()=>{map.setView([p.lat,p.lon],6);select(p.lat,p.lon,p.name);box.replaceChildren();};item.append(b);box.append(item);}}
 catch(err){box.append(li('Busca indisponível: '+err.message,'error'));}};
$('loadMonthly').onclick=loadMonthly;$('loadForecast').onclick=loadForecast;
bindExplain($('explainForecast'),$('forecastExplain'),()=>explainForecast(forecast,pointLabel));
bindExplain($('explainMonthly'),$('monthlyExplain'),()=>explainMonthly(monthly,pointLabel));
bindExplain($('explainPoint'),$('wxExplain'),()=>explainPoint(lastAnomaly,pointLabel));
bindExplain($('explainGlobal'),$('wxGlobalExplain'),()=>explainGlobal(global));
window.magneTerraPoint=()=>({lat:point.lat,lon:point.lon,label:pointLabel});
if($('weather')){start();if(started)loadGlobal();}
