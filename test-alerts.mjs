import assert from 'node:assert/strict';
import {parseUsgs,parseSwpc,parseGdacs,parseKpForecast,collectAlerts,alertsLevel,safeUrl} from './dist/alerts-core.mjs';
import {explainAlerts} from './dist/explain.mjs';
const now=Date.parse('2026-11-08T12:00:00Z'),H=3600000;
// safeUrl bloqueia esquemas perigosos
assert.equal(safeUrl('https://usgs.gov/x'),'https://usgs.gov/x');assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('http://x'),null);assert.equal(safeUrl(undefined),null);
// USGS: ordena por magnitude, descarta antigos/futuros/sem magnitude
const usgs={features:[{id:'a',properties:{mag:4.6,place:'A',time:now-2*H,url:'https://u/a',tsunami:0},geometry:{coordinates:[1,2,10]}},{id:'b',properties:{mag:6.1,place:'B',time:now-5*H,url:'javascript:x',tsunami:1},geometry:{coordinates:[3,4,20]}},{id:'c',properties:{mag:5,place:'C',time:now-30*H},geometry:{coordinates:[0,0,0]}},{id:'d',properties:{mag:null,place:'D',time:now-H},geometry:{coordinates:[0,0,0]}},{id:'e',properties:{mag:5,place:'E',time:now+10*H},geometry:{coordinates:[0,0,0]}}]};
const q=parseUsgs(usgs,now);assert.deepEqual(q.map(x=>x.id),['b','a']);assert.equal(q[0].url,null);assert.equal(q[0].tsunami,true);assert.equal(q[1].url,'https://u/a');assert.throws(()=>parseUsgs({}),/inválido/);
// SWPC: tipo, escala, filtro de 3 dias
const msg=(code,kind,text,scale)=>`Space Weather Message Code: ${code}\r\nSerial Number: 1\r\nIssue Time: x\r\n\r\n${kind}: ${text}\r\nThreshold Reached: x\r\nNOAA Scale: ${scale}\r\nComment: `;
const swpc=[{issue_datetime:'2026-11-08 10:00:00.000',message:msg('ALTK05','ALERT','Geomagnetic K-index of 5','G1 - Minor')},{issue_datetime:'2026-11-01 10:00:00.000',message:msg('ALTK05','ALERT','velho','G1 - Minor')},{issue_datetime:'2026-11-08 09:00:00.000',message:'Space Weather Message Code: SUMX\r\n\r\nSUMMARY: Sem escala'}];
const s=parseSwpc(swpc,now);assert.equal(s.length,2);assert.equal(s[0].kind,'ALERT');assert.equal(s[0].scale,'G1');assert.equal(s[0].text,'Geomagnetic K-index of 5');assert.equal(s[1].scale,null);assert.equal(s[0].code,'ALTK05');
// GDACS: só laranja/vermelho, em andamento ou encerrado há ≤7 dias; vermelho primeiro
const gd=(level,cur,to,type='TC')=>({geometry:{type:'Point',coordinates:[80,15]},properties:{eventtype:type,alertlevel:level,iscurrent:cur,name:'Evento '+level,country:'X',fromdate:'2026-11-01T00:00:00',todate:to,url:{report:'https://gdacs/r'}}});
const g=parseGdacs({features:[gd('Orange','false','2026-11-07T00:00:00'),gd('Red','true','2026-11-09T00:00:00'),gd('Green','true','2026-11-09T00:00:00'),gd('Red','false','2026-09-01T00:00:00','EQ')]},now);
assert.equal(g.length,2);assert.equal(g[0].level,'Red');assert.equal(g[0].current,true);assert.equal(g[0].type,'Ciclone tropical');
// Nível: só o que vale agora
assert.equal(alertsLevel({quakes:[{mag:4.6}],space:[],disasters:[]},now),0);
assert.equal(alertsLevel({quakes:[{mag:6.1}],space:[],disasters:[]},now),2);
assert.equal(alertsLevel({quakes:[{mag:7.2}]},now),3);
assert.equal(alertsLevel({quakes:[],disasters:[{level:'Red',current:false}]},now),0,'desastre encerrado não eleva o nível');
assert.equal(alertsLevel({quakes:[],disasters:[{level:'Orange',current:true}]},now),2);
assert.equal(alertsLevel({space:[{kind:'ALERT',scale:'G1',time:now-2*H}]},now),1);
assert.equal(alertsLevel({space:[{kind:'ALERT',scale:'G4',time:now-30*H}]},now),0,'aviso espacial antigo não conta');
// Coleta com uma fonte falhando: não inventa e registra o erro
const fx=async u=>{if(u.includes('k-index-forecast'))throw Error('offline');if(u.includes('usgs'))return {ok:true,json:async()=>usgs};if(u.includes('swpc'))return {ok:true,json:async()=>swpc};throw Error('offline');};
const r=await collectAlerts(now,fx);assert.equal(r.quakes.length,2);assert.equal(r.space.length,2);assert.equal(r.disasters,null);assert.equal(r.errors.length,2);assert.match(r.errors.join(' '),/GDACS/);assert.equal(r.kpForecast,null);
const bad=await collectAlerts(now,async()=>({ok:true,json:async()=>({})}));assert.equal(bad.quakes,null);assert.equal(bad.errors.length,4);
// Previsão de Kp: só futuro e só "predicted"
const kpf=[{time_tag:'2026-11-08T09:00:00',kp:6,observed:'observed',noaa_scale:'G2'},{time_tag:'2026-11-08T15:00:00',kp:3.33,observed:'predicted',noaa_scale:null},{time_tag:'2026-11-09T00:00:00',kp:5.67,observed:'predicted',noaa_scale:'G1'},{time_tag:'2026-11-08T06:00:00',kp:9,observed:'predicted',noaa_scale:'G5'},{time_tag:'2026-11-09T03:00:00',kp:12,observed:'predicted',noaa_scale:null}];
const kf=parseKpForecast(kpf,now);assert.equal(kf.rows.length,2);assert.equal(kf.max,5.67);assert.equal(kf.hours,12);assert.equal(parseKpForecast([],now),null);assert.throws(()=>parseKpForecast({}),/inválido/);
assert.equal(alertsLevel({kpForecast:{max:5.67}},now),1);assert.equal(alertsLevel({kpForecast:{max:8.3}},now),2);assert.equal(alertsLevel({kpForecast:{max:3}},now),0);
const rk=await collectAlerts(now,async u=>({ok:true,json:async()=>u.includes('k-index-forecast')?kpf:u.includes('usgs')?usgs:u.includes('swpc')?swpc:{features:[]}}));assert.equal(rk.kpForecast.max,5.67);assert.match(JSON.stringify(explainAlerts(rk,now)),/Previsão geomagnética/);
// Explicação em linguagem simples
const e=explainAlerts(r,now);assert.equal(e.level,2);assert.match(JSON.stringify(e),/não prevê terremotos/);assert.match(JSON.stringify(e),/tsunami/);assert.ok(e.sections.some(x=>x.title==='É o fim do mundo?'));assert.doesNotMatch(JSON.stringify(e),/apocalipse|catástrofe iminente/i);
const none=explainAlerts({quakes:null,space:null,disasters:null,errors:['x']},now);assert.equal(none.level,null);assert.match(JSON.stringify(none),/Nada foi estimado/);
const calm=explainAlerts({quakes:[],space:[],disasters:[],errors:[]},now);assert.equal(calm.level,0);assert.match(calm.headline,/rotineiro/);
console.log('Passed: official alert parsing, safe links, validity window, partial failures, plain-language alert explanation.');
