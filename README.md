# MagneTerra

## Automação (GitHub Actions)

O workflow `.github/workflows/site.yml` deixa tudo automático no GitHub, sem o computador ligado:
- **A cada push** na `main`: roda os testes (monitor, tempo, explicações, clima, avisos, leitura geral, estimativas) e só então publica `dist` no GitHub Pages. Código quebrado não vai ao ar.
- **Todo dia, ~8h10 de Brasília:** coleta Kp, aurora, tempo/satélite, clima global e panorama de 150 lugares; commita os dados em `dist/reports` e `dist/climate`; republica o site.
- **A cada 4 horas, enquanto a climatologia não estiver completa:** retoma `build-climatology.mjs` (a API gratuita limita por hora/dia), commita e republica. Quando `climatology-status.mjs` indica 150/150 lugares com modelo, essas execuções extras se dispensam sozinhas.
- Falha de uma fonte não impede a publicação: o erro é registrado e o último dado válido é preservado. Os avisos oficiais, a previsão e as estimativas são calculados ao vivo no navegador de quem abre o site.
- Observação do GitHub: agendamentos de repositórios públicos podem ser pausados após 60 dias sem atividade; as coletas automáticas commitam dados, o que conta como atividade.

## Uso local (sem ChatGPT/Codex)

- **Abrir o site:** dê dois cliques em `start.bat` (ou `node serve.mjs`) e acesse http://127.0.0.1:4173/. Sem login; só funciona neste computador.
- **Atualizar os dados:** `daily.bat` (ou `node collect-daily.mjs`) coleta Kp/aurora, tempo/satélite e o panorama global. Há uma tarefa agendada diária que faz isso enquanto o app Claude estiver aberto.
- **Climatologia:** `node build-climatology.mjs` completa, aos poucos, a climatologia dos 150 lugares (limite diário da API gratuita; retoma de onde parou).
- A hospedagem antiga (Site privado do ChatGPT, `.openai/hosting.json`) foi preservada, mas não é mais necessária.

## Tempo e satélite (quase em tempo real)

A seção **Tempo e satélite** usa fontes dinâmicas, ao contrário das grades estáticas de magnetismo e gravidade:

- **Satélite (NASA GIBS):** GOES-East GeoColor e infravermelho (banda 13), precipitação IMERG de 30 min e anomalia diária da temperatura do mar (GHRSST MUR). O app sonda a GIBS e exibe o quadro mais recente realmente publicado, com a idade dele; o controle de tempo percorre os quadros anteriores. GOES tem atraso de dezenas de minutos, IMERG de várias horas (estimativa por satélite) e a anomalia do mar de ~1 dia.
- **Anomalia no ponto (Open-Meteo):** temperatura média das últimas 24 h e chuva acumulada em 7 dias (análise/previsão de curto prazo) comparadas à média ERA5 1991–2020 em ±7 dias da mesma data. Fontes e modelos diferentes: indicação aproximada, não registro climatológico oficial. Lacunas não são preenchidas.

O coletor diário (`collect-daily.mjs`) também grava em cada boletim o campo `weather`: anomalia de Goiânia no instante da coleta e a hora do quadro de satélite mais recente de cada camada (as imagens não são arquivadas). Boletins antigos não têm o campo e a falha dessa coleta não impede o boletim do Kp/aurora. A seção ao vivo consulta direto no navegador. `node test-weather.mjs` valida a lógica; `node --check dist/weather-ui.mjs` a sintaxe.

### Panorama global e busca de lugares

- **Busca:** qualquer lugar do mundo via geocodificação Open-Meteo; ao escolher, o app calcula a anomalia ao vivo e centraliza o mapa.
- **Panorama global:** tabela e marcadores coloridos de 150 lugares curados (`dist/places.mjs`: capitais brasileiras e cidades de todos os continentes), com filtros por continente, nome/país e ordenação (mais quente/frio, mais/menos chuva). **Não é uma grade regular**: regiões fora da lista não aparecem. Os dados vêm de `reports/weather-latest.json`, gravado por `collect-weather-global.mjs` (também chamado por `collect-daily.mjs`); a página mostra a hora da coleta e avisa se estiver antiga.
- **Climatologia pré-calculada:** `node build-climatology.mjs` gera `dist/climate/places-climatology.json` (ERA5 1991–2020, ±7 dias, 366 dias por lugar). Rode raramente; sem esse arquivo o panorama não calcula anomalias.

