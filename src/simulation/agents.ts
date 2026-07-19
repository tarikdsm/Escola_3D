/**
 * agents.ts — LOOP POR FRAME dos 79 agentes.
 *
 * Máquina de estados por agente:
 * - 'indo': segue path (nós do grafo) → via (pontos off-graph) → destino
 *   (ponto exato). A posição interpola linearmente entre waypoints — como
 *   os nós das escadas já carregam y, subir/descer funciona sozinho.
 *   Repath: sem progresso por > 3 s de jogo → replaneja do nó mais próximo.
 * - 'fazendo': executa a animação da tarefa até o timer acabar; os modos
 *   contínuos 'bola' (perseguir/chutar) e 'fila' (avançar na cantina) têm
 *   movimentação própria aqui dentro.
 * - 'conversando': talk com parceiro da roda (talkTarget mútuo, facing ao
 *   parceiro); ao acabar, desfaz a parceria dos dois lados.
 *
 * Ao final de cada frame, `escreverAgente` copia pos/facing/anim/phase/
 * speed/talkTarget aos buffers SIM (lidos pelo render dos personagens).
 */

import { CONST } from '../contracts/layout';
import {
  setAnim,
  setFacing,
  setPhase,
  setPosicao,
  setSpeed,
  setTalkTarget,
} from '../contracts/simBuffer';
import type { AnimState, Vec3 } from '../contracts/types';
import { WAYPOINTS } from '../contracts/waypoints';
import { chutarBola } from './ball';
import { atribuirProximaTarefa, atribuirTarefaComer, slotPosFila } from './behaviors';
import type { Agente, Mundo } from './estado';
import { andarDe, planejarRota } from './navigation';
import { faixa } from './rng';

/** Ciclos de animação por segundo de jogo (alimenta SIM.phase). */
const FASE_FATOR: Record<AnimState, number> = {
  idle: 0.25,
  walk: 1.1,
  run: 1.6,
  sit: 0.12,
  sitFidget: 0.6,
  write: 0.8,
  talk: 0.7,
  eat: 0.6,
  sweep: 0.9,
  playBall: 1.3,
};

/** Scratch para posições da fila (zero alocação no loop). */
const TMP_SLOT: Vec3 = [0, 0, 0];

// ---------------------------------------------------------------------------
// Movimento
// ---------------------------------------------------------------------------

/** Ponto-alvo do segmento atual (nó do grafo → via → destino). */
function alvoDoSegmento(a: Agente): Vec3 | null {
  if (a.pathIdx < a.path.length) return WAYPOINTS[a.path[a.pathIdx]].pos;
  if (a.viaIdx < a.via.length) return a.via[a.viaIdx];
  return a.destino;
}

/**
 * Avança um passo ao longo da rota. Retorna true quando chega ao ponto
 * final da tarefa (ou quando não há para onde ir).
 *
 * Tolerâncias anti-travamento (multidão + separação podem impedir o
 * encaixe exato no ponto):
 * - chegada "normal" a ≤ 0,1 m do nó / ≤ 0,15 m do destino;
 * - ESTOL: sem progresso por > 3 s de jogo E já perto — nó/via a < 0,6 m
 *   é pulado (sem encaixar); destino a < 0,9 m considera-se alcançado
 *   (executa a ação onde está). Longe do alvo, o repath (agents.ts) assume.
 */
function passoMovimento(a: Agente, dtJogo: number): boolean {
  const alvo = alvoDoSegmento(a);
  if (!alvo) return true;
  const dx = alvo[0] - a.x;
  const dy = alvo[1] - a.y;
  const dz = alvo[2] - a.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const passo = a.velocidade * dtJogo;
  a.anguloAlvo = Math.atan2(dx, dz);

  const noGrafo = a.pathIdx < a.path.length;
  const naVia = !noGrafo && a.viaIdx < a.via.length;
  const ehDestinoFinal = !noGrafo && !naVia;

  // Rastreia progresso em QUALQUER segmento (repath usa semProgresso).
  if (d < a.ultimaDist - 0.02) a.semProgresso = 0;
  else a.semProgresso += dtJogo;
  a.ultimaDist = d;

  const raio = ehDestinoFinal ? 0.15 : 0.1;
  if (d <= Math.max(passo, raio)) {
    // Chegou ao segmento: encaixa e avança para o próximo.
    a.x = alvo[0];
    a.y = alvo[1];
    a.z = alvo[2];
    if (noGrafo) a.pathIdx++;
    else if (naVia) a.viaIdx++;
    else return true; // era o destino final
    a.semProgresso = 0;
    a.ultimaDist = Infinity;
    return a.pathIdx >= a.path.length && a.viaIdx >= a.via.length && a.destino === null;
  }

  // Estol perto do alvo (bloqueado pela multidão): resolve sem encaixar.
  if (a.semProgresso > 3) {
    if (ehDestinoFinal) {
      if (d < 0.9) return true; // perto o bastante: executa a ação aqui
    } else if (d < 0.6) {
      if (noGrafo) a.pathIdx++;
      else a.viaIdx++;
      a.semProgresso = 0;
      a.ultimaDist = Infinity;
      return a.pathIdx >= a.path.length && a.viaIdx >= a.via.length && a.destino === null;
    }
  }

  a.x += (dx / d) * passo;
  a.y += (dy / d) * passo;
  a.z += (dz / d) * passo;
  return false;
}

