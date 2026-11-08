import {alertsLevel} from "./alerts-core.mjs";
// Explicações em linguagem simples, geradas por regras fixas (sem IA externa e sem inventar dados).
// Objetivo: dizer, para leigos, se o que foi medido está normal, quanto foge do normal e se há motivo para se preocupar.
// Princípios: nunca alarmar sem base; sempre separar "tempo de poucos dias" de "clima"; avisar quando faltam dados.
export const LEVELS=[
 {level:0,label:'Dentro do normal',short:'Normal'},
 {level:1,label:'Um pouco fora do normal',short:'Atenção leve'},
 {level:2,label:'Bem fora do normal — vale acompanhar',short:'Atenção'},
 {level:3,label:'Muito fora do normal — siga os avisos oficiais',short:'Alerta'}
];
const f1=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(v);
const f0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v);
const worst=levels=>levels.length?Math.max(...levels):null;
export const END_OF_WORLD='Nenhum dado desta página indica risco de “fim do mundo” ou de catástrofe global. Estes indicadores medem variações do dia a dia da Terra e do espaço próximo, e eventos fortes já foram registrados antes sem fim da civilização. Em situações realmente perigosas, as autoridades (Defesa Civil, serviços de meteorologia) emitem avisos: confie neles, não em uma única página.';
const make=(level,headline,sections,end=END_OF_WORLD)=>({level,levelLabel:level===null?'Sem dados suficientes':LEVELS[level].label,headline,sections:[...sections,{title:'É o fim do mundo?',text:end}]});

// ---- Atividade geomagnética (Kp, escala G da NOAA) ----
export function kpLevel(kp){return kp>=8?3:kp>=6?2:kp>=4?1:0;}
export function explainGeomagnetic(report){
 if(!report||report.max===null||report.max===undefined||!report.rows?.length)return make(null,'Não dá para avaliar a atividade geomagnética agora.',[{title:'O que aconteceu',text:'A fonte (NOAA) não entregou medidas válidas de atividade geomagnética nas últimas 24 horas. Sem dados, não é possível dizer se esteve calma ou agitada. Nada foi estimado ou preenchido.'}]);
 const kp=report.max,level=kpLevel(kp),partial=report.rows.length<8||report.stale;
 const what={0:'O campo magnético da Terra esteve calmo. É o estado mais comum.',1:'O campo magnético esteve um pouco agitado pelo vento solar (partículas vindas do Sol). Isso é frequente e costuma passar sem ninguém notar.',2:'Houve uma tempestade geomagnética de fraca a moderada. É um evento comum, algumas vezes por mês nos períodos de maior atividade do Sol.',3:'Houve uma tempestade geomagnética forte a extrema. É um evento raro e intenso.'}[level];
 const effects={0:'Nenhum efeito perceptível para as pessoas ou para os aparelhos.',1:'Em geral, nenhum efeito para as pessoas. As auroras (luzes no céu) podem aparecer um pouco mais longe dos polos.',2:'Para a maioria das pessoas, nada muda. Operadores de satélites, GPS de alta precisão e redes elétricas podem ficar mais atentos; pequenas falhas pontuais são possíveis.',3:'Para a maioria das pessoas, nada muda no dia a dia, mas operadores de redes elétricas, satélites e comunicações por rádio podem tomar medidas de proteção e ocorrerem falhas pontuais. Auroras podem aparecer em latitudes bem mais baixas que o normal.'}[level];
 const worry={0:'Não há motivo para preocupação.',1:'Não há motivo para preocupação.',2:'Não há motivo para preocupação pessoal. Se trabalha com GPS de precisão, rádio ou energia, vale olhar os avisos do seu setor.',3:'Não há risco à saúde de quem está na superfície: a atmosfera e o campo magnético protegem. Acompanhe avisos oficiais, principalmente se depende de rádio, GPS ou rede elétrica.'}[level];
 const sections=[{title:'O que foi medido',text:`O índice Kp (de 0 a 9) mede o quanto o campo magnético da Terra foi perturbado. O maior valor estimado nas últimas 24 horas foi ${f1(kp)}. Acima de 5 já se chama “tempestade geomagnética”.`},{title:'O que isso significa',text:what},{title:'Isso afeta você?',text:effects},{title:'Devo me preocupar?',text:worry}];
 if(partial)sections.push({title:'Limite do dado',text:'A cobertura está parcial ou desatualizada, então este resumo pode não retratar o momento atual.'});
 sections.push({title:'Sobre o mapa de aurora',text:'O mapa é uma previsão de curto prazo (modelo OVATION), não um registro do que realmente apareceu no céu.'});
 return make(level,level===0?'A atividade geomagnética esteve calma.':level===1?'Houve um pouco de agitação magnética, sem consequências para a maioria das pessoas.':level===2?'Houve uma tempestade geomagnética moderada: comum e sem risco para as pessoas.':'Houve uma tempestade geomagnética forte: rara, mas sem risco direto à saúde.',sections);
}

