import assert from 'node:assert/strict';
import {SST_BINS,sstFromRgba,describeSst,gradientCss,tileAt} from './dist/sst-core.mjs';
// Tabela oficial: 62 faixas contíguas de 0,1 °C entre −3 e +3, abertas nas pontas
assert.equal(SST_BINS.length,62);assert.equal(SST_BINS[0][0],-Infinity);assert.equal(SST_BINS.at(-1)[1],Infinity);assert.equal(SST_BINS[0][1],-3);assert.equal(SST_BINS.at(-1)[0],3);
for(let i=0;i<SST_BINS.length-1;i++){assert.equal(SST_BINS[i][1],SST_BINS[i+1][0],'faixas contíguas em '+i);if(i>0)assert.ok(Math.abs(SST_BINS[i][1]-SST_BINS[i][0]-0.1)<1e-9,'passo de 0,1 em '+i);}
assert.equal(new Set(SST_BINS.map(b=>b.slice(2).join())).size,62,'cada faixa tem cor própria');
// Cada cor exata devolve a própria faixa
for(const b of SST_BINS){const r=sstFromRgba(b[2],b[3],b[4]);assert.ok(r&&r.exact&&r.bin===b,'cor exata '+b);}
// Transparente (terra/sem dado) e cores fora da escala não viram valor
assert.equal(sstFromRgba(128,0,0,0),null);assert.equal(sstFromRgba(128,0,0,100),null);assert.equal(sstFromRgba(255,255,255),null,'branco (terra/gelo) não é valor');assert.equal(sstFromRgba(0,0,0),null,'preto (sem dado) não é valor');assert.equal(sstFromRgba(30,120,60),null);
// Cor levemente diferente: aproximada, marcada como não exata
const near=sstFromRgba(249+2,248-1,141+1);assert.ok(near&&!near.exact&&near.bin[0]===0.4,'aproximação marcada');
// Textos
assert.equal(describeSst([1,1.1,255,182,1]),'+1,0 a +1,1 °C (mais quente que a referência do produto)');
assert.match(describeSst([-2,-1.9]),/^-2,0 a -1,9 °C \(mais frio/);assert.ok(describeSst([-0.1,0]).endsWith('(perto da referência do produto)'));assert.match(describeSst([3,Infinity]),/^\+3,0 °C ou mais \(bem mais quente/);assert.match(describeSst([-Infinity,-3]),/^-3,0 °C ou menos \(bem mais frio/);assert.equal(describeSst(null),null);
// Legenda com as cores reais, de 0% a 100%
const g=gradientCss();assert.match(g,/^linear-gradient\(90deg,rgb\(116,0,214\) 0\.0%/);assert.match(g,/rgb\(128,0,0\) 100\.0%\)$/);assert.equal((g.match(/%/g)||[]).length,13);
// Tile e pixel: origem e uma conta independente (asinh) para Goiânia no zoom 7
assert.deepEqual(tileAt(0,0,0),{z:0,x:0,y:0,px:128,py:128});
const lat=-16.758611,lon=-49.344444,t=tileAt(lat,lon,7),n=128,fy=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n,fx=(lon+180)/360*n;
assert.equal(t.x,Math.floor(fx));assert.equal(t.y,Math.floor(fy));assert.equal(t.px,Math.floor((fx-t.x)*256));assert.equal(t.py,Math.floor((fy-t.y)*256));
assert.deepEqual(tileAt(10,190,4),tileAt(10,-170,4),'a longitude dá a volta');assert.deepEqual(tileAt(10,-540,4),tileAt(10,180,4));
const pole=tileAt(89.9,0,5);assert.equal(pole.y,0);const s=tileAt(-89.9,0,5);assert.equal(s.y,31);assert.ok(s.py<=255&&pole.py>=0);
console.log('Passed: official NASA SST colour table (62 bins), exact/approx/transparent pixel reading, texts, real-colour legend gradient, tile/pixel maths.');
