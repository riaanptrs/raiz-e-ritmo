import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { AstroEvent, CalendarInterval, DayPlan, Hemisphere } from './lib/types';
import {
  COVERAGE_LABEL, COVERAGE_START, COVERAGE_END, formatDate, formatInstant, formatMonth, formatTime, getDayPlan,
  getInitialDate, localDateKey, monthCells, seasonAt, shiftDateMonth,
} from './lib/calendar';

type View = 'calendar' | 'garden' | 'learn' | 'method' | 'help';
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
  const limited = plan.dateKey.startsWith('2026-12-');
  const seasonChange = plan.hemisphere === 'equatorial' ? undefined : plan.events.find(event => event.kind === 'season');
  return <aside className="day-panel" aria-labelledby="day-title">
    <div className="day-heading">
      <span className="eyebrow">UM OLHAR PARA O DIA</span>
      <h2 id="day-title" tabIndex={-1}>{formatDate(plan.dateKey)}</h2>
      <span className="day-context"><Icon kind="globe" size={16} /> {HEMISPHERES[plan.hemisphere]} · {plan.timeZone}</span>
    </div>
    {!plan.supported ? <div className="panel-section"><h3>Fora da cobertura</h3><p>Consulte uma data entre {COVERAGE_LABEL}.</p></div> : <>
      <section className="panel-section">
        <h3>O céu neste dia</h3>
        {limited && <p className="december-note">Em dezembro de 2026, consulte as fases principais e o solstício. Os demais dados lunares e as janelas tradicionais estão disponíveis para 2027.</p>}
        {plan.events.length > 0 ? <ul className="event-list">{plan.events.map(event => <EventItem key={event.id} event={event} timeZone={plan.timeZone} />)}</ul> : <p>Nenhum evento astronômico pontual registrado neste dia.</p>}
        {plan.nextPhase && <div className="next-phase"><MoonIcon type={plan.nextPhase.type} /><p><span>Próxima fase principal</span><strong>{plan.nextPhase.label}</strong><span>{formatInstant(plan.nextPhase.instantUtc, plan.timeZone)}</span></p></div>}
        {seasonChange ? <div className="season-change">
          <p>Antes das {formatTime(seasonChange.instantUtc, plan.timeZone)}: {seasonAt(new Date(Date.parse(seasonChange.instantUtc) - 1).toISOString(), plan.hemisphere)}</p>
          <p>A partir das {formatTime(seasonChange.instantUtc, plan.timeZone)}: {seasonAt(seasonChange.instantUtc, plan.hemisphere)}</p>
        </div> : plan.seasonLabel && <p className="season-line"><Icon kind="sun" size={17} /> {plan.seasonLabel}</p>}
      </section>
      {!limited && <>
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
    </>}
    <div className="classification-note"><Icon kind="info" size={22} /><div><strong>Dias de raiz, folha, flor e fruto</strong><p>Essas quatro categorias ainda estão indisponíveis no calendário. O guia da horta já traz orientações para semear, transplantar e colher.</p><a href="?pagina=horta">Ir para o guia da horta</a></div></div>
  </aside>;
}

function preparationRange(value: number, minRate: number, maxRate: number, unit: string) {
  const format = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 4 });
  return `${format.format(value * minRate)} a ${format.format(value * maxRate)} ${unit}`;
}

function AgricultureCourseCitation({ location }: { location: string }) {
  return <p className="source-note">Rudolf Steiner, <cite>Agriculture Course: The Birth of the Biodynamic Method</cite>, tradução de George Adams, Rudolf Steiner Press, 2012. {location}</p>;
}

function PreparationQuantities() {
  const [area, setArea] = useState('10');
  const [areaUnit, setAreaUnit] = useState('m²');
  const [compost, setCompost] = useState('100');
  const hectares = Number(area) / (areaUnit === 'm²' ? 10_000 : 1);
  const cubicMeters = Number(compost) / 1_000;

  return <section className="preparation-quantities" aria-labelledby="prep-quantities">
    <h3 id="prep-quantities">Quanto usar na sua área?</h3>
    <p>As faixas de referência do Apêndice 8 da Demeter são de 50 a 300 g/ha para o 500, de 2,5 a 5 g/ha para o 501 e de 1 a 2 mL de cada preparado de composto por 10 m³. São referências de aplicação da tradição, sem indicação de eficácia para um canteiro específico.</p>
    <details>
      <summary>Por que a calculadora usa gramas?</summary>
      <p>No curso de 1924, Steiner usou um balde de ordenha suíço como referência e deixou a padronização das medidas em aberto. A calculadora usa as faixas métricas da Demeter para converter a quantidade conforme a área ou o volume de composto.</p>
      <AgricultureCourseCitation location="Discussão da palestra 4, p. 78 do PDF consultado." />
    </details>
    <div className="preparation-inputs">
      <label>Área a tratar<input type="number" step="any" min="0" inputMode="decimal" value={area} onChange={event => setArea(event.target.value)} /></label>
      <label>Unidade de área<select value={areaUnit} onChange={event => setAreaUnit(event.target.value)}><option>m²</option><option>ha</option></select></label>
      <label>Volume de composto (L)<input type="number" step="any" min="0" inputMode="decimal" value={compost} onChange={event => setCompost(event.target.value)} /></label>
    </div>
    <ul className="preparation-results" aria-live="polite">
      <li><strong>500:</strong> {hectares > 0 && Number.isFinite(hectares) ? preparationRange(hectares, 50, 300, 'g') : 'Informe uma área positiva.'}</li>
      <li><strong>501:</strong> {hectares > 0 && Number.isFinite(hectares) ? preparationRange(hectares, 2.5, 5, 'g') : 'Informe uma área positiva.'}</li>
      <li><strong>502–507:</strong> {cubicMeters > 0 && Number.isFinite(cubicMeters) ? preparationRange(cubicMeters / 10, 1, 2, 'mL de cada preparado') : 'Informe um volume positivo.'}</li>
    </ul>
    <p>O resultado indica a quantidade do preparado, antes de adicionar água. Meça apenas os canteiros ou talhões que serão tratados. Para o composto, use o volume da pilha, em vez da área da horta.</p>
    <p>Se a dose for menor do que sua balança ou dosador consegue medir, use um produto pré-dosado para a área, consulte o fornecedor sobre uma dose fracionada ou organize um lote compartilhado. Em 10 m², por exemplo, o 501 fica entre 2,5 e 5 mg. Uma colher de cozinha não permite medir essa quantidade.</p>
  </section>;
}