// ---- Anomalia meteorológica de um ponto (24 h de temperatura, 7 dias de chuva) ----
// O nível estatístico (z) é limitado pela diferença absoluta: em lugares de clima muito estável (trópicos), 2 °C já dá z alto, mas não é alarmante.
export function tempLevel(z,anomaly=Infinity){const a=Math.abs(z),d=Math.abs(anomaly),l=a>=3?3:a>=2?2:a>=1?1:0;return Math.min(l,d>=5?3:d>=2.5?2:1);}
export function rainLevel(pct){return pct>=300?3:pct>=200?2:pct<=25?1:0;}
export function explainPoint(a,place=''){
 const where=place?` em ${place}`:' neste ponto';
 if(!a||(!a.temp&&!a.rain))return make(null,`Não dá para avaliar o tempo${where}.`,[{title:'O que aconteceu',text:'As fontes não entregaram dados válidos para este ponto. Nada foi estimado.'}]);
 const sections=[],levels=[];let headline;
 if(a.temp&&a.temp.anomaly!==undefined){const l=tempLevel(a.temp.z,a.temp.anomaly),hot=a.temp.anomaly>0,d=f1(Math.abs(a.temp.anomaly));levels.push(l);
  sections.push({title:'Temperatura',text:`Nas últimas 24 horas a temperatura média foi ${f1(a.temp.mean24h)} °C. O normal para esta época do ano é cerca de ${f1(a.temp.climMean)} °C. Ou seja, ${l===0?'dentro do esperado (diferença de '+d+' °C)':'esteve '+d+' °C '+(hot?'acima':'abaixo')+' do normal'}.`});
  sections.push({title:'Isso é bom ou ruim?',text:l===0?'É normal: nem bom nem ruim, apenas um dia típico.':hot?(l>=2?'Calor bem acima do normal pode cansar mais e exige cuidados: beba água, evite sol forte nas horas mais quentes e atenção a crianças, idosos e animais.':'Um pouco mais quente que o habitual; basta o cuidado de sempre com hidratação.'):(l>=2?'Frio bem abaixo do normal pede agasalho e atenção a pessoas vulneráveis; plantas e criações sensíveis podem sofrer.':'Um pouco mais frio que o habitual; nada fora do comum.')});}
 if(a.rain&&a.rain.anomaly!==undefined){const l=rainLevel(a.rain.pct??100),pct=a.rain.pct===null?null:f0(a.rain.pct);levels.push(l);
  sections.push({title:'Chuva',text:`Nos últimos 7 dias choveu ${f1(a.rain.sum7d)} mm${pct===null?'':', cerca de '+pct+'% do que é normal para essa semana do ano'} (normal: ${f1(a.rain.climMean)} mm). ${l===0?'Está dentro do esperado.':a.rain.pct>=200?'Choveu bem mais que o normal; isso pode aumentar o risco de alagamentos e deslizamentos se a chuva vier concentrada. Acompanhe os avisos locais.':'Choveu bem menos que o normal nesta semana. Uma semana seca não é seca de verdade: seca se mede em meses.'}`});}
 if(!levels.length)return make(null,`Faltam dados para comparar com o normal${where}.`,[{title:'O que aconteceu',text:`Há medidas recentes${a.temp?' (temperatura média das últimas 24 h: '+f1(a.temp.mean24h)+' °C)':''}, mas a comparação com o clima normal não está disponível. Sem isso não dá para dizer se é bom ou ruim.`}]);
 const level=worst(levels);
 headline=level===0?`O tempo${where} está dentro do normal.`:level===1?`O tempo${where} está um pouco fora do normal.`:level===2?`O tempo${where} está bem fora do normal; vale acompanhar.`:`O tempo${where} está muito fora do normal; acompanhe os avisos oficiais.`;
 sections.push({title:'Devo me preocupar?',text:level<=1?'Não há motivo para preocupação especial.':level===2?'Não é motivo de pânico, mas vale acompanhar a previsão e os avisos locais nos próximos dias.':'Dias assim existem e costumam ser temporários, mas podem trazer riscos locais (calor ou frio extremo, chuva forte). Siga os avisos da Defesa Civil e do serviço de meteorologia da sua região.'});
 sections.push({title:'Tempo não é clima',text:'Um dia ou uma semana fora do normal é “tempo”, e variações assim acontecem naturalmente. Não prova, sozinho, uma mudança do clima. O clima se avalia em décadas.'});
 if(a.notes?.length||a.errors?.length)sections.push({title:'Limite do dado',text:[...(a.notes??[]),...(a.errors??[])].join(' ')});
 sections.push({title:'Como a comparação é feita',text:'Comparamos a análise recente de um modelo (Open-Meteo) com a média de 1991–2020 para a mesma época (reanálise ERA5). São fontes diferentes, então é uma indicação aproximada, não um registro oficial de estação.'});
 return make(level,headline,sections);
}

