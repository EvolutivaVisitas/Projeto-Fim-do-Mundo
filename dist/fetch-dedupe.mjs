// Junta pedidos GET idênticos feitos quase ao mesmo tempo. No carregamento, "Isso é alarmante?", "Estimativa futura" e
// "Tempo e satélite" pediam a mesma previsão (e os avisos oficiais eram pedidos duas vezes). Aqui o primeiro pedido é
// reaproveitado por 15 s; depois disso, "Atualizar agora" volta a consultar a fonte de verdade. Só vale para chamadas
// simples: sem opções, ou só com `signal` (o limite de tempo que os coletores usam). HEAD, POST e qualquer outra
// opção passam direto. Nada é guardado em disco e erros nunca ficam em cache.
const WINDOW_MS = 15000, calls = new Map(), real = window.fetch.bind(window);
const simple = init => init === undefined || (init !== null && typeof init === 'object' && Object.keys(init).every(k => k === 'signal'));
window.fetch = function (input, init) {
  if (!simple(init) || typeof input !== 'string') return real(input, init);
  const now = Date.now(), hit = calls.get(input);
  if (hit && now - hit.at < WINDOW_MS) return hit.promise.then(r => r.clone());
  const promise = real(input, init);
  calls.set(input, { at: now, promise });
  promise.catch(() => { if (calls.get(input)?.promise === promise) calls.delete(input); });
  if (calls.size > 200) for (const [k, v] of calls) if (now - v.at >= WINDOW_MS) calls.delete(k);
  return promise.then(r => r.clone());
};