### Estimativa futura (passado + presente → futuro)

A seção **Estimativa futura** calcula, no próprio app e com métodos estatísticos simples e declarados:
- **Próximos dias e 3 meses (temperatura):** regressão de persistência. Em 30 anos de ERA5, mede-se quanto o desvio dos últimos 3 dias (ou 3 meses) em relação ao normal ainda aparece k dias (meses) depois; aplica-se isso ao desvio atual, com intervalo de 90%. Mostra até quantos dias o passado ajuda (depois, o melhor é o modelo meteorológico, desenhado junto no gráfico). Se a API de 30 anos estiver no limite, usa o modelo pré-calculado (gravado por `build-climatology.mjs` em `dist/climate/places-climatology.json`) do lugar da lista mais próximo (até 60 km); lugares ainda sem `model` precisam ser refeitos por esse script.
- **Terremotos:** frequência histórica (USGS, 10 anos; mundo e raio de 500 km do ponto) e probabilidade de ao menos um em 7 e 30 dias por Poisson. É taxa de base, **não** previsão de quando ou onde.
- **Temperatura global:** extrapolação linear da tendência desde 1970 (NASA GISTEMP) para 2030/2040/2050 com intervalo de ~90%; não é projeção climática.
Cada estimativa traz o intervalo e o limite do método; falta de dado nunca é preenchida. `node test-projection.mjs` valida (inclui recuperar a persistência de um processo AR(1) sintético).

### Leitura geral: “Isso é alarmante?”

No topo da página, o painel **Isso é alarmante?** calcula, para o ponto escolhido em “Tempo e satélite” (padrão: Goiânia), uma leitura em linguagem simples juntando: (1) a previsão dos próximos 7 dias de temperatura e chuva comparada ao normal ERA5 1991–2020, com a **raridade** do desvio (em cerca de 1 a cada N dias, por aproximação normal) e a tendência da semana; (2) a previsão de Kp da NOAA; (3) os avisos oficiais em vigor (USGS, NOAA, GDACS). Dá um nível (normal, atenção leve, atenção, alerta) e um veredito. Regras: previsões nunca passam de “vale acompanhar”; só avisos graves de agências levam ao nível mais alto; o contexto de longo prazo (clima global) aparece mas não entra na leitura geral; dado ausente é dito e nunca estimado. Se a API de 30 anos estiver no limite, usa a climatologia pré-calculada do lugar da lista mais próximo (até 60 km) e informa isso. `node test-outlook.mjs` valida. Não prevê terremotos nem erupções.

### Avisos oficiais e previsões

- **Avisos oficiais** (seção própria, consulta ao vivo no navegador): terremotos já ocorridos de M 4,5+ nas últimas 24 h (USGS), avisos e **previsão de Kp de 3 dias** (NOAA SWPC) e desastres laranja/vermelhos (GDACS, ONU/UE). O MagneTerra **só repassa** o que as agências publicam, com nível de atenção derivado da classificação delas (só conta o que vale agora). **Não prevê terremotos nem erupções e não emite alertas próprios.** Avisos do INMET (Brasil) não estão integrados (o servidor deles não aceitou consultas); o app aponta para alertas2.inmet.gov.br. `node test-alerts.mjs` valida.
- **Previsão dos próximos dias do lugar** (botão na seção Tempo e satélite): temperatura média diária prevista (até 15 dias) vs. normal ERA5 1991–2020 da mesma data, e chuva dos próximos 7 dias vs. normal. Dias além de 7 saem mais claros (menos confiáveis). O nível nunca passa de “vale acompanhar”: eventos severos são anunciados pelos serviços oficiais.

### Últimos 12 meses do lugar

O botão **Ver os últimos 12 meses do lugar** (seção Tempo e satélite) mostra, para o ponto escolhido, a anomalia mensal de temperatura e a chuva em % do normal dos últimos 12 meses completos, comparadas à média mensal ERA5 1991–2020 (mesma fonte, sem misturar modelos). Só roda sob demanda, porque cada consulta usa a cota gratuita da Open-Meteo. Meses sem dados completos aparecem como “s/d” e não são preenchidos. Há explicação em linguagem simples.

### Clima global (longo prazo)

