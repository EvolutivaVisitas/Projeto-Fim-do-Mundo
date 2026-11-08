import assert from 'node:assert/strict';
import {LAYERS,gibsTime,gibsTemplate,floorTime,firstCandidate,frameTimes,ageLabel,buildClimatology,buildAnomaly,forecastDailyUrl,buildForecastAnomalies,collectForecast,nearestPlace,haversineKm,forecastSvg,recentMonthsRange,recentMonthsUrl,monthlyClimatology,buildMonthlyAnomalies,collectMonthly,monthlySvg,climatologyTable,dayIndex,collectGlobalWeather,searchPlace,findLatestFrame,collectDailyWeather,classifyZ,classifyRain,forecastUrl,archiveUrl} from './dist/weather-core.mjs';
const now=Date.parse('2026-11-08T00:52:00Z');
// Tempo GIBS
assert.equal(gibsTime(LAYERS.geocolor,Date.parse('2026-11-07T23:50:00Z')),'2026-11-07T23:50:00Z');
assert.equal(gibsTime(LAYERS.sst,Date.parse('2026-11-06T13:00:00Z')),'2026-11-06');
assert.equal(floorTime(now,10),Date.parse('2026-11-08T00:50:00Z'));
assert.equal(firstCandidate(LAYERS.geocolor,now),Date.parse('2026-11-08T00:20:00Z'));
assert.equal(firstCandidate(LAYERS.imerg,now),Date.parse('2026-11-07T19:30:00Z'));
const fr=frameTimes(LAYERS.geocolor,Date.parse('2026-11-08T00:20:00Z'));assert.equal(fr.length,19);assert.equal(fr.at(-1)-fr[0],18*600000);
assert.match(gibsTemplate(LAYERS.infrared,fr[0]),/\{z\}\/\{y\}\/\{x\}\.png$/);
assert.equal(ageLabel(now-30*60000,now),'30 min atrás');assert.equal(ageLabel(now-6*3600000,now),'6,0 h atrás');
// URLs
assert.match(forecastUrl(-16.76,-49.34),/past_days=7/);assert.match(archiveUrl(-16.76,-49.34),/start_date=1991-01-01&end_date=2020-12-31/);
// Climatologia sintética: temperatura 25 °C ±1 alternado, chuva 2 mm/dia constante
const time=[],t=[],p=[];for(let ms=Date.UTC(1991,0,1);ms<=Date.UTC(2020,11,31);ms+=86400000){time.push(new Date(ms).toISOString().slice(0,10));t.push(time.length%2?24:26);p.push(2);}
const archive={daily:{time,temperature_2m_mean:t,precipitation_sum:p}};
const clim=buildClimatology(archive,now);assert.ok(Math.abs(clim.temps.mean-25)<.05);assert.ok(clim.temps.sd>.9&&clim.temps.sd<1.1);assert.equal(clim.rain7.mean,14);
// Análise recente: 24 h a 28 °C e 7 dias com 0,5 mm/h = 84 mm em 168 h
const hours=[];for(let i=-170;i<=5;i++)hours.push(new Date(Math.floor(now/3600000)*3600000+i*3600000).toISOString().slice(0,16));
const forecast={elevation:850,current:{time:'2026-11-08T00:45',temperature_2m:27,precipitation:0},hourly:{time:hours,temperature_2m:hours.map(()=>28),precipitation:hours.map(()=>.5)}};
const a=buildAnomaly(forecast,archive,-16.76,-49.34,now);
assert.ok(Math.abs(a.temp.anomaly-3)<.05);assert.equal(a.temp.label,'muito acima do normal');assert.equal(a.temp.complete,true);
assert.equal(a.rain.hours,168);assert.ok(Math.abs(a.rain.sum7d-84)<1e-9);assert.ok(Math.abs(a.rain.pct-600)<1);assert.equal(a.rain.label,'muito acima do normal');assert.equal(a.current.temperature,27);
// Horas futuras não entram na janela
assert.ok(a.temp.hours<=24);
// Dados ausentes não são preenchidos
const sparse={hourly:{time:hours,temperature_2m:hours.map((_,i)=>i%2?null:28),precipitation:hours.map(()=>null)}};
const s=buildAnomaly(sparse,archive,0,0,now);assert.equal(s.temp.complete,false);assert.equal(s.rain,null);assert.match(s.notes.join(' '),/parcial/);
// Fontes ausentes
const none=buildAnomaly(null,null,0,0,now,['x']);assert.equal(none.temp,null);assert.equal(none.rain,null);assert.ok(none.errors.length>=1);
const noClim=buildAnomaly(forecast,null,0,0,now);assert.equal(noClim.temp.z,undefined);assert.match(noClim.errors.join(' '),/Climatologia/);
assert.equal(classifyZ(.5),'dentro da variação típica');assert.equal(classifyZ(-1.5),'abaixo do normal');assert.equal(classifyZ(NaN),'indisponível');assert.equal(classifyRain(10),'muito abaixo do normal');assert.equal(classifyRain(100),'próxima do normal');
// Quadro mais recente: recua até achar um publicado; null se nenhum
const avail=Date.parse('2026-11-08T00:00:00Z');
assert.equal(await findLatestFrame(LAYERS.geocolor,async u=>u.includes('2026-11-08T00:00:00Z')||u.includes('T23:')||u.includes('T22:'),now),avail);
assert.equal(await findLatestFrame(LAYERS.geocolor,async()=>false,now,5),null);
// Coleta diária com fonte falhando: não inventa valores
const fail=async()=>{throw Error('offline');};const d=await collectDailyWeather(now,fail);
assert.equal(d.anomaly.temp,null);assert.ok(d.anomaly.errors.length>=1);assert.ok(Object.values(d.satellite).every(s=>s.latestFrame===null&&s.ageMinutes===null));assert.equal(d.point.name,'Goiânia');
// Panorama global: tabela pré-calculada bate com a climatologia direta
const tab=climatologyTable(archive),k=dayIndex(now);
assert.equal(tab.t.length,366);assert.ok(Math.abs(tab.t[k]-clim.temps.mean)<.01);assert.ok(Math.abs(tab.s[k]-clim.temps.sd)<.01);assert.equal(tab.r[k],14);
assert.equal(dayIndex(Date.parse('2026-03-01T00:00:00Z')),60);assert.equal(dayIndex(Date.parse('2024-02-29T00:00:00Z')),59);
assert.equal(climatologyTable({daily:{time:['2000-01-01'],temperature_2m_mean:[1],precipitation_sum:[1]}}),null);
const places=[{id:'a',name:'A',country:'X',continent:'C1',lat:1,lon:2},{id:'b',name:'B',country:'Y',continent:'C2',lat:3,lon:4}];
const table={places:{a:tab}};
const loc=temp=>({hourly:{time:hours,temperature_2m:hours.map(()=>temp),precipitation:hours.map(()=>.5)}});
const g=await collectGlobalWeather(places,table,now,async()=>({ok:true,json:async()=>[loc(28),loc(10)]}));
assert.equal(g.count,2);assert.equal(g.withData,2);assert.equal(g.places[0].tempLabel,'muito acima do normal');assert.ok(Math.abs(g.places[0].tempAnomaly-3)<.1);assert.equal(g.places[0].rainPct,600);
assert.equal(g.places[1].tempAnomaly,null);// sem climatologia para B: não inventa anomalia
const gf=await collectGlobalWeather(places,table,now,async()=>{throw Error('offline');});
assert.equal(gf.withData,0);assert.ok(gf.places.every(p=>p.status==='sem dados'));assert.ok(gf.errors.length===1);
const gs=await searchPlace('Brasília',async()=>({ok:true,json:async()=>({results:[{name:'Brasília',admin1:'DF',country:'Brasil',latitude:-15.78,longitude:-47.93},{name:'x'}]})}));
assert.equal(gs.length,1);assert.equal(gs[0].country,'Brasil');assert.deepEqual(await searchPlace('a'),[]);
// Anomalias mensais (últimos 12 meses completos)
const rng=recentMonthsRange(now);assert.equal(rng.start,'2025-11-01');assert.equal(rng.end,'2026-10-31');assert.match(recentMonthsUrl(-16.7,-49.3,now),/start_date=2025-11-01&end_date=2026-10-31/);
const mc=monthlyClimatology(archive);assert.equal(mc.length,12);assert.ok(Math.abs(mc[0].tMean-25)<.05);assert.ok(Math.abs(mc[1].rMean-2*28.25)<2.2);// fevereiro: 28 ou 29 dias
const rt=[],rtemp=[],rrain=[];for(let ms=Date.UTC(2025,10,1);ms<=Date.UTC(2026,9,31);ms+=86400000){const t=new Date(ms).toISOString().slice(0,10);rt.push(t);rtemp.push(t.startsWith('2026-03')&&t>'2026-03-10'?null:28);rrain.push(4);}
const ma=buildMonthlyAnomalies({daily:{time:rt,temperature_2m_mean:rtemp,precipitation_sum:rrain}},archive,now);
assert.equal(ma.length,12);assert.equal(ma[0].year,2025);assert.equal(ma[0].month,10);assert.equal(ma.at(-1).month,9);
assert.ok(Math.abs(ma[0].tempAnomaly-3)<.1);assert.ok(Math.abs(ma[0].rainPct-200)<12);
const mar=ma.find(r=>r.year===2026&&r.month===2);assert.equal(mar.tempMean,null);assert.equal(mar.tempAnomaly,null);assert.ok(mar.rain!==null);// mês com temperatura incompleta não é preenchido
assert.equal(buildMonthlyAnomalies(null,archive,now),null);assert.equal(buildMonthlyAnomalies({daily:{time:rt,temperature_2m_mean:rtemp,precipitation_sum:rrain}},{daily:{time:['1991-01-01'],temperature_2m_mean:[1],precipitation_sum:[1]}},now),null);
const mf=await collectMonthly(1,2,now,async()=>{throw Error('offline');});assert.equal(mf.rows,null);assert.ok(mf.errors.length>=1);
assert.match(monthlySvg(ma,'Teste'),/<svg/);assert.match(monthlySvg(ma),/s\/d/);assert.match(monthlySvg(null),/indisponíveis/);
// Previsão dos próximos dias
assert.match(forecastDailyUrl(1,2),/forecast_days=16/);
const ft=[],fT=[],fR=[];for(let i=0;i<16;i++){const ms=Date.UTC(2026,10,8+i);ft.push(new Date(ms).toISOString().slice(0,10));fT.push(i===3?null:28);fR.push(i<8?3:0);}
const fa=buildForecastAnomalies({daily:{time:ft,temperature_2m_mean:fT,precipitation_sum:fR}},archive,now);
assert.equal(fa.days[0].date,'2026-11-09');assert.equal(fa.days.length,15);// só dias futuros
assert.ok(Math.abs(fa.days[0].anomaly-3)<.1);const nul=fa.days.find(d=>d.date==='2026-11-11');assert.equal(nul.temp,null);assert.equal(nul.anomaly,null);// dia sem dado não é preenchido
assert.ok(fa.rain&&Math.abs(fa.rain.sum-21)<1e-9);assert.ok(Math.abs(fa.rain.pct-150)<5);
assert.equal(buildForecastAnomalies(null,archive,now),null);
const nc=buildForecastAnomalies({daily:{time:ft,temperature_2m_mean:fT,precipitation_sum:fR}},null,now);assert.equal(nc.days[0].anomaly,null);assert.equal(nc.rain.pct,null);
const cf=await collectForecast(1,2,now,async()=>{throw Error('offline');});assert.equal(cf.forecast,null);assert.ok(cf.errors.length>=1);
assert.ok(forecastSvg(fa,"Teste").includes('s/d'));assert.match(forecastSvg(null),/indisponível/);
// Fallback: API de 30 anos indisponível -> tabela pré-calculada do lugar mais próximo
assert.ok(Math.abs(haversineKm(0,0,0,1)-111.2)<1);
const ftab={places:{'goiania-brasil':tab}};assert.equal(nearestPlace(-16.7,-49.3,ftab).place.id,'goiania-brasil');assert.equal(nearestPlace(-10,-40,ftab),null);assert.equal(nearestPlace(-16.7,-49.3,{places:{}}),null);
const fbFetch=async u=>{if(u.includes('archive-api'))return {ok:false,status:429};if(u.includes('places-climatology'))return {ok:true,json:async()=>ftab};return {ok:true,json:async()=>({daily:{time:ft,temperature_2m_mean:fT,precipitation_sum:fR}})};};
const fb=await collectForecast(-16.7,-49.3,now,fbFetch);assert.ok(fb.hasClimatology);assert.match(fb.climateSource,/Goiânia/);assert.ok(Math.abs(fb.forecast.days[0].anomaly-3)<.15);assert.equal(fb.errors.length,0);
const far=await collectForecast(10,10,now,fbFetch);assert.equal(far.hasClimatology,false);assert.match(far.errors.join(' '),/sem comparação com o normal/);assert.ok(far.forecast.days.length>0);
console.log('Passed: GIBS time/URLs, climatology, temperature/rain anomalies, missing data.');
