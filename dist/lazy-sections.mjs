// Carrega as seções do fim da página só quando elas se aproximam da tela. Antes, o satélite (8 quadros animados),
// o boletim diário, os avisos e o clima global começavam a baixar ao abrir o app e disputavam banda com o mapa e com
// a grade global de 12 MB. Cada seção continua funcionando igual; só começa depois.
// Usa a posição na tela (rolagem, redimensionamento, links #seção) e, como rede de segurança, carrega tudo 12 s
// depois de abrir, para nenhuma seção ficar sem funcionar.
const SECTIONS = [['daily', 'monitor-ui.mjs'], ['weather', 'weather-ui.mjs'], ['alerts', 'alerts-ui.mjs'], ['climate', 'climate-ui.mjs']];
const MARGIN = 900, SAFETY_MS = 12000, started = new Set();
function start(file) {
  if (started.has(file)) return;
  started.add(file);
  import('./' + file).catch(e => console.error('Falha ao carregar ' + file + ': ' + e.message));
}
function check() {
  for (const [id, file] of SECTIONS) {
    if (started.has(file)) continue;
    const el = document.getElementById(id);
    if (!el) { start(file); continue; }
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight + MARGIN && r.bottom > -MARGIN) start(file);
  }
}
let pending = false;
const soon = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; check(); }, 120); };
for (const ev of ['scroll', 'resize', 'hashchange']) addEventListener(ev, soon, { passive: true });
addEventListener('load', soon);
for (const ms of [400, 1500, 4000]) setTimeout(check, ms);   // o layout ainda muda enquanto as seções de cima carregam
setTimeout(() => SECTIONS.forEach(([, file]) => start(file)), SAFETY_MS);
check();