// ---- Panorama global (muitos lugares) ----
export function explainGlobal(g){
 const ok=g?.places?.filter(p=>p.status==='ok')??[],scored=ok.filter(p=>Number.isFinite(p.z));
 if(!scored.length)return make(null,'Não dá para avaliar o panorama global agora.',[{title:'O que aconteceu',text:ok.length?`Há medidas recentes de ${ok.length} lugares, mas a comparação com o clima normal ainda não está disponível (a climatologia está incompleta). Nada foi estimado.`:g?'A coleta não trouxe dados válidos.':'Ainda não há coleta do panorama global disponível.'}]);
 const n=scored.length,hot=scored.filter(p=>p.z>=2),cold=scored.filter(p=>p.z<=-2),ext=scored.filter(p=>Math.abs(p.z)>=3),share=(hot.length+cold.length)/n*100;
 // Por puro acaso, cerca de 5% dos lugares passam de 2 desvios por dia; só um percentual bem maior é incomum.
 const level=share>=25||ext.length>=Math.max(5,n*.08)?3:share>=15?2:share>=9?1:0;
 const top=[...scored].sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,3).map(p=>`${p.name} (${p.tempAnomaly>0?'+':'−'}${f1(Math.abs(p.tempAnomaly))} °C)`).join(', ');
 const sections=[{title:'O que foi medido',text:`Comparamos a temperatura das últimas 24 horas com o normal da época em ${n} lugares do mundo. ${hot.length} estão bem mais quentes que o normal e ${cold.length} bem mais frios.`},
  {title:'Isso é bom ou ruim?',text:`Em qualquer dia, alguns lugares do mundo estão muito quentes ou muito frios por acaso: com ${n} lugares, espera-se por volta de ${f0(n*.05)} deles fora do normal (cerca de 5%). Aqui foram ${hot.length+cold.length} (${f0(share)}%). ${level===0?'Isso é o esperado, ou seja, um dia comum no planeta.':level===1?'É um pouco acima do esperado, mas ainda comum.':'É mais do que o acaso explicaria; vale olhar as regiões listadas.'}`},
  {title:'Onde mais fugiu do normal',text:top||'—'},
  {title:'Devo me preocupar?',text:level<=1?'Não. Este retrato não mostra nada fora do que acontece em dias comuns.':'Não é motivo de pânico: ondas de calor e frio acontecem e costumam ser regionais e temporárias. Se você mora numa região destacada, acompanhe a previsão e os avisos locais.'},
  {title:'Limite do dado',text:'A lista tem '+(g.count??ok.length)+' lugares escolhidos, não cobre o planeta inteiro. É um retrato do dia, não uma medida de mudança climática.'}];
 return make(level,level===0?'O panorama global está dentro do esperado para um dia comum.':level===1?'Há um pouco mais de lugares fora do normal do que o esperado.':'Há bem mais lugares fora do normal do que o acaso explicaria; vale olhar as regiões listadas.',sections);
}

// ---- Boletim diário: atividade geomagnética + (se registrado) tempo no ponto do boletim ----
export function explainDaily(report){
 const g=explainGeomagnetic(report),a=report?.weather?.anomaly;
 if(!a)return g;
 const name=report.weather.point?.name,w=explainPoint(a,name),strip=(e,prefix)=>e.sections.filter(s=>s.title!=='É o fim do mundo?').map(s=>({title:prefix+s.title,text:s.text}));
 const levels=[g.level,w.level].filter(l=>l!==null),level=levels.length?Math.max(...levels):null;
 return make(level,level===null?'Não dá para avaliar o boletim.':g.level===level?g.headline:w.headline,[{title:'Resumo',text:`Espaço: ${g.headline} Tempo${name?' em '+name:''}: ${w.headline}`},...strip(g,'Espaço · '),...strip(w,'Tempo · ')]);
}

