// Coleta o panorama global de anomalias e grava dist/reports/AAAA-MM-DD-weather.json e weather-latest.json.
import fs from 'node:fs/promises';
import {PLACES} from './dist/places.mjs';
import {collectGlobalWeather} from './dist/weather-core.mjs';
export async function runGlobalWeather(root='dist/reports',now=Date.now()){
 let table=null;
 try{table=JSON.parse(await fs.readFile('dist/climate/places-climatology.json','utf8'));}catch{}
 const result=await collectGlobalWeather(PLACES,table,now);
 if(!table)result.errors.push('Climatologia pré-calculada ausente (rode build-climatology.mjs); sem anomalias.');
 const key=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 await fs.mkdir(root,{recursive:true});
 const body=JSON.stringify(result);
 await fs.writeFile(`${root}/${key}-weather.json`,body);
 await fs.writeFile(`${root}/weather-latest.json`,body);
 return {key,count:result.count,withData:result.withData,errors:result.errors};
}
if(process.argv[1]?.endsWith('collect-weather-global.mjs'))console.log(JSON.stringify(await runGlobalWeather()));
