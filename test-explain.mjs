import assert from 'node:assert/strict';
import {kpLevel,tempLevel,rainLevel,explainGeomagnetic,explainPoint,explainGlobal,explainDaily,explainMonthly,explainForecast,explainProjection,explainSelection,END_OF_WORLD,LEVELS} from './dist/explain.mjs';
const text=e=>e.headline+' '+e.sections.map(s=>s.title+' '+s.text).join(' ');
// Níveis
assert.deepEqual([2,4,5,6,8,9].map(kpLevel),[0,1,1,2,3,3]);
assert.deepEqual([0.5,1,2,3,-3.5].map(z=>tempLevel(z)),[0,1,2,3,3]);
assert.equal(tempLevel(3.3,1.9),1);assert.equal(tempLevel(3.3,3),2);assert.equal(tempLevel(3.3,6),3);assert.equal(tempLevel(.3,6),0);
assert.deepEqual([100,24,10,200,300].map(rainLevel),[0,1,1,2,3]);
// Geomagnético: calmo, forte e sem dados
const calm=explainGeomagnetic({max:2.33,rows:Array(8).fill(1),stale:false});assert.equal(calm.level,0);assert.match(text(calm),/calmo/);
const storm=explainGeomagnetic({max:8.67,rows:Array(8).fill(1),stale:false});assert.equal(storm.level,3);assert.match(text(storm),/rara/);assert.match(text(storm),/sem risco|Não há risco à saúde/);
const none=explainGeomagnetic({max:null,rows:[]});assert.equal(none.level,null);assert.equal(none.levelLabel,'Sem dados suficientes');assert.match(text(none),/Nada foi estimado/);
assert.match(text(explainGeomagnetic({max:5,rows:[1,2],stale:true})),/parcial ou desatualizada/);
// Toda explicação traz a resposta sobre fim do mundo e nunca usa linguagem catastrofista
for(const e of [calm,storm,none,explainPoint(null),explainGlobal(null)]){assert.ok(e.sections.some(s=>s.title==='É o fim do mundo?'&&s.text===END_OF_WORLD));assert.doesNotMatch(text(e),/apocalipse|catástrofe iminente|fim dos tempos/i);}
// Ponto: calor extremo + chuva forte
const hot={temp:{mean24h:30,anomaly:4,z:2.4,climMean:26,climSd:1.7},rain:{sum7d:100,anomaly:60,pct:250,climMean:40},notes:[],errors:[]};
const p=explainPoint(hot,'Goiânia');assert.equal(p.level,2);assert.match(text(p),/4,0 °C acima do normal/);assert.match(text(p),/alagamentos/);assert.match(text(p),/Tempo não é clima/);
const ok=explainPoint({temp:{mean24h:26.2,anomaly:.2,z:.1,climMean:26,climSd:1.7},rain:{sum7d:40,anomaly:0,pct:100,climMean:40},notes:[],errors:[]});assert.equal(ok.level,0);assert.match(ok.headline,/dentro do normal/);
// Sem climatologia: não afirma bom/ruim
const noClim=explainPoint({temp:{mean24h:27},rain:null,notes:[],errors:[]});assert.equal(noClim.level,null);assert.match(text(noClim),/não está disponível/);
// Global: dia comum x dia anômalo, e climatologia incompleta
const mk=(n,hotN)=>({count:n,places:Array.from({length:n},(_,i)=>({status:'ok',name:'L'+i,z:i<hotN?2.5:0.2,tempAnomaly:i<hotN?4:0.3}))});
assert.equal(explainGlobal(mk(100,5)).level,0);assert.equal(explainGlobal(mk(100,16)).level,2);assert.equal(explainGlobal(mk(100,30)).level,3);
const inc=explainGlobal({count:3,places:[{status:'ok',name:'A',z:null}]});assert.equal(inc.level,null);assert.match(text(inc),/climatologia está incompleta/);
// Boletim diário combina espaço + tempo e usa o maior nível
const d=explainDaily({max:2,rows:Array(8).fill(1),stale:false,weather:{point:{name:'Goiânia'},anomaly:hot}});assert.equal(d.level,2);assert.ok(d.sections.some(s=>s.title.startsWith('Espaço · ')));assert.ok(d.sections.some(s=>s.title.startsWith('Tempo · ')));assert.equal(d.sections.filter(s=>s.title==='É o fim do mundo?').length,1);
assert.equal(explainDaily({max:2,rows:Array(8).fill(1),stale:false}).level,0);
assert.equal(LEVELS.length,4);
// Últimos 12 meses do lugar
const mrows=(a,p)=>Array.from({length:12},(_,i)=>({year:2025,month:i,tempAnomaly:a,z:a/1.2,rainPct:p}));
const mw=explainMonthly({rows:mrows(2.5,180),errors:[]},'Goiânia');assert.equal(mw.level,2);assert.match(text(mw),/Entre os 12 meses com dados completos/);assert.match(text(mw),/acima do normal/);assert.match(text(mw),/Tempo não é clima/);
assert.equal(explainMonthly({rows:mrows(.1,100),errors:[]}).level,0);
const part=mrows(2.5,100);part[0].tempAnomaly=null;part[0].z=null;assert.match(text(explainMonthly({rows:part,errors:[]})),/1 mês\(es\) sem dados/);
const nm=explainMonthly({rows:null,errors:['Open-Meteo (ERA5): fonte indisponível.']});assert.equal(nm.level,null);assert.match(text(nm),/indisponível/);assert.ok(nm.sections.some(s=>s.title==='É o fim do mundo?'));
// Explicação combinada: 1, 2 ou 3 anomalias
const gmag={min:-2930,max:8326,ranks:{positive:[{lat:62.55,lon:135.95}],negative:[{lat:-26.95,lon:-68.65}]}},ggra={min:-360,max:791,ranks:{positive:[{lat:10.85,lon:-73.65}],negative:[{lat:-76.55,lon:-53.35}]}};
const csum={last12:{mean:1.2,count:12},latest:{year:2026,month:8,monthLabel:'set',value:1.4},lastFull:{year:2025,value:1.18,rank:2,of:146},warmest:{year:2024,value:1.28},trendPerDecade:.2,decades:{1970:.03,2020:1.06},firstYear:1880};
const one=explainSelection({kinds:['magnetic'],magnetic:gmag});assert.equal(one.levelLabel,'Referência estática (sem alerta)');assert.ok(one.sections.every(s=>s.title==='É o fim do mundo?'||s.title.startsWith('Magnetismo · ')));assert.match(text(one),/8\.326 nT/);assert.match(text(one),/Não preveem|não preveem terremotos/i);
const reg=explainSelection({kinds:['gravity'],gravity:ggra,regions:{gravity:{radius:100,lat:-16.7,lon:-49.3,min:-20,max:30,count:500}}});assert.match(text(reg),/Em 100 km ao redor de 16,70°S/);assert.ok(!/Magnetismo ·/.test(text(reg)));
const all=explainSelection({kinds:['magnetic','gravity','climate'],magnetic:gmag,gravity:ggra,climate:csum});assert.equal(all.level,2);assert.match(all.levelLabel,/^Clima: /);for(const p of ['Magnetismo · ','Gravidade · ','Clima · '])assert.ok(all.sections.some(s=>s.title.startsWith(p)));assert.equal(all.sections.filter(s=>s.title==='É o fim do mundo?').length,1);assert.match(all.sections.at(-1).text,/longo prazo/);
const clim=explainSelection({kinds:['climate'],climate:csum});assert.equal(clim.level,2);assert.ok(!/Magnetismo ·|Gravidade ·/.test(text(clim)));
assert.equal(explainSelection({kinds:[]}).level,null);assert.match(text(explainSelection({kinds:[]})),/Escolha pelo menos uma/);
const miss=explainSelection({kinds:['magnetic','climate'],magnetic:null,climate:null});assert.match(text(miss),/não está disponível agora\. Nada foi estimado/);assert.match(text(miss),/Nada foi estimado/);
assert.doesNotMatch(text(all),/apocalipse|catástrofe iminente|fim dos tempos/i);
// Previsão
const fd=(a,t)=>({date:'2026-11-'+String(9+t).padStart(2,'0'),temp:25+a,rain:1,climMean:25,anomaly:a,z:a/1.2});
const hotF={forecast:{days:Array.from({length:10},(_,i)=>fd(5,i)),rain:{sum:80,climMean:30,pct:267}},errors:[]};
const ef=explainForecast(hotF,'Goiânia');assert.equal(ef.level,2);assert.match(text(ef),/acima do normal/);assert.match(text(ef),/alagamento/);assert.match(text(ef),/não é um aviso oficial|Não é um aviso oficial|não prevê terremotos/);assert.match(text(ef),/Quão confiável/);
const calmF=explainForecast({forecast:{days:Array.from({length:10},(_,i)=>fd(.2,i)),rain:null},errors:[]});assert.equal(calmF.level,0);
const extF=explainForecast({forecast:{days:Array.from({length:10},(_,i)=>fd(9,i)),rain:null},errors:[]});assert.equal(extF.level,2,'previsão nunca passa de vale acompanhar');
const noc=explainForecast({forecast:{days:[{date:'2026-11-09',temp:27,anomaly:null,z:null}],rain:null},errors:[]});assert.equal(noc.level,0);assert.match(text(noc),/comparação com o normal não está disponível/);
const nof=explainForecast({forecast:null,errors:['Open-Meteo (previsão): fonte indisponível.']});assert.equal(nof.level,null);assert.match(text(nof),/Nada foi estimado|nada foi estimado/);
// Estimativa futura
const projFx={days:{recentAnomaly:2,usefulDays:5,days:[{date:'2026-11-09',expected:26,lo:24,hi:28,expectedAnomaly:1},{date:'2026-11-12',expected:25,lo:23,hi:27,expectedAnomaly:.4}]},months:{recentAnomaly:1.2,months:[{year:2026,month:10,expected:25,lo:23,hi:27,expectedAnomaly:.5}]},quakes:{years:10,radiusKm:500,rows:[{scope:'global',mag:6,count:1342,perYear:134.2,p7:.93,p30:1},{scope:'local',mag:5,count:0,perYear:0,p7:0,p30:0}]},global:{from:1970,slopePerDecade:.2,points:[{year:2030,value:1.3,lo:1.1,hi:1.5},{year:2050,value:1.7,lo:1.4,hi:2}]},errors:[]};
const ep=explainProjection(projFx,'Goiânia');assert.equal(ep.levelLabel,'Estimativa estatística (sem alerta)');assert.match(text(ep),/até cerca de 5 dias/);assert.match(text(ep),/não uma previsão de quando ou onde|terremotos não podem ser previstos/);assert.match(text(ep),/93%/);assert.match(text(ep),/menos de 1%|0%/);assert.match(text(ep),/não uma projeção climática/);assert.ok(ep.sections.some(s=>s.title==='É o fim do mundo?'));
const epNo=explainProjection({days:null,months:null,quakes:null,global:null,errors:['sem dados']},'Goiânia');assert.equal(epNo.level,null);assert.match(text(epNo),/nada foi estimado/i);
assert.doesNotMatch(text(ep),/apocalipse|catástrofe iminente|certeza de que/i);
console.log('Passed: levels, plain-language explanations, missing data, global baseline, no alarmism.');
