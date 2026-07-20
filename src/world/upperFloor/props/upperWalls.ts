/**
 * upperWalls.ts — Seleção e classificação dos AABBs de WALLS que pertencem
 * aos PAVIMENTOS SUPERIORES (andares 1–3, lajes y=3/6/9) dos blocos A/B/C,
 * mais os guarda-corpos flutuantes das escadas A/B (patamar + passarela em
 * y=6, no pátio, fora das plantas — fatiados para este agente pelo Facade).
 *
 * Convenção de fatiamento entre os agentes de arquitetura:
 * - centro.y ≥ 2,9 E centro dentro das plantas dos blocos A/B/C (expandidas
 *   em 0,6 m para capturar os guarda-corpos nas bordas) OU dentro das zonas
 *   dos patamares/passarelas (derivadas de STAIRS.patamares, sem hardcode);
 * - tipo 'guardaCorpo': altura < 2 m, base exatamente na cota da laje
 *   (min.y múltiplo de 3 — isso exclui peitoris y+1,0 e vergas y+2,1) e
 *   posição sobre uma linha de varanda/escada ou numa zona de patamar;
 * - tipo 'interna': divisórias entre cômodos (linhas x = −22,−11,0,11 no A;
 *   x = −17,5,−5,−2,11,13,5 no B; x = −36 e z = −24 no C);
 * - demais: fachada do bloco correspondente (A, B ou C).
 */

import { STAIRS, WALLS } from '../../../contracts/layout';
import type { Vec3 } from '../../../contracts/types';

export type TipoParedeSuperior = 'fachadaA' | 'fachadaB' | 'fachadaC' | 'interna' | 'guardaCorpo';

export interface ItemParedeSuperior {
  centro: Vec3;
  tamanho: Vec3;
  tipo: TipoParedeSuperior;
}

/** Plantas dos blocos expandidas em 0,6 m (captura guarda-corpos nas bordas). */
const BLOCO_A = { minX: -33.6, maxX: 33.6, minZ: -32.6, maxZ: -19.4 };
const BLOCO_B = { minX: -33.6, maxX: 29.6, minZ: 9.4, maxZ: 20.6 };
const BLOCO_C = { minX: -45.6, maxX: -32.4, minZ: -32.6, maxZ: 20.6 };

/** Divisórias internas ao longo de Z (centro da parede sobre estas linhas em X). */
const DIVISORIAS_A = [-22, -11, 0, 11];
/** B: 1º andar {−5, 11} (auditório|lab|artes); 2º/3º {−17,5, −2, 13,5} (salas). */
const DIVISORIAS_B = [-17.5, -5, -2, 11, 13.5];

/**
 * Zonas dos guarda-corpos flutuantes das escadas (patamares/passarelas de
 * STAIRS expandidos em 0,4 m; cy esperado = y do patamar + 0,55). A escada C
 * não tem patamares no contrato (os guarda-corpos dela ficam dentro da
 * planta do Bloco C e entram pelo caminho normal).
 */
const ZONAS_ESCADA = STAIRS.flatMap((s) =>
  s.patamares.map((p) => ({
    minX: p.rect.x - 0.4,
    maxX: p.rect.x + p.rect.w + 0.4,
    minZ: p.rect.z - 0.4,
    maxZ: p.rect.z + p.rect.d + 0.4,
    cy: p.y + 0.55,
  })),
);

function dentroDe(
  cx: number,
  cz: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return cx >= r.minX && cx <= r.maxX && cz >= r.minZ && cz <= r.maxZ;
}

/**
 * Linhas de guarda-corpo do Bloco C: varanda leste do corredor (x=−33,
 * z −20…+10) e as proteções dos vãos da escada C nas lajes (x=−43/−41 e
 * z=−6/+2 junto ao hall z −6…+2). Peitoris de janela (x=−45) NÃO entram:
 * além da posição, o critério `baseNaLaje` os exclui.
 */
function naLinhaGuardaC(cx: number, cz: number): boolean {
  if (Math.abs(cx + 33) < 0.15) return true; // varanda do corredor
  const noHall = cz > -6.3 && cz < 2.3;
  if (noHall && (Math.abs(cx + 43) < 0.15 || Math.abs(cx + 41) < 0.15)) return true;
  if ((Math.abs(cz - 2) < 0.15 || Math.abs(cz + 6) < 0.15) && cx >= -45.2 && cx <= -40.8) {
    return true;
  }
  return false;
}

/** Lista os AABBs superiores já classificados por tipo/bloco. */
export function paredesSuperiores(): ItemParedeSuperior[] {
  const out: ItemParedeSuperior[] = [];
  for (const w of WALLS) {
    const cx = (w.min[0] + w.max[0]) / 2;
    const cy = (w.min[1] + w.max[1]) / 2;
    const cz = (w.min[2] + w.max[2]) / 2;
    if (cy < 2.9) continue; // térreo / muros / mobiliário baixo: outro agente

    const naZonaEscada = ZONAS_ESCADA.some(
      (z) =>
        cx >= z.minX && cx <= z.maxX && cz >= z.minZ && cz <= z.maxZ && Math.abs(cy - z.cy) < 0.65,
    );
    const emA = dentroDe(cx, cz, BLOCO_A);
    const emB = !emA && dentroDe(cx, cz, BLOCO_B);
    const emC = !emA && !emB && dentroDe(cx, cz, BLOCO_C);
    if (!emA && !emB && !emC && !naZonaEscada) continue; // externo (muros, guarita…)

    const tamanho: Vec3 = [w.max[0] - w.min[0], w.max[1] - w.min[1], w.max[2] - w.min[2]];
    // Guarda-corpos nascem na cota exata da laje (min.y = 3, 6 ou 9); peitoris
    // (y+1,0/+1,6) e vergas (y+2,1…) de vãos NÃO — por isso o teste da base.
    const baseNaLaje = Math.abs(w.min[1] % 3) < 1e-3;
    const naLinhaGuarda =
      (emA && (Math.abs(cz + 20) < 0.15 || (Math.abs(Math.abs(cx) - 33) < 0.15 && cz > -23))) ||
      (emB && (Math.abs(cz - 10) < 0.15 || (Math.abs(Math.abs(cx) - 29) < 0.15 && cz < 13))) ||
      (emC && naLinhaGuardaC(cx, cz));

    let tipo: TipoParedeSuperior;
    if (tamanho[1] < 2 && baseNaLaje && (naZonaEscada || naLinhaGuarda)) {
      tipo = 'guardaCorpo';
    } else if (tamanho[0] <= 0.25 && emA && DIVISORIAS_A.some((x) => Math.abs(cx - x) < 0.11)) {
      tipo = 'interna';
    } else if (tamanho[0] <= 0.25 && emB && DIVISORIAS_B.some((x) => Math.abs(cx - x) < 0.11)) {
      tipo = 'interna';
    } else if (
      emC &&
      ((tamanho[0] <= 0.25 && Math.abs(cx + 36) < 0.11) ||
        (tamanho[2] <= 0.25 && Math.abs(cz + 24) < 0.11))
    ) {
      tipo = 'interna';
    } else if (emA) {
      tipo = 'fachadaA';
    } else if (emB) {
      tipo = 'fachadaB';
    } else if (emC) {
      tipo = 'fachadaC';
    } else {
      tipo = 'guardaCorpo'; // zona de escada fora das plantas (defensivo)
    }
    out.push({ centro: [cx, cy, cz], tamanho, tipo });
  }
  return out;
}