function IntercroppingGuide() {
  return <section aria-labelledby="intercropping-title">
    <h2 id="intercropping-title">Consórcios: como cultivar plantas juntas</h2>
    <p>Na sétima palestra, Steiner chama a atenção para as relações entre as áreas cultivadas, a vegetação do entorno, as aves e os insetos. Na horta, observe essas relações antes de decidir onde plantar. Na agrofloresta, a Embrapa descreve como distribuir as espécies no espaço e ajustar a sombra conforme crescem.</p>
    <AgricultureCourseCitation location="Palestra 7, pp. 129–131 do PDF consultado." />
    <p className="source-note">Armando e colaboradores, <cite>Agrofloresta para agricultura familiar</cite>, Embrapa, Circular Técnica 16, 2002, seções sobre podas de formação e sucessão ecológica.</p>
    <div className="garden-actions">
      <article>
        <h3>Alface americana com coentro ou salsa</h3>
        <p>Em um canteiro, experimente uma erva de cada vez ao lado da alface e deixe espaço para colher as duas. Em vasos pequenos, você pode começar com um recipiente para cada espécie e aproximá-los para observar como a luz incide em cada um.</p>
        <p>Um ensaio brasileiro testou coentro e salsa separadamente com alface americana. O estudo não detectou diferença significativa na produtividade da alface no conjunto dos tratamentos. O resultado se refere à alface nas condições do ensaio.</p>
        <p className="source-note">Forlani e Riva Neto, 2022, <cite>Produção orgânica de alface americana em consórcio com almeirão, coentro, rúcula e salsa</cite>. DOI 10.36560/151220221639.</p>
      </article>
      <article>
        <h3>Alface e rúcula</h3>
        <p>Experimente semear a rúcula na mesma semana em que transplantar a alface. Num ensaio em Jaboticabal, os melhores momentos dependeram da variedade de alface e da época. Semear a rúcula 14 dias depois reduziu sua massa seca nos consórcios tardios.</p>
        <p className="source-note">Costa e colaboradores, 2007, <cite>Viabilidade agronômica do consórcio de alface e rúcula, em duas épocas de cultivo</cite>. DOI 10.1590/S0102-05362007000100008.</p>
      </article>
      <article>
        <h3>Tomate e alface</h3>
        <p>Observe onde a sombra do tomateiro cai à medida que ele cresce e acompanhe o desenvolvimento da alface. No ensaio de Jaboticabal, o tomate manteve a produtividade comercial, mas a alface produziu menos no consórcio. Os melhores resultados de uso da área vieram quando a alface foi transplantada até 14 dias depois do tomate.</p>
        <p className="source-note">Rezende, Canato e Cecílio Filho, 2005, <cite>Influência das épocas de cultivo e do estabelecimento do consórcio na produção de tomate e alface consorciados</cite>. DOI 10.1590/S1413-70542005000100009.</p>
      </article>
    </div>
    <h3>Como testar no seu espaço</h3>
    <ol>
      <li><strong>Desenhe antes de plantar.</strong> Observe o sol de manhã e à tarde. Reserve espaço para as plantas crescerem e para você regar e colher. Num sistema com árvores, reveja o desenho conforme as copas crescem.</li>
      <li><strong>Compare com um cultivo sozinho.</strong> Se houver espaço, plante algumas mudas da mesma alface sem a erva vizinha e compare com o trecho em consórcio. Use a mesma variedade, época e manejo, e anote diferenças de luz ou água.</li>
      <li><strong>Registre as duas colheitas.</strong> Compare a quantidade colhida por espécie, o espaço ocupado e o trabalho necessário. Uma combinação pode aproveitar melhor a área mesmo quando uma das culturas rende menos por planta.</li>
    </ol>
    <p>Vasos vizinhos permitem observar sombra e organização do espaço. Os estudos citados avaliaram plantas em consórcio no solo. Para manjericão e cebolinha, experimente a disposição dos vasos e registre o que observa.</p>
  </section>;
}

