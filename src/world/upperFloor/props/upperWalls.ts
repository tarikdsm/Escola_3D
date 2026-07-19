/**
 * upperWalls.ts — Seleção e classificação dos AABBs de WALLS que pertencem
 * ao ANDAR SUPERIOR (convenção fatiada entre os agentes de arquitetura):
 *
 * - centro.y ≥ 2,9 E centro dentro das plantas dos blocos A/B
 *   (expandidas em 0,6 m para capturar os guarda-corpos de z=−20 e z=+10);
 * - tipo 'guardaCorpo': altura < 2 m (os parapeitos de 1,1 m das varandas);
 * - tipo 'interna': divisórias entre cômodos (linhas x = −22,−11,0,11,22 no
 *   Bloco A e x = −5,+11 no Bloco B) → cor de parede interna;
 * - demais: fachada do bloco correspondente (A ou B).
 */

import { WALLS } from '../../../contracts/layout';
import type { Vec3 } from '../../../contracts/types';

export type TipoParedeSuperior = 'fachadaA' | 'fachadaB' | 'interna' | 'guardaCorpo';

export interface ItemParedeSuperior {
  centro: Vec3;
  tamanho: Vec3;
  tipo: TipoParedeSuperior;
}

/** Plantas dos blocos expandidas em 0,6 m (captura guarda-corpos nas bordas). */
const BLOCO_A = { minX: -33.6, maxX: 33.6, minZ: -32.6, maxZ: -19.4 };
const BLOCO_B = { minX: -29.6, maxX: 29.6, minZ: 9.4, maxZ: 20.6 };

/** Divisórias internas (centro da parede sobre estas linhas = parede interna). */
const DIVISORIAS_A = [-22, -11, 0, 11, 22];
const DIVISORIAS_B = [-5, 11];

function dentroDe(
  cx: number,
  cz: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return cx >= r.minX && cx <= r.maxX && cz >= r.minZ && cz <= r.maxZ;
}

/** Lista os AABBs superiores já classificados por tipo/bloco. */
export function paredesSuperiores(): ItemParedeSuperior[] {
  const out: ItemParedeSuperior[] = [];
  for (const w of WALLS) {
    const cx = (w.min[0] + w.max[0]) / 2;
    const cy = (w.min[1] + w.max[1]) / 2;
    const cz = (w.min[2] + w.max[2]) / 2;
    if (cy < 2.9) continue; // térreo / muros / mobiliário baixo: outro agente
    const emA = dentroDe(cx, cz, BLOCO_A);
    const emB = !emA && dentroDe(cx, cz, BLOCO_B);
    if (!emA && !emB) continue; // externo (muros, guarita, alambrado)

    const tamanho: Vec3 = [w.max[0] - w.min[0], w.max[1] - w.min[1], w.max[2] - w.min[2]];
    // Guarda-corpos existem APENAS nestas linhas (varandas): z=−20 (A), z=+10 (B)
    // e nos trechos laterais das varandas (x=±33 com z>−23; x=±29 com z<13).
    // (Peitoris de janela também são baixos e nascem em y=3, mas ficam nas
    // linhas de fachada — por isso a posição é o critério seguro.)
    const naLinhaGuarda =
      (emA && Math.abs(cz + 20) < 0.15) ||
      (emB && Math.abs(cz - 10) < 0.15) ||
      (emA && Math.abs(Math.abs(cx) - 33) < 0.15 && cz > -23) ||
      (emB && Math.abs(Math.abs(cx) - 29) < 0.15 && cz < 13);
    let tipo: TipoParedeSuperior;
    if (tamanho[1] < 2 && naLinhaGuarda) {
      tipo = 'guardaCorpo';
    } else if (
      tamanho[0] <= 0.25 && // parede fina correndo ao longo de Z
      (emA ? DIVISORIAS_A : DIVISORIAS_B).some((x) => Math.abs(cx - x) < 0.11)
    ) {
      tipo = 'interna';
    } else {
      tipo = emA ? 'fachadaA' : 'fachadaB';
    }
    out.push({ centro: [cx, cy, cz], tamanho, tipo });
  }
  return out;
}
