import {analyze,distance,ranking} from './dist/analysis.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.equal(distance(0,0,0,0),0);assert.ok(Math.abs(distance(0,0,0,1)-111.195)<.01);
const data=await analyze(-16.758611,-49.344444,100,p=>{if(Math.round(p*100)%10===0)console.log(Math.round(p*100)+'%');});
assert.ok(data.points.length>2000&&data.points.length<3000);assert.ok(data.points.every(p=>p.km<=100&&Number.isFinite(p.value)));assert.equal(ranking(data,'positive').length,10);assert.equal(ranking(data,'negative').length,10);assert.equal(ranking(data,'gradient').length,10);
await fs.writeFile('dist/goiania.json',JSON.stringify(data));console.log(JSON.stringify({cells:data.points.length,total:data.total,max:ranking(data,'positive')[0],min:ranking(data,'negative')[0]}));