O seletor **Tipo de anomalia** do painel lateral também tem a opção **Climáticas · °C**: mostra no mapa a anomalia diária da temperatura da superfície do mar (NASA GIBS, GHRSST MUR; só oceanos; ~1–2 dias de atraso; o app procura o dia mais recente realmente publicado). Neste modo não há ranking por ponto nem raio.

A seção **Clima global** mostra a anomalia da temperatura média da Terra desde 1880 (NASA GISS GISTEMP v4, terra + oceano, base 1951–1980): últimos 12 meses, ranking do último ano completo, tendência desde 1970 e gráfico anual, com explicação em linguagem simples. É clima de décadas, não o tempo do dia. `collect-climate.mjs` (chamado por `collect-daily.mjs`) baixa a série para `dist/climate/global-temperature.json`; em falha, o arquivo anterior é preservado. Meses ausentes ficam vazios. `node test-climate.mjs` valida.

### Explicação em linguagem simples

**Explicação combinada:** abaixo das estatísticas do mapa há três caixas (Magnéticas, Gravitacionais, Climáticas) e o botão **Explicar selecionadas**. Marque uma, duas ou as três: o texto junta o que foi escolhido, com seções separadas por tipo. Magnetismo e gravidade são apresentados como mapas estáticos de referência (valores extremos da grade global e, se houver análise regional feita no painel, o intervalo da região), sem nível de alerta; a parte climática usa a série de temperatura global da NASA e traz o nível de atenção. Se algum dado não carregar, o texto diz que está indisponível. Ao trocar o Tipo de anomalia, a caixa correspondente é marcada.

Os botões **Explicar em linguagem simples** (boletim diário, anomalia do ponto e panorama global) geram, no navegador e por regras fixas (`dist/explain.mjs`; sem IA externa), um texto para leigos: o que foi medido, se está normal, se afeta a pessoa e se há motivo de preocupação, num nível de 4 degraus (normal → atenção leve → atenção → alerta). Cada texto responde "é o fim do mundo?" e lembra que tempo de poucos dias não é clima. Quando faltam dados, diz isso em vez de estimar. Não é aviso oficial. `node test-explain.mjs` valida as regras.

## Gravidade

O seletor **Tipo de anomalia** alterna magnetismo (nT) e gravidade de ar livre (mGal), preservando o centro e o raio. Os resultados são recalculados ao alternar. O CSV identifica a fonte, a modalidade, as unidades e o espaçamento.

A camada gravitacional usa a grade **Scripps/IGPP v33.1**, via GMT `earth_faa_06m_p`: EGM2008 em terra e altimetria nos oceanos. Grade de 6′ (~11,1 km norte–sul), filtro gaussiano de 31,5 km, cobertura de 80°S a 80°N. Não equivale a Bouguer, não mede em tempo real e não resolve estruturas pequenas. A distribuição binária tem 13 MB, passo de 0,1 mGal e NoData explícito; é carregada somente ao selecionar gravidade e reutilizada na sessão. Não exige chave de API.

`dist/gravity/metadata.json` registra os atributos e o SHA-256 do arquivo científico original. `node download-gravity.mjs` baixa a fonte; `prepare-gravity.py` converte NetCDF usando netCDF4/numpy. `node test-gravity.mjs` verifica referências numéricas independentes, cobertura, distância, gradientes e a passagem pelo antimeridiano.

Fonte e metodologia: https://www.generic-mapping-tools.org/remote-datasets/earth-faa.html

Aplicativo estático em português para explorar a grade NOAA EMAG2 v3. Abra o site publicado ou execute `node serve.mjs` e acesse http://127.0.0.1:4173.

Mapa mundial com sobreposição NOAA; seleção por coordenadas, mapa ou localização; raios de 25, 50, 100 e 200 km; rankings positivos, negativos e gradientes; exportação CSV. A análise inicial de Goiânia é uma consulta salva, com data e cobertura exibidas. Novas consultas requerem internet e disponibilidade da NOAA.

Os rankings abrangem somente células retornadas pelo serviço. Ausências não são preenchidas com valores inventados. O gradiente usa diferenças centrais e exige quatro vizinhos válidos. A resolução é 2 minutos de arco, altitude de referência 4 km. Não há previsão temporal, inferência mineral ou índice de probabilidade.

`node prepare.mjs` atualiza a consulta de Goiânia e verifica distância, raio e rankings. `node --check dist/app.mjs` verifica sintaxe.

Fonte: https://www.ncei.noaa.gov/products/earth-magnetic-model-anomaly-grid-2
