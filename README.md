# MagneTerra

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
