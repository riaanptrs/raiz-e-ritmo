# Dados, cálculos e interpretação

Atualizado em 26 de novembro de 2026. Versão do método: `raiz-e-ritmo-astronomy-and-partial-tradition-v1`.

O Raiz & Ritmo apresenta astronomia de 2027, explicações em português e duas recomendações tradicionais identificadas pela origem. **A classificação completa em períodos de raiz, folha, flor e fruto permanece indisponível.** O cálculo correto de um evento celeste e a demonstração de benefício agrícola são verificações diferentes.

Os resultados numéricos, as divergências encontradas e as instruções de reprodução estão em [Validação de 2027](VALIDATION_2027.md).

## Origem das orientações para a horta

O *Agriculture Course* de 1924 é a base da leitura biodinâmica do guia. A edição de George Adams (Rudolf Steiner Press, 2012, páginas do PDF consultado) fundamenta a discussão de chuva, Lua cheia e semeadura (p. 26), da propriedade como organismo e seu entorno (pp. 29 e 129–131), da escala de observação (p. 80) e da aplicação do 500 antes de semear (p. 82). Essas passagens não fornecem um calendário anual com tarefas para cada espécie.

O módulo astronômico informa datas locais de eventos. As duas janelas tradicionais vêm do Stella Natura. A indicação de três dias antes da Lua cheia é de Charles Kovacs e aparece como leitura de uma fonte posterior. As taxas métricas dos preparados vêm do Apêndice 8 da Demeter de 2026. As atividades para vasos e canteiros são adaptações de observação inspiradas em Kovacs. O guia atribui ao Stella Natura a distinção entre colheita fresca e para guardar e o contexto de transplante de Maria Thun, sem calcular a janela editorial.

## Dezembro de 2026