function CompostGuide() {
  return <section aria-labelledby="compost-title">
    <h2 id="compost-title">Compostagem biodinâmica com sobras da cozinha</h2>
    <p>Steiner descreve o composto como uma forma de devolver os resíduos da horta ao solo. Ele propõe montar a pilha em camadas finas e cobrir cada camada. Para uma casa, adapte essa ideia aos resíduos vegetais que você consegue reunir.</p>
    <AgricultureCourseCitation location="Palestra 4, pp. 69–70 do PDF consultado." />
    <h3>Como montar e cuidar da composteira</h3>
    <ol>
      <li><strong>Separe dois tipos de material.</strong> Use cascas e aparas de frutas e hortaliças como material úmido. Guarde folhas secas, palha ou raminhos picados para cobrir. Para esta composteira doméstica, separe carnes, peixes, laticínios, óleo e sobras gordurosas.</li>
      <li><strong>Comece pela base.</strong> Em uma caixa ventilada ou numa pilha no quintal, coloque uma camada fina de raminhos para deixar o ar passar. Cubra com folhas secas, espalhe os restos vegetais picados em uma camada fina e cubra as sobras com mais material seco a cada adição. Evite apertar as camadas.</li>
      <li><strong>Cuide da umidade.</strong> O conteúdo deve ficar úmido, sem ficar encharcado. Se estiver seco ao apertar um punhado com luva, umedeça aos poucos. Se escorrer água ou aparecer cheiro forte de podridão, acrescente material seco, solte a mistura e proteja da chuva sem vedar a entrada de ar.</li>
      <li><strong>Deixe o lote maturar.</strong> Quando a caixa estiver cheia, comece outro lote para as sobras novas. Espere o primeiro ficar escuro, solto e com cheiro de terra, com a maior parte das sobras já desfeita. A caixa pequena tende a aquecer menos e pode levar mais tempo. Use esses sinais para decidir quando incorporar o composto ao canteiro.</li>
    </ol>
    <h3>Quando entram os preparados 502–507?</h3>
    <p><strong>Pilha montada de uma vez:</strong> na orientação de Julie Moore, aplique os preparados após montar a pilha. Os preparados 502 a 506 vão em pontos separados no interior, que depois são fechados com o próprio material. A valeriana, 507, é aplicada por último sobre a pilha, antes de cobrir.</p>
    <p><strong>Caixa que recebe sobras aos poucos:</strong> Moore descreve, como alternativa biodinâmica, usar um iniciador de compostagem pronto à base do preparado de barril de Maria Thun (Mausdorf) ao acrescentar material. Siga a dose do produto. Para uma pilha montada de uma vez, a calculadora abaixo estima os preparados individuais pelo volume da pilha.</p>
    <p className="source-note">Julie Moore, <cite>Composting the Biodynamic Way</cite>, <cite>Kitchen Garden</cite>, outubro de 2016, pp. 63–66, material disponibilizado pela Associação Biodinâmica britânica. Controle de umidade e aeração: Associação Biodinâmica britânica, <cite>Biodynamic Basics: the art and science of making and applying compost</cite>.</p>
  </section>;
}

function PreparationGuide() {
  return <details className="preparation-guide">
    <summary>Quando entram os preparados biodinâmicos?</summary>
    <p>Na tradição biodinâmica, o momento depende do trabalho em andamento. Use este guia para entender onde cada preparado se encaixa.</p>
    <dl>
      <div>
        <dt>Antes de semear · 500, esterco de chifre</dt>
        <dd>Se você segue essa prática, planeje a aplicação no solo na etapa de preparo do canteiro. Steiner propôs essa ordem para que, segundo sua explicação, o preparado pudesse atuar no solo antes da chegada da semente. Ele também relata uma aplicação tardia naquele ano e deixa a avaliação do resultado em aberto.</dd>
        <dd className="source-note">Steiner, discussão da palestra 4 em Agriculture Course (George Adams, 2012), p. 82 do PDF consultado. Ver também What Is Biodynamics?, pp. 92–93 do PDF consultado.</dd>
      </div>
      <div>
        <dt>Com a cultura em crescimento · 501, sílica de chifre</dt>
        <dd>Steiner descreve o uso sobre as plantas, como complemento ao trabalho no solo. Planeje essa etapa em função da cultura já estabelecida. A passagem consultada não fixa um dia ou horário de aplicação para cada hortaliça.</dd>
        <dd className="source-note">Steiner, palestra de agricultura de 12 de junho de 1924, p. 86 do PDF.</dd>
      </div>
      <div>
        <dt>Durante a compostagem · preparados 502 a 507</dt>
        <dd>Se estiver preparando uma pilha de composto, é nessa etapa que entra o conjunto de preparados descrito na obra. A aplicação é na pilha, durante o preparo do composto que será usado mais adiante.</dd>
        <dd className="source-note">Hugh J. Courtney, introdução, pp. 7–8, e Steiner, perguntas da palestra de 13 de junho de 1924, p. 111 do PDF.</dd>
      </div>
    </dl>
    <PreparationQuantities />
    <h3>Como preparar uma aplicação em pequena escala</h3>
    <p><strong>Exemplo de um canteiro de 10 m²:</strong> a faixa de referência é 0,05 a 0,30 g de 500 para o solo, ou 2,5 a 5 mg de 501 para as plantas em crescimento. São aplicações distintas, cada uma na sua etapa. Para 100 L de composto, a referência é 0,01 a 0,02 mL de cada preparado de composto. Use a calculadora se a área ou o volume forem diferentes.</p>
    <ol>
      <li><strong>Escolha o produto para a tarefa.</strong> Use um preparado pronto de procedência conhecida e confira o rótulo para dose, diluição, modo de mistura e uso na cultura. O 500 vai ao solo, o 501 às plantas e o conjunto 502 a 507 à pilha de composto.</li>
      <li><strong>Calibre a água com o equipamento limpo.</strong> Para uma aplicação líquida, teste primeiro com água pura em uma área medida. Se usar 2 L em 100 m², com a mesma cobertura precisará de 0,2 L para 10 m² ou 200 L para 1 ha. Ajuste a técnica para distribuir uniformemente, sem escorrer.</li>
      <li><strong>Misture apenas o que vai usar.</strong> Siga o rótulo sobre o volume mínimo de mistura, a agitação e o prazo de uso. Em área pequena, prefira um lote pré-dosado ou compartilhado quando o equipamento não comportar o volume calculado.</li>
    </ol>
    <h3>Como obter os preparados para uma horta pequena</h3>
    <p><strong>507, valeriana.</strong> A base vegetal é o suco das flores de <i>Valeriana officinalis</i>, obtido por prensagem. Steiner descreve diluir o extrato em água morna antes de aplicá-lo à pilha. A passagem não fixa uma diluição para pequenas pilhas. Se você precisa de uma dose reproduzível, use um extrato com rótulo e dosador.</p>
    <p className="source-note">Steiner, palestra de 13 de junho de 1924, p. 107 do PDF consultado.</p>
    <p>Para um canteiro, adquirir pequenas porções prontas evita fabricar um lote maior do que a demanda. Para uma fazenda que pretende produzir os próprios preparados, use a seção de produção do Apêndice 8 com orientação técnica local sobre origem dos materiais, higiene e descarte. Em climas sem inverno definido, confirme a adaptação sazonal com a associação biodinâmica da região.</p>
    <p>Evite improvisar com esterco cru ou subprodutos animais em uma horta de alimentos. Para o 501, use o produto pronto e evite manusear pó de sílica. Para o composto, mantenha as boas práticas locais de compostagem mesmo se optar pelos preparados.</p>
    <p className="note">Estas indicações descrevem a prática tradicional. As faixas métricas vêm do padrão Demeter de 2026. No canteiro, planeje o 500 antes da semeadura, o 501 com a cultura em crescimento e os preparados de composto quando estiver preparando a pilha. As janelas de semeadura do Stella Natura tratam apenas da semeadura. Planeje cada etapa conforme o cultivo e registre o que observou.</p>
    <p className="source-note">Fonte: Rudolf Steiner, <cite>What Is Biodynamics?</cite>, SteinerBooks, 2005. As palestras de agricultura foram traduzidas por Catherine Creeger e Malcolm Gardner. As páginas referem-se ao PDF consultado.</p>
  </details>;
}