// ---- Clima global (anomalia de temperatura, NASA GISTEMP; ver climate-core.mjs summarize) ----
export const END_OF_WORLD_CLIMATE='Não. O aquecimento global é um problema real e de longo prazo, que se desenrola ao longo de décadas, não um evento súbito de “fim do mundo”. Os riscos (ondas de calor, chuvas e secas mais extremas, elevação do nível do mar) crescem com as emissões e podem ser reduzidos por ações coletivas. Esta página mostra um retrato do passado e do presente, não uma previsão do futuro.';
export function climateLevel(mean12){return mean12>=1.5?3:mean12>=1?2:mean12>=.5?1:0;}
export function explainClimate(sum){
 if(!sum||sum.last12?.mean===null||sum.last12?.mean===undefined)return make(null,'Não dá para avaliar o clima global agora.',[{title:'O que aconteceu',text:'A série de temperatura global não está disponível ou está incompleta. Nada foi estimado.'}],END_OF_WORLD_CLIMATE);
 const m=sum.last12.mean,level=climateLevel(m),l=sum.latest,f=sum.lastFull,fmt=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(v);
 const sections=[
  {title:'O que foi medido',text:`A temperatura média da superfície da Terra (terra e oceanos) nos últimos 12 meses com dados ficou ${fmt(m)} °C acima da média de 1951–1980. O valor mais recente (${l.monthLabel}/${l.year}) foi ${fmt(l.value)} °C.`},
  {title:'O que isso significa',text:`Em ${f.year}, o ano completo mais recente, a Terra teve o ${f.rank}º ano mais quente dos ${f.of} registrados desde ${sum.firstYear}. O mais quente da série foi ${sum.warmest.year} (+${fmt(sum.warmest.value)} °C). Os últimos anos estão entre os mais quentes já medidos.`}];
 if(sum.trendPerDecade!==null)sections.push({title:'Tendência',text:`Desde 1970 a média global sobe cerca de ${fmt(sum.trendPerDecade)} °C por década. Na década de 1970 a anomalia média era ${fmt(sum.decades[1970]??0)} °C; nos anos 2020 até agora, ${fmt(sum.decades[2020]??0)} °C.`});
 sections.push({title:'Isso é bom ou ruim?',text:'Em geral não é uma boa notícia: uma Terra mais quente tende a trazer mais dias de calor extremo, mudanças no regime de chuvas e elevação do nível do mar. O efeito varia muito de região para região.'},
  {title:'Isso afeta você?',text:'Um ou dois graus na média global parecem pouco, mas deslocam os extremos: no dia a dia aparece como verões mais quentes e eventos de chuva ou seca mais intensos em alguns lugares. Um dia frio na sua cidade não contradiz a tendência global.'},
  {title:'Devo me preocupar?',text:'É um assunto sério e de longo prazo, mas não de pânico. A avaliação científica internacional (IPCC) conclui que o aquecimento recente é causado principalmente pelas atividades humanas. O que mais ajuda é acompanhar fontes oficiais e as decisões coletivas, não esta página isolada.'},
  {title:'Limite do dado',text:'A base de comparação é 1951–1980, que é anterior ao aquecimento recente e não é o mesmo que “antes da era industrial”. A média global não diz como está o clima no seu bairro, e os meses mais recentes podem ser revisados pela NASA.'});
 return make(level,level===0?'A Terra está perto da média de 1951–1980.':level===1?'A Terra está um pouco mais quente que a média de 1951–1980.':level===2?'A Terra está bem mais quente que a média de 1951–1980.':'A Terra está muito mais quente que a média de 1951–1980.',sections,END_OF_WORLD_CLIMATE);
}

