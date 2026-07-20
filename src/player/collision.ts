/**
 * collision.ts — colisão e altura de chão do jogador contra o layout estático.
 *
 * Convenção de Y: as funções trabalham com a posição dos PÉS do jogador.
 * Sem alocação por chamada: ambas aceitam um `out` opcional reutilizado;
 * omitindo-o, usam scratches do módulo (não guarde a referência retornada).
 */

import { CONST, STAIRS, WALLS, alturaNaRampa } from '../contracts/layout';
import type { AABB, Andar, Vec3 } from '../contracts/types';

/** Altura do corpo do jogador (para o teste vertical das paredes). */
const ALTURA_CORPO = 1.7;
/** Sobra mínima acima dos pés: AABBs mais baixos que isto não bloqueiam. */
const SOBRA_BASE = 0.25;
/** Tolerância vertical p/ a rampa valer (evita "puxar" quem está no térreo
 *  embaixo da projeção do topo da escada, ex.: corredor junto à varanda). */
const TOLERANCIA_RAMPA = 1.0;

/** Plantas dos blocos (contorno externo, cômodos + corredor/varanda — ver
 *  cabeçalho de layout.ts): usadas para a regra da laje (chão em y=3/6/9). */
const BLOCO_A = { minX: -33, maxX: 33, minZ: -32, maxZ: -20 };
const BLOCO_B = { minX: -33, maxX: 29, minZ: 10, maxZ: 20 };
const BLOCO_C = { minX: -45, maxX: -33, minZ: -32, maxZ: 20 };

const scratchMover: Vec3 = [0, 0, 0];
const scratchChao: { y: number; andar: Andar } = { y: 0, andar: 0 };

/** true se a parede cruza a faixa vertical do corpo (pés yPes … +ALTURA_CORPO). */
function paredeBloqueia(w: AABB, yPes: number): boolean {
  return w.min[1] < yPes + ALTURA_CORPO && w.max[1] > yPes + SOBRA_BASE;
}

/**
 * Move `pos` na direção de `desejado` resolvendo colisão contra WALLS, eixo a
 * eixo (move X, testa AABBs expandidos pelo `raio` e empurra para fora; depois
 * Z). O Y retornado é o Y de `desejado` (a vertical é resolvida por `chaoEm`).
 */
export function moverComColisao(
  pos: Vec3,
  desejado: Vec3,
  raio: number,
  out: Vec3 = scratchMover,
): Vec3 {
  const y = desejado[1];

  // --- Eixo X (z ainda é o antigo) ---
  let x = desejado[0];
  const zAntigo = pos[2];
  for (const w of WALLS) {
    if (!paredeBloqueia(w, y)) continue;
    const minX = w.min[0] - raio;
    const maxX = w.max[0] + raio;
    const minZ = w.min[2] - raio;
    const maxZ = w.max[2] + raio;
    if (x > minX && x < maxX && zAntigo > minZ && zAntigo < maxZ) {
      // Empurra para o lado de onde o jogador veio.
      if (pos[0] <= w.min[0]) x = minX;
      else if (pos[0] >= w.max[0]) x = maxX;
      else x = x < (w.min[0] + w.max[0]) / 2 ? minX : maxX;
    }
  }

  // --- Eixo Z (com o x já resolvido) ---
  let z = desejado[2];
  for (const w of WALLS) {
    if (!paredeBloqueia(w, y)) continue;
    const minX = w.min[0] - raio;
    const maxX = w.max[0] + raio;
    const minZ = w.min[2] - raio;
    const maxZ = w.max[2] + raio;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      if (pos[2] <= w.min[2]) z = minZ;
      else if (pos[2] >= w.max[2]) z = maxZ;
      else z = z < (w.min[2] + w.max[2]) / 2 ? minZ : maxZ;
    }
  }

  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Altura do chão em (x, z) para quem está na altura `yAtual` (pés):
 * 1. rampa/patamar de alguma escada (altura contínua) — `alturaNaRampa` com
 *    yRef = yAtual desambigua os lances sobrepostos da meia-volta — se
 *    |h − yAtual| ≤ 1,0;
 * 2. laje de pavimento superior (y=3, 6 ou 9, a mais próxima de yAtual)
 *    dentro da planta dos blocos A/B/C, se yAtual ≥ 2;
 * 3. senão, o térreo (y=0).
 */
export function chaoEm(
  x: number,
  z: number,
  yAtual: number,
  out: { y: number; andar: Andar } = scratchChao,
): { y: number; andar: Andar } {
  // 1) Rampas e patamares das escadas (projeção no chão, com margem de 0,3 m
  //    no contrato — cobre também as passarelas flutuantes em y=6).
  for (const s of STAIRS) {
    const h = alturaNaRampa(s, x, z, yAtual);
    if (h !== null && Math.abs(h - yAtual) <= TOLERANCIA_RAMPA) {
      out.y = h;
      out.andar = andarDeAltura(h);
      return out;
    }
  }

  // 2) Laje superior dentro da planta de algum bloco (só se já estiver em
  //    cima): nível = o múltiplo de ALTURA_PISO mais próximo (3, 6 ou 9).
  const dentroA = x >= BLOCO_A.minX && x <= BLOCO_A.maxX && z >= BLOCO_A.minZ && z <= BLOCO_A.maxZ;
  const dentroB = x >= BLOCO_B.minX && x <= BLOCO_B.maxX && z >= BLOCO_B.minZ && z <= BLOCO_B.maxZ;
  const dentroC = x >= BLOCO_C.minX && x <= BLOCO_C.maxX && z >= BLOCO_C.minZ && z <= BLOCO_C.maxZ;
  if ((dentroA || dentroB || dentroC) && yAtual >= CONST.ALTURA_PISO - 1) {
    const nivel = Math.max(1, Math.min(3, Math.round(yAtual / CONST.ALTURA_PISO)));
    out.y = nivel * CONST.ALTURA_PISO;
    out.andar = nivel as Andar;
    return out;
  }

  // 3) Térreo.
  out.y = 0;
  out.andar = 0;
  return out;
}

/** Andar lógico de uma cota y (0 = térreo … 3 = 3º andar). */
function andarDeAltura(y: number): Andar {
  return Math.max(0, Math.min(3, Math.round(y / CONST.ALTURA_PISO))) as Andar;
}