function GardenGuide({ onMethod }: { onMethod: () => void }) {
  return <section className="garden-guide reading-card" aria-labelledby="garden-title">
    <h1 id="garden-title">Guia biodinâmico da horta</h1>
    <p>Na agricultura biodinâmica de Rudolf Steiner, a propriedade é vista como um organismo. Para uma horta pequena, isso começa com uma pergunta prática: como o solo, a água, as plantas e a vida no entorno se relacionam neste lugar?</p>
    <details className="preparation-guide">
      <summary>Como usar o calendário com as orientações de Steiner?</summary>
      <ol>
        <li><strong>Comece pela tarefa.</strong> Veja se é época da cultura, se o solo está em condições e se a muda ou a planta está no estágio certo.</li>
        <li><strong>Use a data para observar.</strong> Na primeira palestra, Steiner levantou a questão da semeadura em relação à chuva seguida de Lua cheia. Se quiser observar essa hipótese, consulte a fase no calendário e anote a chuva que caiu no seu local. A passagem trata de certas plantas e deixa em aberto a escolha de um dia para cada cultura.</li>
        <li><strong>Registre o resultado.</strong> Anote a cultura, a data, a umidade do solo e quantas mudas emergiram. Ao comparar duas semeaduras, use sementes do mesmo lote e observe cada canteiro após o mesmo número de dias.</li>
      </ol>
      <p>O curso de 1924 orienta esta leitura. As janelas de nós e perigeu exibidas em 2027 vêm do Stella Natura. A indicação de três dias antes da Lua cheia, apresentada em Aprender, vem de Charles Kovacs.</p>
      <AgricultureCourseCitation location="Palestra 1, p. 26, e discussão da palestra 4, p. 80 do PDF consultado." />
    </details>
    <details className="preparation-guide">
      <summary>Como aplicar essa visão numa horta pequena?</summary>
      <ul>
        <li><strong>Observe o lugar.</strong> Depois da chuva, veja onde a água infiltra e onde fica empoçada. Repare também em quais canteiros recebem sol ou sombra das árvores e dos arbustos.</li>
        <li><strong>Aproveite os recursos da horta.</strong> Separe folhas secas e resíduos vegetais adequados para a compostagem. Observe o que você consegue devolver ao solo e o que precisa trazer de fora.</li>
        <li><strong>Observe a vida ao redor.</strong> Repare nas aves e nos insetos que visitam as flores e as bordas do canteiro. Anote o que muda de uma estação para outra.</li>
      </ul>
      <p>Essas são adaptações para pequenos espaços da visão de Steiner sobre a propriedade e seu entorno.</p>
      <AgricultureCourseCitation location="Palestras 2 e 7, pp. 29 e 129–131 do PDF consultado." />
    </details>
    <h3>Semear, transplantar ou colher</h3>
    <div className="garden-actions">
      <article>
        <h4>Semear</h4>
        <p>Steiner propôs observar a chuva junto com a Lua cheia ao pensar na germinação. Se você segue a prática do preparado 500, ele orientou aplicá-lo ao solo antes de semear.</p>
        <p>Na aula sobre sementes, Charles Kovacs orienta retirar a vegetação que compete com a muda, deixar a terra solta e considerar a época própria de cada planta. Em vasos e canteiros pequenos, vale observar também a umidade antes de semear.</p>
        <AgricultureCourseCitation location="Palestra 1 e discussão da palestra 4, pp. 26 e 82 do PDF consultado." />
        <p className="source-note">Charles Kovacs, <cite>Botany</cite>, cap. 17, Floris Books, edição digital de 2020, pp. 42–43 do PDF consultado.</p>
      </article>
      <article>
        <h4>Transplantar</h4>
        <p>O Stella Natura descreve o arco descendente da Lua como período de transplante na tradição de Maria Thun. A janela editorial depende do método da publicação e não é calculada aqui.</p>
        <p>Para observar essa prática, anote a data em que passou a muda do vaso para o canteiro e acompanhe como ela se estabelece. Registre também o clima e a umidade do solo.</p>
      </article>
      <article>
        <h4>Colher</h4>
        <p>O Stella Natura distingue a colheita para consumo imediato da colheita para guardar ou para semente. Para consumir ervas e hortaliças frescas, a publicação prioriza o frescor e a conveniência.</p>
        <p>Para guardar a produção ou colher sementes, o Stella Natura usa critérios próprios de acordo com a parte da planta a ser colhida. Esses critérios dependem das categorias raiz, folha, flor e fruto, que ainda estão indisponíveis neste calendário. Para o uso diário, observe o que já está pronto e colha a quantidade que pretende consumir fresca.</p>
      </article>
    </div>
    <section aria-labelledby="garden-crops">
      <h2 id="garden-crops">Ervas e hortaliças comuns no Brasil</h2>
      <p>Escolha a época de semeadura conforme a cultura e as condições da sua região. Os exemplos ajudam a observar vasos e canteiros pequenos ao longo do cultivo.</p>
      <div className="garden-actions">
        <article>
          <h3>Manjericão, cebolinha e coentro</h3>
          <p>Se cultivar para colher folhas e ramos frescos, observe primeiro o crescimento de folhas novas. Quando tiver o que precisa para a refeição, colha a quantidade que vai usar. Se cultivar coentro para semente, acompanhe a floração e anote a formação das sementes em uma planta reservada para esse fim.</p>
          <p className="note">Aplicação para a horta da distinção entre colheita fresca e colheita para semente, descrita no <cite>Stella Natura</cite>. O guia não atribui dias a essas ervas.</p>
        </article>
        <article>
          <h3>Alface e outras folhas</h3>
          <p>Para semear alface, retire a vegetação que compete com a muda e deixe a superfície do canteiro solta. Observe as primeiras folhas e o momento em que as plantas começam a alongar o caule. Se a intenção é consumir as folhas frescas, colha conforme o uso na cozinha.</p>
          <p className="note">Kovacs orienta o preparo do canteiro em <cite>Botany</cite>, cap. 17, pp. 42–43 do PDF. O <cite>Stella Natura</cite> inclui a alface entre as culturas de folha na sua orientação de semeadura.</p>
        </article>
        <article>
          <h3>Cenoura, rabanete e tomate</h3>
          <p>Registre a semeadura e observe o desenvolvimento de cada cultura. Quando colher uma cenoura ou um rabanete para consumo, anote como a raiz se desenvolveu. No tomate, acompanhe a floração e o amadurecimento dos frutos.</p>
          <p className="note">O <cite>Stella Natura</cite> usa cenoura e rabanete como exemplos de culturas de raiz, e tomate como cultura de fruto. Essas categorias descrevem a tradição da publicação. O calendário do Raiz &amp; Ritmo ainda não fornece as datas correspondentes.</p>
        </article>
      </div>
    </section>
    <p className="note">No detalhe de cada data coberta de 2027, as janelas do Stella Natura indicam quando essa tradição sugere evitar a semeadura. Para acompanhar transplantes e colheitas, anote o estágio da planta e as condições do local.</p>
    <p className="source-note">Transplante e colheita: Sherry Wildfeuer, <cite>Stella Natura</cite>, orientações da edição de 2024.</p>
    <IntercroppingGuide />
    <CompostGuide />
    <h2>Preparados biodinâmicos</h2>
    <PreparationGuide />
    <button className="text-button garden-source-button" onClick={onMethod}>Ver fontes do guia da horta</button>
  </section>;
}

