// Links como #weather ou #sky aterrissavam no lugar errado: as seções de cima ainda estavam carregando e empurravam o
// conteúdo depois da rolagem. Aqui a página confere a cada 250 ms, por até 15 s, se o alvo continua no topo e realinha
// quando ele se afastou. Para assim que a pessoa rola, toca, clica ou digita.
const id = decodeURIComponent(location.hash.slice(1)), target = id && document.getElementById(id);
if (target) {
  const halt = () => clearInterval(timer);
  const timer = setInterval(() => { if (Math.abs(target.getBoundingClientRect().top) > 4) target.scrollIntoView(); }, 250);
  for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) addEventListener(ev, halt, { once: true, passive: true });
  setTimeout(halt, 15000);
}