// ---- Últimos 12 meses do lugar (anomalias mensais; ver weather-core buildMonthlyAnomalies) ----
const MN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export function explainMonthly(m,place=''){
 const where=place?` em ${place}`:' neste ponto',rows=m?.rows??[],t=rows.filter(r=>r.tempAnomaly!==null),r=rows.filter(x=>x.rainPct!==null);
 if(!t.length&&!r.length)return make(null,`Não dá para avaliar os últimos 12 meses${where}.`,[{title:'O que aconteceu',text:[...(m?.errors??[]),'Sem dados mensais completos; nada foi estimado.'].join(' ')}]);
 const sections=[],f1x=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(v);let level=0;
 if(t.length){const avg=t.reduce((s,x)=>s+x.tempAnomaly,0)/t.length,zs=t.filter(x=>x.z!==null),avgZ=zs.length?zs.reduce((s,x)=>s+x.z,0)/zs.length:0,above=t.filter(x=>x.tempAnomaly>0).length,top=[...t].sort((a,b)=>Math.abs(b.tempAnomaly)-Math.abs(a.tempAnomaly))[0];
  level=Math.abs(avgZ)>=1.5&&Math.abs(avg)>=1?2:Math.abs(avgZ)>=.75&&Math.abs(avg)>=.5?1:0;
  sections.push({title:'Temperatura',text:`Entre os ${t.length} meses com dados completos (dos últimos 12), ${above} ficaram mais quentes que o normal de 1991–2020 e ${t.length-above} mais frios. Na média, a temperatura ficou ${f1x(Math.abs(avg))} °C ${avg>=0?'acima':'abaixo'} do normal. O mês que mais fugiu do normal foi ${MN[top.month]} de ${top.year} (${top.tempAnomaly>0?'+':'−'}${f1x(Math.abs(top.tempAnomaly))} °C).`});
  sections.push({title:'Isso é bom ou ruim?',text:level===0?'Os últimos 12 meses ficaram dentro da variação normal de um ano para outro. Nem bom nem ruim.':avg>0?'Um ano inteiro mais quente que o normal pesa mais que um dia quente: pode significar mais calor acumulado e mais demanda de água e energia.':'Um ano inteiro mais frio que o normal é incomum e merece acompanhamento, mas não indica perigo por si só.'});}
 if(r.length){const wet=r.filter(x=>x.rainPct>=150).length,dry=r.filter(x=>x.rainPct<=50).length;
  sections.push({title:'Chuva',text:`Dos ${r.length} meses com dados completos, ${wet} tiveram bem mais chuva que o normal (150% ou mais) e ${dry} bem menos (50% ou menos). ${wet+dry===0?'A chuva ficou, em geral, dentro do esperado.':'Meses secos ou chuvosos isolados acontecem naturalmente; o que pesa é quando se repetem.'}`});}
 const missing=12-Math.min(t.length,12);if(missing>0)sections.push({title:'Limite do dado',text:`${missing} mês(es) sem dados completos de temperatura não foram estimados.`});
 sections.push({title:'Devo me preocupar?',text:level<=1?'Não há motivo para preocupação especial com este histórico.':'Não é motivo de pânico, mas vale acompanhar a previsão e os avisos locais, principalmente em épocas de calor.'},{title:'Tempo não é clima',text:'Doze meses são pouco para falar de clima, que se avalia em décadas. Para a tendência de longo prazo, veja a seção “Clima global”.'});
 return make(level,level===0?`Os últimos 12 meses${where} ficaram dentro do normal.`:level===1?`Os últimos 12 meses${where} ficaram um pouco fora do normal.`:`Os últimos 12 meses${where} ficaram bem fora do normal.`,sections);
}