function Learning({ onMethod }: { onMethod: () => void }) {
  return <section className="reading-view" aria-labelledby="learn-title">
    <div className="section-intro"><span className="eyebrow">APRENDER COM O JARDIM</span><h1 id="learn-title">Observe o céu.<br />Conheça o seu chão.</h1><p>Um calendário se torna mais útil quando você entende o que ele mostra, de onde vem a orientação e o que precisa observar no seu próprio cultivo.</p></div>
    <div className="learning-grid">
      <article className="learning-card"><span className="card-icon"><Icon kind="globe" size={28} /></span><h2>Por que acompanhar?</h2><p>A agricultura biodinâmica propõe cuidar da propriedade como um conjunto de solo, plantas e outros seres vivos. Algumas tradições biodinâmicas consultam ritmos celestes ao escolher datas de semeadura e transplante. O calendário registra essas interpretações.</p></article>
      <article className="learning-card"><span className="card-icon"><Icon kind="leaf" size={28} /></span><h2>Como usar no cotidiano?</h2><p>Comece observando umidade do solo, clima e estágio da planta. Registre o que fez, as condições e o resultado. Use as indicações tradicionais como uma escolha a investigar, sem deixar o calendário substituir a atenção ao jardim.</p></article>
      <article className="learning-card"><span className="card-icon"><Icon kind="calendar" size={28} /></span><h2>Quando consultar?</h2><p>Ao planejar uma tarefa, confira o horário local e os intervalos dentro do dia. Uma transição pode acontecer no meio da manhã ou à noite. O mesmo evento pode cair em datas diferentes conforme o fuso.</p></article>
    </div>
    <article className="reading-card">
      <h2>Como a tradição usa os calendários</h2>
      <p>Hugh J. Courtney descreve métodos diferentes de dividir o céu e registra que alguns praticantes não conseguiram repetir os resultados que esperavam. As orientações mudam conforme o calendário consultado. Para escolher a tarefa de hoje, comece pelas condições que você pode observar na horta.</p>
      <p className="source-note">Hugh J. Courtney, introdução a <cite>What Is Biodynamics?</cite>, de Rudolf Steiner, SteinerBooks, 2005, páginas 11–12 do PDF consultado.</p>
      <h3>Por que observar a chuva junto com a Lua?</h3>
      <p>Na primeira palestra do curso de 1924, Steiner propôs que a chuva antes da Lua cheia poderia influenciar a germinação de certas plantas. Essa hipótese faz parte da explicação biodinâmica para observar os dois ritmos. Na horta, confira se o solo está úmido, sem estar encharcado, e se a época é adequada para a cultura antes de semear.</p>
      <AgricultureCourseCitation location="Palestra 1, p. 26 do PDF consultado." />
      <details>
        <summary>Como Kovacs ensinava a escolher uma data?</summary>
        <p>Na aula sobre sementes, Kovacs apresenta três dias antes da Lua cheia como momento para semear. A passagem descreve essa orientação sem apresentar uma comparação medida que permita prever a germinação na sua horta. Se quiser observá-la, use o exercício de comparação de semeaduras abaixo e registre também o clima.</p>
        <p className="source-note">Charles Kovacs, <cite>Botany</cite>, cap. 17, Floris Books, edição digital de 2020, p. 43 do PDF consultado.</p>
      </details>
    </article>
    <article className="reading-card observation-guide">
      <h2>Da leitura à observação</h2>
      <ol>
        <li><strong>Escolha um dia.</strong> Confira o fuso e identifique o que aparece. Uma fase tem hora marcada. Uma janela tradicional pode começar na véspera e terminar no dia seguinte.</li>
        <li><strong>Confira as condições.</strong> Antes de semear, veja se o solo está úmido sem estar encharcado e considere a chuva e a temperatura. Antes de transplantar, observe o estágio e o vigor da muda.</li>
        <li><strong>Anote o que aconteceu.</strong> Registre data, cultura, local, umidade, temperatura e tarefa.</li>
      </ol>
      <h3>Da semente às primeiras folhas</h3>
      <p>Quando uma muda de feijão emergir, procure os cotilédones, também chamados de folhas da semente. Observe depois as primeiras folhas verdadeiras, que aparecem no caule e têm outra forma. Faça um desenho ou tire uma foto em cada etapa e anote quantos dias se passaram desde a semeadura. Para comparar dois canteiros, conte a emergência pelo mesmo critério nos dois.</p>
      <p className="source-note">Atividade adaptada de Charles Kovacs, <cite>Botany</cite>, cap. 17, “Seeds and Cotyledons”, Floris Books, edição digital de 2020, pp. 42–43 do PDF consultado.</p>
      <h3>Como comparar duas semeaduras</h3>
      <p>Ao relatar o curso de 1924, Steiner descreveu como um grupo de agricultores reuniria informações sobre o solo, o clima e o entorno de cada propriedade antes de testar as práticas propostas.</p>
      <p>Na horta, comece com dois trechos semelhantes. Se quiser observar duas datas de semeadura, use sementes do mesmo lote, na mesma profundidade, e mantenha o manejo tão parecido quanto possível. Anote chuva e temperatura e conte quantas mudas emergiram após o mesmo número de dias em cada trecho. Uma diferença ajuda a formular a próxima pergunta e pode ter várias causas.</p>
      <p className="source-note">Rudolf Steiner, relato de 20 de junho de 1924 em <cite>Spiritual Foundations for the Renewal of Agriculture</cite>, tradução de Catherine Creeger e Malcolm Gardner, 1993, pp. 9 e 11 do PDF consultado. O exemplo da horta é uma adaptação do Raiz &amp; Ritmo.</p>
      <p>Um estudo da UNESP com cenouras em dois períodos encontrou diferenças em alguns contrastes. O estudo não encontrou diferença associada ao ritmo ascendente e descendente nos aspectos avaliados. Referência: Jovchelevich, UNESP, 2007, acervo digital 11449/93462.</p>
    </article>
    <article className="reading-card rhythm-guide"><div><span className="eyebrow">CADA RITMO TEM SUA PRÓPRIA PERGUNTA</span><h2>A Lua tem mais de um ciclo</h2><p>“Crescente” não significa “ascendente”. E um nó ascendente não é o início da Lua ascendente.</p></div><dl>
      <div><dt>Fase lunar</dt><dd>Relação angular entre Sol e Lua vista da Terra: nova, quartos e cheia.</dd></div>
      <div><dt>Declinação</dt><dd>Movimento da Lua para norte ou sul do equador celeste, usado nesta versão para a convenção de ascensão e descensão.</dd></div>
      <div><dt>Nó lunar</dt><dd>Cruzamento do plano da eclíptica. O nome do nó não muda quando você troca de hemisfério.</dd></div>
      <div><dt>Perigeu e apogeu</dt><dd>Momentos de menor e maior distância entre a Terra e a Lua.</dd></div>
    </dl><p className="note">Os símbolos de fase são esquemáticos. A orientação aparente da Lua depende do observador; o símbolo identifica a fase, sem representar sua posição no céu local. Trocar de hemisfério não troca crescente por minguante.</p></article>
    <article className="hemisphere-guide reading-card"><div><span className="eyebrow">UM CÉU, DUAS PERSPECTIVAS</span><h2>O que muda entre Norte e Sul?</h2><p>O instante de uma fase, de um nó ou do perigeu é o mesmo. O fuso muda o relógio. O hemisfério muda a interpretação tradicional de ascendente e descendente.</p></div><div className="hemisphere-comparison"><p className="comparison-caption">Quando a Lua se move para o norte:</p><div><span>NORTE</span><strong>Ascendente</strong></div><div><span>SUL</span><strong>Descendente</strong></div><p>Na região equatorial, usamos apenas “para o norte” ou “para o sul”. Nos trópicos, essa convenção não prevê diretamente a altura da Lua no horizonte.</p></div></article>
    <article className="reading-card"><h2>E as estações?</h2><p>Equinócios e solstícios têm instantes compartilhados, mas recebem nomes sazonais diferentes no Norte e no Sul. Eles não bastam para definir a época de plantio em cada região: o calendário não contém previsão do tempo nem uma recomendação climática local.</p><h3>Por que ainda não aparecem dias de raiz, folha, flor e fruto?</h3><p>As associações tradicionais dependem do sistema de divisão do céu e de outros ajustes. Os limites astronômicos da IAU não substituem automaticamente os de um calendário biodinâmico. Enquanto o conjunto de regras não estiver validado, deixamos essa classificação indisponível.</p><button className="text-button" onClick={onMethod}>Conhecer as fontes e os limites do método</button></article>
  </section>;
}

