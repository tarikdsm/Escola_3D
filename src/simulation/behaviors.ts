/**
 * behaviors.ts — COMPORTAMENTOS: escolha da próxima tarefa por papel × período.
 *
 * O planejador (`atribuirProximaTarefa`) é chamado quando o agente termina
 * uma ação ou quando o período muda. Ele monta uma `Tarefa` (rota pelo
 * grafo + pernas off-graph + animação + duração + texto de atividade) e a
 * aplica ao agente, que então executa (ver agents.ts).
 *
 * Convenções documentadas:
 * - ASSENTO FIXO DO ALUNO: CARTEIRAS[salaId] é gerada fileira a fileira a
 *   partir da frente (z=−29,8 é a fileira mais perto do quadro, z=−31,85).
 *   Os 5 alunos de cada sala ocupam deterministicamente os índices 0–4
 *   (fileira da frente, da esquerda para a direita) — ver estado.ts.
 * - PORTÃO: aberto em CHEGADA/RECREIO/ALMOCO_SAIDA, fechado em AULA_*
 *   (decisão aplicada em step.ts).
 * - FILA DA CANTINA: o último slot do contrato (z=17,05) fica dentro do
 *   AABB do balcão; quem está sendo atendido para em z=16,7 (colado no
 *   balcão, sem clipping visual).
 * - Cozinheiras contornam o balcão pela passagem x −14…−12 (via points),
 *   único caminho sem atravessar o balcão até o lado da cozinha.
 */

import {
  ADMIN,
  CARTEIRAS,
  CONST,
  IDS_SALAS_AULA,
  PATIO,
  PORTARIA,
  QUADROS,
  REFEITORIO,
  getSala,
} from '../contracts/layout';
import { ROSTER } from '../contracts/roster';
import type { AnimState, Periodo, Vec3 } from '../contracts/types';
import type { PersonagemInfo } from '../contracts/types';
import { WAYPOINTS, getNodeIndex, nearestNode } from '../contracts/waypoints';
import { resetBola } from './ball';
import { liberarTudo, type Agente, type ModoTarefa, type Mundo } from './estado';
import { andarDe, pernaDiretaLivre, planejarRota } from './navigation';
import { faixa } from './rng';

// ---------------------------------------------------------------------------
// Tarefa (resultado do planejamento)
// ---------------------------------------------------------------------------

interface Tarefa {
  /** Nó do grafo a alcançar (−1 = ficar onde está / perna direta). */
  nodeAlvo: number;
  /** Ponto final exato (off-graph). */
  destino: Vec3 | null;
  /** Pontos intermediários off-graph (ex.: contorno do balcão). */
  via: Vec3[];
  faseFinal: 'fazendo' | 'conversando';
  anim: AnimState;
  /** Duração da ação em segundos de jogo. */
  duracao: number;
  velocidade: number;
  correr: boolean;
  face: Vec3 | null;
  parceiro: number;
  modo: ModoTarefa;
  atvDeslocando: string;
  atvAcao: string;
}

// ---------------------------------------------------------------------------
// Nós do grafo pré-computados (resolvidos uma vez)
// ---------------------------------------------------------------------------

interface PontoRonda {
  idx: number;
  rotulo: string;
}

interface NosPre {
  salaCentro: Map<string, number>;
  refeitorioCentro: number;
  secretariaCentro: number;
  diretoriaCentro: number;
  profCentro: number;
  guaritaInt: number;
  quadraInt: number;
  portaoDentro: number;
  portaoAprox2: number;
  guaritaAprox: number;
  rua: number[];
  patio: number[];
  rondaDiretora: PontoRonda[];
  faxPatio: number[];
  faxCorredor: number[];
}

let NOS: NosPre | null = null;

