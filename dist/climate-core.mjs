// Anomalia da temperatura global (NASA GISS GISTEMP v4, superfície terra+oceano, base 1951–1980).
// Dado de clima de longo prazo: não é observação do dia nem previsão. Valores ausentes ("***") ficam null, nunca são preenchidos.
export const GISTEMP_URL='https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv';
export const GISTEMP_SOURCE={name:'NASA GISS · GISTEMP v4 (terra + oceano)',baseline:'1951–1980',url:'https://data.giss.nasa.gov/gistemp/'};
const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export const monthName=i=>MONTHS[i];
const val=s=>{const t=String(s??'').trim();if(!t||t.includes('*'))return null;const n=Number(t);return Number.isFinite(n)?n:null;};
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;

// Lê o CSV oficial. Aceita só linhas com ano de 4 dígitos; falha explicitamente se nada válido for encontrado.
export function parseGistemp(csv){
 const lines=String(csv??'').split(/\r?\n/),h=lines.findIndex(l=>/^Year,Jan,/.test(l));
 if(h<0)throw Error('Formato GISTEMP inesperado');
 const years=[];
 for(const l of lines.slice(h+1)){const c=l.split(',');if(!/^\d{4}$/.test(c[0]))continue;years.push({year:Number(c[0]),months:c.slice(1,13).map(val),annual:val(c[13])});}
 if(years.length<50)throw Error('Série GISTEMP curta demais');
 return {source:GISTEMP_SOURCE,fetchedAt:null,years};
}

// Resumo para a tela e para a explicação.
export function summarize(series){
 const ys=series?.years;if(!Array.isArray(ys)||!ys.length)return null;
 const monthly=ys.flatMap(y=>y.months.map((v,i)=>({year:y.year,month:i,value:v}))).filter(m=>m.value!==null);
 if(!monthly.length)return null;
 const latest=monthly.at(-1),last12=monthly.slice(-12),full=ys.filter(y=>y.annual!==null);
 const lastFull=full.at(-1),ranked=[...full].sort((a,b)=>b.annual-a.annual),rank=ranked.findIndex(y=>y.year===lastFull.year)+1;
 const since=full.filter(y=>y.year>=1970),n=since.length;let trend=null;
 if(n>=20){const mx=mean(since.map(y=>y.year)),my=mean(since.map(y=>y.annual));trend=since.reduce((s,y)=>s+(y.year-mx)*(y.annual-my),0)/since.reduce((s,y)=>s+(y.year-mx)**2,0)*10;}
 const decades={};for(const y of full){const d=Math.floor(y.year/10)*10;(decades[d]??=[]).push(y.annual);}
 return {latest:{...latest,monthLabel:MONTHS[latest.month]},last12:{mean:last12.length===12?mean(last12.map(m=>m.value)):null,count:last12.length},
  lastFull:{year:lastFull.year,value:lastFull.annual,rank,of:full.length},warmest:{year:ranked[0].year,value:ranked[0].annual},
  trendPerDecade:trend,decades:Object.fromEntries(Object.entries(decades).map(([d,v])=>[d,Math.round(mean(v)*100)/100])),firstYear:ys[0].year};
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const color=v=>v>=0?`hsl(${12+Math.max(0,1-v/1.5)*18} 70% ${55-Math.min(v,1.5)*8}%)`:`hsl(214 60% ${58+Math.max(v,-0.6)*10}%)`;
// Barras anuais (azul abaixo de 0, vermelho acima). Anos sem valor anual não são desenhados.
export function climateSvg(series){
 const full=(series?.years??[]).filter(y=>y.annual!==null);if(!full.length)return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 120"><text x="20" y="60" font-family="sans-serif" font-size="18">Série de temperatura global indisponível</text></svg>';
 const W=1000,H=300,left=60,top=50,min=Math.min(-0.6,...full.map(y=>y.annual)),max=Math.max(1.6,...full.map(y=>y.annual)),y0=top+max/(max-min)*H,sy=v=>top+(max-v)/(max-min)*H,bw=W/full.length;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 400"><rect width="1100" height="400" fill="#f7fafc"/><text x="${left}" y="28" font-family="sans-serif" font-size="19" fill="#16344c">Temperatura média global · anomalia anual (°C, base ${esc(GISTEMP_SOURCE.baseline)})</text>`;
 for(let v=Math.ceil(min*2)/2;v<=max;v+=.5)s+=`<path d="M${left} ${sy(v).toFixed(1)}H${left+W}" stroke="${v===0?'#7b8b99':'#dce4ec'}"/><text x="${left-8}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-family="sans-serif" font-size="12" fill="#526579">${v>0?'+':''}${v.toFixed(1).replace('.',',')}</text>`;
 full.forEach((y,i)=>{const x=left+i*bw,top2=Math.min(sy(y.annual),y0),h=Math.abs(sy(y.annual)-y0);s+=`<rect x="${x.toFixed(2)}" y="${top2.toFixed(1)}" width="${Math.max(bw-.6,.8).toFixed(2)}" height="${Math.max(h,.8).toFixed(1)}" fill="${color(y.annual)}"><title>${y.year}: ${y.annual>0?'+':''}${y.annual.toFixed(2)} °C</title></rect>`;});
 for(let yr=Math.ceil(full[0].year/20)*20;yr<=full.at(-1).year;yr+=20){const i=full.findIndex(y=>y.year===yr);if(i>=0)s+=`<text x="${(left+i*bw).toFixed(1)}" y="${top+H+22}" font-family="sans-serif" font-size="12" fill="#526579">${yr}</text>`;}
 s+=`<text x="${left}" y="${top+H+48}" font-family="sans-serif" font-size="12" fill="#526579">${esc(GISTEMP_SOURCE.name)} · anos com valor anual completo · ${full[0].year}–${full.at(-1).year}</text></svg>`;
 return s;
}
