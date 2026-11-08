// Painel de interpretação: junta previsões e dados já coletados e responde "isso é alarmante?".
// Só combina previsões de modelos/agências e comparações com o clima normal; nada aqui prevê terremotos ou erupções.
import {tempLevel,climateLevel} from './explain.mjs';
import {alertsLevel} from './alerts-core.mjs';

// Função de distribuição normal padrão (Abramowitz–Stegun 7.1.26).
export function normalCdf(z){const t=1/(1+.3275911*Math.abs(z)/Math.SQRT2),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z/2);return z>=0?.5*(1+y):.5*(1-y);}
// Quão raro é um desvio de z: fração dos dias que fica tão ou mais longe do normal (aproximação normal, bicaudal).
export function rarity(z){if(!Number.isFinite(z))return null;const p=Math.min(1,2*(1-normalCdf(Math.abs(z))));return {pctDays:p*100,oneIn:p>0?Math.round(1/p):null};}
export function rarityText(z){const r=rarity(z);if(!r)return '';if(r.pctDays>=20)return 'Esse desvio é comum: ocorre em cerca de 1 a cada '+Math.max(1,r.oneIn)+' dias nesta época.';if(r.oneIn===null||r.oneIn>5000)return 'Esse desvio é raríssimo para esta época.';return `Esse desvio é incomum: ocorre em cerca de 1 a cada ${r.oneIn.toLocaleString('pt-BR')} dias nesta época (aproximação estatística).`;}
const LABELS=['Tudo dentro do esperado','Um pouco fora do normal','Bem fora do normal — vale acompanhar','Muito fora do normal — siga as autoridades'];
export const VERDICTS=[
 'Não há nada alarmante: os sinais dos próximos dias estão dentro do esperado.',
 'Há sinais um pouco fora do normal, mas comuns. Não é alarmante.',
 'Há sinais bem fora do normal. Não é motivo de pânico, mas vale acompanhar a previsão e os avisos oficiais.',
 'Agências oficiais emitiram avisos graves. Se você está na região afetada, siga as instruções das autoridades.'];

