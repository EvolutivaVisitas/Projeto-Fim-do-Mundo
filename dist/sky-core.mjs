// Eventos astronômicos previsíveis: fases da Lua, eclipses e equinócios/solstícios.
// São cálculos de efemérides (movimento da Lua e do Sol), 100% determinísticos e feitos no próprio navegador, sem fonte externa.
// Não são medições nem previsão de fenômenos da Terra: o app NÃO relaciona fases da Lua ou eclipses a terremotos ou tempestades geomagnéticas.
// Modelo: termos principais de Meeus (Lua e Sol). Precisão típica: poucos minutos nas fases e estações; classificação de eclipses é aproximada.

export const J2000 = 2451545.0;
export const UNIX_JD = 2440587.5;
export const SYNODIC_DAYS = 29.530588861;   // mês sinódico médio
export const SAROS_DAYS = 6585.3211;         // 223 meses sinódicos: ~18 anos, 11 dias e 8 horas
export const toJd = ms => ms / 86400000 + UNIX_JD;
export const toMs = jd => (jd - UNIX_JD) * 86400000;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const norm = a => ((a % 360) + 360) % 360;
const wrap = a => norm(a + 180) - 180;

export const PHASE_NAMES = ['Lua nova', 'Quarto crescente', 'Lua cheia', 'Quarto minguante'];

// Posição geocêntrica aparente (longitude e latitude eclípticas) da Lua e longitude do Sol, em graus.
export function position(jd) {
  const T = (jd - J2000) / 36525, s = x => Math.sin(rad(x));
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.2720950 + 483202.0175233 * T;
  const omega = 125.04 - 1934.136 * T;
  const nut = -0.00478 * s(omega) - 0.00569;   // nutação em longitude e aberração (aprox.)
  const moonLon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mp)
    - 0.185116 * s(M) - 0.114332 * s(2 * F) + 0.058793 * s(2 * D - 2 * Mp) + 0.057066 * s(2 * D - M - Mp)
    + 0.053322 * s(2 * D + Mp) + 0.045758 * s(2 * D - M) - 0.040923 * s(M - Mp) - 0.034720 * s(D) - 0.030383 * s(M + Mp);
  const moonLat = 5.128122 * s(F) + 0.280602 * s(Mp + F) + 0.277693 * s(Mp - F) + 0.173237 * s(2 * D - F)
    + 0.055413 * s(2 * D - Mp + F) + 0.046271 * s(2 * D - Mp - F) + 0.032573 * s(2 * D + F);
  const L0 = 280.46646 + 36000.76983 * T;
  const sunLon = L0 + (1.914602 - 0.004817 * T) * s(M) + 0.019993 * s(2 * M);
  const sun = norm(sunLon + nut), moon = norm(moonLon + nut);
  return { moonLon: moon, moonLat, sunLon: sun, elong: norm(moon - sun) };
}

// Nome da fase pela elongação (0° = nova, 180° = cheia). Quartos e nova/cheia valem só perto do ângulo exato,
// para que, por exemplo, 66% de disco iluminado seja "gibosa" e não "quarto".
export function stageOf(elong) {
  const e = norm(elong);
  if (e < 6 || e >= 354) return 'Lua nova';
  if (e < 84) return 'Crescente';
  if (e < 96) return 'Quarto crescente';
  if (e < 174) return 'Gibosa crescente';
  if (e < 186) return 'Lua cheia';
  if (e < 264) return 'Gibosa minguante';
  if (e < 276) return 'Quarto minguante';
  return 'Minguante';
}

// Estado da Lua em um instante (ms UTC).
export function moonState(ms) {
  const p = position(toJd(ms));
  return {
    elong: p.elong,
    illum: (1 - Math.cos(rad(p.elong))) / 2,
    age: p.elong / 360 * SYNODIC_DAYS,
    waxing: p.elong < 180,
    stage: stageOf(p.elong),
    moonLon: p.moonLon, sunLon: p.sunLon
  };
}

// Procura instantes em que `fn` (graus, crescente) cruza cada alvo. `step` em dias, menor que 1/4 de volta.
function crossings(fn, jd0, jd1, targets, step, want) {
  const out = [];
  let t = jd0, prev = fn(t);
  while (t < jd1 && (want === undefined || out.length < want)) {
    const t2 = t + step, cur = fn(t2);
    for (const T of targets) {
      const a = wrap(prev - T), b = wrap(cur - T);
      if (a < 0 && b >= 0 && b - a < 90) {
        let lo = t, hi = t2;
        for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (wrap(fn(m) - T) < 0) lo = m; else hi = m; }
        out.push({ jd: (lo + hi) / 2, target: T });
      }
    }
    prev = cur; t = t2;
  }
  return out.sort((x, y) => x.jd - y.jd);
}

