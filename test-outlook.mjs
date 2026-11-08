import assert from 'node:assert/strict';
import {normalCdf,rarity,rarityText,buildOutlook,VERDICTS} from './dist/outlook-core.mjs';
const now=Date.parse('2026-11-08T12:00:00Z'),H=3600000;
// Estatística: valores conhecidos da normal padrão
assert.ok(Math.abs(normalCdf(0)-.5)<1e-6);assert.ok(Math.abs(normalCdf(1.96)-.975)<1e-3);assert.ok(Math.abs(normalCdf(-1)-.1587)<1e-3);
assert.ok(Math.abs(rarity(1).pctDays-31.7)<.2);assert.ok(Math.abs(rarity(2).pctDays-4.55)<.1);assert.equal(rarity(3).oneIn,370);assert.equal(rarity(NaN),null);
assert.match(rarityText(.3),/comum/);assert.match(rarityText(2.2),/incomum.*1 a cada/);assert.match(rarityText(7),/raríssimo|1 a cada/);
const day=(i,a,z)=>({date:'2026-11-'+String(9+i).padStart(2,'0'),temp:25+a,anomaly:a,z,rain:1});
const fcOf=(a,z,rain=null)=>({forecast:{days:Array.from({length:12},(_,i)=>day(i,a,z)),rain},errors:[]});
const quietAlerts={quakes:[{mag:4.8}],space:[],disasters:[],kpForecast:{max:3.3,hours:48},errors:[]};
const clim={last12:{mean:1.2,count:12}};
// Dia comum: nada alarmante; contexto climático fora da leitura geral
const calm=buildOutlook({forecast:fcOf(.2,.15),alerts:quietAlerts,climate:clim,now});
assert.equal(calm.level,0);assert.equal(calm.verdict,VERDICTS[0]);assert.equal(calm.items.find(i=>i.key==='climate').level,2);assert.ok(calm.items.find(i=>i.key==='climate').context);assert.match(calm.caveat,/não prevê terremotos/);
// Calor forte previsto: "bem fora do normal" (previsão limitada a nível 2)
const hot=buildOutlook({forecast:fcOf(7,3.4,{sum:90,climMean:30,pct:300}),alerts:quietAlerts,climate:clim,now});
assert.equal(hot.level,2);const w=hot.items.find(i=>i.key==='weather');assert.equal(w.level,2);assert.match(w.detail,/1 a cada 370|raríssimo|incomum/);assert.match(w.detail,/alagamentos/);
// Só avisos oficiais graves levam ao nível 3
const grave=buildOutlook({forecast:fcOf(.2,.15),alerts:{...quietAlerts,quakes:[{mag:7.4}]},climate:clim,now});assert.equal(grave.level,3);assert.match(grave.verdict,/autoridades/);
// Tendência
const trend=buildOutlook({forecast:{forecast:{days:Array.from({length:7},(_,i)=>day(i,i<3?0:3,i<3?0:2)),rain:null},errors:[]},alerts:quietAlerts,climate:clim,now});assert.match(trend.items[0].detail,/esquentando/);
// Dados ausentes: não inventa e avisa
const noFc=buildOutlook({forecast:{forecast:null,errors:['Open-Meteo (previsão): fonte indisponível.']},alerts:quietAlerts,climate:clim,now});
assert.equal(noFc.items[0].level,null);assert.equal(noFc.level,0);assert.match(noFc.verdict,/faltam dados de Tempo no ponto/);
const noCmp=buildOutlook({forecast:{forecast:{days:[{date:'2026-11-09',temp:27,anomaly:null,z:null}],rain:null},errors:[]},alerts:null,climate:null,now});
assert.equal(noCmp.level,null);assert.equal(noCmp.label,'Sem dados suficientes');assert.match(noCmp.verdict,/Nada foi estimado/);assert.equal(noCmp.items.find(i=>i.key==='climate').level,null);
// Kp previsto alto
const kp=buildOutlook({forecast:fcOf(0,0),alerts:{...quietAlerts,kpForecast:{max:8.3,hours:48}},climate:clim,now});assert.equal(kp.items.find(i=>i.key==='space').level,2);assert.match(kp.items.find(i=>i.key==='space').detail,/não oferecem risco à saúde/);
for(const o of [calm,hot,grave,noFc,noCmp])assert.doesNotMatch(JSON.stringify(o),/apocalipse|fim do mundo|catástrofe iminente/i);
console.log('Passed: normal distribution rarity, short-term overall level, long-term context excluded, trend, missing data, alerts-only level 3.');
