import {collectAlerts,alertsLevel,OFFICIAL_LINKS,safeUrl} from './alerts-core.mjs';
import {explainAlerts} from './explain.mjs';
import {bindExplain,renderExplanation} from './explain-ui.mjs';
const $=id=>document.getElementById(id),fmt=(v,n=1)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:n,minimumFractionDigits:n}).format(v);
const brt=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' (Brasília)';
let report=null,loadId=0;
function item(parts,url){const li=document.createElement('li');const span=document.createElement('span');span.textContent=parts;li.append(span);const u=safeUrl(url);if(u){const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';a.textContent=' fonte ↗';li.append(a);}return li;}
function fill(id,items,empty){const ul=$(id);ul.replaceChildren();if(items===null){ul.append(item('Fonte indisponível nesta consulta.'));return;}if(!items.length){ul.append(item(empty));return;}items.forEach(x=>ul.append(x));}
function render(r){
 fill('alQuakes',r.quakes&&r.quakes.slice(0,8).map(q=>item(`M ${fmt(q.mag)} · ${q.place} · ${brt(q.time)}${q.tsunami?' · possibilidade de tsunami (conferir tsunami.gov)':''}`,q.url)),'Nenhum terremoto de magnitude 4,5 ou mais nas últimas 24 h.');
 fill('alSpace',r.space&&[...(r.kpForecast?[item(`Previsão de Kp (NOAA, próximos ${r.kpForecast.hours} h): até ${fmt(r.kpForecast.max)} em ${brt(r.kpForecast.maxTime)}`)]:[]),...r.space.slice(0,6).map(a=>item(`${a.kind??'Mensagem'}: ${a.text}${a.scale?' ('+a.scale+')':''} · ${brt(a.time)}`))],'Sem avisos de clima espacial nos últimos 3 dias.');
 fill('alDisasters',r.disasters&&r.disasters.slice(0,8).map(d=>item(`${d.level==='Red'?'Vermelho':'Laranja'} · ${d.type}${d.country?' · '+d.country:''} · ${d.current?'em andamento':'encerrado'}${d.to?' (até '+brt(d.to)+')':''}`,d.url)),'Nenhum evento laranja ou vermelho recente.');
 const lv=alertsLevel(r);$('alLevel').textContent=['Nada fora do rotineiro','Eventos moderados registrados','Avisos relevantes: vale acompanhar','Eventos graves: siga as autoridades'][lv];$('alLevel').dataset.level=lv;
 $('alState').textContent=`Consultado em ${brt(Date.parse(r.collectedAt))}. ${r.errors.join(' ')} ${r.notes.join(' ')}`.trim();$('alState').classList.toggle('error',r.errors.length>0);
 if(!$('alExplain').hidden)renderExplanation($('alExplain'),explainAlerts(report));
}
async function load(){const id=++loadId;$('alRefresh').disabled=true;$('alState').textContent='Consultando USGS, NOAA e GDACS…';$('alState').classList.remove('error');
 try{const r=await collectAlerts();if(id!==loadId)return;report=r;render(r);}catch(e){if(id===loadId){$('alState').textContent='Consulta indisponível: '+e.message;$('alState').classList.add('error');}}finally{if(id===loadId)$('alRefresh').disabled=false;}}
if($('alerts')){
 const l=$('alLinks');for(const [k,u] of Object.entries({USGS:OFFICIAL_LINKS.usgs,'NOAA SWPC':OFFICIAL_LINKS.swpc,GDACS:OFFICIAL_LINKS.gdacs,'INMET (Brasil)':OFFICIAL_LINKS.inmet})){const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';a.textContent=k;l.append(a,document.createTextNode(' · '));}
 $('alRefresh').onclick=load;bindExplain($('alExplainBtn'),$('alExplain'),()=>explainAlerts(report));load();}