// Próximas fases principais da Lua (nova, quarto crescente, cheia, quarto minguante).
export function nextPhases(ms, count = 8) {
  const jd0 = toJd(ms);
  return crossings(jd => position(jd).elong, jd0, jd0 + count * 8 + 10, [0, 90, 180, 270], 0.5)
    .slice(0, count).map(c => ({ type: 'phase', name: PHASE_NAMES[c.target / 90], target: c.target, ms: toMs(c.jd) }));
}

// Próximos equinócios e solstícios. Os nomes das estações dependem do hemisfério.
export function nextSeasons(ms, count = 4, lat = 0) {
  const jd0 = toJd(ms), south = lat < 0;
  const names = {
    0: ['Equinócio de março', south ? 'início do outono' : 'início da primavera'],
    90: ['Solstício de junho', south ? 'início do inverno' : 'início do verão'],
    180: ['Equinócio de setembro', south ? 'início da primavera' : 'início do outono'],
    270: ['Solstício de dezembro', south ? 'início do verão' : 'início do inverno']
  };
  return crossings(jd => position(jd).sunLon, jd0, jd0 + 370 * Math.ceil(count / 4) + 5, [0, 90, 180, 270], 2)
    .slice(0, count).map(c => ({ type: 'season', name: names[c.target][0], season: names[c.target][1], target: c.target, ms: toMs(c.jd) }));
}

// Limites (em graus de latitude eclíptica da Lua no instante da lua nova/cheia) para haver eclipse.
// Classificação aproximada: perto de 1° dois tipos se confundem e são marcados como "incerto".
export function classifyEclipse(kind, absLat) {
  if (kind === 'solar') return absLat >= 1.55 ? null : absLat < 0.93 ? 'central' : absLat < 1.06 ? 'incerto' : 'parcial';
  return absLat >= 1.55 ? null : absLat < 0.38 ? 'total' : absLat < 0.9 ? 'parcial' : absLat < 1.1 ? 'incerto' : 'penumbral';
}

// Próximos eclipses solares e lunares (luas novas/cheias com a Lua perto do plano da órbita da Terra).
export function nextEclipses(ms, count = 6) {
  const jd0 = toJd(ms), limit = jd0 + 365.25 * 15, out = [];
  let from = jd0;
  while (out.length < count && from < limit) {
    const to = Math.min(from + 120, limit);
    for (const c of crossings(jd => position(jd).elong, from, to, [0, 180], 0.5)) {
      const kind = c.target === 0 ? 'solar' : 'lunar', lat = Math.abs(position(c.jd).moonLat), q = classifyEclipse(kind, lat);
      if (q) out.push({ type: 'eclipse', kind, q, absLat: lat, ms: toMs(c.jd), sarosNextMs: toMs(c.jd + SAROS_DAYS) });
    }
    from = to;
  }
  return out.slice(0, count);
}

// Altura (graus) do centro do Sol ou da Lua acima do horizonte, sem refração nem paralaxe (erro até ~1°).
export function altitude(body, ms, lat, lon) {
  const jd = toJd(ms), p = position(jd), T = (jd - J2000) / 36525;
  const lam = rad(body === 'sun' ? p.sunLon : p.moonLon), beta = body === 'sun' ? 0 : rad(p.moonLat);
  const eps = rad(23.439291 - 0.0130042 * T);
  const x = Math.cos(beta) * Math.cos(lam);
  const y = Math.cos(beta) * Math.sin(lam) * Math.cos(eps) - Math.sin(beta) * Math.sin(eps);
  const z = Math.cos(beta) * Math.sin(lam) * Math.sin(eps) + Math.sin(beta) * Math.cos(eps);
  const ra = Math.atan2(y, x), dec = Math.asin(z);
  const gmst = norm(280.46061837 + 360.98564736629 * (jd - J2000));
  const H = rad(norm(gmst + lon) - deg(ra));
  const phi = rad(lat);
  return deg(Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)));
}
export const horizon = alt => alt > 1 ? 'acima' : alt < -1 ? 'abaixo' : 'limite';

// Pacote completo para a interface e para a explicação. `point` = {lat, lon, label}.
export function skyOutlook(nowMs, point) {
  const lat = point?.lat, lon = point?.lon, hasPoint = Number.isFinite(lat) && Number.isFinite(lon);
  const eclipses = nextEclipses(nowMs - 3 * 3600e3, 6).map(e => {
    if (!hasPoint) return e;
    const body = e.kind === 'solar' ? 'sun' : 'moon', alt = altitude(body, e.ms, lat, lon);
    return { ...e, body, alt, horizon: horizon(alt) };
  });
  return {
    collectedAt: new Date(nowMs).toISOString(),
    point: hasPoint ? { lat, lon, label: point.label } : null,
    moon: moonState(nowMs),
    phases: nextPhases(nowMs, 8),
    eclipses,
    seasons: nextSeasons(nowMs, 4, hasPoint ? lat : 0)
  };
}
