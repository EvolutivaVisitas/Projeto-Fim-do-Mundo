import assert from 'node:assert/strict';
import {position,stageOf,moonState,nextPhases,nextSeasons,nextEclipses,altitude,horizon,classifyEclipse,skyOutlook,SAROS_DAYS,SYNODIC_DAYS} from './dist/sky-core.mjs';
import {explainSky} from './dist/explain.mjs';
const utc=iso=>Date.parse(iso);
const mins=(a,b)=>Math.abs(a-b)/60000;

// ---- Fases da Lua contra datas conhecidas (UTC), tolerância de 12 min ----
const near=(list,target,iso,tol=12)=>{const p=list.find(x=>x.target===target&&mins(x.ms,utc(iso))<600*60);assert.ok(p,'fase não encontrada perto de '+iso);assert.ok(mins(p.ms,utc(iso))<tol,`fase ${iso} errou ${mins(p.ms,utc(iso)).toFixed(1)} min`);return p;};
near(nextPhases(utc('2000-01-01T00:00:00Z'),8),0,'2000-01-06T18:14:00Z');
near(nextPhases(utc('2000-01-10T00:00:00Z'),6),180,'2000-01-21T04:40:00Z');
near(nextPhases(utc('2024-04-01T00:00:00Z'),4),0,'2024-04-08T18:21:00Z');
near(nextPhases(utc('2026-02-25T00:00:00Z'),4),180,'2026-03-03T11:38:00Z');
// ordem, nomes e espaçamento médio (~7,4 dias entre fases)
const ph=nextPhases(utc('2026-11-19T12:00:00Z'),8);assert.equal(ph.length,8);
for(let i=1;i<ph.length;i++){const d=(ph[i].ms-ph[i-1].ms)/86400000;assert.ok(d>6.3&&d<8.6,'intervalo entre fases '+d);}
assert.deepEqual(ph.map(p=>p.name).slice(0,4).sort(),['Lua cheia','Lua nova','Quarto crescente','Quarto minguante']);
assert.ok(ph.every((p,i)=>i===0||p.target===(ph[i-1].target+90)%360),'as fases seguem a sequência nova→crescente→cheia→minguante');

// ---- Equinócios e solstícios de 2026 (USNO), tolerância de 20 min ----
const se=nextSeasons(utc('2026-01-01T00:00:00Z'),4,-16.7);assert.equal(se.length,4);
[['2026-03-20T14:46:00Z','início do outono'],['2026-06-21T08:24:00Z','início do inverno'],['2026-09-23T00:05:00Z','início da primavera'],['2026-12-21T20:50:00Z','início do verão']].forEach(([iso,season],i)=>{assert.ok(mins(se[i].ms,utc(iso))<20,`estação ${iso} errou ${mins(se[i].ms,utc(iso)).toFixed(1)} min`);assert.equal(se[i].season,season);});
assert.equal(nextSeasons(utc('2026-01-01T00:00:00Z'),1,45)[0].season,'início da primavera','hemisfério norte troca os nomes');

// ---- Eclipses reais 2024–2026: encontrados, horário em ±35 min e tipo compatível ----
const real=[['2024-03-25','lunar','penumbral|incerto'],['2024-04-08','solar','central'],['2024-09-18','lunar','parcial|incerto'],['2024-10-02','solar','central'],['2025-03-14','lunar','total'],['2025-03-29','solar','parcial'],['2025-09-07','lunar','total'],['2025-09-21','solar','parcial|incerto'],['2026-02-17','solar','central'],['2026-03-03','lunar','total'],['2026-08-12','solar','central|incerto'],['2026-08-28','lunar','parcial']];
const got=nextEclipses(utc('2024-03-01T00:00:00Z'),12);assert.equal(got.length,12,'todos os 12 eclipses reais aparecem, sem extras');
for(const [d,kind,q] of real){const e=got.find(x=>new Date(x.ms).toISOString().slice(0,10)===d);assert.ok(e,'eclipse não encontrado: '+d);assert.equal(e.kind,kind,d);assert.match(e.q,new RegExp('^('+q+')$'),`${d}: ${e.q}`);}
// horários conhecidos do máximo (UTC)
const peak=(d)=>got.find(x=>new Date(x.ms).toISOString().slice(0,10)===d);
assert.ok(mins(peak('2024-04-08').ms,utc('2024-04-08T18:17:00Z'))<35);assert.ok(mins(peak('2026-03-03').ms,utc('2026-03-03T11:33:00Z'))<35);assert.ok(mins(peak('2025-09-07').ms,utc('2025-09-07T18:11:00Z'))<35);
// ciclo de Saros: 223 meses sinódicos ≈ 18 a 11 d 8 h
assert.ok(Math.abs(SAROS_DAYS-223*SYNODIC_DAYS)<0.01);assert.ok(Math.abs((got[0].sarosNextMs-got[0].ms)/86400000-6585.3211)<1e-6);
// limites de classificação
assert.equal(classifyEclipse('solar',2),null);assert.equal(classifyEclipse('lunar',1.7),null);assert.equal(classifyEclipse('solar',0.3),'central');assert.equal(classifyEclipse('lunar',0.2),'total');assert.equal(classifyEclipse('lunar',1.3),'penumbral');