function Method() {
  return <section className="reading-view" aria-labelledby="method-title">
    <div className="section-intro"><span className="eyebrow">FONTES E MÉTODO</span><h1 id="method-title">Clareza em cada cálculo.</h1><p>Astronomia, interpretação tradicional e evidência agrícola respondem a perguntas diferentes. Aqui você encontra o que está incluído e o que ainda precisa ser resolvido.</p></div>
    <div className="method-principles"><article><span className="small-tag">ASTRONOMIA</span><h2>O que acontece no céu</h2><p>Eventos e posições calculáveis, com horários convertidos para o fuso escolhido.</p></article><article><span className="small-tag">TRADIÇÃO</span><h2>Como é interpretado</h2><p>Regras atribuídas à publicação que as descreve. Não existe uma regra única para todos os calendários.</p></article><article><span className="small-tag">EVIDÊNCIA</span><h2>O que isso demonstra</h2><p>Acertar a geometria não demonstra uma melhora de produtividade, sabor ou saúde das plantas.</p></article></div>
    <article className="reading-card">
      <h2>Fontes do guia da horta</h2>
      <p>A seção de consórcios tem referências bibliográficas junto aos exemplos. Ela distingue a perspectiva de Steiner, o planejamento agroflorestal da Embrapa e os resultados dos ensaios brasileiros.</p>
      <p>As palestras de Rudolf Steiner fundamentam a leitura biodinâmica. As referências a cada edição e às páginas consultadas aparecem junto às orientações no guia.</p>
      <p>O guia de semeadura e as atividades de observação recorrem a <cite>Botany</cite>, de Charles Kovacs. Para a distinção entre colheita fresca e colheita para guardar, e para o contexto do transplante na tradição de Maria Thun, o guia usa o <cite>Stella Natura</cite>, manual da edição de 2024, de Sherry Wildfeuer.</p>
      <p>As faixas que a calculadora converte por área ou volume, bem como as referências para produção dos preparados, vêm do padrão internacional de 2026 da Demeter, Apêndice 8, p. 122, que indica as faixas por hectare e por volume de composto.</p>
    </article>
    <article className="reading-card"><h2>O que esta versão calcula</h2><div className="table-scroll"><table><thead><tr><th>Informação</th><th>Definição e limites</th></tr></thead><tbody>
      <tr><th>Dezembro de 2026</th><td>Fases principais e solstício, em UTC com precisão de minuto, publicados por Fred Espenak nas tabelas de fases lunares e estações do AstroPixels.</td></tr>
      <tr><th>Fases principais de 2027</th><td>49 instantes da referência USNO, preservados com precisão de minuto.</td></tr>
      <tr><th>Nós lunares</th><td>Cruzamentos do plano da eclíptica. Os termos ascendente e descendente indicam o sentido do cruzamento, em qualquer hemisfério.</td></tr>
      <tr><th>Perigeu e apogeu</th><td>26 extremos da distância geocêntrica lunar de 2027, derivados de posições JPL DE441. Há cobertura adjacente ao ano: o apogeu de 1º de janeiro de 2028 pode aparecer em 31 de dezembro de 2027 no horário local.</td></tr>
      <tr><th>Declinação lunar</th><td>Variação para norte ou sul e seus pontos de inversão. A interpretação por hemisfério é separada da observação geométrica.</td></tr>
      <tr><th>Constelação</th><td>Região IAU na direção da Lua, incluindo regiões que não pertencem às doze categorias tradicionais.</td></tr>
      <tr><th>Estações astronômicas</th><td>Equinócios e solstícios; o nome da estação acompanha o hemisfério escolhido. Conferidos contra a tabela de estações do USNO.</td></tr>
    </tbody></table></div><p className="source-note">Os instantes de fases publicados preservam os minutos da referência USNO. O Astronomy Engine fornece os demais cálculos. Os ápsides desta edição são derivados do sistema Horizons do JPL.</p></article>
    <article className="reading-card"><h2>Verificação desta edição</h2><p>Nas comparações com USNO e JPL, as diferenças máximas foram de <strong>73 segundos nas fases calculadas</strong>, <strong>29 segundos nos nós lunares</strong>, <strong>11 segundos nas inversões de declinação</strong> e <strong>42 segundos nos equinócios e solstícios</strong>. As fases mostradas no calendário continuam a usar os horários publicados pelo USNO.</p><p>A checagem identificou uma diferença de até <strong>16 minutos e 14 segundos</strong> em um dos ápsides lunares calculados pela biblioteca. Por isso, esta edição usa eventos de perigeu e apogeu derivados diretamente dos dados JPL. O refinamento com amostras mais próximas mudou esses horários em menos de um segundo; essa comparação usa o mesmo modelo e não demonstra uma precisão física de um segundo.</p><p className="note">São verificações numéricas de datas e posições. Não validam efeitos de uma prática agrícola nem a equivalência com um calendário editorial completo. Os procedimentos, tolerâncias e resultados ficam documentados no repositório.</p></article>
    <article className="reading-card partial-method"><span className="small-tag">PERFIL TRADICIONAL PARCIAL</span><h2>Duas regras do Stella Natura</h2><p>As janelas exibidas aplicam dois intervalos descritos pela editora Sherry Wildfeuer:</p><ul><li><strong>Nós lunares:</strong> duas horas antes e duas horas depois do cruzamento.</li><li><strong>Perigeu:</strong> doze horas antes e doze horas depois do instante de menor distância.</li></ul><p>A implementação não reproduz o calendário completo. Ajustes por outros planetas, eclipses, transições entre setores e associações agrícolas não entram nessas janelas. Ausência de uma janela não significa indicação favorável.</p><p>Esses intervalos são orientações tradicionais para evitar semeadura, não resultados demonstrados pelo cálculo astronômico.</p></article>
    <article className="reading-card"><h2>Por que não copiar a lógica de qualquer calendário?</h2><p>É necessário definir limites de setores, coordenadas, época de referência, horários de transição, margens e exceções. Diferentes publicações fazem escolhas distintas. O MABD explica que os limites usados por sua tradição não são idênticos aos dos astrônomos.</p><p>O Raiz &amp; Ritmo não apresenta uma classificação IAU como reprodução de Maria Thun, ABD ou Assesoar. A classificação completa de raiz, folha, flor e fruto permanece indisponível.</p></article>
    <article className="reading-card"><h2>Hemisfério e fuso são configurações independentes</h2><p>Mudar o hemisfério preserva os instantes dos eventos. Mudar o fuso recalcula o dia e a hora exibidos, incluindo mudanças de horário de verão previstas na base de fusos do dispositivo. Intervalos podem atravessar a meia-noite.</p><p>Ascendente e descendente, na leitura tradicional implementada, invertem-se entre Norte e Sul. A direção física norte/sul continua a mesma. Na região equatorial, mostramos a direção sem aplicar essa inversão. Uma previsão da altura no horizonte exigiria latitude e cálculo topocêntrico, que não fazem parte desta versão. Referência: Associação Biodinâmica britânica, <cite>Sowing and Planting Calendar</cite>, guia 5.</p></article>
    <p className="note">As preferências ficam neste navegador. O aplicativo não exige conta.</p>
  </section>;
}

