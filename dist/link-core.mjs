// Link compartilhável do ponto escolhido no mapa principal: ?modo=magnetic|gravity|climate&raio=global|25|50|100|200&lat=..&lon=..
// Só leitura e montagem de texto; valores inválidos são ignorados (nunca viram ponto inventado) e nada é enviado a servidor.
export const MODES = ['magnetic', 'gravity', 'climate'];
export const RADII = ['global', '25', '50', '100', '200'];
const num = s => (s === null || String(s).trim() === '') ? NaN : Number(s);

// Lê a query string e devolve só os campos válidos.
export function parseLink(search) {
  const q = new URLSearchParams(search), out = {};
  const mode = q.get('modo'), radius = q.get('raio'), lat = num(q.get('lat')), lon = num(q.get('lon'));
  if (MODES.includes(mode)) out.mode = mode;
  if (RADII.includes(radius)) out.radius = radius;
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180) { out.lat = lat; out.lon = lon; }
  return out;
}

// Monta o link a partir do endereço atual. Na abrangência global o ponto não importa e não entra no link.
export function buildLink(href, { mode, radius, lat, lon }, hash = '#map') {
  const u = new URL(href);
  u.search = ''; u.hash = '';
  if (MODES.includes(mode)) u.searchParams.set('modo', mode);
  if (RADII.includes(radius)) u.searchParams.set('raio', radius);
  if (radius !== 'global' && Number.isFinite(lat) && Number.isFinite(lon)) {
    u.searchParams.set('lat', lat.toFixed(5));
    u.searchParams.set('lon', lon.toFixed(5));
  }
  return u.toString() + hash;
}
