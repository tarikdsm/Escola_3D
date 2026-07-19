/**
 * navigation.ts — NAVEGAÇÃO dos agentes.
 *
 * Camadas:
 * 1) ROTEAMENTO: wrapper sobre findPath/nearestNode dos contratos.
 *    Destinos de longa distância são SEMPRE waypoints; o trecho final
 *    (carteira, lugar na mesa, ponto da roda de conversa...) é uma perna
 *    direta off-graph — só usada para âncoras dentro do mesmo cômodo ou
 *    em área aberta, validada por script de teste com `cruzaParede`.
 * 2) REPATH: se o agente não progride por > 3 s de jogo, replaneja a
 *    partir do nó mais próximo da posição atual (ver agents.ts).
 * 3) SEPARAÇÃO anti-sobreposição: hash espacial por andar (células de
 *    1 m, tabela de buckets pré-alocada — zero alocação por frame).
 *    Pares a < 0,55 m empurram-se ao longo do eixo do par (passo pequeno
 *    e suave). Empurrões que cruzariam parede são descartados
 *    (`cruzaParede` do contrato, só para pares próximos).
 *    Só empurra quem está em movimento ('indo' ou perseguindo a bola):
 *    pares parados (fila da cantina com 0,45 m entre slots, bancos,
 *    carteiras) ficam intactos.
 */

import { CONST } from '../contracts/layout';
import type { Andar, Vec3 } from '../contracts/types';
import { WAYPOINTS, cruzaParede, findPath, nearestNode } from '../contracts/waypoints';
import type { Agente, Mundo } from './estado';

/** Distância de separação desejada entre dois agentes. */
const DIST_SEPARACAO = 0.55;

// ---------------------------------------------------------------------------
// Roteamento
// ---------------------------------------------------------------------------

/** Andar lógico da posição (para roteamento/separação). */
export function andarDe(y: number): Andar {
  return y >= 1.5 ? 1 : 0;
}

/**
 * Menor caminho do ponto atual até o nó `paraNode` (índices de WAYPOINTS).
 * O primeiro nó é o mais próximo da posição atual — descartado quando o
 * agente já está praticamente em cima dele (< 0,35 m).
 */
export function planejarRota(dePos: Vec3, andar: Andar, paraNode: number): number[] {
  if (paraNode < 0) return [];
  const de = nearestNode(dePos, andar);
  if (de < 0) return [];
  const path = findPath(de, paraNode);
  if (path.length > 0 && path[0] === de) {
    const p = WAYPOINTS[de].pos;
    if (Math.hypot(p[0] - dePos[0], p[2] - dePos[2]) < 0.35) path.shift();
  }
  return path;
}

/**
 * Perna direta permitida? true quando o destino off-graph está no mesmo
 * andar, perto e com linha livre (sem parede no caminho) — evita roteamento
 * desnecessário para deslocamentos dentro do mesmo cômodo/área aberta.
 */
export function pernaDiretaLivre(dePos: Vec3, para: Vec3): boolean {
  if (Math.abs(dePos[1] - para[1]) > 0.5) return false;
  const d = Math.hypot(para[0] - dePos[0], para[2] - dePos[2]);
  if (d > 10) return false;
  return !cruzaParede(dePos, para, andarDe(dePos[1]));
}

// ---------------------------------------------------------------------------
// Separação (hash espacial por andar, células de 1 m)
// ---------------------------------------------------------------------------

const N = CONST.TOTAL_PERSONAGENS;
const BUCKETS = 2048; // potência de 2
const cabecas = new Int32Array(BUCKETS);
const proximo = new Int32Array(N);
const celulaX = new Int16Array(N);
const celulaZ = new Int16Array(N);
const andarCel = new Uint8Array(N);

function hashCelula(cx: number, cz: number, andar: number): number {
  let h = (cx * 73856093) ^ (cz * 19349663) ^ (andar * 83492791);
  h &= BUCKETS - 1;
  return h < 0 ? h + BUCKETS : h;
}

/** true se o agente conta como "em movimento" para fins de separação. */
function emMovimento(a: Agente): boolean {
  return a.fase === 'indo' || a.modo === 'bola';
}

/**
 * Aplica a separação em todos os pares próximos. `dtJogo` em segundos de jogo.
 * Reconstrói o hash a cada frame (custo ~79 inserções + consultas 3×3).
 */
export function separacao(m: Mundo, dtJogo: number): void {
  cabecas.fill(-1);
  const agentes = m.agentes;

  // Insere todos no hash.
  for (let i = 0; i < agentes.length; i++) {
    const a = agentes[i];
    const cx = Math.floor(a.x);
    const cz = Math.floor(a.z);
    const an = a.y >= 1.5 ? 1 : 0;
    celulaX[i] = cx;
    celulaZ[i] = cz;
    andarCel[i] = an;
    const h = hashCelula(cx, cz, an);
    proximo[i] = cabecas[h];
    cabecas[h] = i;
  }

  const passoMax = 1.5 * dtJogo; // deslocamento máximo de separação por frame

  for (let i = 0; i < agentes.length; i++) {
    const a = agentes[i];
    // Vasculha a célula e as 8 vizinhas (mesmo andar).
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const h = hashCelula(celulaX[i] + dx, celulaZ[i] + dz, andarCel[i]);
        for (let j = cabecas[h]; j !== -1; j = proximo[j]) {
          if (j <= i) continue; // cada par uma única vez
          if (andarCel[j] !== andarCel[i]) continue;
          const b = agentes[j];
          if (Math.abs(b.y - a.y) > 1) continue;
          const ddx = b.x - a.x;
          const ddz = b.z - a.z;
          const d2 = ddx * ddx + ddz * ddz;
          if (d2 >= DIST_SEPARACAO * DIST_SEPARACAO) continue;

          const moveA = emMovimento(a);
          const moveB = emMovimento(b);
          if (!moveA && !moveB) continue; // ambos parados: respeita o lugar

          let d = Math.sqrt(d2);
          let nx: number;
          let nz: number;
          if (d < 1e-4) {
            // Exatamente sobrepostos: direção determinística pelo índice.
            nx = 1;
            nz = 0;
            d = 1e-4;
          } else {
            nx = ddx / d;
            nz = ddz / d;
          }
          const overlap = DIST_SEPARACAO - d;
          const passo = Math.min(overlap * 0.5, passoMax);
          if (passo <= 0) continue;

          if (moveA && moveB) {
            empurra(a, -nx, -nz, passo * 0.5);
            empurra(b, nx, nz, passo * 0.5);
          } else if (moveA) {
            empurra(a, -nx, -nz, passo);
          } else {
            empurra(b, nx, nz, passo);
          }
        }
      }
    }
  }
}

/** Desloca o agente se a linha até o novo ponto não cruzar parede. */
function empurra(a: Agente, nx: number, nz: number, passo: number): void {
  const novoX = a.x + nx * passo;
  const novoZ = a.z + nz * passo;
  if (cruzaParede([a.x, a.y, a.z], [novoX, a.y, novoZ], andarDe(a.y))) return;
  a.x = novoX;
  a.z = novoZ;
}