// ---- Explicação combinada: o usuário escolhe uma, duas ou as três anomalias (magnéticas, gravitacionais, climáticas) ----
export const END_OF_WORLD_STATIC='Não. Os mapas magnético e gravitacional mostram propriedades das rochas da Terra, que mudam em escalas de milhões de anos. Eles não preveem terremotos, erupções nem qualquer outro evento, e nada neles indica risco ou catástrofe.';
const nf=(v,n=0)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:n,minimumFractionDigits:n}).format(v);
const place=p=>`${nf(Math.abs(p.lat),2)}°${p.lat>=0?'N':'S'}, ${nf(Math.abs(p.lon),2)}°${p.lon>=0?'L':'O'}`;
const STATIC={
 magnetic:{name:'Magnetismo',unit:'nT',
  what:'O campo magnético da Terra tem uma parte que vem do núcleo e outra, bem menor, que vem das rochas da crosta: rochas ricas em minerais magnéticos (como a magnetita) deixam uma “marca” no campo. A anomalia magnética é a diferença entre o que se mede e o campo esperado.',
  effects:'Nenhum efeito sobre saúde ou dia a dia. Geólogos usam esses mapas como uma pista sobre os tipos de rocha no subsolo, mas sozinho o mapa não prova a existência de nenhum minério.',
  limit:'É um modelo compilado de levantamentos (EMAG2 v3, NOAA), não uma medição do dia. Na visão global usamos grade de 6′ (~11 km) suavizada em 31,5 km, o que apaga estruturas pequenas.'},
 gravity:{name:'Gravidade',unit:'mGal',
  what:'A gravidade varia ligeiramente de lugar para lugar, por causa do relevo (montanhas, fossas) e de como a massa está distribuída no subsolo. A anomalia de ar livre é a diferença entre a gravidade medida e a de um modelo de referência, já corrigida da altitude.',
  effects:'Nenhum efeito perceptível: as variações são pequenas demais para qualquer pessoa sentir, e 1 mGal é um milionésimo da gravidade normal. Servem a estudos geológicos e à definição do formato da Terra.',
  limit:'É um modelo estático (Scripps/IGPP v33.1), não uma medição em tempo real, com suavização de 31,5 km. Não equivale à anomalia de Bouguer.'}
};
// region: {radius, lat, lon, min, max, count} quando há análise regional do mesmo tipo; global: resumo global (min, max, ranks).
function staticSections(kind,global,region){
 const c=STATIC[kind],p=c.name+' · ',out=[{title:p+'O que é',text:c.what}];
 if(global&&Number.isFinite(global.min)&&Number.isFinite(global.max)){
  const hi=global.ranks?.positive?.[0],lo=global.ranks?.negative?.[0];
  out.push({title:p+'O que foi medido',text:`Na grade global, os valores vão de ${nf(global.min,0)} a ${nf(global.max,0)} ${c.unit}.${hi?` O maior valor fica perto de ${place(hi)}.`:''}${lo?` O menor, perto de ${place(lo)}.`:''}`});
 }else out.push({title:p+'O que foi medido',text:'O resumo global não está disponível agora. Nada foi estimado.'});
 if(region&&Number.isFinite(region.min)&&Number.isFinite(region.max))out.push({title:p+'Na região escolhida',text:`Em ${nf(region.radius,0)} km ao redor de ${place(region)}, os valores variam de ${nf(region.min,1)} a ${nf(region.max,1)} ${c.unit} (${nf(region.count,0)} células válidas). Variações grandes em poucos quilômetros indicam contraste geológico, não perigo.`});
 out.push({title:p+'Isso é bom ou ruim?',text:'Nem bom nem ruim: reflete a geologia do lugar e é estável por milhões de anos. Não existe “nível de alerta” para este tipo de dado.'},
  {title:p+'Isso afeta você?',text:c.effects},{title:p+'Devo me preocupar?',text:'Não.'},{title:p+'Limite do dado',text:c.limit});
 return out;
}
export function explainSelection({kinds,magnetic=null,gravity=null,climate=null,regions={}}){
 const chosen=['magnetic','gravity','climate'].filter(k=>kinds?.includes(k));
 if(!chosen.length)return make(null,'Escolha pelo menos uma anomalia para explicar.',[{title:'Como usar',text:'Marque magnéticas, gravitacionais e/ou climáticas e clique de novo. Você pode explicar uma só ou as três juntas.'}]);
 const sections=[],heads=[];let level=0;
 for(const k of chosen){
  if(k==='climate'){const e=explainClimate(climate);level=e.level??0;heads.push(e.headline);
   sections.push(...e.sections.filter(s=>s.title!=='É o fim do mundo?').map(s=>({title:'Clima · '+s.title,text:s.text})),{title:'Clima · Mapa deste modo',text:'O mapa climático do painel mostra a anomalia diária da temperatura do mar (NASA GIBS), só nos oceanos. É um produto que muda a cada dia, ao contrário dos mapas magnético e gravitacional.'});}
  else sections.push(...staticSections(k,k==='magnetic'?magnetic:gravity,regions?.[k]));
 }
 const names={magnetic:'magnéticas',gravity:'gravitacionais',climate:'climáticas'};
 const list=chosen.map(k=>names[k]).join(', ').replace(/, ([^,]*)$/,' e $1');
 const staticOnly=!chosen.includes('climate'),headline=staticOnly?`Anomalias ${list}: mapas de referência da crosta terrestre, sem alerta.`:chosen.length===1?heads[0]:`Anomalias ${list}: ${heads[0]} Os mapas magnético e gravitacional são referências estáticas e não trazem alerta.`;
 const exp=make(level,headline,sections,chosen.includes('climate')?END_OF_WORLD_CLIMATE:END_OF_WORLD_STATIC);
 if(staticOnly)exp.levelLabel='Referência estática (sem alerta)';
 else if(chosen.length>1)exp.levelLabel='Clima: '+exp.levelLabel;
 return exp;
}

