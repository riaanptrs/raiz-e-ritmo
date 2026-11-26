import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { AstroEvent, CalendarInterval, DayPlan, Hemisphere } from './lib/types';
import {
  COVERAGE_YEAR, formatDate, formatInstant, formatMonth, formatTime, getDayPlan,
  getInitialDate, localDateKey, monthCells, seasonAt, shiftDateMonth,
} from './lib/calendar';

type View = 'calendar' | 'learn' | 'method' | 'help';
type Settings = { timeZone: string; hemisphere: Hemisphere };
const STORAGE_KEY = 'raiz-e-ritmo.settings.v1';
const DEFAULTS: Settings = { timeZone: 'America/Sao_Paulo', hemisphere: 'south' };
const ZONES = [
  ['America/Sao_Paulo', 'Brasília · São Paulo'], ['America/Manaus', 'Manaus'],
  ['America/Rio_Branco', 'Rio Branco'], ['America/Noronha', 'Fernando de Noronha'],
  ['Europe/Lisbon', 'Lisboa'], ['Europe/London', 'Londres'], ['Europe/Paris', 'Paris'],
  ['America/New_York', 'Nova York'], ['America/Los_Angeles', 'Los Angeles'],
  ['Africa/Johannesburg', 'Joanesburgo'], ['Australia/Sydney', 'Sydney'],
  ['Pacific/Auckland', 'Auckland'], ['Asia/Tokyo', 'Tóquio'], ['UTC', 'UTC'],
] as const;
const HEMISPHERES: Record<Hemisphere, string> = { south: 'Hemisfério Sul', north: 'Hemisfério Norte', equatorial: 'Região equatorial' };
const SOURCES = {
  repo: 'https://github.com/riaanptrs/raiz-e-ritmo',
  docs: 'https://github.com/riaanptrs/raiz-e-ritmo/blob/f53d80cae78e82288463b2d512f9024e01134cbd/docs',
  seasons: 'https://aa.usno.navy.mil/calculated/seasons?dst=false&submit=Get+Data&tz=0.00&tz_label=false&tz_sign=-1&year=2027',
  iau: 'https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx',
  evidence: 'https://acervodigital.unesp.br/handle/11449/93462',
  usno: 'https://aa.usno.navy.mil/calculated/moon/phases?year=2027',
  jpl: 'https://ssd.jpl.nasa.gov/horizons/manual.html',
  engine: 'https://github.com/cosinekitty/astronomy',
  stella: 'https://stellanatura.com/use.html',
  bda: 'https://www.biodynamic.org.uk/wp-content/uploads/2023/09/Guidelines-5-Sowing-and-Planting-Calendar.pdf',
  mabd: 'https://www.bio-dynamie.org/actualites/foire-aux-questions/',
};

function isTimeZone(value: string) {
  if (!/^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+|UTC|GMT)$/.test(value)) return false;
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: value }).format(); return true; } catch { return false; }
}

function readSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return {
      timeZone: typeof value?.timeZone === 'string' && isTimeZone(value.timeZone) ? value.timeZone : DEFAULTS.timeZone,
      hemisphere: ['south', 'north', 'equatorial'].includes(value?.hemisphere) ? value.hemisphere : DEFAULTS.hemisphere,
    };
  } catch { return DEFAULTS; }
}

