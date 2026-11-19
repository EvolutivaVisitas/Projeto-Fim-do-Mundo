import assert from 'node:assert/strict';
import {parseLink,buildLink,MODES,RADII} from './dist/link-core.mjs';
const base='https://exemplo.test/magneterra/index.html';
// ida e volta: o que foi montado é lido de volta igual (coordenadas com 5 casas)
const st={mode:'gravity',radius:'100',lat:-16.758611,lon:-49.344444};
const link=buildLink(base,st);
assert.equal(link,'https://exemplo.test/magneterra/index.html?modo=gravity&raio=100&lat=-16.75861&lon=-49.34444#map');
assert.deepEqual(parseLink(new URL(link).search),{mode:'gravity',radius:'100',lat:-16.75861,lon:-49.34444});
// abrangência global: o ponto não entra no link
const g=buildLink(base,{mode:'magnetic',radius:'global',lat:10,lon:20});assert.ok(!g.includes('lat=')&&!g.includes('lon=')&&g.includes('raio=global'));
// parâmetros antigos e outros são descartados; o caminho da página é preservado; hash personalizado
const clean=buildLink(base+'?x=1&lat=5#weather',{mode:'climate',radius:'global'},'#sky');assert.ok(!clean.includes('x=1')&&clean.endsWith('#sky')&&clean.startsWith('https://exemplo.test/magneterra/index.html?'));
// valores inválidos são ignorados, sem inventar nada
assert.deepEqual(parseLink(''),{});
assert.deepEqual(parseLink('?modo=pwned&raio=9999'),{});
assert.deepEqual(parseLink('?lat=&lon='),{},'vazio não vira 0,0');
assert.deepEqual(parseLink('?lat=abc&lon=10'),{});
assert.deepEqual(parseLink('?lat=10'),{},'precisa de latitude e longitude juntas');
assert.deepEqual(parseLink('?lat=86&lon=10'),{},'fora do alcance do app (±85)');
assert.deepEqual(parseLink('?lat=10&lon=181'),{});
assert.deepEqual(parseLink('?lat=85&lon=-180&modo=gravity'),{mode:'gravity',lat:85,lon:-180},'limites incluídos; o modo gravidade valida os 80° ao analisar');
assert.deepEqual(parseLink('?lat=1e999&lon=10'),{},'infinito é rejeitado');
// texto malicioso na query não vira nada além de campos conhecidos
const odd=parseLink('?modo=<script>&raio="><img src=x onerror=1>&lat=1&lon=2');assert.deepEqual(odd,{lat:1,lon:2});
// as listas casam com as opções da interface
assert.deepEqual(MODES,['magnetic','gravity','climate']);assert.deepEqual(RADII,['global','25','50','100','200']);
console.log('Passed: shareable link round-trip, global scope omits point, invalid/empty/out-of-range values ignored, no injection.');
