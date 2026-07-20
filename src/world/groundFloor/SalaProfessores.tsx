/**
 * SalaProfessores.tsx — SALA DOS PROFESSORES GRANDE (térreo do Bloco C,
 * x −45…−36, z +2…+20) — a sala dos professores oficial da expansão.
 *
 * - 8 mesas × 5 lugares = 40 lugares (âncoras SALA_PROFESSORES_GRANDE do
 *   contrato), mesas e cadeiras em DUAS InstancedMesh;
 * - rotY de cada cadeira deduzido da mesa mais próxima (cadeiras voltadas
 *   ao tampo);
 * - extras procedurais: quadro de avisos na parede sul (centralizado entre
 *   as 2 janelas) e armário no canto sudoeste.
 *
 * O lado norte (z=+2) fica aberto ao hall da escada C — decisão do contrato
 * de layout (sem divisória), mantida aqui.
 */

import * as THREE from 'three';
import { SALA_PROFESSORES_GRANDE, getSala } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import {
  Armario,
  Caixa,
  GEO_CADEIRA,
  Instancias,
  materialCor,
  mesclarCaixas,
  type Instancia,
} from './props/furniture';
import { texturaQuadroAvisos } from './props/canvasTextures';

// ---------------------------------------------------------------------------
// Mesas e cadeiras (instanciadas a partir das âncoras do contrato)
// ---------------------------------------------------------------------------

/** Mesa da sala dos professores: tampo 1,4 × 0,9 + 4 pernas (h = 0,75). */
const GEO_MESA = mesclarCaixas([
  { size: [1.4, 0.05, 0.9], offset: [0, 0.725, 0] },
  { size: [0.06, 0.7, 0.06], offset: [-0.62, 0.35, -0.37] },
  { size: [0.06, 0.7, 0.06], offset: [0.62, 0.35, -0.37] },
  { size: [0.06, 0.7, 0.06], offset: [-0.62, 0.35, 0.37] },
  { size: [0.06, 0.7, 0.06], offset: [0.62, 0.35, 0.37] },
]);

const ITENS_MESAS: Instancia[] = SALA_PROFESSORES_GRANDE.mesas.map((pos) => ({ pos }));

/**
 * 40 cadeiras: cada uma olha para a sua mesa (a mais próxima — grade regular,
 * sem ambiguidade). Lado norte do tampo (z menor) vira p/ +Z (rotY = π).
 */
const ITENS_CADEIRAS: Instancia[] = SALA_PROFESSORES_GRANDE.lugares.map((pos) => {
  let mesa = SALA_PROFESSORES_GRANDE.mesas[0];
  let melhor = Infinity;
  for (const m of SALA_PROFESSORES_GRANDE.mesas) {
    const d2 = (m[0] - pos[0]) * (m[0] - pos[0]) + (m[2] - pos[2]) * (m[2] - pos[2]);
    if (d2 < melhor) {
      melhor = d2;
      mesa = m;
    }
  }
  return { pos: [pos[0], pos[1], pos[2]] as Vec3, rotY: pos[2] < mesa[2] ? Math.PI : 0 };
});

// ---------------------------------------------------------------------------
// Extras — posições derivadas do rect da sala
// ---------------------------------------------------------------------------

const RECT = getSala('sala-professores').rect;
const CX = RECT.x + RECT.w / 2;
const Z_SUL = RECT.z + RECT.d;

const MAT_AVISOS = new THREE.MeshStandardMaterial({ map: texturaQuadroAvisos(), roughness: 0.95 });

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Sala dos Professores grande mobiliada (40 lugares). */
export function SalaProfessores() {
  return (
    <group name="sala-professores-grande">
      <Instancias
        geo={GEO_MESA}
        mat={materialCor(PALETTE.mesaProfessor)}
        itens={ITENS_MESAS}
        castShadow
        receiveShadow
      />
      <Instancias geo={GEO_CADEIRA} mat={materialCor(PALETTE.cadeira)} itens={ITENS_CADEIRAS} castShadow />

      {/* Quadro de avisos na parede sul, centralizado entre as 2 janelas */}
      <group position={[CX, 1.7, Z_SUL - 0.11]} rotation-y={Math.PI}>
        <Caixa pos={[0, 0, -0.015]} size={[1.75, 1.25, 0.04]} cor={PALETTE.portaMadeira} />
        <mesh position={[0, 0, 0.01]} material={MAT_AVISOS}>
          <planeGeometry args={[1.6, 1.1]} />
        </mesh>
      </group>

      {/* Armário no canto sudoeste */}
      <Armario pos={[RECT.x + 0.7, 0, Z_SUL - 0.4]} rotY={Math.PI} />
    </group>
  );
}