function Help({ offlineReady }: { offlineReady: boolean }) {
  return <section className="reading-view" aria-labelledby="help-title">
    <div className="section-intro"><h1 id="help-title">Instalação e uso offline</h1><p>Tenha o calendário e os guias à mão mesmo quando a conexão falhar.</p></div>
    <article className="reading-card">
      <h2>Adicionar ao seu dispositivo</h2>
      <p>No Android ou computador, procure <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong> no menu do navegador, quando disponível. No iPhone ou iPad, abra no Safari, toque em <strong>Compartilhar</strong> e escolha <strong>Adicionar à Tela de Início</strong>.</p>
    </article>
    <article className="reading-card">
      <h2>Preparar o acesso offline</h2>
      <p>Abra o calendário com internet na primeira visita e aguarde o aviso <strong>Acesso offline preparado</strong>. O calendário e os guias ficam disponíveis neste navegador. As referências bibliográficas também ficam disponíveis offline.</p>
      <p role="status">{offlineReady ? 'Acesso offline preparado neste navegador.' : 'O acesso offline ainda não está preparado neste navegador.'}</p>
      <p>Ao voltar à internet, aguarde o aviso de nova versão. Se ele aparecer, selecione <strong>Atualizar aplicativo</strong> para carregar os novos arquivos.</p>
    </article>
  </section>;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [dateKey, setDateKey] = useState(() => getInitialDate(readSettings().timeZone));
  const [view, setView] = useState<View>(() => new URLSearchParams(window.location.search).get('pagina') === 'horta' ? 'garden' : 'calendar');
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
    const url = new URL(window.location.href);
    if (url.searchParams.get('pagina') === 'horta' && next !== 'garden') {
      url.searchParams.delete('pagina');
      window.history.replaceState(null, '', url);
    }
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
        <section className="hero"><div className="hero-copy"><h1>Seu jardim,<br />no ritmo da natureza.</h1><p>Consulte os eventos do céu no seu horário local e conheça as tradições biodinâmicas que orientam a observação do jardim.</p><div className="hero-meta"><span>DEZ 2026 A DEZ 2027</span></div></div><BotanicalDrawing /></section>
        <section className="garden-guide reading-card" aria-labelledby="garden-intro-title">
          <h2 id="garden-intro-title">O que fazer hoje na horta?</h2>
          <p>Veja como observar o solo e as plantas, quando semear, transplantar e colher, e em que etapa entram os preparados biodinâmicos.</p>
          <a className="button primary-button" href="?pagina=horta">Abrir o guia biodinâmico da horta</a>
        </section>
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
          {!plan.supported && <div className="coverage-banner"><div><strong>Data fora da cobertura.</strong><p>O calendário cobre {COVERAGE_LABEL}.</p></div><button className="button secondary-button" onClick={() => setDateKey(dateKey < COVERAGE_START ? COVERAGE_START : COVERAGE_END)}>Voltar ao calendário</button></div>}
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
      </> : view === 'garden' ? <GardenGuide onMethod={() => navigate('method')} /> : view === 'learn' ? <Learning onMethod={() => navigate('method')} /> : view === 'method' ? <Method /> : <Help offlineReady={offlineReady} />}
    </main>
    <footer className="site-footer"><div><span className="footer-brand">Raiz &amp; Ritmo</span></div><div className="footer-links"><button onClick={() => navigate('help')}>Instalação e ajuda</button><button onClick={() => navigate('method')}>Fontes e limites</button><span className="offline-label">{offlineReady ? <><Icon kind="cloud" size={16} />Acesso offline preparado</> : 'Dezembro de 2026 a dezembro de 2027'}</span></div></footer>
  </>;
}
