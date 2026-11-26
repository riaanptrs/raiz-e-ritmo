# Raiz & Ritmo

**Calendário e guia de agricultura biodinâmica em português.**

Aplicativo web gratuito para observar os ritmos astronômicos, compreender interpretações da tradição biodinâmica e registrar perguntas para o próprio cultivo. Interface em PT-BR, sem conta, backend ou API paga.

## Estado da implementação

A primeira versão funcional inclui calendário, guias de observação e ajuda para instalação e uso offline. Usa **React, TypeScript e Vite**, com calendário de **dezembro de 2026 a dezembro de 2027**, explicações e estrutura de PWA. O destino previsto é GitHub Pages no caminho `/raiz-e-ritmo/`. Esta implementação **não publica o site automaticamente**.

O calendário separa astronomia, interpretação tradicional e evidência agrícola. Não promete efeitos sobre produtividade ou sabor. **A classificação completa de raiz, folha, flor e fruto permanece indisponível**: limites e ajustes de calendários editoriais ainda não foram reproduzidos por um método completo e verificável.

### O que funciona

- Calendário mensal, detalhes por dia e navegação por teclado; datas fora da cobertura têm uma indicação clara.
- Dezembro de 2026 tem cobertura parcial: fases principais e solstício, com horários publicados por Fred Espenak no AstroPixels. Os demais dados lunares e as janelas tradicionais estão disponíveis para 2027.
- 49 fases principais publicadas pelo USNO, preservadas com sua precisão original de minuto.
- Nós lunares, direção e extremos de declinação, regiões IAU, equinócios e solstícios calculados e conferidos contra referências externas.
- 26 perigeus/apogeus de 2027 derivados de JPL DE441, mais o apogeu de 1º de janeiro de 2028 necessário à consulta de 31 de dezembro em fusos ocidentais.
- Hemisfério Sul, Norte ou região equatorial, escolhido **separadamente** do fuso IANA. Padrão: Sul e `America/Sao_Paulo`.
- Duas regras tradicionais atribuídas ao Stella Natura: janelas de ±2 horas em torno dos nós lunares e ±12 horas em torno do perigeu. Elas não representam o calendário completo; ausência de janela não significa dia favorável.
- Preferências locais, conteúdo de aprendizagem, fontes, limites, manifest e cache do aplicativo para uso offline após a instalação bem-sucedida do service worker.

## Executar

Requer Node.js **22.12 ou superior**. Verificado nesta implementação com Node.js 24.22.3. As versões exatas estão no `package-lock.json`.

```sh
npm ci
npm run dev
```

Abra o endereço informado pelo Vite, acrescentando `/raiz-e-ritmo/` quando necessário. O modo de desenvolvimento não registra o service worker.

```sh
npm run build
npm run preview
```

O build gera `dist/`, inclusive `sw.js` com cache identificado pelo conteúdo. A prévia de produção permite verificar o cache em `localhost`; uma publicação requer HTTPS. Use o caminho `/raiz-e-ritmo/` também nessa prévia.

## Verificar e reproduzir

```sh
npm run verify
```

Esse comando verifica que os dados gerados estão atualizados, produz o relatório astronômico, executa os testes e compila a versão de produção. Comandos individuais:

| Comando | Finalidade |
| --- | --- |
| `npm run generate` | Regenerar o calendário a partir das fontes e regras versionadas. |
| `npm run check:data` | Detectar diferença entre o gerador e o calendário commitado, sem sobrescrevê-lo. |
| `npm run validate:astronomy` | Conferir os eventos efetivamente entregues ao navegador e gravar o relatório. |
| `npm test` | Verificar astronomia, fusos, hemisférios, cobertura, janelas e cache offline. |
| `npm run build` | Verificar tipos e gerar a aplicação estática e seu service worker. |

O relatório em [data/validation/astronomy-2027.json](data/validation/astronomy-2027.json) preserva também um diagnóstico que **falhou**: três apogeus aproximados da biblioteca excederam o limite original de 15 minutos, com diferença máxima de 16 min 14 s. Por isso, os eventos de distância entregues ao aplicativo vêm do JPL. O limite não foi ampliado para aprovar a biblioteca.

Os dados de ápsides podem ser reproduzidos offline com Python, NumPy e SciPy a partir das respostas JPL incluídas nos testes. As instruções e versões usadas estão em [tests/fixtures/JPL_README.md](tests/fixtures/JPL_README.md). Python não é necessário para executar, compilar ou usar o aplicativo.

## Hemisférios e precisão

Fases, nós e ápsides são eventos geocêntricos compartilhados. O fuso muda o relógio e pode mudar a data. O hemisfério muda a leitura tradicional de ascendente/descendente e os nomes das estações; não muda a direção física norte/sul nem o nome de um nó lunar.

Na região equatorial, o aplicativo evita a classificação automática de ascendente/descendente. Altura da Lua no horizonte, estações chuvosas/secas e épocas de plantio exigem informações locais que esta versão não calcula. Os símbolos de fases são esquemáticos, não uma previsão de orientação da Lua no céu.

Os segundos internos ajudam a comparar e ordenar eventos. A interface mostra horas e minutos. Concordância numérica, resolução do arquivo e precisão física são conceitos distintos; veja o relatório de validação.

## Offline e atualizações

O service worker guarda o aplicativo, os dados e os guias incluídos no build. Só a ativação do worker deste aplicativo permite mostrar “Acesso offline preparado”. Uma nova versão instalada aguarda a ação **Atualizar aplicativo**; o cache de outros projetos no mesmo domínio é preservado.

Cache e preferências podem ser removidos pelo navegador ou pelo usuário. A primeira visita precisa de conexão. Links de fontes externas continuam exigindo internet. Instalação na tela inicial depende do navegador e não equivale a uma versão publicada em lojas de aplicativos.

Os testes de cache executam o worker real gerado em um ambiente controlado de rede/cache. Os testes não substituem a revisão em dispositivos móveis reais.

## Publicação prevista

O workflow **Publish GitHub Pages** só executa por acionamento manual e publica exclusivamente a partir de `main`. A revisão, a integração e a publicação são etapas separadas.

1. Revise a alteração, confirme que o projeto pode publicar os materiais e integre a versão aprovada em `main`.
2. No GitHub, abra **Settings → Pages → Build and deployment** e selecione **GitHub Actions** como fonte. Se necessário, configure o ambiente `github-pages` para exigir aprovação antes do deploy.
3. Em **Actions → Publish GitHub Pages → Run workflow**, selecione `main`. O workflow instala as dependências do lockfile, verifica e compila o projeto, e publica o conteúdo de `dist/`.
4. Abra a URL exibida na execução. Confira o caminho `/raiz-e-ritmo/`, o escopo do service worker e a instalação nos dispositivos pretendidos.

Se o caminho público mudar, ajuste `vite.config.ts` e confira manifest, assets e escopo do worker no build. Veja a [documentação oficial de publicação do GitHub Pages](https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Documentação

- [Método e fontes](docs/DATA_METHOD.md): cálculos, convenções e limitações.
- [Validação de 2027](docs/VALIDATION_2027.md): referências, resultados e discrepância corrigida.
- [Produto](docs/PRODUCT_BRIEF.md), [roadmap](docs/ROADMAP.md) e [Task 01](docs/CODEX_TASK_01.md).

O site é gratuito para consulta. O projeto não concede uma licença de reutilização para seu código, textos ou ilustrações originais. Dependências conservam suas próprias licenças. O build inclui os avisos das dependências distribuídas com o aplicativo em `dist/third-party-licenses.txt`. Livros privados, artes de editoras e calendários comerciais completos não fazem parte deste repositório.
