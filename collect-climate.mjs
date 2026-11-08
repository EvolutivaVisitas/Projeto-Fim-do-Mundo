// Baixa a série oficial de temperatura global (NASA GISTEMP) e grava dist/climate/global-temperature.json.
// O arquivo anterior só é substituído se a nova série for válida; em falha, o último arquivo é preservado.
import fs from 'node:fs/promises';
import {GISTEMP_URL,parseGistemp,summarize} from './dist/climate-core.mjs';
export async function runClimate(file='dist/climate/global-temperature.json',fetcher=fetch){
 const r=await fetcher(GISTEMP_URL,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'MagneTerra/1.0',Accept:'text/csv,*/*'}});
 if(!r.ok)throw Error('HTTP '+r.status);
 const series=parseGistemp(await r.text());series.fetchedAt=new Date().toISOString();
 const s=summarize(series);
 await fs.mkdir('dist/climate',{recursive:true});await fs.writeFile(file,JSON.stringify(series));
 return {latest:s.latest,lastFull:s.lastFull,years:series.years.length};
}
if(process.argv[1]?.endsWith('collect-climate.mjs'))console.log(JSON.stringify(await runClimate()));
