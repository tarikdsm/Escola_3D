/**
 * simBuffer.ts — BUFFERS MUTÁVEIS da simulação, FORA do React.
 *
 * A simulação escreve aqui 60×/s e o render lê no mesmo ritmo; NADA disto
 * passa pelo Zustand por frame (o store só carrega estado "grosso", ~1 Hz).
 * Os arrays são dimensionados por ROSTER.length (79) e indexados por
 * PersonagemInfo.indice (0–78).
 *
 * Convenções:
 * - pos: [x, y, z] em metros (y = piso sob os pés do personagem);
 * - facing: ângulo em radianos em torno de Y (0 = +Z, sentido anti-horário);
 * - anim: índice de AnimState (ver ANIM_INDEX/ANIM_STATES em types.ts);
 * - phase: fase livre 0..1 p/ dessincronizar ciclos de animação entre personagens;
 * - speed: velocidade escalar atual (m/s de jogo), p/ o render ajustar o passo;
 * - talkTarget: índice do interlocutor durante 'talk', ou −1.
 */

import { ROSTER } from './roster';
import { ANIM_INDEX, ANIM_STATES, type Andar, type AnimState, type Vec3 } from './types';

const N = ROSTER.length;

export const SIM = {
  pos: new Float32Array(N * 3),
  facing: new Float32Array(N),
  anim: new Uint8Array(N),
  phase: new Float32Array(N),
  speed: new Float32Array(N),
  talkTarget: new Int16Array(N).fill(-1),
};

/**
 * Estado mutável do jogador (singleton): escrito pelos controles do jogador
 * e lido pelo minimapa/câmera. Spawn: pátio sul, a 1,6 m de altura (olhos).
 */
export const playerState = {
  pos: [0, 1.6, 30] as Vec3,
  andar: 0 as Andar,
};

// ---------------------------------------------------------------------------
// Helpers tipados de leitura/escrita (índice = PersonagemInfo.indice)
// ---------------------------------------------------------------------------

export function setPosicao(i: number, x: number, y: number, z: number): void {
  SIM.pos[i * 3] = x;
  SIM.pos[i * 3 + 1] = y;
  SIM.pos[i * 3 + 2] = z;
}

/** Lê a posição de `i` em `out` (ou num novo vetor, se omitido). */
export function getPosicao(i: number, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = SIM.pos[i * 3];
  out[1] = SIM.pos[i * 3 + 1];
  out[2] = SIM.pos[i * 3 + 2];
  return out;
}

export function setFacing(i: number, rad: number): void {
  SIM.facing[i] = rad;
}

export function getFacing(i: number): number {
  return SIM.facing[i];
}

export function setAnim(i: number, estado: AnimState): void {
  SIM.anim[i] = ANIM_INDEX[estado];
}

export function getAnim(i: number): AnimState {
  return ANIM_STATES[SIM.anim[i]];
}

export function setPhase(i: number, fase: number): void {
  SIM.phase[i] = fase;
}

export function getPhase(i: number): number {
  return SIM.phase[i];
}

export function setSpeed(i: number, v: number): void {
  SIM.speed[i] = v;
}

export function getSpeed(i: number): number {
  return SIM.speed[i];
}

/** Define o interlocutor de `i` (−1 = ninguém). */
export function setTalkTarget(i: number, alvo: number): void {
  SIM.talkTarget[i] = alvo;
}

export function getTalkTarget(i: number): number {
  return SIM.talkTarget[i];
}
