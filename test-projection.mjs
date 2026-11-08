import assert from 'node:assert/strict';
import {climatologyTable} from './dist/weather-core.mjs';
import {fitDailyPersistence,serializeModels,modelsFromEntry,monthRowsFromClim,collectProjection,projectionSvg,recentDailyUrl,projectDays,fitMonthlyPersistence,projectMonths,quakeCountUrl,poissonAtLeastOne,collectQuakeRates,projectGlobalTemp} from './dist/projection-core.mjs';
// Gerador pseudoaleatório determinístico e ruído AR(1) com persistência conhecida (ρ = 0,7)
let seed=12345;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
const time=[],temp=[];let e=0;
for(let ms=Date.UTC(1991,0,1);ms<=Date.UTC(2020,11,31);ms+=86400000){const d=new Date(ms),doy=(ms-Date.UTC(d.getUTCFullYear(),0,0))/86400000;e=.7*e+Math.sqrt(1-.49)*gauss();time.push(d.toISOString().slice(0,10));temp.push(25+4*Math.sin(2*Math.PI*doy/365.25)+e);}
const archive={daily:{time,temperature_2m_mean:temp,precipitation_sum:temp.map(()=>1)}};
const m=fitDailyPersistence(archive);assert.ok(m);
// A regressão recupera a persistência: forte no dia 1, decaindo, ~0 em 10 dias
assert.ok(m.r[1]>.5&&m.r[1]<.8,'r1='+m.r[1]);assert.ok(m.r[5]<m.r[2]&&m.r[2]<m.r[1]);assert.ok(Math.abs(m.r[10])<.15,'r10='+m.r[10]);
assert.ok(m.beta[1]>.5&&m.beta[1]<1.1);assert.ok(m.sigma[1]<m.sigma[10]+1e-9,'a incerteza cresce com a defasagem');assert.ok(m.sigma[10]>.9&&m.sigma[10]<1.15);
// Projeção: dias recentes +2 °C acima do normal -> desvio esperado decai
const today=Date.parse('2026-11-08T12:00:00Z'),rec={time:['2026-11-05','2026-11-06','2026-11-07'],temp:[0,1,2].map(i=>m.table.t[(new Date(Date.UTC(2026,10,5+i))-Date.UTC(2024,0,1))/86400000|0]*0+25)};
// monta recentes com anomalia +2 sobre a climatologia do dia
const dayIdx=ms=>{const d=new Date(ms);return Math.round((Date.UTC(2024,d.getUTCMonth(),d.getUTCDate())-Date.UTC(2024,0,1))/86400000);};
const recent={time:['2026-11-05','2026-11-06','2026-11-07'],temp:['2026-11-05','2026-11-06','2026-11-07'].map(t=>m.table.t[dayIdx(Date.parse(t+'T00:00:00Z'))]+2)};
const p=projectDays(m,recent,[{date:'2026-11-09',temp:30,anomaly:4}],today);
assert.ok(Math.abs(p.recentAnomaly-2)<1e-9);assert.equal(p.lastObserved,'2026-11-07');assert.equal(p.days[0].date,'2026-11-09');// 08/11 é "hoje": só dias futuros
assert.ok(p.days[0].expectedAnomaly>.6&&p.days[0].expectedAnomaly<2.2);assert.ok(p.days[0].expectedAnomaly>p.days[3].expectedAnomaly&&p.days[3].expectedAnomaly>p.days[9].expectedAnomaly);
assert.ok(p.days[9].hi-p.days[9].lo>p.days[0].hi-p.days[0].lo);assert.equal(p.days[0].modelTemp,30);assert.equal(p.days[1].modelTemp,null);
assert.ok(p.usefulDays>=2&&p.usefulDays<=10,'usefulDays='+p.usefulDays);
// Dados recentes faltando/não consecutivos -> não inventa
assert.equal(projectDays(m,{time:['2026-11-05','2026-11-07'],temp:[25,25]},[],today),null);
assert.equal(projectDays(m,{time:['2026-11-05','2026-11-06','2026-11-07'],temp:[25,null,25]},[],today),null);
assert.equal(projectDays(null,recent,[],today),null);assert.equal(fitDailyPersistence({daily:{time:['1991-01-01'],temperature_2m_mean:[1]}}),null);
// Meses
const mm=fitMonthlyPersistence(archive);assert.ok(mm&&mm.beta.length===4);
const rows=Array.from({length:12},(_,i)=>({year:2025+(i>=2?1:0),month:(10+i)%12,tempAnomaly:i>=9?1.5:0}));
const pm=projectMonths(mm,rows,today);assert.equal(pm.months.length,3);assert.equal(pm.months[0].month,10);assert.ok(Math.abs(pm.recentAnomaly-1.5)<1e-9);assert.ok(pm.months.every(x=>x.hi>x.lo));
assert.equal(projectMonths(mm,rows.map(r=>({...r,tempAnomaly:null})),today),null);
// Terremotos
assert.match(quakeCountUrl(6,today,10,{lat:-16.7,lon:-49.3}),/maxradiuskm=500.*|minmagnitude=6/);assert.match(quakeCountUrl(7,today),/starttime=2016-11-08.*endtime=2026-11-08|endtime=2026-11-08.*starttime=2016-11-08/);
assert.ok(Math.abs(poissonAtLeastOne(135,10,365.25)-(1-Math.exp(-13.5)))<1e-9);assert.equal(poissonAtLeastOne(0,10,30),0);assert.equal(poissonAtLeastOne(-1,10,30),null);
const qf=async u=>{const mag=Number(new URL(u).searchParams.get('minmagnitude')),local=new URL(u).searchParams.has('latitude');if(mag===7&&!local)throw Error('falha parcial');return {ok:true,json:async()=>({count:local?(mag>=6?1:mag>=5?4:20):mag>=6?1342:mag>=5?17999:135,maxAllowed:20000})};};
const qr=await collectQuakeRates(-16.7,-49.3,today,qf);assert.equal(qr.rows.length,6);assert.equal(qr.rows[2].error,true);assert.equal(qr.rows[2].count,null);assert.equal(qr.errors.length,1);
const g6=qr.rows.find(r=>r.scope==='global'&&r.mag===6);assert.ok(Math.abs(g6.perYear-134.2)<.01);assert.ok(g6.p7>.9&&g6.p7<1);const l6=qr.rows.find(r=>r.scope==='local'&&r.mag===6);assert.ok(l6.p30<.01&&l6.p30>0);
const capped=await collectQuakeRates(0,0,today,async()=>({ok:true,json:async()=>({count:20000,maxAllowed:20000})}));assert.ok(capped.rows.every(r=>r.capped));
// Temperatura global: série sintética com tendência de 0,02 °C/ano e ruído nulo
const ys=[];for(let y=1970;y<=2025;y++)ys.push({year:y,months:[],annual:(y-1970)*.02});
const pg=projectGlobalTemp({years:ys},[2030,2050]);assert.ok(Math.abs(pg.slopePerDecade-.2)<1e-9);assert.ok(Math.abs(pg.points[0].value-1.2)<1e-9);assert.ok(Math.abs(pg.points[1].value-1.6)<1e-9);assert.ok(pg.points[1].hi-pg.points[1].lo>=pg.points[0].hi-pg.points[0].lo);
assert.equal(projectGlobalTemp({years:ys.slice(0,10)}),null);assert.equal(projectGlobalTemp(null),null);
// Orquestração com fetcher simulado (arquivo de 30 anos + dias recentes + meses + terremotos)
assert.match(recentDailyUrl(1,2),/past_days=14/);
const nowP=Date.parse('2026-11-08T12:00:00Z');
const recDaily={daily:{time:['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08'],temperature_2m_mean:Array(10).fill(27)}};
const fcDaily={daily:{time:Array.from({length:16},(_,i)=>new Date(Date.UTC(2026,10,8+i)).toISOString().slice(0,10)),temperature_2m_mean:Array(16).fill(27),precipitation_sum:Array(16).fill(2)}};
const monDaily=(()=>{const tm=[],tp=[],pr=[];for(let ms=Date.UTC(2025,10,1);ms<=Date.UTC(2026,9,31);ms+=86400000){tm.push(new Date(ms).toISOString().slice(0,10));tp.push(27);pr.push(2);}return {daily:{time:tm,temperature_2m_mean:tp,precipitation_sum:pr}};})();
const pf=async u=>{const p=new URL(u);if(p.hostname.startsWith('archive')){return {ok:true,json:async()=>p.searchParams.get('start_date')==='1991-01-01'?archive:monDaily};}
 if(p.hostname.startsWith('earthquake'))return {ok:true,json:async()=>({count:p.searchParams.has('latitude')?2:500,maxAllowed:20000})};
 return {ok:true,json:async()=>p.searchParams.get('past_days')==='14'?recDaily:fcDaily};};
