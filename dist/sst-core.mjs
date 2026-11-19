// Anomalia da temperatura do mar (NASA GIBS · GHRSST MUR L4): escala oficial de cores, para ler o valor de um ponto do mapa e para a legenda.
// Fonte da tabela: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature_Anomalies.xml (62 faixas de 0,1 °C entre −3 e +3 °C, abertas nas pontas).
// Importante: o valor lido é a FAIXA DE COR do produto diário da NASA naquele pixel, não uma medição no local. Sem cor válida (terra, gelo, sem dado), nada é estimado.
// [mínimo, máximo (exclusivo), R, G, B]
export const SST_BINS=[
  [-Infinity,-3.0,107,0,219], [-3.0,-2.9,116,0,214], [-2.9,-2.8,127,0,211], [-2.8,-2.7,137,0,207],
  [-2.7,-2.6,150,0,202], [-2.6,-2.5,145,9,204], [-2.5,-2.4,127,26,209], [-2.4,-2.3,96,49,220],
  [-2.3,-2.2,65,75,230], [-2.2,-2.1,34,100,241], [-2.1,-2.0,8,124,251], [-2.0,-1.9,0,148,255],
  [-1.9,-1.8,0,174,255], [-1.8,-1.7,0,202,255], [-1.7,-1.6,0,227,255], [-1.6,-1.5,3,248,250],
  [-1.5,-1.4,24,252,229], [-1.4,-1.3,47,255,206], [-1.3,-1.2,71,255,182], [-1.2,-1.1,96,255,158],
  [-1.1,-1.0,118,255,140], [-1.0,-0.9,136,255,132], [-0.9,-0.8,151,255,139], [-0.8,-0.7,164,255,145],
  [-0.7,-0.6,177,255,152], [-0.6,-0.5,189,254,158], [-0.5,-0.4,191,244,163], [-0.4,-0.3,191,232,169],
  [-0.3,-0.2,191,219,176], [-0.2,-0.1,191,208,182], [-0.1,0.0,194,202,184], [0.0,0.1,202,202,183],
  [0.1,0.2,213,213,172], [0.2,0.3,226,226,162], [0.3,0.4,237,237,152], [0.4,0.5,249,248,141],
  [0.5,0.6,255,246,121], [0.6,0.7,255,234,94], [0.7,0.8,255,222,67], [0.8,0.9,255,208,37],
  [0.9,1.0,255,194,9], [1.0,1.1,255,182,1], [1.1,1.2,255,170,0], [1.2,1.3,255,157,0],
  [1.3,1.4,255,145,0], [1.4,1.5,255,130,0], [1.5,1.6,255,113,0], [1.6,1.7,255,89,0],
  [1.7,1.8,255,61,0], [1.8,1.9,255,33,0], [1.9,2.0,254,9,0], [2.0,2.1,249,1,19],
  [2.1,2.2,243,0,45], [2.2,2.3,236,0,74], [2.3,2.4,230,0,103], [2.4,2.5,222,0,125],
  [2.5,2.6,211,0,133], [2.6,2.7,191,0,104], [2.7,2.8,171,0,72], [2.8,2.9,154,0,44],
  [2.9,3.0,136,0,15], [3.0,Infinity,128,0,0]
];

const f1 = v => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(v);

// Faixa de cor correspondente a um pixel RGBA do tile da NASA. Transparente (terra, gelo sem dado) ou cor desconhecida: null.
// `exact: false` quando a cor só ficou parecida com uma faixa (tolerância pequena); cores mais distantes não são adivinhadas.
export function sstFromRgba(r, g, b, a = 255, tol = 18) {
  if (a < 200) return null;
  let best = null, bd = Infinity;
  for (const bin of SST_BINS) {
    const d = (bin[2] - r) ** 2 + (bin[3] - g) ** 2 + (bin[4] - b) ** 2;
    if (d < bd) { bd = d; best = bin; }
  }
  if (bd === 0) return { bin: best, exact: true };
  return Math.sqrt(bd) <= tol ? { bin: best, exact: false } : null;
}

// Texto em português para a faixa lida, sem inventar precisão além dos 0,1 °C do produto.
export function describeSst(bin) {
  if (!bin) return null;
  const [lo, hi] = bin;
  if (lo === -Infinity) return `${f1(hi)} °C ou menos (bem mais frio que o normal do produto)`;
  if (hi === Infinity) return `${f1(lo)} °C ou mais (bem mais quente que o normal do produto)`;
  const rel = hi <= -0.5 ? 'mais frio que a referência do produto' : lo >= 0.5 ? 'mais quente que a referência do produto' : 'perto da referência do produto';
  return `${f1(lo)} a ${f1(hi)} °C (${rel})`;
}

// Degradê da legenda com as cores reais da escala, de −3 a +3 °C.
export function gradientCss(step = 0.5) {
  const stops = [];
  for (let v = -3; v <= 3 + 1e-9; v += step) {
    const bin = SST_BINS.find(([lo, hi]) => v >= lo - 1e-9 && v < hi - 1e-9) ?? SST_BINS.at(-1);
    stops.push(`rgb(${bin[2]},${bin[3]},${bin[4]}) ${((v + 3) / 6 * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg,${stops.join(',')})`;
}

// Tile (256 px, GoogleMapsCompatible) e pixel dentro dele para uma coordenada. A longitude é reduzida a −180…180.
export function tileAt(lat, lon, z) {
  const n = 2 ** z, L = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
  const lw = ((lon + 180) % 360 + 360) % 360 - 180, fx = (lw + 180) / 360 * n, s = Math.sin(L * Math.PI / 180);
  const fy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  const x = Math.min(n - 1, Math.floor(fx)), y = Math.min(n - 1, Math.max(0, Math.floor(fy)));
  return { z, x, y, px: Math.min(255, Math.floor((fx - x) * 256)), py: Math.min(255, Math.floor((fy - y) * 256)) };
}
