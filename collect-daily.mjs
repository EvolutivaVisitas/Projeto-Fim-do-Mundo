import fs from 'node:fs/promises';
import {collectReport,auroraSvg,kpSvg} from './dist/monitor-core.mjs';
import {collectDailyWeather} from './dist/weather-core.mjs';
import {runGlobalWeather} from './collect-weather-global.mjs';
import {runClimate} from './collect-climate.mjs';
const report=await collectReport();const key=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(report.collectedAt));
try{report.weather=await collectDailyWeather();}catch(e){report.weather=null;report.errors.push('Tempo/satélite: coleta indisponível.');}
let globalWeather=null;try{globalWeather=await runGlobalWeather();}catch(e){report.errors.push('Panorama global de tempo: coleta indisponível.');}
try{await runClimate();}catch(e){report.errors.push('Clima global (NASA GISTEMP): coleta indisponível; série anterior preservada.');}
const root='dist/reports';await fs.mkdir(root,{recursive:true});
const land=JSON.parse(await fs.readFile('dist/land.geojson','utf8'));
await fs.writeFile(`${root}/${key}.json`,JSON.stringify(report));
await fs.writeFile(`${root}/${key}-aurora.svg`,auroraSvg(report,land));
await fs.writeFile(`${root}/${key}-kp.svg`,kpSvg(report));
let index=[];try{index=JSON.parse(await fs.readFile(`${root}/index.json`,'utf8'));}catch{}
const entry={date:key,collectedAt:report.collectedAt,max:report.max,stale:report.stale,json:`reports/${key}.json`,aurora:`reports/${key}-aurora.svg`,kp:`reports/${key}-kp.svg`};
index=index.filter(r=>r.date!==key);index.push(entry);index.sort((a,b)=>b.date.localeCompare(a.date));
await fs.writeFile(`${root}/index.json`,JSON.stringify(index));
console.log(JSON.stringify({date:key,globalWeather,kpMax:report.max,estimates:report.rows.length,stale:report.stale,errors:report.errors,aurora:report.aurora?.forecast,weather:report.weather?{temp:report.weather.anomaly.temp?.anomaly,rain7:report.weather.anomaly.rain?.sum7d,errors:report.weather.anomaly.errors}:null}));
