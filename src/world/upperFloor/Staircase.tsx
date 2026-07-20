/**
 * Staircase.tsx — As 3 escadarias do contrato (STAIRS), em meia-volta de
 * 3 lances (térreo → 3º andar), com acabamento estrutural completo:
 * - escada-a (pátio→Bloco A): lances x 22…30, z −20…−3 + patamar e passarela
 *   em y=6 (a passarela liga o patamar à varanda do 2º andar);
 * - escada-b (pátio→Bloco B): lances x −26…−22, z +2…+10 + patamar e
 *   passarela em y=6;
 * - escada-c (hall interno do Bloco C): lances x −45…−41, z −6…+2 — sem
 *   patamares (desemboca nas lajes; os guarda-corpos dos vãos estão em WALLS).
 *
 * Toda a geometria (degraus maciços/caixote sobre viga-caixão de fundo liso,
 * bocel no nariz dos degraus, corrimãos em 2 níveis com balaústres a cada
 * ~0,4 m, vigas de borda e escoras inclinadas dos patamares/passarelas) é
 * calculada de forma PURA em props/staircaseGeometry.ts (derivada de STAIRS,
 * sem hardcode de cotas) — aqui ficam só o useMemo e os grupos instanciados.
 * Nada é alocado por frame.
 */

import { useMemo } from 'react';
import { PALETTE } from '../../contracts/palette';
import { InstancedBoxes } from './props/InstancedBoxes';
import { calcularEscadarias } from './props/staircaseGeometry';

/** As 3 escadarias completas (degraus, bocel, estrutura, corrimãos e balaústres). */
export function Staircase() {
  const grupos = useMemo(calcularEscadarias, []);

  return (
    <group name="escadarias">
      {/* Degraus e lajes de patamar (concreto de piso) */}
      <InstancedBoxes items={grupos.degraus} color={PALETTE.pisoCorredor} roughness={0.95} castShadow receiveShadow />
      {/* Filete/bocel escuro no nariz dos degraus */}
      <InstancedBoxes items={grupos.bocais} color={PALETTE.degrauBocel} roughness={0.9} receiveShadow={false} />
      {/* Viga-caixão, vigas de borda e escoras (concreto pintado) */}
      <InstancedBoxes items={grupos.estrutura} color={PALETTE.coluna} roughness={0.9} castShadow receiveShadow />
      {/* Corrimãos (2 níveis) e balaústres metálicos */}
      <InstancedBoxes items={grupos.corrimaos} color={PALETTE.corrimao} metalness={0.4} roughness={0.5} castShadow />
      <InstancedBoxes items={grupos.balaustres} color={PALETTE.corrimao} metalness={0.4} roughness={0.5} />
    </group>
  );
}
