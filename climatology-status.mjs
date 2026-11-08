// Diz se a climatologia pré-calculada está completa (todos os lugares de dist/places.mjs com tabela e modelo de persistência).
// Uso no GitHub Actions: grava "complete=true|false" em $GITHUB_OUTPUT; fora dele, só imprime o resumo.
import fs from 'node:fs/promises';
import {PLACES} from './dist/places.mjs';
let table=null;
try{table=JSON.parse(await fs.readFile('dist/climate/places-climatology.json','utf8'));}catch{}
const ready=PLACES.filter(p=>table?.places?.[p.id]?.model).length,complete=ready===PLACES.length;
console.log(`climatologia: ${ready}/${PLACES.length} lugares prontos (${complete?'completa':'incompleta'})`);
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`complete=${complete}\nready=${ready}\n`);
