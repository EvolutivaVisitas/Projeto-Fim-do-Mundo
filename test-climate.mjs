import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseGistemp,summarize,climateSvg} from './dist/climate-core.mjs';
import {explainClimate,climateLevel,END_OF_WORLD_CLIMATE} from './dist/explain.mjs';
import {runClimate} from './collect-climate.mjs';
// CSV sintético: 60 anos, ruído zero, tendência de +0,02 °C/ano; 2026 incompleto (***)
const rows=['Land-Ocean: Global Means','Year,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,J-D,D-N,DJF,MAM,JJA,SON'];
for(let y=1967;y<=2026;y++){const v=((y-1967)*.02-.3).toFixed(2);const m=Array(12).fill(v);if(y===2026){for(let i=9;i<12;i++)m[i]='***';}rows.push([y,...m,y===2026?'***':v,'***','***','***','***','***'].join(','));}
const csv=rows.join('\n');
const series=parseGistemp(csv);assert.equal(series.years.length,60);assert.equal(series.years.at(-1).months[11],null);assert.equal(series.years.at(-1).annual,null);
const s=summarize(series);assert.equal(s.latest.year,2026);assert.equal(s.latest.month,8);assert.equal(s.lastFull.year,2025);assert.equal(s.lastFull.rank,1);assert.ok(Math.abs(s.trendPerDecade-.2)<.01);assert.equal(s.last12.count,12);
assert.throws(()=>parseGistemp('lixo'),/inesperado/);assert.throws(()=>parseGistemp('Year,Jan,Feb\n1999,1,2'),/curta/);
assert.match(climateSvg(series),/<svg/);assert.match(climateSvg(null),/indisponível/);
assert.deepEqual([0.2,0.6,1.2,1.7].map(climateLevel),[0,1,2,3]);
const e=explainClimate(s);assert.ok(e.sections.some(x=>x.title==='É o fim do mundo?'&&x.text===END_OF_WORLD_CLIMATE));assert.match(e.sections.map(x=>x.text).join(' '),/1951–1980/);assert.doesNotMatch(e.headline+e.sections.map(x=>x.text).join(' '),/apocalipse|fim dos tempos|irreversível/i);
assert.equal(explainClimate(null).level,null);assert.match(explainClimate(null).sections[0].text,/Nada foi estimado/);
// Coletor: falha não destrói o arquivo anterior
const f=process.env.TEMP+'/gistemp-test.json';await fs.writeFile(f,'ANTERIOR');
await assert.rejects(runClimate(f,async()=>({ok:true,text:async()=>'lixo'})));assert.equal(await fs.readFile(f,'utf8'),'ANTERIOR');
await assert.rejects(runClimate(f,async()=>({ok:false,status:503})),/503/);assert.equal(await fs.readFile(f,'utf8'),'ANTERIOR');
await fs.rm(f);
console.log('Passed: GISTEMP parsing, missing months, summary/trend, chart, climate explanation, collector keeps old file on failure.');
