# Validação dos cálculos de 2027

Auditoria realizada em 26 de novembro de 2026. Leia também [Dados, cálculos e interpretação](DATA_METHOD.md).

**O conjunto astronômico de produção passou nos critérios descritos aqui.** O relatório preserva uma falha da biblioteca em dados substituídos. A validação não reproduz integralmente calendários de editoras nem demonstra benefício agrícola; as duas regras tradicionais implementadas têm escopo próprio.

## 1. Referências e rastreabilidade

As fases de produção preservam os 49 horários, com precisão de minuto, da [tabela USNO](https://aa.usno.navy.mil/calculated/moon/phases?year=2027). Uma conferência anterior por interpolação de longitudes aparentes Lua–Sol do JPL encontrou diferença máxima de **39,48 segundos** em relação aos minutos publicados. Esse resultado está no [conjunto de fases](../data/astronomy/moon-phases-2027.json); não deve ser confundido com a comparação separada do Astronomy Engine abaixo.

A [referência JPL](../tests/fixtures/jpl-2027-reference.json) foi construída a partir de 9.025 amostras horárias de uma tabela Horizons DE441, de 25 de dezembro de 2026 a 5 de janeiro de 2028. O alvo é o centro da Lua (`301`), visto do centro da Terra (`500@399`). O registro inclui consulta original, data de obtenção, SHA-256 da resposta, versão da API, grandezas, referenciais e precisão impressa. Os equinócios e solstícios são comparados com a [tabela USNO de estações](https://aa.usno.navy.mil/calculated/seasons?dst=false&submit=Get+Data&tz=0.00&tz_label=false&tz_sign=-1&year=2027).

Uma interpolação cúbica encontra zeros de latitude eclíptica, zeros da velocidade radial e extremos da declinação. As posições de conferência são amostras diretas no dia 15 de cada mês, às 12h UTC. Os [detalhes da referência](../tests/fixtures/JPL_README.md) e o [manual Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) permitem interpretar corretamente os campos.

## 2. Resultado da comparação do Astronomy Engine

Versão auditada: **2.1.19**. Os limites são critérios de aceitação, não estimativas de incerteza. Também são verificadas sequência e quantidade. O [relatório numérico](../data/validation/astronomy-2027.json), esquema 2, aprova os dados selecionados para produção e preserva a falha abaixo em `excludedLibraryDiagnostics.lunarApsides`, com `selectedForProduction: false`.

| Família, no ano UTC de 2027 | Quantidade | Maior diferença absoluta | Limite | Resultado |
| --- | ---: | ---: | ---: | --- |
| Fases, contra USNO | 49 | 73 s | 90 s | Aceita para conferência; produção preserva USNO |
| Nodos lunares, contra JPL | 27 | 29 s | 180 s | Aceita |
| Mudanças de direção da declinação, contra JPL | 27 | 11 s | 180 s | Aceita |
| Equinócios/solstícios, contra USNO | 4 | 42 s | 120 s | Aceita |
| Perigeus/apogeus originais da biblioteca, contra JPL | 26 | 974 s | 900 s | Reprovada; substituída na produção de 2027 |

Nas doze amostras de coordenadas, as diferenças máximas foram **2,338997 segundos de arco** em declinação, **4,981629** em longitude eclíptica, **1,267793** em latitude eclíptica e **48,395708 km** em distância. Os critérios eram 60 segundos de arco e 100 km. As doze identificações de constelação coincidiram.

As **216 transições IAU** calculadas corresponderam aos 216 intervalos horários da referência, admitindo uma margem declarada de 60 segundos por diferenças de referencial. Isso verifica os intervalos que contêm as passagens, não seus minutos exatos. Uma excursão curta entre amostras com a mesma identificação pode escapar à tabela horária; portanto, o teste não prova resolução temporal de um minuto.

## 3. Divergência dos ápsides e solução adotada

Três apogeus da biblioteca excederam o limite de quinze minutos: 7 de janeiro (**974 s**), 19 de julho (**923 s**) e 15 de agosto (**915 s**). Por exemplo, em janeiro, a biblioteca encontrou 08:08:42 UTC e a referência JPL, 08:24:56 UTC. A reprovação permanece registrada; o limite não foi ampliado para aprovar esses resultados.

A produção usa [lunar-apsides-2027.json](../data/astronomy/lunar-apsides-2027.json): 26 eventos do ano UTC em `events` e um evento adicional em `boundary_events`. Os horários conservam a raiz da interpolação horária arredondada ao segundo; a interface apresenta minutos. O evento adicional é o apogeu de **1º de janeiro de 2028, 03:59:18 UTC**, ainda em 31 de dezembro de 2027 em fusos ocidentais. Verificar essa borda não valida o restante de 2028.

Foram consultadas **108 novas amostras JPL**: quatro para cada um dos 27 eventos, a **−120, −60, +60 e +120 segundos** da referência. O zero da velocidade radial foi ajustado novamente no intervalo que troca de sinal, com interpolação cúbica e linear. A diferença máxima dos 26 eventos centrais foi **0,776666 segundo**; a do evento de borda, **0,363269 segundo**, frente às referências arredondadas. Ambos passaram no limite de 60 segundos.

Essa conferência é independente da biblioteca do aplicativo, mas usa a **mesma efeméride física DE441**. Mede a estabilidade da amostragem/interpolação, não exatidão física subsegundo. A velocidade radial impressa tem resolução de `10⁻⁷ km/s`; sua quantização já afeta o último dígito temporal. Os resultados e as respostas preservadas estão em [jpl-apsis-refinement-2027.json](../tests/fixtures/jpl-apsis-refinement-2027.json), com as verificações adicionais de borda identificadas no conjunto de produção.

## 4. Comparação limitada com uma publicação de 2027

O trecho público de [Maria Thun Biodynamic Calendar 2027, Floris Books](https://www.florisbooks.co.uk/books/9781782509974), página impressa 16, fornece três referências úteis. Todos os horários abaixo são UTC:

| Evento | Referência JPL, aproximada ao minuto | Prévia impressa |
| --- | --- | --- |
| Extremo sul da declinação | 5 de janeiro, 20:39 | 5 de janeiro, 21h |
| Apogeu | 7 de janeiro, 08:25 | 7 de janeiro, 08h |
| Nodo ascendente | 10 de janeiro, 15:57 | 10 de janeiro, 16h |

Há concordância no arredondamento horário. São três verificações pontuais, sem validar toda a publicação. Nas páginas 16–17, as margens publicadas de transplante também diferem dos instantes brutos dos extremos. O aplicativo preserva essa distinção e não converte automaticamente um extremo em uma janela editorial de transplante.

As fontes são o [caminho público da página 16](https://www.florisbooks.co.uk/add/9781782509974/12.jpg) e o [da página 17](https://www.florisbooks.co.uk/add/9781782509974/13.jpg), expostos pelo visualizador da editora. Nenhuma dessas imagens ou grade anual é incorporada ao aplicativo.

## 5. Reproduzir e avaliar o resultado

A partir da raiz do repositório, com o Node indicado em `package.json`:

```sh
npm ci
npm run verify
```

`verify` executa `check:data`, `validate:astronomy`, testes e compilação. A primeira etapa compara os dados entregues com sua regeneração; a segunda registra a auditoria numérica. Após uma mudança deliberada de fontes ou método, `npm run generate` atualiza os dados antes da verificação. Aprovação de produção preserva a reprovação dos ápsides originais.

Para reconstruir a referência horária, use Python com NumPy/SciPy nas versões registradas no conjunto e uma resposta Horizons salva com seu arquivo de procedência:

```sh
python scripts/build-jpl-reference.py /caminho/lua-horaria.json tests/fixtures/jpl-2027-reference.json
python scripts/refine-apsides.py \
  --reference tests/fixtures/jpl-2027-reference.json \
  --boundary-reference tests/fixtures/jpl-apsis-boundary-reference.json \
  --raw tests/fixtures/apsis_refinement_raw_1.json tests/fixtures/apsis_refinement_raw_2.json tests/fixtures/apsis_refinement_raw_boundary.json \
  --output data/astronomy/lunar-apsides-2027.json \
  --report-output tests/fixtures/jpl-apsis-refinement-2027.json
```

O refinamento verifica os hashes e usa respostas preservadas, sem rede. A geração separada da referência de borda está no [guia dos conjuntos de teste](../tests/fixtures/JPL_README.md). Reproduzir um hash exige conservar a resposta original: novas consultas podem mudar metadados ou previsões, inclusive pela atualização de segundos intercalares. Revisões precisam de nova comparação.

Também devem ser verificados conversão através da meia-noite, horário de verão, meses e anos, fim exclusivo dos intervalos e independência entre fuso e hemisfério. A auditoria não calcula altura local, nascer/pôr, clima, visibilidade de eclipses, aspectos planetários ou classificações agrícolas completas. Uma nova família de dados exige sua própria origem, definição e verificação antes de ser apresentada como conferida.

## 6. Verificação do aplicativo

`npm run verify` passou: dados regenerados sem diferenças, auditoria astronômica aprovada, **24 testes em três arquivos** e compilação de produção concluída. Os testes incluem dias de 23/25 horas e mudanças de meia hora, conversão na virada do ano, interpretação por hemisfério, intervalos com fim exclusivo, preservação das fontes e funcionamento do worker gerado.

Na prévia de produção em Chrome, foram verificados visualmente os controles, a navegação pelo teclado, a inversão Norte/Sul, a opção equatorial e a mudança da Lua cheia de junho entre 18/06 em São Paulo e 19/06 em UTC. O navegador instalou o cache; uma atualização exibiu seu aviso e foi ativada pelo botão do aplicativo.

Um teste real com o servidor da prévia desligado encontrou uma falha inicial: o cabeçalho `Vary: Origin` impedia a correspondência de módulos JavaScript com o cache criado anteriormente. Um teste de regressão reproduziu a falha antes da correção. A correspondência agora ignora essa variação somente para arquivos estáticos do build, sem estender a exceção a respostas dinâmicas.

Após a correção, uma navegação para uma nova URL de consulta, com o servidor ainda desligado, carregou o aplicativo completo. Trocar o mês e o hemisfério e abrir os guias funcionou nessa condição. Isso verifica a recuperação do cache quando a origem fica indisponível; instalação em celulares reais, todos os navegadores e uso em modo avião ainda exigem revisão nos dispositivos pretendidos.
