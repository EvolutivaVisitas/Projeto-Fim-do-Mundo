import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReport,normalizeKp,storm,auroraSvg,kpSvg} from './dist/monitor-core.mjs';
const now=Date.parse('2026-09-24T12:00:00Z');
const raw=[{time_tag:'2026-09-24T09:00:00',Kp:5},{time_tag:'2026-09-24T06:00:00',Kp:3},{time_tag:'2026-09-21T09:00:00',Kp:9},{time_tag:'2026-09-25T09:00:00',Kp:9},{time_tag:'2026-09-24T09:00:00',Kp:5},{time_tag:'2026-09-24T10:00:00',Kp:null}];
const report=buildReport(raw,null,now);assert.equal(report.rows.length,2);assert.equal(report.max,5);assert.equal(report.mean,4);assert.equal(report.stale,false);assert.match(report.summary,/parcial/);assert.match(report.summary,/G1/);assert.equal(normalizeKp([['time_tag','Kp'],['2026-09-24 09:00:00','4.33']])[0].kp,4.33);
const missing=buildReport([],null,now);assert.equal(missing.max,null);assert.match(missing.summary,/Não é possível concluir/);assert.equal(storm(8.67),'G4 · severa');assert.equal(storm(9),'G5 · extrema');
const stale=buildReport([{time_tag:'2026-09-23T15:00:00',Kp:2}],null,now);assert.equal(stale.stale,true);
assert.match(auroraSvg(missing,{features:[]}),/Mapa indisponível/);assert.match(kpSvg(report),/<svg/);
for(const mode of ['gravity','magnetic']){const s=JSON.parse(fs.readFileSync(`dist/global/${mode}-summary.json`));assert.equal(s.scope,'global');assert.ok(s.validCount>5000000);assert.equal(s.ranks.positive.length,10);assert.equal(s.ranks.negative.length,10);assert.equal(s.ranks.gradient.length,10);assert.equal(s.ranks.positive[0].value,Math.round(s.max*1000)/1000);assert.equal(s.ranks.negative[0].value,Math.round(s.min*1000)/1000);assert.ok(s.ranks.gradient.every(p=>p.gradient>=0));}
console.log('Passed: UTC windows, missing data, forecast separation, scales and global rankings.');