function construirNos(): NosPre {
  const salaCentro = new Map<string, number>();
  for (const id of IDS_SALAS_AULA) salaCentro.set(id, getNodeIndex(`${id}-centro`));

  const patio: number[] = [];
  const faxCorredor: number[] = [];
  WAYPOINTS.forEach((n, i) => {
    if (n.tipo === 'patio') patio.push(i);
    else if (n.tipo === 'corredor' && n.andar === 0) faxCorredor.push(i);
  });
  // Pontos de varrição do pátio (espalhados, 1 a cada 3 da grade).
  const faxPatio = patio.filter((_, k) => k % 3 === 0);

  const rondaIds: [string, string][] = [
    ['sp-corredor-a-0-4', 'Rondando o corredor térreo'],
    ['sp-corredor-a-0-12', 'Rondando o corredor térreo'],
    ['sp-varanda-a-1-4', 'Rondando a varanda superior'],
    ['sp-varanda-a-1-12', 'Rondando a varanda superior'],
    ['sp-passeio-b-0-3', 'Rondando o passeio coberto'],
    ['sp-passeio-b-0-10', 'Rondando o passeio coberto'],
    ['sp-varanda-b-1-7', 'Rondando a varanda do Bloco B'],
    ['patio-mastro', 'Observando o pátio'],
    ['quadra-aprox-1', 'Observando a quadra'],
    ['portao-dentro', 'Observando o portão'],
  ];
  const rondaDiretora: PontoRonda[] = [];
  for (const [id, rotulo] of rondaIds) {
    const idx = getNodeIndex(id);
    if (idx >= 0) rondaDiretora.push({ idx, rotulo });
  }

  const rua: number[] = [];
  for (let i = 0; i < 12; i++) rua.push(getNodeIndex(`rua-${i}`));

  return {
    salaCentro,
    refeitorioCentro: getNodeIndex('refeitorio-centro'),
    secretariaCentro: getNodeIndex('secretaria-centro'),
    diretoriaCentro: getNodeIndex('diretoria-centro'),
    profCentro: getNodeIndex('sala-professores-centro'),
    guaritaInt: getNodeIndex('guarita-int'),
    quadraInt: getNodeIndex('quadra-portao-int'),
    portaoDentro: getNodeIndex('portao-dentro'),
    portaoAprox2: getNodeIndex('portao-aprox-2'),
    guaritaAprox: getNodeIndex('guarita-aprox'),
    rua,
    patio,
    rondaDiretora,
    faxPatio,
    faxCorredor,
  };
}

function nos(): NosPre {
  if (!NOS) NOS = construirNos();
  return NOS;
}

// ---------------------------------------------------------------------------
// Aplicação da tarefa
// ---------------------------------------------------------------------------

function aplicarTarefa(_m: Mundo, a: Agente, t: Tarefa): void {
  a.destino = t.destino;
  a.via.length = 0;
  for (const v of t.via) a.via.push(v);
  a.viaIdx = 0;
  a.velocidade = t.velocidade;
  a.correr = t.correr;
  a.anim = t.anim;
  a.face = t.face;
  a.parceiroTalk = t.parceiro;
  a.modo = t.modo;
  a.faseFinal = t.faseFinal;
  a.tempoRestante = t.duracao;
  a.atvDeslocando = t.atvDeslocando;
  a.atvAcao = t.atvAcao;
  a.atividade = t.atvDeslocando;
  a.semProgresso = 0;
  a.ultimaDist = Infinity;
  a.pathIdx = 0;

  const pos: Vec3 = [a.x, a.y, a.z];
  if (t.destino && pernaDiretaLivre(pos, t.destino)) {
    // Perna direta: mesmo cômodo/área aberta com linha livre — dispensa
    // grafo E via points (manter o via aqui faria o agente desviar até um
    // ponto intermediário possivelmente atrás de uma parede/balcão).
    a.path.length = 0;
    a.via.length = 0;
    a.nodeAlvo = -1;
  } else {
    a.nodeAlvo = t.nodeAlvo;
    a.path = planejarRota(pos, andarDe(a.y), t.nodeAlvo);
    if (t.nodeAlvo >= 0 && a.path.length === 0 && a.via.length === 0) {
      // Segurança: sem rota, executa a ação onde está (não atravessa parede).
      a.destino = null;
    }
  }
  a.fase = 'indo';
}

