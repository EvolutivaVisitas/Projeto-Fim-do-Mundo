// Lista curada de lugares do panorama global (capitais brasileiras + cidades de todos os continentes).
// Formato: 'Nome|País|Continente|lat|lon'. Não é uma grade regular: regiões sem cidade aqui não aparecem no panorama.
const RAW=`Rio Branco|Brasil|América do Sul|-9.97|-67.81
Maceió|Brasil|América do Sul|-9.67|-35.74
Macapá|Brasil|América do Sul|0.03|-51.07
Manaus|Brasil|América do Sul|-3.12|-60.02
Salvador|Brasil|América do Sul|-12.97|-38.51
Fortaleza|Brasil|América do Sul|-3.73|-38.53
Brasília|Brasil|América do Sul|-15.78|-47.93
Vitória|Brasil|América do Sul|-20.32|-40.34
Goiânia|Brasil|América do Sul|-16.68|-49.25
São Luís|Brasil|América do Sul|-2.53|-44.30
Cuiabá|Brasil|América do Sul|-15.60|-56.10
Campo Grande|Brasil|América do Sul|-20.47|-54.62
Belo Horizonte|Brasil|América do Sul|-19.92|-43.94
Belém|Brasil|América do Sul|-1.46|-48.50
João Pessoa|Brasil|América do Sul|-7.12|-34.86
Curitiba|Brasil|América do Sul|-25.43|-49.27
Recife|Brasil|América do Sul|-8.05|-34.88
Teresina|Brasil|América do Sul|-5.09|-42.80
Rio de Janeiro|Brasil|América do Sul|-22.91|-43.17
Natal|Brasil|América do Sul|-5.79|-35.21
Porto Alegre|Brasil|América do Sul|-30.03|-51.23
Porto Velho|Brasil|América do Sul|-8.76|-63.90
Boa Vista|Brasil|América do Sul|2.82|-60.67
Florianópolis|Brasil|América do Sul|-27.60|-48.55
São Paulo|Brasil|América do Sul|-23.55|-46.63
Aracaju|Brasil|América do Sul|-10.91|-37.07
Palmas|Brasil|América do Sul|-10.18|-48.33
Buenos Aires|Argentina|América do Sul|-34.60|-58.38
Córdoba|Argentina|América do Sul|-31.42|-64.18
Santiago|Chile|América do Sul|-33.45|-70.67
Punta Arenas|Chile|América do Sul|-53.16|-70.91
Ushuaia|Argentina|América do Sul|-54.80|-68.30
Lima|Peru|América do Sul|-12.05|-77.04
Bogotá|Colômbia|América do Sul|4.71|-74.07
Medellín|Colômbia|América do Sul|6.25|-75.56
Caracas|Venezuela|América do Sul|10.48|-66.90
Quito|Equador|América do Sul|-0.18|-78.47
La Paz|Bolívia|América do Sul|-16.50|-68.15
Assunção|Paraguai|América do Sul|-25.26|-57.58
Montevidéu|Uruguai|América do Sul|-34.90|-56.16
Georgetown|Guiana|América do Sul|6.80|-58.16
Nova York|Estados Unidos|América do Norte|40.71|-74.01
Los Angeles|Estados Unidos|América do Norte|34.05|-118.24
Chicago|Estados Unidos|América do Norte|41.88|-87.63
Houston|Estados Unidos|América do Norte|29.76|-95.37
Miami|Estados Unidos|América do Norte|25.76|-80.19
Seattle|Estados Unidos|América do Norte|47.61|-122.33
Denver|Estados Unidos|América do Norte|39.74|-104.99
Anchorage|Estados Unidos|América do Norte|61.22|-149.90
Honolulu|Estados Unidos|América do Norte|21.31|-157.86
Toronto|Canadá|América do Norte|43.65|-79.38
Vancouver|Canadá|América do Norte|49.28|-123.12
Montreal|Canadá|América do Norte|45.50|-73.57
Cidade do México|México|América do Norte|19.43|-99.13
Monterrey|México|América do Norte|25.69|-100.32
Havana|Cuba|América do Norte|23.11|-82.37
Cidade do Panamá|Panamá|América do Norte|8.98|-79.52
Cidade da Guatemala|Guatemala|América do Norte|14.63|-90.51
San José|Costa Rica|América do Norte|9.93|-84.08
Kingston|Jamaica|América do Norte|18.00|-76.79
Santo Domingo|República Dominicana|América do Norte|18.49|-69.93
Nuuk|Groenlândia|América do Norte|64.18|-51.72
Londres|Reino Unido|Europa|51.51|-0.13
Paris|França|Europa|48.86|2.35
Berlim|Alemanha|Europa|52.52|13.40
Madri|Espanha|Europa|40.42|-3.70
Lisboa|Portugal|Europa|38.72|-9.14
Roma|Itália|Europa|41.90|12.50
Atenas|Grécia|Europa|37.98|23.73
Moscou|Rússia|Europa|55.76|37.62
São Petersburgo|Rússia|Europa|59.93|30.34
Istambul|Turquia|Europa|41.01|28.98
Estocolmo|Suécia|Europa|59.33|18.07
Oslo|Noruega|Europa|59.91|10.75
Helsinque|Finlândia|Europa|60.17|24.94
Varsóvia|Polônia|Europa|52.23|21.01
Kiev|Ucrânia|Europa|50.45|30.52
Viena|Áustria|Europa|48.21|16.37
Dublin|Irlanda|Europa|53.35|-6.26
Amsterdã|Países Baixos|Europa|52.37|4.90
Zurique|Suíça|Europa|47.38|8.54
Bucareste|Romênia|Europa|44.43|26.10
Reykjavik|Islândia|Europa|64.15|-21.94
Longyearbyen|Noruega (Svalbard)|Europa|78.22|15.63
Cairo|Egito|África|30.04|31.24
Lagos|Nigéria|África|6.52|3.38
Nairóbi|Quênia|África|-1.29|36.82
Joanesburgo|África do Sul|África|-26.20|28.05
Cidade do Cabo|África do Sul|África|-33.92|18.42
Adis Abeba|Etiópia|África|9.03|38.74
Kinshasa|RD Congo|África|-4.44|15.27
Luanda|Angola|África|-8.84|13.23
Casablanca|Marrocos|África|33.57|-7.59
Argel|Argélia|África|36.75|3.06
Acra|Gana|África|5.60|-0.19
Dacar|Senegal|África|14.72|-17.47
Dar es Salaam|Tanzânia|África|-6.79|39.21
Cartum|Sudão|África|15.50|32.56
Maputo|Moçambique|África|-25.97|32.57
Túnis|Tunísia|África|36.81|10.18
Windhoek|Namíbia|África|-22.56|17.08
Antananarivo|Madagascar|África|-18.88|47.51
Tamanrasset|Argélia|África|22.79|5.53
Abidjan|Costa do Marfim|África|5.36|-4.01
Tóquio|Japão|Ásia|35.68|139.69
Pequim|China|Ásia|39.90|116.41
Xangai|China|Ásia|31.23|121.47
Hong Kong|China|Ásia|22.32|114.17
Seul|Coreia do Sul|Ásia|37.57|126.98
Mumbai|Índia|Ásia|19.08|72.88
Nova Délhi|Índia|Ásia|28.61|77.21
Calcutá|Índia|Ásia|22.57|88.36
Bangalore|Índia|Ásia|12.97|77.59
Daca|Bangladesh|Ásia|23.81|90.41
Carachi|Paquistão|Ásia|24.86|67.01
Cabul|Afeganistão|Ásia|34.53|69.17
Teerã|Irã|Ásia|35.69|51.39
Bagdá|Iraque|Ásia|33.31|44.37
Riad|Arábia Saudita|Ásia|24.71|46.68
Dubai|Emirados Árabes Unidos|Ásia|25.20|55.27
Jerusalém|Israel|Ásia|31.77|35.22
Bangkok|Tailândia|Ásia|13.76|100.50
Jacarta|Indonésia|Ásia|-6.21|106.85
Singapura|Singapura|Ásia|1.35|103.82
Manila|Filipinas|Ásia|14.60|120.98
Hanói|Vietnã|Ásia|21.03|105.85
Ho Chi Minh|Vietnã|Ásia|10.82|106.63
Kuala Lumpur|Malásia|Ásia|3.14|101.69
Colombo|Sri Lanka|Ásia|6.93|79.86
Catmandu|Nepal|Ásia|27.72|85.32
Ulan Bator|Mongólia|Ásia|47.89|106.91
Almaty|Cazaquistão|Ásia|43.24|76.89
Tashkent|Uzbequistão|Ásia|41.30|69.24
Novosibirsk|Rússia|Ásia|55.03|82.92
Yakutsk|Rússia|Ásia|62.04|129.74
Vladivostok|Rússia|Ásia|43.12|131.89
Taipé|Taiwan|Ásia|25.03|121.57
Lhasa|China|Ásia|29.65|91.12
Sydney|Austrália|Oceania|-33.87|151.21
Melbourne|Austrália|Oceania|-37.81|144.96
Brisbane|Austrália|Oceania|-27.47|153.03
Perth|Austrália|Oceania|-31.95|115.86
Darwin|Austrália|Oceania|-12.46|130.84
Alice Springs|Austrália|Oceania|-23.70|133.88
Auckland|Nova Zelândia|Oceania|-36.85|174.76
Wellington|Nova Zelândia|Oceania|-41.29|174.78
Port Moresby|Papua-Nova Guiné|Oceania|-9.44|147.18
Suva|Fiji|Oceania|-18.14|178.44
Papeete|Polinésia Francesa|Oceania|-17.54|-149.57
McMurdo|Antártida|Antártida|-77.85|166.67`;
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const PLACES=RAW.split('\n').map(l=>{const [name,country,continent,lat,lon]=l.split('|');return {id:slug(name+'-'+country),name,country,continent,lat:Number(lat),lon:Number(lon)};});
export const CONTINENTS=[...new Set(PLACES.map(p=>p.continent))];
