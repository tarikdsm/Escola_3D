/**
 * Staircase.tsx — As 2 escadarias do contrato (STAIRS):
 * - escada-a (principal, 4 m): base (28,0,−6) → patamar (28,1,5,−13) → topo (28,3,−20);
 * - escada-b (secundária, 3 m): base (−24,0,+2) → patamar (−24,1,5,+6) → topo (−24,3,+10).
 *
 * Degraus maciços de concreto (InstancedMesh; espelho ~0,17 m interpolado
 * base→patamar→topo), corrimão inclinado nos DOIS lados de cada lance +
 * trecho horizontal no patamar, balaústres verticais a cada ~0,8 m e vigas
 * laterais fechando o vão sob cada lance.
 *
 * Premissa do contrato: ambas as escadas correm ao longo do eixo Z
 * (dir = (0,0,±1)); por isso os corrimãos/vigas usam rotação apenas em X.
 */

import { useMemo } from 'react';
import { STAIRS, type StairDef } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';

/** Altura do corrimão acima do piso do degrau. */
const H_CORRIMAO = 0.92;
/** Espelho alvo dos degraus (~0,17 m, norma escolar). */
const ESPELHO = 0.17;

interface DadosEscada {
  degraus: ItemCaixa[];
  corrimaos: ItemCaixa[];
  balaustres: ItemCaixa[];
  vigas: ItemCaixa[];
}

function calcularEscada(stair: StairDef): DadosEscada {
  const degraus: ItemCaixa[] = [];
  const corrimaos: ItemCaixa[] = [];
  const balaustres: ItemCaixa[] = [];
  const vigas: ItemCaixa[] = [];
  const meiaLarg = stair.largura / 2;
  const lances: [Vec3, Vec3][] = [
    [stair.base, stair.patamar],
    [stair.patamar, stair.topo],
  ];

  for (const [a, b] of lances) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const run = Math.hypot(dx, dz);
    const dirX = dx / run;
    const dirZ = dz / run;
    // Lateral horizontal (perpendicular à subida): para dir ±Z resulta em ±X.
    const latX = -dirZ;
    const latZ = dirX;
    const rotX = Math.atan2(dy, dz); // inclinação do lance (escadas ao longo de Z)
    const comp = Math.hypot(run, dy);

    // --- Degraus maciços: caixas do chão (y=0) até o topo de cada degrau.
    const n = Math.max(1, Math.round(dy / ESPELHO));
    const espelho = dy / n;
    const piso = run / n;
    for (let i = 0; i < n; i++) {
      const yTopo = a[1] + (i + 1) * espelho;
      degraus.push({
        pos: [a[0] + dirX * (i + 0.5) * piso, yTopo / 2, a[2] + dirZ * (i + 0.5) * piso],
        size: [stair.largura, yTopo, piso + 0.02],
      });
    }

    // --- Corrimão inclinado + balaústres + viga lateral, nos dois lados.
    const midX = (a[0] + b[0]) / 2;
    const midY = (a[1] + b[1]) / 2;
    const midZ = (a[2] + b[2]) / 2;
    for (const s of [-1, 1]) {
      const ox = latX * s * (meiaLarg - 0.07);
      const oz = latZ * s * (meiaLarg - 0.07);
      corrimaos.push({
        pos: [midX + ox, midY + H_CORRIMAO, midZ + oz],
        size: [0.07, 0.07, comp],
        rot: [rotX, 0, 0],
      });
      const nb = Math.max(1, Math.round(run / 0.8));
      for (let k = 0; k <= nb; k++) {
        const t = k / nb;
        balaustres.push({
          pos: [a[0] + dx * t + ox, a[1] + dy * t + H_CORRIMAO / 2, a[2] + dz * t + oz],
          size: [0.05, H_CORRIMAO, 0.05],
        });
      }
      // Viga estrutural na face externa, fechando o vão sob o lance.
      vigas.push({
        pos: [midX + latX * s * (meiaLarg + 0.06), midY - 0.1, midZ + latZ * s * (meiaLarg + 0.06)],
        size: [0.14, 0.4, comp],
        rot: [rotX, 0, 0],
      });
    }
  }

  // --- Patamar maciço + corrimão horizontal dos dois lados.
  const p = stair.patamar;
  degraus.push({
    pos: [p[0], p[1] / 2, p[2]],
    size: [stair.largura, p[1], 0.9],
  });
  // Lateral do patamar (dir ao longo de Z → lados em X).
  const latPX = -stair.dir[2];
  const latPZ = stair.dir[0];
  for (const s of [-1, 1]) {
    const ox = latPX * s * (meiaLarg - 0.07);
    const oz = latPZ * s * (meiaLarg - 0.07);
    corrimaos.push({
      pos: [p[0] + ox, p[1] + H_CORRIMAO, p[2] + oz],
      size: [0.07, 0.07, 1.0],
    });
  }

  return { degraus, corrimaos, balaustres, vigas };
}

/** As duas escadarias completas (degraus, corrimãos, balaústres e vigas). */
export function Staircase() {
  const dados = useMemo(() => STAIRS.map(calcularEscada), []);
  const grupos = useMemo(() => {
    const juntar = (campo: keyof DadosEscada): ItemCaixa[] => dados.flatMap((d) => d[campo]);
    return {
      degraus: juntar('degraus'),
      corrimaos: juntar('corrimaos'),
      balaustres: juntar('balaustres'),
      vigas: juntar('vigas'),
    };
  }, [dados]);

  return (
    <group name="escadarias">
      <InstancedBoxes items={grupos.degraus} color={PALETTE.pisoCorredor} roughness={0.95} castShadow receiveShadow />
      <InstancedBoxes items={grupos.corrimaos} color={PALETTE.corrimao} metalness={0.4} roughness={0.5} castShadow />
      <InstancedBoxes items={grupos.balaustres} color={PALETTE.corrimao} metalness={0.4} roughness={0.5} />
      <InstancedBoxes items={grupos.vigas} color={PALETTE.coluna} roughness={0.9} receiveShadow />
    </group>
  );
}
