/**
 * Staircase.tsx — As 3 escadarias do contrato (STAIRS), em meia-volta de
 * 3 lances (térreo → 3º andar):
 * - escada-a (pátio→Bloco A): lances x 22…30, z −20…−3 + patamar e passarela
 *   flutuantes em y=6 (passarela liga à varanda do 2º andar);
 * - escada-b (pátio→Bloco B): lances x −26…−22, z +2…+10 + patamar e
 *   passarela flutuantes em y=6;
 * - escada-c (hall interno do Bloco C): lances x −45…−41, z −6…+2 — sem
 *   patamares (desemboca nas lajes; os guarda-corpos dos vãos estão em WALLS).
 *
 * Cada lance (StairDef.lances) vira degraus maciços instanciados (espelho
 * ~0,17 m): lances com base no SOLO (y=0) são maciços até o chão; lances
 * ELEVADOS (base y>0) viram uma laje dente-de-serra (cada degrau desce só
 * ~0,22 m abaixo do degrau anterior) para não enterrar o lance que passa
 * por baixo na meia-volta. Corrimão inclinado nos DOIS lados de cada lance,
 * balaústres verticais a cada ~0,8 m e vigas laterais sob cada lance.
 * Patamares/passarelas (StairDef.patamares) viram lajes finas instanciadas;
 * seus guarda-corpos estão em WALLS e são renderizados em ParedesSuperiores.
 *
 * Premissa do contrato: todos os lances correm ao longo do eixo Z
 * (dir = (0,0,±1)); por isso corrimãos/vigas usam rotação apenas em X
 * (rotX = atan2(dy, dz) cobre dz positivo e negativo).
 */

import { useMemo } from 'react';
import { STAIRS, type StairDef } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';

/** Altura do corrimão acima do piso do degrau. */
const H_CORRIMAO = 0.92;
/** Espelho alvo dos degraus (~0,17 m, norma escolar). */
const ESPELHO = 0.17;
/** Quanto a laje dente-de-serra desce abaixo do degrau anterior (lances elevados). */
const ALMA = 0.22;
/** Espessura das lajes de patamar/passarela. */
const ESP_PATAMAR = 0.28;

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

  for (const lance of stair.lances) {
    const a = lance.base;
    const b = lance.topo;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const run = Math.hypot(dx, dz);
    const dirX = dx / run;
    const dirZ = dz / run;
    // Lateral horizontal (perpendicular à subida): para dir ±Z resulta em ±X.
    const latX = -dirZ;
    const latZ = dirX;
    const rotX = Math.atan2(dy, dz); // inclinação do lance (lances ao longo de Z)
    const comp = Math.hypot(run, dy);
    const noSolo = a[1] < 0.01;

    // --- Degraus: maciços até o chão no lance térreo; laje dente-de-serra
    //     (fundo = topo do degrau anterior − ALMA) nos lances elevados.
    const n = Math.max(1, Math.round(dy / ESPELHO));
    const espelho = dy / n;
    const piso = run / n;
    // Footprint do degrau: largura na lateral, piso na direção da subida.
    const sizeX = stair.largura * Math.abs(latX) + (piso + 0.02) * Math.abs(dirX);
    const sizeZ = stair.largura * Math.abs(latZ) + (piso + 0.02) * Math.abs(dirZ);
    for (let i = 0; i < n; i++) {
      const yTopo = a[1] + (i + 1) * espelho;
      const yFundo = noSolo ? 0 : a[1] + i * espelho - ALMA;
      degraus.push({
        pos: [a[0] + dirX * (i + 0.5) * piso, (yTopo + yFundo) / 2, a[2] + dirZ * (i + 0.5) * piso],
        size: [sizeX, yTopo - yFundo, sizeZ],
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
      // Viga estrutural na face externa, acompanhando a inclinação do lance.
      vigas.push({
        pos: [midX + latX * s * (meiaLarg + 0.06), midY - 0.1, midZ + latZ * s * (meiaLarg + 0.06)],
        size: [0.14, 0.4, comp],
        rot: [rotX, 0, 0],
      });
    }
  }

  // --- Patamares e passarelas: lajes finas (face superior na cota do contrato).
  for (const p of stair.patamares) {
    degraus.push({
      pos: [p.rect.x + p.rect.w / 2, p.y - ESP_PATAMAR / 2, p.rect.z + p.rect.d / 2],
      size: [p.rect.w, ESP_PATAMAR, p.rect.d],
    });
  }

  return { degraus, corrimaos, balaustres, vigas };
}

/** As 3 escadarias completas (degraus, corrimãos, balaústres e vigas). */
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