/**
 * Move no plano XZ em direção a (tx, tz) — usado pelos modos 'bola' e 'fila'.
 * Retorna true quando já está perto o bastante (< 0,12 m).
 */
function moverPlano(a: Agente, tx: number, tz: number, vel: number, dtJogo: number): boolean {
  const dx = tx - a.x;
  const dz = tz - a.z;
  const d = Math.hypot(dx, dz);
  if (d <= 0.12) return true;
  a.anguloAlvo = Math.atan2(dx, dz);
  const passo = Math.min(vel * dtJogo, d);
  a.x += (dx / d) * passo;
  a.z += (dz / d) * passo;
  return false;
}

/**
 * Repath se ficou > 3 s de jogo sem progresso no grafo (o estol PERTO do
 * nó já é resolvido em passoMovimento; aqui é o caso "longe e travado").
 */
function verificarRepath(a: Agente): void {
  if (a.nodeAlvo < 0) return; // perna direta: nada a replanejar
  if (a.pathIdx >= a.path.length) return; // já saiu do grafo (via/destino)
  if (a.semProgresso <= 3) return;
  a.path = planejarRota([a.x, a.y, a.z], andarDe(a.y), a.nodeAlvo);
  a.pathIdx = 0;
  a.semProgresso = 0;
  a.ultimaDist = Infinity;
}

// ---------------------------------------------------------------------------
// Modos contínuos
// ---------------------------------------------------------------------------

/** Persegue a bola na quadra; a < 0,7 m chuta (com cooldown). */
function atualizarModoBola(m: Mundo, a: Agente, dtJogo: number): void {
  const b = m.bola;
  if (!b.ativa) return;
  const dx = b.pos[0] - a.x;
  const dz = b.pos[2] - a.z;
  const d = Math.hypot(dx, dz);
  a.anim = 'playBall';
  if (d > 0.7) {
    moverPlano(a, b.pos[0], b.pos[2], CONST.VEL_CORRER, dtJogo);
    a.velAtual = CONST.VEL_CORRER;
    return;
  }
  a.anguloAlvo = Math.atan2(dx, dz);
  if (a.cooldownChute <= 0) {
    chutarBola(b, m.rng);
    a.cooldownChute = 1.2;
  }
}

/**
 * Avança na fila da cantina conforme as posições vagam; na ponta, aguarda
 * o atendimento (8–15 s de jogo) e sai para comer. Retorna true se a
 * tarefa foi trocada dentro do handler (saiu da fila para comer).
 */