const gs={years:Array.from({length:56},(_,i)=>({year:1970+i,months:[],annual:i*.02}))};
const full=await collectProjection(-16.76,-49.34,nowP,pf,gs);
assert.ok(full.days&&full.days.days.length>5);assert.ok(full.months&&full.months.months.length===3);assert.equal(full.quakes.rows.length,6);assert.ok(full.global);assert.equal(full.errors.length,0);
assert.ok(projectionSvg(full.days.days,'T').includes('<svg'));assert.match(projectionSvg(null),/indisponível/);
// Sem o arquivo de 30 anos: nada de dias/meses, mas terremotos e tendência global continuam; erro explícito
const noArch=await collectProjection(40.5,10.5,nowP,async u=>{if(new URL(u).hostname.startsWith('archive'))return {ok:false,status:429};return pf(u);},gs);
assert.equal(noArch.days,null);assert.equal(noArch.months,null);assert.ok(noArch.quakes&&noArch.global);assert.match(noArch.errors.join(' '),/30 anos/);
// Modelo pré-calculado: ida e volta e uso como fallback quando a API de 30 anos está no limite
const tabP=climatologyTable(archive),ser=serializeModels(m,mm);assert.equal(ser.d.beta.length,14);assert.equal(ser.m.beta.length,3);assert.equal(ser.m.tMean.length,12);
const back=modelsFromEntry({...tabP,model:ser});assert.ok(Math.abs(back.daily.beta[1]-m.beta[1])<1e-3);assert.equal(back.daily.beta[0],null);assert.ok(Math.abs(back.monthly.clim[0].tMean-mm.clim[0].tMean)<.01);assert.equal(modelsFromEntry({...tabP}),null);
const pfb=async u=>{if(u.includes('places-climatology'))return {ok:true,json:async()=>({places:{'goiania-brasil':{...tabP,model:ser}}})};const p=new URL(u);if(p.hostname.startsWith('archive')&&p.searchParams.get('start_date')==='1991-01-01')return {ok:false,status:429};if(u.includes('places-climatology'))return {ok:true,json:async()=>({places:{'goiania-brasil':{...tabP,model:ser}}})};return pf(u);};
const fbp=await collectProjection(-16.9,-49.1,nowP,async u=>{if(u.includes('places-climatology'))return pfb(u);return pfb(u);},gs);
assert.ok(fbp.days&&fbp.days.days.length>5,'dias via modelo pré-calculado');assert.match(fbp.source,/Goiânia/);assert.ok(fbp.months);
const mr=monthRowsFromClim(monDaily,mm.clim,nowP);assert.equal(mr.length,12);assert.equal(mr[0].year,2025);assert.equal(mr[0].month,10);assert.ok(Math.abs(mr[0].tempAnomaly-(27-mm.clim[10].tMean))<1e-9);assert.equal(monthRowsFromClim(null,mm.clim,nowP),null);
console.log('Passed: AR persistence recovered, decaying skill and widening bands, no invention without data, Poisson rates, trend extrapolation.');