// ---- Altura do Sol e da Lua ----
assert.ok(altitude('sun',utc('2026-03-20T12:07:00Z'),0,0)>85,'Sol quase a pino no equador ao meio-dia do equinócio');
assert.ok(altitude('sun',utc('2026-03-20T00:07:00Z'),0,0)<-85,'Sol no nadir à meia-noite');
assert.ok(altitude('moon',utc('2026-03-03T11:38:00Z'),7,-170)>70,'lua cheia perto do zênite à meia-noite local');
// Visibilidade dos eclipses lunares conhecidos
const gyn={lat:-16.76,lon:-49.34};
assert.equal(horizon(altitude('moon',utc('2025-09-07T18:11:00Z'),gyn.lat,gyn.lon)),'abaixo','eclipse de set/2025 não era visível em Goiânia');
assert.equal(horizon(altitude('moon',utc('2025-03-14T06:58:00Z'),gyn.lat,gyn.lon)),'acima','eclipse de mar/2025 era visível em Goiânia');
assert.equal(horizon(altitude('moon',utc('2025-09-07T18:11:00Z'),28.6,77.2)),'acima','eclipse de set/2025 era visível em Nova Délhi');
assert.equal(horizon(0.5),'limite');

// ---- Estado da Lua ----
const ms=moonState(utc('2024-04-08T18:21:00Z'));assert.ok(ms.illum<0.002&&ms.stage==='Lua nova'&&ms.age<0.05||ms.age>29.4);
const full=moonState(utc('2026-03-03T11:38:00Z'));assert.ok(full.illum>0.998&&full.stage==='Lua cheia');
const wax=moonState(utc('2026-11-12T00:00:00Z'));assert.ok(wax.waxing&&wax.illum>0&&wax.illum<1);
// Nomes das fases: quartos só perto de 90°/270°; 66% iluminada é gibosa, nunca "quarto"
assert.equal(stageOf(0),'Lua nova');assert.equal(stageOf(45),'Crescente');assert.equal(stageOf(90),'Quarto crescente');assert.equal(stageOf(109.7),'Gibosa crescente');assert.equal(stageOf(180),'Lua cheia');assert.equal(stageOf(230),'Gibosa minguante');assert.equal(stageOf(270),'Quarto minguante');assert.equal(stageOf(320),'Minguante');assert.equal(stageOf(359),'Lua nova');
const q1=moonState(nextPhases(utc('2026-11-19T12:00:00Z'),8).find(p=>p.target===90).ms);assert.equal(q1.stage,'Quarto crescente');assert.ok(Math.abs(q1.illum-0.5)<0.01);

// ---- Pacote e explicação em linguagem simples ----
const now=utc('2026-11-19T12:00:00Z'),sky=skyOutlook(now,{lat:-16.76,lon:-49.34,label:'Goiânia'});
assert.equal(sky.phases.length,8);assert.ok(sky.eclipses.length>=4);assert.equal(sky.seasons.length,4);assert.equal(sky.point.label,'Goiânia');
assert.ok(sky.eclipses.every(e=>e.horizon&&Number.isFinite(e.alt)&&e.ms>now-3*3600e3));
assert.equal(skyOutlook(now,null).point,null);assert.ok(skyOutlook(now,null).eclipses.every(e=>e.horizon===undefined),'sem ponto não há visibilidade inventada');
const ex=explainSky(sky,'Goiânia');
assert.equal(ex.level,0);assert.equal(ex.levelLabel,'Evento previsível (não é alerta)');
const txt=JSON.stringify(ex);
for(const w of ['A Lua hoje','Próximas fases','Próximo eclipse','Anticítera','Saros','Isso afeta o campo magnético ou os terremotos?','Quão confiável é?','filtro solar']){assert.ok(txt.includes(w),'faltou: '+w);}
assert.ok(!/p[aâ]nico|catástrofe iminente|perigo iminente|vai acontecer um terremoto/i.test(txt),'sem alarmismo');
assert.ok(/Não há base científica/.test(txt)&&/não usa a Lua para prever/.test(txt),'não relaciona Lua a terremotos');
// sem dados: nada é inventado
const empty=explainSky(null);assert.equal(empty.level,null);assert.ok(/Nada foi estimado/.test(JSON.stringify(empty)));
// sem ponto: texto genérico, sem afirmar visibilidade local
const noPt=JSON.stringify(explainSky(skyOutlook(now,null)));assert.ok(!/No ponto escolhido/.test(noPt));
console.log('Passed: moon phases, equinoxes/solstices, 12 real eclipses 2024–2026, Saros, Sun/Moon altitude and local visibility, plain-language explanation without alarmism.');