// ---- Avisos oficiais (terremotos ocorridos, clima espacial e desastres; ver alerts-core.mjs) ----
export function explainAlerts(r,now=Date.now()){
 if(!r||(!r.quakes&&!r.space&&!r.disasters))return make(null,'Não dá para avaliar os avisos oficiais agora.',[{title:'O que aconteceu',text:['As fontes oficiais não responderam.',...(r?.errors??[])].join(' ')+' Nada foi estimado.'},{title:'Onde ver',text:'Consulte diretamente a Defesa Civil, o INMET (alertas2.inmet.gov.br), o USGS e a NOAA.'}]);
 const level=alertsLevel(r,now),sections=[],f1x=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(v);
 if(r.quakes){const q=r.quakes,top=q[0];sections.push({title:'Terremotos já ocorridos',text:q.length?`Nas últimas 24 horas o USGS registrou ${q.length} terremoto(s) de magnitude 4,5 ou mais no mundo. O maior foi M ${f1x(top.mag)}, em ${top.place}. Isso é normal: tremores desse porte acontecem várias vezes por dia no planeta, e a maioria ocorre longe de áreas habitadas. Terremotos de magnitude 7 ou mais ocorrem cerca de 15 vezes por ano.`:'Nas últimas 24 horas o USGS não listou terremotos de magnitude 4,5 ou mais.'});
  if(q.some(x=>x.tsunami))sections.push({title:'Tsunami',text:'Algum dos terremotos listados está marcado com possibilidade de tsunami. Consulte tsunami.gov e a Defesa Civil da sua região.'});}
 if(r.space){const act=r.space.find(a=>a.scale&&/ALERT|WARNING|WATCH/.test(a.kind??'')&&now-a.time<=12*3600000);sections.push({title:'Clima espacial (NOAA)',text:act?`A NOAA emitiu há pouco um aviso: “${act.text}” (escala ${act.scale}). Tempestades geomagnéticas assim não oferecem risco à saúde de quem está na superfície; afetam, no máximo, satélites, GPS de precisão e redes elétricas.`:'Não há avisos de clima espacial das últimas 12 horas.'});}
 if(r.kpForecast){const k=r.kpForecast;sections.push({title:'Previsão geomagnética (próximos dias)',text:`A NOAA prevê Kp de até ${f1x(k.max)} nas próximas ${k.hours} horas${k.max>=5?' (nível de tempestade geomagnética)':', sem tempestade geomagnética prevista'}. É uma previsão probabilística de poucos dias e pode mudar.`});}
 if(r.disasters){const cur=r.disasters.filter(d=>d.current),ended=r.disasters.filter(d=>!d.current);sections.push({title:'Desastres (GDACS, ONU/UE)',text:cur.length?`Há ${cur.length} evento(s) de alerta laranja ou vermelho em andamento: ${cur.slice(0,3).map(d=>`${d.type}${d.country?' ('+d.country+')':''}`).join('; ')}. Se você está na região, siga a Defesa Civil local.`:`Nenhum evento de alerta laranja ou vermelho está em andamento agora.${ended.length?` Nos últimos 7 dias houve ${ended.length} já encerrado(s).`:''}`});}
 sections.push({title:'Isso afeta você?',text:'Depende de onde você está. Terremotos e desastres são locais: o que importa é o aviso da autoridade do seu município ou país.'},
  {title:'Devo me preocupar?',text:level===0?'Não há nada fora do rotineiro nas fontes consultadas.':level===1?'Há eventos moderados registrados, comuns no mundo. Só se preocupe se estiver perto de algum deles.':level===2?'Há eventos fortes ou avisos relevantes. Se estiver perto, acompanhe a Defesa Civil.':'Há eventos graves classificados pelas agências. Se estiver na região, siga as instruções oficiais imediatamente.'},
  {title:'Limites',text:'O MagneTerra apenas repassa o que USGS, NOAA e GDACS publicaram: não prevê terremotos nem erupções (isso não é possível hoje) e não emite alertas próprios. Os avisos do INMET (Brasil) não estão integrados: veja alertas2.inmet.gov.br. '+(r.errors?.length?r.errors.join(' '):'')});
 return make(level,level===0?'Nada fora do rotineiro nos avisos oficiais.':level===1?'Há eventos moderados nos avisos oficiais, comuns no mundo.':level===2?'Há avisos oficiais relevantes: vale acompanhar.':'Há eventos graves nos avisos oficiais: siga as instruções das autoridades.',sections);
}

