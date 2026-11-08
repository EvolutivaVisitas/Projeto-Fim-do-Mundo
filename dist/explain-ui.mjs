import {LEVELS} from './explain.mjs';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
// Desenha a explicação (objeto de explain.mjs) em `box`. Só usa textContent: nenhum texto vira HTML.
export function renderExplanation(box,exp){
 box.replaceChildren();box.hidden=false;box.className='explain lvl'+(exp.level===null?'n':exp.level);
 const scale=el('div',undefined,'explainScale');scale.setAttribute('role','img');scale.setAttribute('aria-label','Escala de 4 níveis: '+exp.levelLabel);
 for(const l of LEVELS)scale.append(el('span',l.short,exp.level!==null&&l.level<=exp.level?'on':''));
 box.append(el('div',exp.levelLabel,'explainBadge'),scale,el('h4',exp.headline));
 for(const s of exp.sections){const sec=el('div',undefined,'explainSec');sec.append(el('h5',s.title),el('p',s.text));box.append(sec);}
 box.append(el('p','Explicação automática por regras fixas, a partir dos dados coletados. Não é aviso oficial nem previsão; não substitui a Defesa Civil, o INMET ou a NOAA.','hint'));
}
// Liga um botão a uma caixa: clicar mostra a explicação atual; clicar de novo esconde.
export function bindExplain(button,box,getExplanation){
 button.onclick=()=>{if(!box.hidden){box.hidden=true;button.textContent='Explicar em linguagem simples';return;}
  try{renderExplanation(box,getExplanation());button.textContent='Esconder explicação';}
  catch(e){box.hidden=false;box.className='explain lvln';box.textContent='Não foi possível gerar a explicação: '+e.message;}};
}