function Icon({ kind, size = 22 }: { kind: 'leaf' | 'calendar' | 'book' | 'source' | 'globe' | 'chevron-left' | 'chevron-right' | 'info' | 'sun' | 'cloud' | 'check'; size?: number }) {
  const paths: Record<typeof kind, ReactNode> = {
    leaf: <><path d="M12 21V11M12 15C5 15 3 10 3 5c6 0 9 4 9 10ZM12 12c6 0 9-4 9-10-6 1-9 5-9 10Z" /><path d="m12 20-4 3m4-3 4 3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1" /></>,
    book: <><path d="M12 5c-4-3-8-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" /></>,
    source: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    'chevron-left': <path d="m14 6-6 6 6 6" />,
    'chevron-right': <path d="m10 6 6 6-6 6" />,
    info: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5m0 3v.01" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    cloud: <><path d="M7 19a5 5 0 1 1 0-10 6 6 0 0 1 11-3 5 5 0 0 1 0 13Z" /><path d="m8 15 3 3 5-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function MoonIcon({ type, size = 20 }: { type: string; size?: number }) {
  const full = type === 'full_moon';
  const first = type === 'first_quarter';
  const last = type === 'last_quarter';
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="moon-icon">
    <circle cx="12" cy="12" r="9" fill={full ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
    {first && <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />}
    {last && <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />}
    {!full && !first && !last && <circle cx="12" cy="12" r="6" fill="currentColor" opacity=".16" />}
  </svg>;
}

function BotanicalDrawing() {
  return <svg className="botanical-drawing" viewBox="0 0 340 240" fill="none" aria-hidden="true">
    <circle cx="217" cy="102" r="76" stroke="currentColor" opacity=".23" />
    <circle cx="217" cy="102" r="100" stroke="currentColor" opacity=".12" strokeDasharray="2 8" />
    <circle cx="277" cy="55" r="15" fill="#e7ca82" />
    <circle cx="143" cy="83" r="4" fill="currentColor" />
    <circle cx="247" cy="173" r="4" fill="currentColor" />
    <path d="M141 224c-3-74 21-129 57-165M152 159c-44 3-65-16-74-52 42-3 66 18 74 52ZM172 112c34-3 57-23 61-56-33 0-56 21-61 56ZM143 196c41-2 72-21 82-54-39-6-68 15-82 54Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m141 225-25 13m25-13 23 13m-23-13-2 15M83 224h130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M70 63v12m-6-6h12M287 135v8m-4-4h8" stroke="#e7ca82" strokeWidth="1.5" />
  </svg>;
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}<span className="sr-only"> (abre em outra aba)</span></a>;
}

function IntervalList({ intervals, timeZone }: { intervals: CalendarInterval[]; timeZone: string }) {
  return <ul className="interval-list">{intervals.map(interval => <li key={interval.id}>
    <strong>{interval.label}</strong>
    <span className="interval-time">{formatInstant(interval.startUtc, timeZone)} — {formatInstant(interval.endUtc, timeZone)}</span>
    {interval.detail && <p>{interval.detail}</p>}
  </li>)}</ul>;
}

function EventItem({ event, timeZone }: { event: AstroEvent; timeZone: string }) {
  return <li className="event-item">
    <span className="event-icon">{event.kind === 'phase' ? <MoonIcon type={event.type} size={27} /> : event.kind === 'season' ? <Icon kind="sun" size={25} /> : <span className={`orbit-symbol ${event.kind}`} aria-hidden="true" />}</span>
    <div><strong>{event.label}</strong><span>{event.kind === 'phase' ? 'Instante da fase principal' : event.detail || 'Evento astronômico'}</span></div>
    <time dateTime={event.instantUtc}>{formatTime(event.instantUtc, timeZone)}</time>
  </li>;
}

function DayDetail({ plan, onMethod }: { plan: DayPlan; onMethod: () => void }) {
  const seasonChange = plan.hemisphere === 'equatorial' ? undefined : plan.events.find(event => event.kind === 'season');
  return <aside className="day-panel" aria-labelledby="day-title">
    <div className="day-heading">
      <span className="eyebrow">UM OLHAR PARA O DIA</span>
      <h2 id="day-title" tabIndex={-1}>{formatDate(plan.dateKey)}</h2>
      <span className="day-context"><Icon kind="globe" size={16} /> {HEMISPHERES[plan.hemisphere]} · {plan.timeZone}</span>
    </div>
    {!plan.supported ? <div className="panel-section"><h3>Fora da cobertura</h3><p>Esta versão contém dados de {COVERAGE_YEAR}. Escolha uma data desse ano para consultar o calendário.</p></div> : <>
      <section className="panel-section">
        <h3>O céu neste dia</h3>
        {plan.events.length > 0 ? <ul className="event-list">{plan.events.map(event => <EventItem key={event.id} event={event} timeZone={plan.timeZone} />)}</ul> : <p>Nenhum evento astronômico pontual registrado neste dia.</p>}
        {plan.nextPhase && <div className="next-phase"><MoonIcon type={plan.nextPhase.type} /><p><span>Próxima fase principal</span><strong>{plan.nextPhase.label}</strong><span>{formatInstant(plan.nextPhase.instantUtc, plan.timeZone)}</span></p></div>}
        {seasonChange ? <div className="season-change">
          <p>Antes das {formatTime(seasonChange.instantUtc, plan.timeZone)}: {seasonAt(new Date(Date.parse(seasonChange.instantUtc) - 1).toISOString(), plan.hemisphere)}</p>
          <p>A partir das {formatTime(seasonChange.instantUtc, plan.timeZone)}: {seasonAt(seasonChange.instantUtc, plan.hemisphere)}</p>
        </div> : plan.seasonLabel && <p className="season-line"><Icon kind="sun" size={17} /> {plan.seasonLabel}</p>}
      </section>
      <section className="panel-section">
        <h3>Percurso da Lua</h3>
        {plan.motion.length ? <IntervalList intervals={plan.motion} timeZone={plan.timeZone} /> : <p>Dados de direção lunar indisponíveis neste dia.</p>}
        <p className="note">A direção norte/sul é astronômica. “Ascendente” e “descendente” seguem aqui uma convenção biodinâmica por hemisfério.</p>
      </section>
      <section className="panel-section">
        <h3>Constelação no céu</h3>
        {plan.constellations.length ? <IntervalList intervals={plan.constellations} timeZone={plan.timeZone} /> : <p>Dados de constelação indisponíveis neste dia.</p>}
        <p className="note">Regiões astronômicas da IAU. Não determinam, por si, uma recomendação de cultivo.</p>
      </section>
      <section className="panel-section tradition-section">
        <span className="small-tag">LEITURA TRADICIONAL · PARCIAL</span>
        <h3>Janelas de atenção</h3>
        {plan.cautions.length ? <IntervalList intervals={plan.cautions} timeZone={plan.timeZone} /> : <p>Nenhuma janela calculada por estas duas regras neste dia. Isso não classifica o dia como favorável.</p>}
        <p className="note">Regras de nós lunares e perigeu descritas no Stella Natura. Outros fatores do calendário não estão incluídos; benefício ou prejuízo agrícola não foi demonstrado por este cálculo.</p>
        <button className="text-button" onClick={onMethod}>Entender estas regras</button>
      </section>
    </>}
    <div className="classification-note"><Icon kind="info" size={22} /><div><strong>Classificação biodinâmica indisponível</strong><p>Dias de raiz, folha, flor e fruto aguardam um método completo e validado.</p></div></div>
  </aside>;
}

function Learning({ onMethod }: { onMethod: () => void }) {
  return <section className="reading-view" aria-labelledby="learn-title">
    <div className="section-intro"><span className="eyebrow">APRENDER COM O JARDIM</span><h1 id="learn-title">Observe o céu.<br />Conheça o seu chão.</h1><p>Um calendário se torna mais útil quando você entende o que ele mostra, de onde vem a orientação e o que precisa observar no seu próprio cultivo.</p></div>
    <div className="learning-grid">
      <article className="learning-card"><span className="card-icon"><Icon kind="globe" size={28} /></span><h2>Por que acompanhar?</h2><p>A agricultura biodinâmica propõe cuidar da propriedade como um conjunto de solo, plantas e outros seres vivos. Algumas tradições biodinâmicas consultam ritmos celestes ao escolher datas de semeadura e transplante. O calendário registra essas interpretações.</p><SourceLink href={SOURCES.stella}>A perspectiva do Stella Natura</SourceLink></article>
      <article className="learning-card"><span className="card-icon"><Icon kind="leaf" size={28} /></span><h2>Como usar no cotidiano?</h2><p>Comece observando umidade do solo, clima e estágio da planta. Registre o que fez, as condições e o resultado. Use as indicações tradicionais como uma escolha a investigar, sem deixar o calendário substituir a atenção ao jardim.</p><SourceLink href={SOURCES.stella}>Calendário, clima e observação</SourceLink></article>
      <article className="learning-card"><span className="card-icon"><Icon kind="calendar" size={28} /></span><h2>Quando consultar?</h2><p>Ao planejar uma tarefa, confira o horário local e os intervalos dentro do dia. Uma transição pode acontecer no meio da manhã ou à noite. O mesmo evento pode cair em datas diferentes conforme o fuso.</p><SourceLink href={SOURCES.jpl}>Como os eventos são definidos</SourceLink></article>
    </div>
    <article className="reading-card observation-guide">
      <h2>Da leitura à observação</h2>
      <ol>
        <li><strong>Escolha um dia.</strong> Confira o fuso e identifique o que aparece. Uma fase tem hora marcada. Uma janela tradicional pode começar na véspera e terminar no dia seguinte.</li>
        <li><strong>Confira as condições.</strong> Antes de semear, veja se o solo está úmido sem estar encharcado e considere a chuva e a temperatura. Antes de transplantar, observe o estágio e o vigor da muda.</li>
        <li><strong>Anote o que aconteceu.</strong> Registre data, cultura, local, umidade, temperatura e tarefa. Se comparar duas semeaduras, mantenha condições semelhantes e registre também as diferenças. Uma diferença na germinação pode ter várias causas.</li>
      </ol>
      <p>Um estudo da UNESP com cenouras em dois períodos encontrou diferenças em alguns contrastes. O estudo não encontrou diferença associada ao ritmo ascendente e descendente nos aspectos avaliados. <SourceLink href={SOURCES.evidence}>Consultar o estudo</SourceLink></p>
    </article>
    <article className="reading-card rhythm-guide"><div><span className="eyebrow">CADA RITMO TEM SUA PRÓPRIA PERGUNTA</span><h2>A Lua tem mais de um ciclo</h2><p>“Crescente” não significa “ascendente”. E um nó ascendente não é o início da Lua ascendente.</p></div><dl>
      <div><dt>Fase lunar</dt><dd>Relação angular entre Sol e Lua vista da Terra: nova, quartos e cheia.</dd></div>
      <div><dt>Declinação</dt><dd>Movimento da Lua para norte ou sul do equador celeste, usado nesta versão para a convenção de ascensão e descensão.</dd></div>
      <div><dt>Nó lunar</dt><dd>Cruzamento do plano da eclíptica. O nome do nó não muda quando você troca de hemisfério.</dd></div>
      <div><dt>Perigeu e apogeu</dt><dd>Momentos de menor e maior distância entre a Terra e a Lua.</dd></div>
    </dl><p className="source-note"><SourceLink href={SOURCES.engine}>Referência dos cálculos astronômicos</SourceLink></p><p className="note">Os símbolos de fase são esquemáticos. A orientação aparente da Lua depende do observador; o símbolo identifica a fase, sem representar sua posição no céu local. Trocar de hemisfério não troca crescente por minguante.</p></article>
    <article className="hemisphere-guide reading-card"><div><span className="eyebrow">UM CÉU, DUAS PERSPECTIVAS</span><h2>O que muda entre Norte e Sul?</h2><p>O instante de uma fase, de um nó ou do perigeu é o mesmo. O fuso muda o relógio. O hemisfério muda a interpretação tradicional de ascendente e descendente.</p><SourceLink href={SOURCES.bda}>Orientação da Associação Biodinâmica britânica</SourceLink></div><div className="hemisphere-comparison"><p className="comparison-caption">Quando a Lua se move para o norte:</p><div><span>NORTE</span><strong>Ascendente</strong></div><div><span>SUL</span><strong>Descendente</strong></div><p>Na região equatorial, usamos apenas “para o norte” ou “para o sul”. Nos trópicos, essa convenção não prevê diretamente a altura da Lua no horizonte.</p></div></article>
    <article className="reading-card"><h2>E as estações?</h2><p>Equinócios e solstícios têm instantes compartilhados, mas recebem nomes sazonais diferentes no Norte e no Sul. Eles não bastam para definir a época de plantio em cada região: o calendário não contém previsão do tempo nem uma recomendação climática local.</p><h3>Por que ainda não aparecem dias de raiz, folha, flor e fruto?</h3><p>As associações tradicionais dependem do sistema de divisão do céu e de outros ajustes. Os limites astronômicos da IAU não substituem automaticamente os de um calendário biodinâmico. Enquanto o conjunto de regras não estiver validado, deixamos essa classificação indisponível.</p><button className="text-button" onClick={onMethod}>Conhecer as fontes e os limites do método</button></article>
  </section>;
}

function Method() {
  return <section className="reading-view" aria-labelledby="method-title">
    <div className="section-intro"><span className="eyebrow">FONTES E MÉTODO</span><h1 id="method-title">Clareza em cada cálculo.</h1><p>Astronomia, interpretação tradicional e evidência agrícola respondem a perguntas diferentes. Aqui você encontra o que está incluído e o que ainda precisa ser resolvido.</p></div>
    <div className="method-principles"><article><span className="small-tag">ASTRONOMIA</span><h2>O que acontece no céu</h2><p>Eventos e posições calculáveis, com horários convertidos para o fuso escolhido.</p></article><article><span className="small-tag">TRADIÇÃO</span><h2>Como é interpretado</h2><p>Regras atribuídas à publicação que as descreve. Não existe uma regra única para todos os calendários.</p></article><article><span className="small-tag">EVIDÊNCIA</span><h2>O que isso demonstra</h2><p>Acertar a geometria não demonstra uma melhora de produtividade, sabor ou saúde das plantas.</p></article></div>
    <article className="reading-card"><h2>O que esta versão calcula</h2><div className="table-scroll"><table><thead><tr><th>Informação</th><th>Definição e limites</th></tr></thead><tbody>
      <tr><th>Fases principais de 2027</th><td>49 instantes da referência USNO, preservados com precisão de minuto. <SourceLink href={SOURCES.usno}>Tabela original</SourceLink>.</td></tr>
      <tr><th>Nós lunares</th><td>Cruzamentos do plano da eclíptica. Os termos ascendente e descendente indicam o sentido do cruzamento, em qualquer hemisfério.</td></tr>
      <tr><th>Perigeu e apogeu</th><td>26 extremos da distância geocêntrica lunar de 2027, derivados de posições JPL DE441. Há cobertura adjacente ao ano: o apogeu de 1º de janeiro de 2028 pode aparecer em 31 de dezembro de 2027 no horário local.</td></tr>
      <tr><th>Declinação lunar</th><td>Variação para norte ou sul e seus pontos de inversão. A interpretação por hemisfério é separada da observação geométrica.</td></tr>
      <tr><th>Constelação</th><td>Região IAU na direção da Lua, incluindo regiões que não pertencem às doze categorias tradicionais. <SourceLink href={SOURCES.iau}>Limites oficiais da IAU</SourceLink>.</td></tr>
      <tr><th>Estações astronômicas</th><td>Equinócios e solstícios; o nome da estação acompanha o hemisfério escolhido. <SourceLink href={SOURCES.seasons}>Tabela USNO</SourceLink>.</td></tr>
    </tbody></table></div><p className="source-note">Os instantes de fases publicados preservam os minutos da referência USNO. O <SourceLink href={SOURCES.engine}>Astronomy Engine</SourceLink> fornece os demais cálculos, com a exceção dos ápsides desta edição, derivados do <SourceLink href={SOURCES.jpl}>JPL Horizons</SourceLink>.</p></article>
    <article className="reading-card"><h2>Verificação desta edição</h2><p>Nas comparações com USNO e JPL, as diferenças máximas foram de <strong>73 segundos nas fases calculadas</strong>, <strong>29 segundos nos nós lunares</strong>, <strong>11 segundos nas inversões de declinação</strong> e <strong>42 segundos nos equinócios e solstícios</strong>. As fases mostradas no calendário continuam a usar os horários publicados pelo USNO.</p><p>A checagem identificou uma diferença de até <strong>16 minutos e 14 segundos</strong> em um dos ápsides lunares calculados pela biblioteca. Por isso, esta edição usa eventos de perigeu e apogeu derivados diretamente dos dados JPL. O refinamento com amostras mais próximas mudou esses horários em menos de um segundo; essa comparação usa o mesmo modelo e não demonstra uma precisão física de um segundo.</p><p className="note">São verificações numéricas de datas e posições. Não validam efeitos de uma prática agrícola nem a equivalência com um calendário editorial completo. Os procedimentos, tolerâncias e resultados ficam documentados no repositório.</p></article>
    <article className="reading-card partial-method"><span className="small-tag">PERFIL TRADICIONAL PARCIAL</span><h2>Duas regras do Stella Natura</h2><p>As janelas exibidas aplicam dois intervalos descritos pela editora Sherry Wildfeuer:</p><ul><li><strong>Nós lunares:</strong> duas horas antes e duas horas depois do cruzamento.</li><li><strong>Perigeu:</strong> doze horas antes e doze horas depois do instante de menor distância.</li></ul><p>A implementação não reproduz o calendário completo. Ajustes por outros planetas, eclipses, transições entre setores e associações agrícolas não entram nessas janelas. Ausência de uma janela não significa indicação favorável.</p><p>Esses intervalos são orientações tradicionais para evitar semeadura, não resultados demonstrados pelo cálculo astronômico.</p><SourceLink href={SOURCES.stella}>Ler as regras publicadas pelo Stella Natura</SourceLink></article>
    <article className="reading-card"><h2>Por que não copiar a lógica de qualquer calendário?</h2><p>É necessário definir limites de setores, coordenadas, época de referência, horários de transição, margens e exceções. Diferentes publicações fazem escolhas distintas. O MABD explica que os limites usados por sua tradição não são idênticos aos dos astrônomos.</p><p>O Raiz &amp; Ritmo não apresenta uma classificação IAU como reprodução de Maria Thun, ABD ou Assesoar. A classificação completa de raiz, folha, flor e fruto permanece indisponível.</p><SourceLink href={SOURCES.mabd}>Explicações do MABD</SourceLink></article>
    <article className="reading-card"><h2>Hemisfério e fuso são configurações independentes</h2><p>Mudar o hemisfério preserva os instantes dos eventos. Mudar o fuso recalcula o dia e a hora exibidos, incluindo mudanças de horário de verão previstas na base de fusos do dispositivo. Intervalos podem atravessar a meia-noite.</p><p>Ascendente e descendente, na leitura tradicional implementada, invertem-se entre Norte e Sul. A direção física norte/sul continua a mesma. Na região equatorial, mostramos a direção sem aplicar essa inversão. Uma previsão da altura no horizonte exigiria latitude e cálculo topocêntrico, que não fazem parte desta versão.</p><SourceLink href={SOURCES.bda}>Fonte da convenção entre hemisférios</SourceLink></article>
    <div className="source-directory"><h2>Consultar, reproduzir, melhorar</h2><p>O código, os dados e a documentação do método estão disponíveis para inspeção.</p><a className="button primary-button" href={SOURCES.repo} target="_blank" rel="noreferrer">Abrir o projeto no GitHub</a><p><SourceLink href={SOURCES.docs + "/DATA_METHOD.md"}>Documentação do método</SourceLink> · <SourceLink href={SOURCES.docs + "/VALIDATION_2027.md"}>Relatório de validação de 2027</SourceLink></p><p className="note">As preferências ficam neste navegador. O aplicativo não exige conta.</p></div>
  </section>;
}

function Help({ offlineReady }: { offlineReady: boolean }) {
  return <section className="reading-view" aria-labelledby="help-title">
    <div className="section-intro"><h1 id="help-title">Instalação e uso offline</h1><p>Tenha o calendário de 2027 e os guias à mão mesmo quando a conexão falhar.</p></div>
    <article className="reading-card">
      <h2>Adicionar ao seu dispositivo</h2>
      <p>No Android ou computador, procure <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong> no menu do navegador, quando disponível. No iPhone ou iPad, abra no Safari, toque em <strong>Compartilhar</strong> e escolha <strong>Adicionar à Tela de Início</strong>.</p>
    </article>
    <article className="reading-card">
      <h2>Preparar o acesso offline</h2>
      <p>Abra o calendário com internet na primeira visita e aguarde o aviso <strong>Acesso offline preparado</strong>. O calendário e os guias ficam disponíveis neste navegador. Os links de fontes externas precisam de conexão.</p>
      <p role="status">{offlineReady ? 'Acesso offline preparado neste navegador.' : 'O acesso offline ainda não está preparado neste navegador.'}</p>
      <p>Ao voltar à internet, aguarde o aviso de nova versão. Se ele aparecer, selecione <strong>Atualizar aplicativo</strong> para carregar os novos arquivos.</p>
    </article>
  </section>;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [dateKey, setDateKey] = useState(() => getInitialDate(readSettings().timeZone));
  const [view, setView] = useState<View>('calendar');
  const [customZone, setCustomZone] = useState('');
  const [showCustomZone, setShowCustomZone] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineFailed, setOfflineFailed] = useState(false);
  const focusDay = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const mainRef = useRef<HTMLElement>(null);
  const plan = useMemo(() => getDayPlan(dateKey, settings.timeZone, settings.hemisphere), [dateKey, settings]);
  const cells = useMemo(() => monthCells(dateKey), [dateKey]);
  const monthPlans = useMemo(() => new Map(cells.filter((day): day is string => !!day).map(day => [day, getDayPlan(day, settings.timeZone, settings.hemisphere)])), [cells, settings]);
  const today = localDateKey(new Date(), settings.timeZone);
  const knownZone = ZONES.some(([value]) => value === settings.timeZone);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); setStorageUnavailable(false); } catch { setStorageUnavailable(true); }
  }, [settings]);
  useEffect(() => {
    if (focusDay.current && view === 'calendar') { buttons.current.get(dateKey)?.focus(); focusDay.current = false; }
  }, [dateKey, view]);
  useEffect(() => {
    let disposed = false;
    let stateCheck = 0;
    const syncOnline = () => setOnline(navigator.onLine);
    let container: ServiceWorkerContainer | undefined;
    try { if ('serviceWorker' in navigator) container = navigator.serviceWorker; } catch { /* Unsupported or blocked context. */ }
    const scope = new URL(import.meta.env.BASE_URL, window.location.href).href;
    const scriptURL = new URL('sw.js', scope).href;
    const refreshWorkerState = async () => {
      if (!container) return;
      const check = ++stateCheck;
      try {
        const registration = await container.getRegistration(scope);
        if (disposed || check !== stateCheck) return;
        const ours = registration?.scope === scope;
        const ready = !!ours && registration?.active?.scriptURL === scriptURL && container.controller?.scriptURL === scriptURL;
        setOfflineReady(ready);
        setUpdateAvailable(!!ours && registration?.waiting?.scriptURL === scriptURL);
        if (ready) setOfflineFailed(false);
      } catch {
        if (!disposed && check === stateCheck) { setOfflineReady(false); setUpdateAvailable(false); setOfflineFailed(true); }
      }
    };
    const changed = () => { void refreshWorkerState(); };
    const failed = () => { setOfflineFailed(true); setOfflineReady(false); changed(); };
    window.addEventListener('online', syncOnline); window.addEventListener('offline', syncOnline);
    window.addEventListener('rr:sw-update', changed); window.addEventListener('rr:sw-state', changed);
    window.addEventListener('rr:sw-error', failed);
    container?.addEventListener('controllerchange', changed);
    // Registration may already be waiting, or a state event may precede this effect.
    // Query after subscribing rather than relying on a one-shot announcement.
    changed();
    return () => {
      disposed = true;
      window.removeEventListener('online', syncOnline); window.removeEventListener('offline', syncOnline);
      window.removeEventListener('rr:sw-update', changed); window.removeEventListener('rr:sw-state', changed);
      window.removeEventListener('rr:sw-error', failed);
      container?.removeEventListener('controllerchange', changed);
    };
  }, []);

  function navigate(next: View) {
    setView(next);
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function chooseToday() {
    setDateKey(today);
    navigate('calendar');
  }
  function keyboardDay(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = day;
    if (event.key in offsets) {
      const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + offsets[event.key]); next = value.toISOString().slice(0, 10);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') next = shiftDateMonth(day, event.key === 'PageUp' ? -1 : 1);
    else if (event.key === 'Home' || event.key === 'End') {
      const value = new Date(`${day}T12:00:00Z`);
      const weekday = (value.getUTCDay() + 6) % 7;
      value.setUTCDate(value.getUTCDate() + (event.key === 'Home' ? -weekday : 6 - weekday));
      next = value.toISOString().slice(0, 10);
    }
    else return;
    event.preventDefault(); focusDay.current = true; setDateKey(next);
  }
  function applyCustomZone() {
    const value = customZone.trim();
    if (!value || !isTimeZone(value)) { setZoneError('Use um fuso IANA válido, como America/Recife.'); return; }
    setSettings(previous => ({ ...previous, timeZone: value })); setShowCustomZone(false); setZoneError('');
  }

  return <>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={() => navigate('calendar')} aria-label="Raiz e Ritmo, início"><span className="brand-mark"><Icon kind="leaf" size={31} /></span><span>Raiz <i>&amp;</i> Ritmo<small>OBSERVAR PARA CULTIVAR</small></span></button>
      <nav aria-label="Navegação principal"><button className={view === 'calendar' ? 'active' : ''} aria-current={view === 'calendar' ? 'page' : undefined} onClick={() => navigate('calendar')}><Icon kind="calendar" size={18} />Calendário</button><button className={view === 'learn' ? 'active' : ''} aria-current={view === 'learn' ? 'page' : undefined} onClick={() => navigate('learn')}><Icon kind="book" size={18} />Aprender</button><button className={view === 'method' ? 'active' : ''} aria-current={view === 'method' ? 'page' : undefined} onClick={() => navigate('method')}><Icon kind="source" size={18} />Fontes e método</button></nav>
      <button className="today-button" onClick={chooseToday}>Hoje</button>
    </div></header>
    {(!online || updateAvailable || offlineFailed) && <div className="connection-banner" role="status"><div>{!online ? offlineReady ? 'Você está sem conexão. Consulte os dados e guias já disponíveis neste dispositivo.' : 'Você está sem conexão. O acesso offline ainda não foi preparado neste dispositivo.' : offlineFailed ? 'Não foi possível preparar o acesso offline neste navegador.' : 'Uma nova versão está pronta.'}{updateAvailable && <button onClick={() => window.dispatchEvent(new Event('rr:apply-update'))}>Atualizar aplicativo</button>}</div></div>}
    <main id="main-content" ref={mainRef} tabIndex={-1}>
      {view === 'calendar' ? <>
        <section className="hero"><div className="hero-copy"><h1>Seu jardim,<br />no ritmo da natureza.</h1><p>Consulte os eventos do céu no seu horário local e conheça as tradições biodinâmicas que orientam a observação do jardim.</p><div className="hero-meta"><span>EDIÇÃO {COVERAGE_YEAR}</span></div></div><BotanicalDrawing /></section>
        <section className="settings-panel" aria-labelledby="settings-title"><div className="settings-intro"><Icon kind="globe" size={25} /><div><h2 id="settings-title">Seu lugar no mundo</h2></div></div><label><span id="hemisphere-label">Hemisfério</span><select aria-labelledby="hemisphere-label" value={settings.hemisphere} onChange={e => setSettings(previous => ({ ...previous, hemisphere: e.target.value as Hemisphere }))}>{Object.entries(HEMISPHERES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span id="timezone-label">Fuso horário</span><select aria-labelledby="timezone-label" value={showCustomZone ? 'custom' : settings.timeZone} onChange={e => {
          if (e.target.value === 'custom') { setShowCustomZone(true); setCustomZone(settings.timeZone); }
          else { setSettings(previous => ({ ...previous, timeZone: e.target.value })); setShowCustomZone(false); setZoneError(''); }
        }}>{ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{!knownZone && <option value={settings.timeZone}>{settings.timeZone}</option>}<option value="custom">Outro fuso IANA…</option></select></label>
          <p className="settings-footnote">{settings.timeZone} · Hemisfério escolhido separadamente do fuso.</p>
          {showCustomZone && <form className="custom-zone" onSubmit={event => { event.preventDefault(); applyCustomZone(); }}><label htmlFor="custom-zone">Identificador do fuso<input id="custom-zone" value={customZone} onChange={event => setCustomZone(event.target.value)} placeholder="America/Recife" aria-describedby={zoneError ? 'zone-error' : undefined} aria-invalid={!!zoneError} /></label><button className="button secondary-button" type="submit">Aplicar fuso</button>{zoneError && <p id="zone-error" role="alert">{zoneError}</p>}</form>}
          {storageUnavailable && <p className="settings-footnote" role="status">Seu navegador não permitiu salvar as preferências. Elas valem enquanto esta página estiver aberta.</p>}
        </section>
        <div className="calendar-layout"><section className="calendar-panel" aria-labelledby="calendar-title"><div className="calendar-toolbar"><div><h2 id="calendar-title" aria-live="polite">{formatMonth(dateKey)}</h2></div><div className="month-navigation"><button aria-label="Mês anterior" onClick={() => setDateKey(previous => shiftDateMonth(previous, -1))}><Icon kind="chevron-left" /></button><button aria-label="Próximo mês" onClick={() => setDateKey(previous => shiftDateMonth(previous, 1))}><Icon kind="chevron-right" /></button></div></div>
          <p className="calendar-zone">{HEMISPHERES[settings.hemisphere]} · {settings.timeZone}</p>
          {!plan.supported && <div className="coverage-banner"><div><strong>Você está fora do calendário de {COVERAGE_YEAR}.</strong><p>A consulta desta versão cobre janeiro a dezembro de {COVERAGE_YEAR}.</p></div><button className="button secondary-button" onClick={() => setDateKey(`${COVERAGE_YEAR}-01-01`)}>Voltar a {COVERAGE_YEAR}</button></div>}
          <div className="weekdays" aria-hidden="true">{['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" role="group" aria-label={`Dias de ${formatMonth(dateKey)}`}>{cells.map((day, index) => {
            if (!day) return <span key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />;
            const info = monthPlans.get(day)!;
            const phase = info.events.find(event => event.kind === 'phase');
            const otherEvents = info.events.filter(event => event.kind !== 'phase');
            const eventSummary = info.events.map(event => event.label).join(', ');
            return <button key={day} ref={element => { if (element) buttons.current.set(day, element); else buttons.current.delete(day); }} className={`calendar-day ${day === dateKey ? 'selected' : ''} ${day === today ? 'is-today' : ''} ${!info.supported ? 'outside-coverage' : ''}`} onClick={() => setDateKey(day)} onKeyDown={event => keyboardDay(event, day)} aria-pressed={day === dateKey} aria-label={`${formatDate(day)}${eventSummary ? `, ${eventSummary}` : ''}${info.cautions.length ? ', janela tradicional parcial' : ''}${day === today ? ', hoje' : ''}`} tabIndex={day === dateKey ? 0 : -1}>
              <span className="day-number">{Number(day.slice(-2))}{day === today && <span className="today-dot" aria-hidden="true" />}</span>
              {phase && <span className="cell-phase"><MoonIcon type={phase.type} /><span>{phase.label}</span></span>}
              {!phase && otherEvents.length > 0 && <span className="cell-event"><span>{otherEvents.length}</span><span className="cell-event-word"> {otherEvents.length > 1 ? 'eventos' : 'evento'}</span></span>}
              {info.cautions.length > 0 && <span className="cell-caution"><Icon kind="info" size={12} /><span>Janela</span></span>}
            </button>;
          })}</div>
          <div className="calendar-legend"><span><MoonIcon type="full_moon" size={16} />Fase principal (símbolo esquemático)</span><span><span className="legend-event" aria-hidden="true" />Evento astronômico</span><span><Icon kind="info" size={15} />Janela tradicional parcial</span></div>
          <p className="calendar-help">Selecione um dia para ver os horários e as explicações. No teclado, use as setas para mudar de dia e Page Up / Page Down para mudar de mês.</p>
          <a className="day-jump" href="#day-title">Ver detalhes de {formatDate(dateKey)}</a>
          <div className="garden-reminder"><span><Icon kind="leaf" size={28} /></span><div><h3>O jardim também tem algo a dizer.</h3><p>Observe o solo, o clima e a planta antes de escolher uma tarefa. O calendário ajuda a formular perguntas e registrar experiências.</p><button className="text-button" onClick={() => navigate('learn')}>Aprender a usar o calendário</button></div></div>
        </section><DayDetail plan={plan} onMethod={() => navigate('method')} /></div>
      </> : view === 'learn' ? <Learning onMethod={() => navigate('method')} /> : view === 'method' ? <Method /> : <Help offlineReady={offlineReady} />}
    </main>
    <footer className="site-footer"><div><span className="footer-brand">Raiz &amp; Ritmo</span></div><div className="footer-links"><button onClick={() => navigate('help')}>Instalação e ajuda</button><button onClick={() => navigate('method')}>Fontes e limites</button><a href={SOURCES.repo} target="_blank" rel="noreferrer">Projeto no GitHub</a><span className="offline-label">{offlineReady ? <><Icon kind="cloud" size={16} />Acesso offline preparado</> : 'Calendário 2027 · versão inicial'}</span></div></footer>
  </>;
}