// ---- Previsão de anomalias dos próximos dias (ver weather-core buildForecastAnomalies) ----
export function explainForecast(res,place=''){
 const where=place?` em ${place}`:' neste ponto',fc=res?.forecast,days=fc?.days??[],scored=days.filter(d=>d.anomaly!==null);
 if(!fc||!days.length)return make(null,`Não dá para avaliar a previsão${where}.`,[{title:'O que aconteceu',text:[...(res?.errors??[]),'Sem previsão válida; nada foi estimado.'].join(' ')}]);
 const f1x=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(v),sections=[],fmtDay=d=>d.date.slice(8,10)+'/'+d.date.slice(5,7);
 let level=0;
 if(scored.length){const near=scored.slice(0,7),use=near.length?near:scored,avg=use.reduce((s,d)=>s+d.anomaly,0)/use.length,top=[...use].sort((a,b)=>Math.abs(b.anomaly)-Math.abs(a.anomaly))[0];
  const lv=Math.max(...use.map(d=>tempLevel(d.z,d.anomaly)));level=Math.min(lv,2);// previsão nunca passa de "vale acompanhar"
  sections.push({title:'Temperatura prevista',text:`Nos próximos ${use.length} dias a temperatura média diária deve ficar ${f1x(Math.abs(avg))} °C ${avg>=0?'acima':'abaixo'} do normal em média. O dia mais fora do normal deve ser ${fmtDay(top)} (${top.anomaly>0?'+':'−'}${f1x(Math.abs(top.anomaly))} °C, previsto ${f1x(top.temp)} °C).`},
   {title:'Isso é bom ou ruim?',text:level===0?'Os dias previstos ficam dentro da variação normal: nem bom nem ruim.':avg>0?'Dias bem mais quentes que o normal pedem cuidado com hidratação e exposição ao sol, principalmente para crianças, idosos e animais.':'Dias bem mais frios que o normal pedem agasalho e atenção a pessoas vulneráveis.'});}
 else sections.push({title:'Temperatura prevista',text:'A previsão existe, mas a comparação com o normal não está disponível agora; sem isso não dá para dizer se os dias serão normais.'});
 if(fc.rain){const r=fc.rain;sections.push({title:'Chuva prevista (7 dias)',text:`A previsão soma ${f1x(r.sum)} mm nos próximos 7 dias${r.pct===null||r.climMean===null?'.':`, cerca de ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(r.pct)}% do normal para a época (${f1x(r.climMean)} mm).`} ${r.pct!==null&&r.pct>=200?'É bem mais que o normal; se a chuva vier concentrada, acompanhe os avisos locais de alagamento.':r.pct!==null&&r.pct<=25?'É bem menos que o normal para a semana.':'Dentro do que se espera para a época.'}`});}
 sections.push({title:'Quão confiável é?',text:'Previsões de tempo são boas até uns 3 a 5 dias e perdem precisão rapidamente depois de 7. Use os dias mais distantes como tendência, não como garantia. Valores são do modelo na grade, não de uma estação.'},
  {title:'Devo me preocupar?',text:level===0?'Não há motivo para preocupação especial.':'Não é motivo de pânico, mas vale acompanhar a previsão e os avisos do serviço de meteorologia da sua região nos próximos dias.'},
  {title:'Limites',text:'Esta é uma previsão estatística de tempo, não um aviso oficial. Eventos severos (tempestades, ciclones) são anunciados pelo INMET, pela Defesa Civil e serviços equivalentes. O app não prevê terremotos ou erupções.'});
 if(res?.errors?.length)sections.push({title:'Limite do dado',text:res.errors.join(' ')});
 return make(level,level===0?`A previsão${where} para os próximos dias é de tempo dentro do normal.`:level===1?`A previsão${where} indica dias um pouco fora do normal.`:`A previsão${where} indica dias bem fora do normal; vale acompanhar.`,sections);
}