Dezembro tem cobertura parcial. As cinco fases principais de dezembro UTC e o solstício usam os minutos publicados por Fred Espenak no AstroPixels, conferidos contra o Astronomy Engine (diferença máxima de 45 segundos). O equinócio de setembro dá o contexto de estação antes do solstício. Os instantes publicados ficam em [december-2026.ts](../src/data/december-2026.ts). As fontes são as tabelas de [fases](https://www.astropixels.com/ephemeris/phasescat/phases2001.html) e [estações](https://www.astropixels.com/ephemeris/soleq2001.html). Os demais dados lunares e as janelas tradicionais seguem restritos a 2027.

## 1. De onde vêm os horários

| Informação apresentada | Origem usada em 2027 | Registro no projeto |
| --- | --- | --- |
| 49 fases principais | Tabela do US Naval Observatory, preservada com precisão de minuto | [moon-phases-2027.json](../data/astronomy/moon-phases-2027.json) |
| 26 perigeus e apogeus no ano UTC e um apogeu adicional para a borda local | Raízes calculadas a partir de dados NASA/JPL Horizons DE441; conferência com novas amostras da mesma efeméride | [lunar-apsides-2027.json](../data/astronomy/lunar-apsides-2027.json) |
| Nodos, mudanças de direção da declinação, posições e regiões IAU | Astronomy Engine 2.1.19, comparado com referências JPL | [astronomy.ts](../src/lib/astronomy.ts) |
| Equinócios e solstícios | Astronomy Engine, comparado com a tabela USNO | Referência em [usno-seasons-2027.json](../tests/fixtures/usno-seasons-2027.json) |
| Intervalos tradicionais em torno de nodos e perigeus | Duas regras públicas da edição 2024 de Stella Natura | [tradition.ts](../src/lib/tradition.ts) |

As fontes primárias são as tabelas [USNO de fases](https://aa.usno.navy.mil/calculated/moon/phases?year=2027) e [estações](https://aa.usno.navy.mil/calculated/seasons?dst=false&submit=Get+Data&tz=0.00&tz_label=false&tz_sign=-1&year=2027), o [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) e a [documentação do Astronomy Engine](https://github.com/cosinekitty/astronomy). Cada conjunto preserva origem, método e precisão. Segundos em um resultado interpolado servem à reprodução do cálculo; não representam, por si só, exatidão física de um segundo.

O aplicativo reúne os dados em `src/data/calendar-2027.json`, com margem temporal para datas locais, intervalos e a próxima fase. O apogeu usado na borda de 2028 recebeu verificação própria. Essa margem não constitui um calendário completo de 2026 ou 2028.

## 2. O que cada cálculo significa

Todos os eventos abaixo usam uma referência **geocêntrica**, situada no centro da Terra. O horizonte, o relevo e a posição de uma propriedade não entram nesse cálculo.

| Fenômeno | Definição operacional |
| --- | --- |
| Fase principal | A diferença de longitude eclíptica Lua–Sol alcança 0°, 90°, 180° ou 270°: nova, quarto crescente, cheia ou quarto minguante. |
| Nodo lunar | A latitude eclíptica da Lua cruza zero. A passagem sul→norte é ascendente; norte→sul, descendente. |
| Perigeu e apogeu | A taxa de mudança da distância, `dr/dt`, cruza zero. Aproximação seguida de afastamento indica perigeu; a inversão oposta indica apogeu. O conjunto JPL usa a distância aparente e sua taxa, incluindo a correção de tempo de propagação da luz. |
| Mudança da declinação | A derivada da declinação equatorial, `dδ/dt`, cruza zero: a Lua deixa de avançar ao norte ou ao sul. Isso não é um nodo nem uma fase. |
| Região de constelação | A posição equatorial da Lua é classificada em uma região bidimensional oficial da IAU. Não é uma divisão automática da longitude em doze setores. |
| Estação astronômica | Equinócios e solstícios delimitam as estações astronômicas; seus nomes sazonais dependem do hemisfério. |

Na implementação, `GeoMoon` fornece um vetor equatorial J2000. A transformação para equador/equinócio da data permite calcular a declinação; sua inclinação é estimada com avaliações cinco minutos antes e depois. Mudanças de sinal são localizadas e refinadas numericamente. A identificação IAU usa as coordenadas J2000 esperadas pela biblioteca. As passagens entre regiões são procuradas em passos de dez minutos e refinadas quando há mudança de identificação.

O JPL fornece coordenadas aparentes da data, enquanto sua identificação de constelação usa a posição astrométrica. A biblioteca e a referência aplicam correções diferentes. A auditoria registra os referenciais e tolerâncias; coordenadas geométricas, aparentes e astrométricas não são intercambiáveis. Os parâmetros constam da [referência JPL](../tests/fixtures/jpl-2027-reference.json).

## 3. Fusos, hemisférios e clima

Os instantes são armazenados em UTC. O fuso selecionado determina a hora e a data civil mostradas, usando identificadores IANA como `America/Sao_Paulo`, `America/Manaus` ou `Europe/Lisbon`. O padrão é `America/Sao_Paulo`; o aplicativo não presume que todo o Brasil tenha o mesmo horário. Por exemplo, a fase de 19 de junho de 2027 às 00:44 UTC aparece em São Paulo em **18 de junho às 21:44**.

Hemisfério e fuso são escolhas independentes. A fase, a constelação geocêntrica, o perigeu e o nome do nodo não mudam quando se troca de hemisfério. A associação tradicional do movimento da declinação é:

| Movimento calculado | Convenção do Norte | Convenção do Sul | Opção equatorial |
| --- | --- | --- | --- |
| Ao norte | Ascendente | Descendente | Mostrar “em direção ao norte” |
| Ao sul | Descendente | Ascendente | Mostrar “em direção ao sul” |

A [Biodynamic Association britânica](https://www.biodynamic.org.uk/wp-content/uploads/2023/09/Guidelines-5-Sowing-and-Planting-Calendar.pdf) descreve a inversão entre hemisférios. O aplicativo identifica essa convenção sem afirmar que reproduz as margens de transplante de uma editora.

A altura real no céu depende da latitude. Da [equação de altitude do USNO](https://aa.usno.navy.mil/faq/alt_az), no trânsito superior e desprezando paralaxe/refração, resulta `altura = 90° − |latitude − declinação|`. Assim, nos trópicos, a passagem da Lua pela latitude do observador pode alterar a tendência de altura antes de um extremo de declinação. A opção equatorial evita atribuir uma única subida ou descida local a todo o ciclo.

Inverter os nomes das estações também não produz um calendário de cultivo local. Chuvas, seca, temperatura, altitude, espécie e estágio da cultura continuam necessários para decidir uma atividade. A faixa equatorial recebe orientação para observar o regime local de chuva e seca.

## 4. O perfil tradicional realmente implementado

O perfil `stella-natura-lunar-cautions-partial-v1` registra somente duas indicações para semeadura, descritas por Sherry Wildfeuer em [Using the Stella Natura 2024](https://stellanatura.com/use.html):

- Nodo lunar: intervalo de duas horas antes até duas horas depois.
- Perigeu: intervalo de doze horas antes até doze horas depois.

São durações de tempo decorrido, centradas no evento calculado e arredondado ao segundo. Os intervalos usam `[início, fim)`: incluem o início e excluem o fim. A divisão por dias acontece depois da conversão para o fuso escolhido. O arredondamento horário dos quadros da editora não é reproduzido.

Ficam fora deste perfil: transições de setores, nodos de Mercúrio/Vênus, eclipses, aspectos planetários, correções de apogeu e margens de transplante da editora. A ausência de um alerta significa apenas que **essas duas regras** não estão ativas. Não indica aprovação por um calendário completo. Os alertas expressam uma tradição atribuída; não afirmam dano comprovado durante esses intervalos nem benefício garantido por evitá-los.

## 5. Por que ainda não há dias de raiz, folha, flor ou fruto

A [IAU define regiões do céu](https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx). O [MABD declara que seus limites diferem dos limites astronômicos convencionais](https://www.bio-dynamie.org/actualites/foire-aux-questions/). Também há correções planetárias nos calendários publicados. Classificar a Lua numa região IAU ou num signo de 30° não estabelece equivalência com Thun, MABD ou um calendário brasileiro.

No Brasil, a [Assesoar publicou sua edição de 2027 com dados de Mário Barbarioli](https://assesoar.org.br/assesoar-divulga-calendario-biodinamico-2027/). A introdução do calendário descreve uma interpretação própria desde 2016, que troca Libra por Escorpião e atribui a Serpentário parte do setor anteriormente chamado Escorpião. O material consultado não fornece uma tabela completa de limites numéricos, referencial e regras de transição capaz de reproduzir todos os horários. Essas escolhas não foram importadas nem tratadas como padrão universal. A [comparação de métodos da associação britânica](https://www.biodynamic.org.uk/wp-content/uploads/QAPlantingCal.pdf) também distingue calendários de setores iguais e desiguais.

Para acrescentar uma classificação completa, ainda são necessários limites numéricos com época e referencial, regras e duração das correções, precedência entre condições simultâneas, significado agrícola, tratamento dos hemisférios e comparação com exemplos da edição correspondente. Os períodos desconhecidos permanecem indisponíveis; não são preenchidos por fases, cores de outro ano ou concordância entre sites.

## 6. Evidência, correções e distribuição

A investigação [de Jovchelevich na UNESP, de 2007](https://acervodigital.unesp.br/handle/11449/93462) estudou cenouras em dois períodos e relatou resultados significativos em alguns contrastes, mas não no ritmo ascendente/descendente para os aspectos investigados. Esse escopo não sustenta uma promessa geral de eficácia nem prova ausência de efeito em toda circunstância. Nossa auditoria verifica cálculos; não é um ensaio agrícola.

Correções devem preservar o resultado anterior, registrar a justificativa e atualizar a versão, as fontes e a validação. Respeitam-se as licenças das dependências e dos materiais utilizados. O repositório contém código, explicações originais e referências numéricas documentadas; não incorpora livros privados, ilustrações de editoras ou seus calendários anuais completos. Disponibilidade pública de um PDF não é um registro de autorização para redistribuir seu conteúdo integral.