function atualizarModoFila(m: Mundo, a: Agente, dtJogo: number): boolean {
  const q = m.filaRefeitorio.indexOf(a.indice);
  if (q < 0) {
    a.modo = 'nenhum';
    a.tempoRestante = 0;
    return false;
  }
  slotPosFila(q, TMP_SLOT);
  const chegou = moverPlano(a, TMP_SLOT[0], TMP_SLOT[2], CONST.VEL_ANDAR, dtJogo);
  if (!chegou) {
    a.anim = 'walk';
    a.velAtual = CONST.VEL_ANDAR;
    return false;
  }
  a.anim = 'idle';
  a.velAtual = 0;
  a.anguloAlvo = 0; // de frente para o balcão (+Z)
  if (q === 0) {
    if (a.memoria === 0) {
      a.memoria = 1;
      a.tempoRestante = faixa(m.rng, 8, 15);
      a.atividade = 'Sendo servido na cantina';
    } else if (a.tempoRestante <= dtJogo) {
      m.filaRefeitorio.shift();
      a.memoria = 0;
      a.modo = 'nenhum';
      atribuirTarefaComer(m, a);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Transições de estado
// ---------------------------------------------------------------------------

/** Chegada ao destino: assume a fase final da tarefa e pareia conversas. */
function iniciarAcao(m: Mundo, a: Agente): void {
  a.fase = a.faseFinal;
  a.velAtual = 0;
  a.atividade = a.atvAcao;
  if (a.faseFinal === 'conversando') {
    parearNaRoda(m, a);
  } else if (a.anim === 'talk' && a.profMesaRef >= 0) {
    parearNaMesaProf(m, a);
  }
}

/** Pareia o agente com outro ocupante livre da mesma roda de conversa. */
function parearNaRoda(m: Mundo, a: Agente): void {
  if (a.rodaRef < 0) return;
  const roda = Math.floor(a.rodaRef / 6);
  for (const o of m.agentes) {
    if (o.indice === a.indice || o.rodaRef < 0) continue;
    if (Math.floor(o.rodaRef / 6) !== roda) continue;
    if (o.fase !== 'conversando' || o.parceiroTalk >= 0) continue;
    o.parceiroTalk = a.indice;
    a.parceiroTalk = o.indice;
    return;
  }
}

/** Pareia professores conversando na mesma mesa da sala dos professores. */
function parearNaMesaProf(m: Mundo, a: Agente): void {
  const mesa = Math.floor(a.profMesaRef / 2);
  for (const o of m.agentes) {
    if (o.indice === a.indice || o.profMesaRef < 0) continue;
    if (Math.floor(o.profMesaRef / 2) !== mesa) continue;
    if (o.fase !== 'fazendo' || o.anim !== 'talk' || o.parceiroTalk >= 0) continue;
    o.parceiroTalk = a.indice;
    a.parceiroTalk = o.indice;
    return;
  }
}

/** Fim da ação: desfaz parceria de conversa (dos dois lados) e o modo. */
function terminarAcao(m: Mundo, a: Agente): void {
  if (a.parceiroTalk >= 0) {
    const o = m.agentes[a.parceiroTalk];
    if (o.parceiroTalk === a.indice) o.parceiroTalk = -1;
    a.parceiroTalk = -1;
  }
  a.modo = 'nenhum';
}

// ---------------------------------------------------------------------------
// Atualização principal
// ---------------------------------------------------------------------------

/** Avança a máquina de estados do agente em um frame (`dtJogo` em s de jogo). */
export function atualizarAgente(m: Mundo, a: Agente, dtJogo: number): void {
  a.velAtual = 0;
  if (a.cooldownChute > 0) a.cooldownChute -= dtJogo;

  if (a.fase === 'indo') {
    if (passoMovimento(a, dtJogo)) {
      iniciarAcao(m, a);
      return;
    }
    a.velAtual = a.velocidade;
    verificarRepath(a);
    return;
  }

  // 'fazendo' / 'conversando'
  if (a.modo === 'bola') {
    atualizarModoBola(m, a, dtJogo);
  } else if (a.modo === 'fila') {
    if (atualizarModoFila(m, a, dtJogo)) return; // saiu da fila para comer
  }

  a.tempoRestante -= dtJogo;
  if (a.tempoRestante > 0 || a.modo === 'fila') return; // fila espera a vez
  terminarAcao(m, a);
  atribuirProximaTarefa(m, a);
}

/**
 * Copia o estado do agente aos buffers SIM (1× por frame, após o movimento
 * e a separação). Facing interpola suavemente até o ângulo-alvo: direção
 * do movimento ao andar; quadro/interlocutor/balcão quando parado.
 */
export function escreverAgente(m: Mundo, a: Agente, dtJogo: number, dtReal: number): void {
  let alvo = a.anguloAlvo;
  if (a.fase !== 'indo') {
    if (a.parceiroTalk >= 0) {
      const p = m.agentes[a.parceiroTalk];
      alvo = Math.atan2(p.x - a.x, p.z - a.z);
    } else if (a.face) {
      alvo = Math.atan2(a.face[0] - a.x, a.face[2] - a.z);
    }
  }
  let d = (alvo - a.angulo) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  a.angulo += d * Math.min(1, dtReal * 8);

  const anim: AnimState = a.fase === 'indo' ? (a.correr ? 'run' : 'walk') : a.anim;
  a.faseAnim = (a.faseAnim + dtJogo * FASE_FATOR[anim]) % 1;

  const i = a.indice;
  setPosicao(i, a.x, a.y, a.z);
  setFacing(i, a.angulo);
  setAnim(i, anim);
  setPhase(i, a.faseAnim);
  setSpeed(i, a.velAtual);
  setTalkTarget(i, a.parceiroTalk);
}