function weatherItem(res){
 const fc=res?.forecast;if(!fc?.days?.length)return {key:'weather',title:'Tempo no ponto (próx. 7 dias)',level:null,value:'Sem previsão',detail:[...(res?.errors??[]),'Nada foi estimado.'].join(' ')};
 const days=fc.days.slice(0,7),scored=days.filter(d=>d.anomaly!==null);
 if(!scored.length)return {key:'weather',title:'Tempo no ponto (próx. 7 dias)',level:null,value:'Sem comparação',detail:'Há previsão, mas a comparação com o normal não está disponível agora.'};
 const worst=[...scored].sort((a,b)=>Math.abs(b.z)-Math.abs(a.z))[0],avg=scored.reduce((s,d)=>s+d.anomaly,0)/scored.length;
 let level=Math.min(Math.max(...scored.map(d=>tempLevel(d.z,d.anomaly))),2);
 const parts=[`Dia mais fora do normal: ${worst.date.slice(8,10)}/${worst.date.slice(5,7)}, ${worst.anomaly>0?'+':'−'}${Math.abs(worst.anomaly).toFixed(1).replace('.',',')} °C (previsto ${worst.temp.toFixed(1).replace('.',',')} °C). ${rarityText(worst.z)}`];
 const e=scored.slice(0,3),l=scored.slice(-3);if(scored.length>=6){const d=l.reduce((s,x)=>s+x.anomaly,0)/l.length-e.reduce((s,x)=>s+x.anomaly,0)/e.length;if(Math.abs(d)>=1)parts.push(`Tendência: ${d>0?'esquentando':'esfriando'} (${d>0?'+':'−'}${Math.abs(d).toFixed(1).replace('.',',')} °C do começo ao fim da semana).`);}
 if(fc.rain&&fc.rain.pct!==null){const p=fc.rain.pct;if(p>=200)level=Math.max(level,Math.min(p>=300?2:1,2));parts.push(`Chuva prevista: ${fc.rain.sum.toFixed(0)} mm em 7 dias, ${Math.round(p)}% do normal${p>=200?' (bem acima: atenção a alagamentos se vier concentrada)':p<=25?' (bem abaixo do normal)':''}.`);}
 if(res.climateSource&&!/consulta direta/.test(res.climateSource))parts.push(`Comparação com o normal feita com ${res.climateSource}.`);
 return {key:'weather',title:'Tempo no ponto (próx. 7 dias)',level,value:`${avg>=0?'+':'−'}${Math.abs(avg).toFixed(1).replace('.',',')} °C na média`,detail:parts.join(' ')};
}
function spaceItem(al){
 const kf=al?.kpForecast;if(!kf)return {key:'space',title:'Clima espacial (próx. 3 dias)',level:null,value:'Sem previsão',detail:'A NOAA não retornou a previsão de Kp. Nada foi estimado.'};
 const level=kf.max>=8?2:kf.max>=5?1:0;
 return {key:'space',title:'Clima espacial (próx. 3 dias)',level,value:`Kp até ${kf.max.toFixed(1).replace('.',',')}`,detail:`${kf.max>=5?'A NOAA prevê tempestade geomagnética (Kp 5 ou mais).':'A NOAA não prevê tempestade geomagnética (abaixo de Kp 5).'} Mesmo as tempestades fortes não oferecem risco à saúde de quem está na superfície; afetam satélites, GPS de precisão e redes elétricas. Previsão probabilística de poucos dias.`};
}
function alertsItem(al,now){
 if(!al||(!al.quakes&&!al.space&&!al.disasters))return {key:'alerts',title:'Avisos oficiais agora',level:null,value:'Sem consulta',detail:'As fontes oficiais não responderam. Nada foi estimado.'};
 const level=alertsLevel(al,now),top=al.quakes?.[0],cur=(al.disasters??[]).filter(d=>d.current);
 return {key:'alerts',title:'Avisos oficiais agora',level,value:top?`Maior tremor: M ${top.mag.toFixed(1).replace('.',',')}`:'Sem tremores M 4,5+',detail:`${al.quakes?al.quakes.length+' terremoto(s) de M 4,5+ nas últimas 24 h (o mundo tem vários por dia). ':''}${cur.length?cur.length+' desastre(s) laranja/vermelho em andamento. ':'Nenhum desastre laranja/vermelho em andamento. '}Terremotos não podem ser previstos: aqui só aparecem os que já ocorreram.`};
}
function climateItem(cs){
 if(!cs||cs.last12?.mean==null)return {key:'climate',title:'Contexto de longo prazo',level:null,value:'Sem dados',detail:'A série de temperatura global não está disponível. Nada foi estimado.',context:true};
 const m=cs.last12.mean;
 return {key:'climate',title:'Contexto de longo prazo',level:climateLevel(m),value:`+${m.toFixed(2).replace('.',',')} °C global`,detail:`A Terra está ${m.toFixed(2).replace('.',',')} °C acima da média de 1951–1980 (últimos 12 meses). É um tema sério e de décadas; ele não muda o que vai acontecer nos próximos dias e por isso não entra na leitura geral.`,context:true};
}
// Reúne tudo e dá a leitura geral. Só entram na leitura geral os itens de curto prazo (tempo, espaço, avisos).
export function buildOutlook({forecast,alerts,climate,now=Date.now()}){
 const items=[weatherItem(forecast),spaceItem(alerts),alertsItem(alerts,now),climateItem(climate)];
 const short=items.filter(i=>!i.context&&i.level!==null);
 const level=short.length?Math.max(...short.map(i=>i.level)):null,missing=items.filter(i=>!i.context&&i.level===null).map(i=>i.title);
 return {level,label:level===null?'Sem dados suficientes':LABELS[level],verdict:level===null?'Não há dados suficientes para dizer se algo é alarmante. Nada foi estimado.':VERDICTS[level]+(missing.length?` Atenção: faltam dados de ${missing.join('; ')}, então a leitura pode estar incompleta.`:''),missing,items,collectedAt:new Date(now).toISOString(),
  caveat:'Esta leitura combina previsões de modelos e avisos de agências. Não é um aviso oficial, não prevê terremotos nem erupções e pode mudar a qualquer momento.'};
}