// ---------------------------------------------------------------------------
// Utilidades de ocupação
// ---------------------------------------------------------------------------

/** Reserva o primeiro slot livre (marca 1) ou retorna −1. */
function reservarSlot(arr: Int8Array): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) {
      arr[i] = 1;
      return i;
    }
  }
  return -1;
}

/**
 * Posição da q-ésima posição da fila da cantina (0 = sendo atendido).
 * Os 8 primeiros usam os filaSlots do contrato (da frente para trás);
 * excedentes ficam atrás do último slot, no mesmo corredor da fila.
 */
export function slotPosFila(q: number, out: Vec3): Vec3 {
  if (q <= 7) {
    const s = REFEITORIO.filaSlots[7 - q];
    out[0] = s[0];
    out[1] = 0;
    // Clamp: o slot da ponta (z=17,05) ficaria dentro do AABB do balcão.
    out[2] = Math.min(s[2], 16.7);
  } else {
    // Excedente além dos 8 slots (não ocorre: a fila é limitada a 8) —
    // mantido com clamp dentro do refeitório por segurança.
    out[0] = -24;
    out[1] = 0;
    out[2] = Math.max(13.9 - (q - 7) * 0.45, 13.4);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Atividades compartilhadas (pátio, cantina, saída)
// ---------------------------------------------------------------------------

/** Conversar numa roda do pátio (reserva slot; fallback: banco → vagar). */
function conversarNoPatio(m: Mundo, a: Agente): void {
  const slot = reservarSlot(m.rodas);
  if (slot < 0) {
    sentarBanco(m, a);
    return;
  }
  a.rodaRef = slot;
  const centro = PATIO.rodaConversa[Math.floor(slot / 6)];
  const ang = ((slot % 6) / 6) * Math.PI * 2;
  const destino: Vec3 = [
    centro[0] + Math.cos(ang) * 1.15,
    0,
    centro[2] + Math.sin(ang) * 1.15,
  ];
  aplicarTarefa(m, a, {
    nodeAlvo: nearestNode(destino, 0),
    destino,
    via: [],
    faseFinal: 'conversando',
    anim: 'talk',
    duracao: faixa(m.rng, 10, 30),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: centro,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Indo conversar no pátio',
    atvAcao: 'Conversando no pátio',
  });
}

/** Sentar num banco do pátio (reserva lugar; fallback: vagar). */
function sentarBanco(m: Mundo, a: Agente): void {
  const slot = reservarSlot(m.bancos);
  if (slot < 0) {
    vagarPatio(m, a);
    return;
  }
  a.bancoRef = slot;
  const banco = PATIO.bancos[Math.floor(slot / 3)];
  const lugar = banco.lugares[slot % 3];
  // Bancos ao norte (z<0) olham para o centro do pátio (+Z) e vice-versa.
  const face: Vec3 = [lugar[0], 0, lugar[2] + (banco.pos[2] < -2 ? 3 : -3)];
  aplicarTarefa(m, a, {
    nodeAlvo: nearestNode(lugar, 0),
    destino: lugar,
    via: [],
    faseFinal: 'fazendo',
    anim: 'sit',
    duracao: faixa(m.rng, 30, 80),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Indo sentar no banco do pátio',
    atvAcao: 'Descansando no banco do pátio',
  });
}

/** Passeio sem destino fixo por um nó do pátio (alguns correndo). */
function vagarPatio(m: Mundo, a: Agente): void {
  const lista = nos().patio;
  const alvo = lista[Math.floor(m.rng() * lista.length)];
  const correr = m.rng() < 0.35;
  aplicarTarefa(m, a, {
    nodeAlvo: alvo,
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: 'idle',
    duracao: faixa(m.rng, 10, 25),
    velocidade: correr ? CONST.VEL_CORRER : CONST.VEL_ANDAR,
    correr,
    face: null,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Passeando pelo pátio',
    atvAcao: 'Observando o movimento no pátio',
  });
}

/** Entrar na fila da cantina (modo contínuo 'fila'; avança sozinho). */
function entrarNaFila(m: Mundo, a: Agente): void {
  if (m.filaRefeitorio.length >= REFEITORIO.filaSlots.length) {
    // Fila cheia (8 slots): desiste — no almoço, decide sair direto depois
    // de conversar. (Além dos 8 slots a fila invadiria a parede z=13.)
    if (m.periodo === 'ALMOCO_SAIDA') a.vaiSair = true;
    conversarNoPatio(m, a);
    return;
  }
  m.filaRefeitorio.push(a.indice);
  a.memoria = 0; // 0 = ainda não começou atendimento na ponta
  const destino: Vec3 = [0, 0, 0];
  slotPosFila(m.filaRefeitorio.length - 1, destino);
  aplicarTarefa(m, a, {
    nodeAlvo: nos().refeitorioCentro,
    destino,
    via: [],
    faseFinal: 'fazendo',
    anim: 'idle',
    duracao: 9999,
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: [-24, 0, 20], // olha o balcão (+Z)
    parceiro: -1,
    modo: 'fila',
    atvDeslocando: 'Indo à cantina',
    atvAcao: 'Na fila da cantina',
  });
}

/**
 * Após ser atendido: reserva um lugar na mesa do refeitório e vai comer.
 * Sem lugar livre: desiste (marca `comeu` para seguir o fluxo do período).
 */
export function atribuirTarefaComer(m: Mundo, a: Agente): void {
  a.comeu = true;
  const slot = reservarSlot(m.lugaresRefeitorio);
  if (slot < 0) {
    a.modo = 'nenhum';
    a.fase = 'fazendo';
    a.tempoRestante = 0;
    a.atividade = 'Procurando lugar no refeitório';
    return;
  }
  a.lugarRef = slot;
  const mesa = REFEITORIO.mesas[Math.floor(slot / 6)];
  const lugar = mesa.lugares[slot % 6];
  const almoco = m.periodo === 'ALMOCO_SAIDA';
  aplicarTarefa(m, a, {
    nodeAlvo: nos().refeitorioCentro,
    destino: lugar,
    via: [],
    faseFinal: 'fazendo',
    anim: 'eat',
    duracao: almoco ? faixa(m.rng, 60, 100) : faixa(m.rng, 30, 60),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: mesa.pos,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Levando a bandeja à mesa',
    atvAcao: almoco ? 'Almoçando no refeitório' : 'Lanchando no refeitório',
  });
}

/** Sair da escola: portão → ponto de spawn na rua (fica lá até o wrap). */
function sairDaEscola(m: Mundo, a: Agente): void {
  a.saiu = true;
  aplicarTarefa(m, a, {
    nodeAlvo: nos().rua[a.ruaNode],
    destino: a.spawnPos,
    via: [],
    faseFinal: 'fazendo',
    anim: 'idle',
    duracao: 9999,
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: PORTARIA.portao.pos,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Saindo da escola',
    atvAcao: 'Na rua, após a saída',
  });
}

/** Já na rua após a saída: espera ociosa (idle/talk) até o wrap do dia. */
function ficarNaRua(m: Mundo, a: Agente): void {
  aplicarTarefa(m, a, {
    nodeAlvo: -1,
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: m.rng() < 0.3 ? 'talk' : 'idle',
    duracao: faixa(m.rng, 20, 40),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: PORTARIA.portao.pos,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Na rua, após a saída',
    atvAcao: 'Na rua, após a saída',
  });
}

/** Espera na rua o horário de entrada (CHEGADA escalonada, em grupos). */
function esperarNaRua(m: Mundo, a: Agente): void {
  // Tenta parear com um colega do mesmo grupo que também está esperando.
  let parceiro = -1;
  if (a.grupoChegada >= 0) {
    for (const j of m.gruposChegada[a.grupoChegada]) {
      if (j === a.indice) continue;
      const o = m.agentes[j];
      if (!o.entrouHoje && o.parceiroTalk < 0 && o.fase !== 'indo' && o.modo === 'nenhum') {
        parceiro = j;
        o.parceiroTalk = a.indice;
        o.anim = 'talk';
        break;
      }
    }
  }
  aplicarTarefa(m, a, {
    nodeAlvo: -1,
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: parceiro >= 0 ? 'talk' : 'idle',
    duracao: faixa(m.rng, 15, 25),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: PORTARIA.portao.pos,
    parceiro,
    modo: 'nenhum',
    atvDeslocando: 'Aguardando na rua para entrar',
    atvAcao: 'Aguardando na rua para entrar',
  });
}

// ---------------------------------------------------------------------------
// ALUNO
// ---------------------------------------------------------------------------

function planoAluno(m: Mundo, a: Agente, info: PersonagemInfo): void {
  const periodo = m.periodo;

  if (periodo === 'CHEGADA') {
    if (!a.entrouHoje) {
      if (m.clockMin < a.minutoEntrada) {
        esperarNaRua(m, a);
        return;
      }
      a.entrouHoje = true;
      conversarNoPatio(m, a);
      return;
    }
    const r = m.rng();
    if (r < 0.5) conversarNoPatio(m, a);
    else if (r < 0.8) sentarBanco(m, a);
    else vagarPatio(m, a);
    return;
  }

  if (periodo === 'AULA_1' || periodo === 'AULA_2') {
    irParaCarteira(m, a, info);
    return;
  }

  if (periodo === 'RECREIO') {
    const r = m.rng();
    if (r < 0.3) jogarBola(m, a);
    else if (r < 0.7) conversarNoPatio(m, a);
    else if (r < 0.9 && !a.comeu) entrarNaFila(m, a);
    else vagarPatio(m, a);
    return;
  }

  // ALMOCO_SAIDA: ~60% almoça e depois sai; ~40% sai direto.
  if (a.saiu) {
    ficarNaRua(m, a);
    return;
  }
  if (!a.comeu && !a.vaiSair) a.vaiSair = m.rng() < 0.4;
  if (!a.comeu && !a.vaiSair) {
    entrarNaFila(m, a);
    return;
  }
  sairDaEscola(m, a);
}

/** AULA: vai à carteira fixa e senta (80%) ou senta inquieto (20%, por aula). */
function irParaCarteira(m: Mundo, a: Agente, info: PersonagemInfo): void {
  const salaId = info.salaId ?? 'sala-1';
  const sala = getSala(salaId);
  const assento = a.assentoFixo ?? CARTEIRAS[salaId][0];
  const inquieto = m.rng() < 0.2;
  aplicarTarefa(m, a, {
    nodeAlvo: nos().salaCentro.get(salaId) ?? -1,
    destino: assento,
    via: [],
    faseFinal: 'fazendo',
    anim: inquieto ? 'sitFidget' : 'sit',
    duracao: 9999,
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: QUADROS[salaId].pos,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: `Indo para a ${sala.nome}`,
    atvAcao: `Assistindo à aula na ${sala.nome}`,
  });
}

/** RECREIO: ir à quadra e perseguir a bola (modo contínuo 'bola'). */
function jogarBola(m: Mundo, a: Agente): void {
  aplicarTarefa(m, a, {
    nodeAlvo: nos().quadraInt,
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: 'playBall',
    duracao: faixa(m.rng, 45, 90),
    velocidade: CONST.VEL_CORRER,
    correr: true,
    face: null,
    parceiro: -1,
    modo: 'bola',
    atvDeslocando: 'Indo jogar bola na quadra',
    atvAcao: 'Jogando bola na quadra',
  });
}

// ---------------------------------------------------------------------------
// PROFESSOR
// ---------------------------------------------------------------------------

function planoProfessor(m: Mundo, a: Agente, info: PersonagemInfo): void {
  const periodo = m.periodo;

  if (periodo === 'CHEGADA') {
    if (!a.entrouHoje) {
      if (m.clockMin < a.minutoEntrada) {
        esperarNaRua(m, a);
        return;
      }
      a.entrouHoje = true;
    }
    if (m.rng() < 0.7) salaDosProfessores(m, a);
    else conversarNoPatio(m, a);
    return;
  }

  if (periodo === 'AULA_1' || periodo === 'AULA_2') {
    cicloAula(m, a, info);
    return;
  }

  if (periodo === 'RECREIO') {
    salaDosProfessores(m, a);
    return;
  }

  // ALMOCO_SAIDA: metade sai direto, metade almoça antes.
  if (a.saiu) {
    ficarNaRua(m, a);
    return;
  }
  if (!a.comeu && !a.vaiSair) a.vaiSair = m.rng() < 0.5;
  if (!a.comeu && !a.vaiSair) {
    entrarNaFila(m, a);
    return;
  }
  sairDaEscola(m, a);
}

/** AULA: cicla escrever no quadro (~30–60 s) ↔ falar junto à mesa (~25–45 s). */
function cicloAula(m: Mundo, a: Agente, info: PersonagemInfo): void {
  const salaId = info.salaId ?? 'sala-1';
  const sala = getSala(salaId);
  const cx = sala.rect.x + sala.rect.w / 2;
  const y = sala.andar * CONST.ALTURA_PISO;
  a.alterna = !a.alterna;
  const materia = info.materia ?? 'Aula';

  if (a.alterna) {
    aplicarTarefa(m, a, {
      nodeAlvo: nos().salaCentro.get(salaId) ?? -1,
      destino: [cx + 0.6, y, -31.2],
      via: [],
      faseFinal: 'fazendo',
      anim: 'write',
      duracao: faixa(m.rng, 30, 60),
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: QUADROS[salaId].pos,
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: `Indo para a ${sala.nome}`,
      atvAcao: `Escrevendo no quadro da ${sala.nome}`,
    });
  } else {
    aplicarTarefa(m, a, {
      nodeAlvo: nos().salaCentro.get(salaId) ?? -1,
      destino: [cx - 0.9, y, -30.0],
      via: [],
      faseFinal: 'fazendo',
      anim: 'talk',
      duracao: faixa(m.rng, 25, 45),
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: [cx, y, -26.5], // de frente para a turma
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: `Indo para a ${sala.nome}`,
      atvAcao: `Dando aula de ${materia} na ${sala.nome}`,
    });
  }
}

/** Sala dos professores: come, conversa ou descansa numa das mesas. */
function salaDosProfessores(m: Mundo, a: Agente): void {
  const slot = reservarSlot(m.profMesas);
  if (slot < 0) {
    conversarNoPatio(m, a);
    return;
  }
  a.profMesaRef = slot;
  const mesa = ADMIN.profMesas[Math.floor(slot / 2)];
  const destino: Vec3 = [mesa[0] + (slot % 2 === 0 ? -0.75 : 0.75), 0, mesa[2]];
  const r = m.rng();
  const anim: AnimState = r < 0.4 ? 'eat' : r < 0.75 ? 'talk' : 'sit';
  const acao =
    anim === 'eat'
      ? 'Lanchando na sala dos professores'
      : anim === 'talk'
        ? 'Conversando na sala dos professores'
        : 'Descansando na sala dos professores';
  aplicarTarefa(m, a, {
    nodeAlvo: nos().profCentro,
    destino,
    via: [],
    faseFinal: 'fazendo',
    anim,
    duracao: faixa(m.rng, 40, 90),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: mesa,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Indo à sala dos professores',
    atvAcao: acao,
  });
}

// ---------------------------------------------------------------------------
// DIRETORA
// ---------------------------------------------------------------------------

function planoDiretora(m: Mundo, a: Agente): void {
  if (m.periodo === 'ALMOCO_SAIDA') {
    aplicarTarefa(m, a, {
      nodeAlvo: nos().diretoriaCentro,
      destino: [9, 0, 18.2],
      via: [],
      faseFinal: 'fazendo',
      anim: 'sit',
      duracao: 9999,
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: [9, 0, 13], // de frente para a porta
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: 'Indo à diretoria',
      atvAcao: 'Na diretoria',
    });
    return;
  }
  // Ronda contínua pelos corredores/varandas dos dois andares e o pátio.
  const ronda = nos().rondaDiretora;
  const idx = Math.floor(a.memoria) % ronda.length;
  a.memoria = idx + 1;
  const ponto = ronda[idx];
  aplicarTarefa(m, a, {
    nodeAlvo: ponto.idx,
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: 'idle',
    duracao: faixa(m.rng, 15, 40),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: null,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Rondando a escola',
    atvAcao: ponto.rotulo,
  });
}

// ---------------------------------------------------------------------------
// SECRETÁRIO
// ---------------------------------------------------------------------------

function planoSecretario(m: Mundo, a: Agente): void {
  // 1–2 saídas por período (~8% por nova tarefa): levar papel à diretoria.
  if (m.rng() < 0.08) {
    aplicarTarefa(m, a, {
      nodeAlvo: nos().diretoriaCentro,
      destino: [8.2, 0, 16.6],
      via: [],
      faseFinal: 'fazendo',
      anim: 'talk',
      duracao: faixa(m.rng, 20, 30),
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: ADMIN.diretoriaMesa,
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: 'Levando documentos à diretoria',
      atvAcao: 'Conversando com a diretora',
    });
    return;
  }
  const escrevendo = m.rng() < 0.45;
  aplicarTarefa(m, a, {
    nodeAlvo: nos().secretariaCentro,
    destino: [1, 0, 16.8],
    via: [],
    faseFinal: 'fazendo',
    anim: escrevendo ? 'write' : 'sit',
    duracao: faixa(m.rng, 40, 90),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: [1, 0, 13], // de frente para o guichê
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Indo à secretaria',
    atvAcao: escrevendo ? 'Organizando documentos na secretaria' : 'Atendendo na secretaria',
  });
}

// ---------------------------------------------------------------------------
// COZINHEIRAS (2)
// ---------------------------------------------------------------------------

/** Contorno do balcão pela passagem x −14…−12 (único acesso à cozinha). */
const VIA_BALCAO: Vec3[] = [
  [-12.5, 0, 16.5],
  [-12.5, 0, 17.6],
];

function planoCozinheira(m: Mundo, a: Agente): void {
  const spot = REFEITORIO.balcao[a.indice === 74 ? 1 : 3];
  const servindo = m.periodo === 'RECREIO' || m.periodo === 'ALMOCO_SAIDA';

  if (servindo) {
    aplicarTarefa(m, a, {
      nodeAlvo: nos().refeitorioCentro,
      destino: spot,
      via: VIA_BALCAO,
      faseFinal: 'fazendo',
      anim: 'idle',
      duracao: 9999,
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: [spot[0], 0, 14], // virada para a fila
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: 'Indo ao balcão da cantina',
      atvAcao: 'Servindo merenda',
    });
    return;
  }

  a.alterna = !a.alterna;
  if (a.alterna) {
    const parceira = a.indice === 74 ? 75 : 74;
    const outra = m.agentes[parceira];
    aplicarTarefa(m, a, {
      nodeAlvo: nos().refeitorioCentro,
      destino: spot,
      via: VIA_BALCAO,
      faseFinal: 'fazendo',
      anim: 'talk',
      duracao: faixa(m.rng, 25, 50),
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: [outra.x, 0, outra.z],
      parceiro: parceira,
      modo: 'nenhum',
      atvDeslocando: 'Indo à cozinha',
      atvAcao: 'Conversando na cozinha',
    });
  } else {
    aplicarTarefa(m, a, {
      nodeAlvo: nos().refeitorioCentro,
      destino: spot,
      via: VIA_BALCAO,
      faseFinal: 'fazendo',
      anim: 'idle',
      duracao: faixa(m.rng, 20, 40),
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: [spot[0], 0, 19.5], // virada para a bancada da cozinha
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: 'Indo à cozinha',
      atvAcao: 'Preparando a merenda',
    });
  }
}

// ---------------------------------------------------------------------------
// FAXINEIROS (2) — áreas diferentes: 76 = pátio; 77 = corredores térreos
// ---------------------------------------------------------------------------

function planoFaxineiro(m: Mundo, a: Agente): void {
  const noPatio = a.indice === 76;
  const lista = noPatio ? nos().faxPatio : nos().faxCorredor;
  const idx = Math.floor(a.memoria) % lista.length;
  a.memoria = idx + 1;
  const onde = noPatio ? 'o pátio' : 'o corredor';
  aplicarTarefa(m, a, {
    nodeAlvo: lista[idx],
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: 'sweep',
    duracao: faixa(m.rng, 30, 60),
    velocidade: CONST.VEL_PASSEIO, // caminhada lenta entre os pontos
    correr: false,
    face: null,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: `Indo varrer ${onde}`,
    atvAcao: `Varrendo ${onde}`,
  });
}

// ---------------------------------------------------------------------------
// PORTEIRO — guarita/portão; nunca sai do posto por muito tempo
// ---------------------------------------------------------------------------

function planoPorteiro(m: Mundo, a: Agente): void {
  const n = nos();
  if (m.rng() < 0.65) {
    aplicarTarefa(m, a, {
      nodeAlvo: n.guaritaInt,
      destino: PORTARIA.porteiroPos,
      via: [],
      faseFinal: 'fazendo',
      anim: 'idle',
      duracao: faixa(m.rng, 40, 90),
      velocidade: CONST.VEL_ANDAR,
      correr: false,
      face: PORTARIA.portao.pos,
      parceiro: -1,
      modo: 'nenhum',
      atvDeslocando: 'Voltando à guarita',
      atvAcao: 'No portão',
    });
    return;
  }
  // Pequena caminhada de ronda ao redor do portão.
  const opcoes = [n.portaoDentro, n.portaoAprox2, n.guaritaAprox];
  const alvo = opcoes[Math.floor(m.rng() * opcoes.length)];
  aplicarTarefa(m, a, {
    nodeAlvo: alvo,
    destino: null,
    via: [],
    faseFinal: 'fazendo',
    anim: 'idle',
    duracao: faixa(m.rng, 10, 25),
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    face: PORTARIA.portao.pos,
    parceiro: -1,
    modo: 'nenhum',
    atvDeslocando: 'Vistoriando o portão',
    atvAcao: 'Vistoriando o portão',
  });
}

// ---------------------------------------------------------------------------
// Despachante principal
// ---------------------------------------------------------------------------

/**
 * Escolhe e aplica a próxima tarefa do agente conforme papel × período.
 * Libera antes todos os recursos disputados (lugares, fila, parceiro).
 */
export function atribuirProximaTarefa(m: Mundo, a: Agente): void {
  liberarTudo(m, a);
  const info = ROSTER[a.indice];
  switch (info.papel) {
    case 'ALUNO':
      planoAluno(m, a, info);
      return;
    case 'PROFESSOR':
      planoProfessor(m, a, info);
      return;
    case 'DIRETORA':
      planoDiretora(m, a);
      return;
    case 'SECRETARIO':
      planoSecretario(m, a);
      return;
    case 'COZINHEIRA':
      planoCozinheira(m, a);
      return;
    case 'FAXINEIRO':
      planoFaxineiro(m, a);
      return;
    case 'PORTEIRO':
      planoPorteiro(m, a);
      return;
  }
}

/**
 * Troca de período: interrompe TODOS os agentes (libera lugares, esvazia a
 * fila, cancela conversas) e força replanejamento no próximo frame.
 * Também posiciona a bola (centro da quadra, ativa só no RECREIO).
 */
export function aoMudarPeriodo(m: Mundo, periodo: Periodo): void {
  m.periodo = periodo;
  m.filaRefeitorio.length = 0;
  for (const a of m.agentes) {
    liberarTudo(m, a);
    a.fase = 'fazendo';
    a.tempoRestante = 0;
    a.path.length = 0;
    a.pathIdx = 0;
    a.via.length = 0;
    a.viaIdx = 0;
    a.destino = null;
    a.nodeAlvo = -1;
    a.comeu = false;
    a.vaiSair = false;
    a.cooldownChute = 0;
  }
  m.bola.ativa = periodo === 'RECREIO';
  resetBola(m.bola);
}
