import assert from 'node:assert/strict';
import fs from 'node:fs';
import {valueAt,analyzeGravity,gravityColor} from './dist/gravity.mjs';
import {ranking} from './dist/analysis.mjs';
const bytes=fs.readFileSync('dist/gravity/faa-06m.bin'),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),values=new Int16Array(bytes.length/2);for(let i=0;i<values.length;i++)values[i]=view.getInt16(i*2,true);
assert.equal(values.length,3600*1800);
// Independently read from the source NetCDF using netCDF4, including its scale and offset.
for(const sample of [{lat:-16.75,lon:-49.35,source_value:-5.175},{lat:.05,lon:.05,source_value:-4.55},{lat:40.05,lon:-99.95,source_value:1.45},{lat:-44.95,lon:170.05,source_value:66.05}]){assert.ok(Math.abs(valueAt(values,sample.lat,sample.lon)-sample.source_value)<=.050001);}
const go=analyzeGravity(values,-16.758611,-49.344444,100);
assert.ok(go.points.length>250&&go.points.length<280);
assert.ok(go.points.every(p=>p.km<=100&&Number.isFinite(p.value)&&Number.isFinite(p.gradient)));
assert.equal(go.total,go.points.length);
assert.ok(ranking(go,'positive').every(p=>p.value>0));assert.ok(ranking(go,'negative').every(p=>p.value<0));
assert.ok(Number.isNaN(valueAt(values,85,0)));assert.throws(()=>analyzeGravity(values,82,0,100));
assert.equal(valueAt(values,0,180),valueAt(values,0,-180));
const seam=analyzeGravity(values,0,179.9,100);assert.ok(seam.points.some(p=>p.lon<0)&&seam.points.some(p=>p.lon>0));assert.ok(seam.points.every(p=>Number.isFinite(p.gradient)));
assert.equal(gravityColor(NaN)[3],0);
console.log(JSON.stringify({checks:'passed',goiania:{cells:go.points.length,min:Math.min(...go.points.map(p=>p.value)),max:Math.max(...go.points.map(p=>p.value)),center:valueAt(values,-16.758611,-49.344444)}}));
