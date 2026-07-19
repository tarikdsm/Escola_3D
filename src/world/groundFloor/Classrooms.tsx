/**
 * Classrooms.tsx — Salas de aula 1–6 (térreo do Bloco A), mobiliadas:
 * - 180 carteiras (30/sala) em DUAS InstancedMesh (partes de madeira + metal);
 * - quadro verde com moldura e bandeja de giz (âncoras QUADROS);
 * - mesa + cadeira do professor (âncoras MESAS_PROFESSOR);
 * - armário alto no canto, 3 cartazes educativos e ventilador de teto por sala.
 *
 * Orientação: o quadro fica na parede norte (z=−32); alunos olham para −Z.
 */

import { CARTEIRAS, IDS_SALAS_AULA, MESAS_PROFESSOR, QUADROS, getSala } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import {
  Armario,
  Cadeira,
  Caixa,
  Instancias,
  Mesa,
  materialCor,
  mesclarCaixas,
  type Instancia,
} from './props/furniture';
import { Cartaz, type TipoCartaz } from './props/posters';
import { Ventilador } from './props/Fan';

/** Salas do térreo (sala-1 … sala-6). */
const SALAS_TERREO = IDS_SALAS_AULA.slice(0, 6);

// ---------------------------------------------------------------------------
// Carteiras: 2 InstancedMesh para as 180 carteiras (30 × 6 salas)
// ---------------------------------------------------------------------------

/** Partes de madeira da carteira escolar combinada (tampo + assento + encosto). */
const GEO_CARTEIRA_MADEIRA = mesclarCaixas([
  // Tampo (à frente do aluno, que olha para −Z)
  { size: [0.55, 0.04, 0.4], offset: [0, 0.62, -0.33] },
  // Assento
  { size: [0.42, 0.04, 0.4], offset: [0, 0.4, 0.05] },
  // Encosto
  { size: [0.42, 0.34, 0.04], offset: [0, 0.6, 0.27] },
]);

/** Estrutura metálica (pernas) da carteira. */
const GEO_CARTEIRA_METAL = mesclarCaixas([
  { size: [0.05, 0.62, 0.05], offset: [-0.22, 0.31, -0.45] },
  { size: [0.05, 0.62, 0.05], offset: [0.22, 0.31, -0.45] },
  { size: [0.05, 0.6, 0.05], offset: [-0.18, 0.3, 0.25] },
  { size: [0.05, 0.6, 0.05], offset: [0.18, 0.3, 0.25] },
]);

/** 180 posições de assento (âncoras CARTEIRAS das salas 1–6). */
const ITENS_CARTEIRAS: Instancia[] = SALAS_TERREO.flatMap((id) =>
  CARTEIRAS[id].map((pos) => ({ pos: [pos[0], pos[1], pos[2]] as Vec3 })),
);

function CarteirasInstanciadas() {
  return (
    <group>
      <Instancias
        geo={GEO_CARTEIRA_MADEIRA}
        mat={materialCor(PALETTE.carteira)}
        itens={ITENS_CARTEIRAS}
        castShadow
        receiveShadow
      />
      <Instancias
        geo={GEO_CARTEIRA_METAL}
        mat={materialCor(PALETTE.carteiraMetal, { metalness: 0.4, roughness: 0.5 })}
        itens={ITENS_CARTEIRAS}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Quadro verde com moldura e bandeja de giz
// ---------------------------------------------------------------------------

function QuadroSala({ salaId }: { salaId: string }) {
  const q = QUADROS[salaId];
  const rotY = Math.atan2(q.normal[0], q.normal[2]);
  return (
    <group position={q.pos} rotation-y={rotY}>
      {/* Moldura de madeira */}
      <Caixa pos={[0, 0, 0]} size={[2.5, 1.3, 0.05]} cor={PALETTE.portaMadeira} receiveShadow />
      {/* Lousa verde */}
      <Caixa pos={[0, 0, 0.032]} size={[2.32, 1.12, 0.02]} cor={PALETTE.quadroVerde} />
      {/* Bandeja de giz */}
      <Caixa pos={[0, -0.72, 0.1]} size={[1.1, 0.05, 0.12]} cor={PALETTE.janelaMoldura} />
      {/* Giz e apagador */}
      <Caixa pos={[0.3, -0.68, 0.1]} size={[0.12, 0.02, 0.02]} cor={'#ffffff'} />
      <Caixa pos={[-0.2, -0.675, 0.1]} size={[0.14, 0.035, 0.05]} cor={PALETTE.cadeira} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mobiliário individual de cada sala
// ---------------------------------------------------------------------------

const CARTAZES: TipoCartaz[] = ['alfabeto', 'tabuada', 'mapa'];

function MobiliarioSala({ salaId }: { salaId: string }) {
  const sala = getSala(salaId);
  const cx = sala.rect.x + sala.rect.w / 2;
  const x0 = sala.rect.x;
  const mesaProf = MESAS_PROFESSOR[salaId];
  return (
    <group>
      <QuadroSala salaId={salaId} />
      {/* Mesa do professor + cadeira (professor olha para os alunos, +Z) */}
      <Mesa pos={mesaProf} w={1.5} d={0.7} h={0.76} />
      <Cadeira pos={[mesaProf[0], mesaProf[1], mesaProf[2] - 0.62]} rotY={Math.PI} />
      {/* Armário alto no canto noroeste (longe das janelas e do quadro) */}
      <Armario pos={[x0 + 0.68, 0, -31.62]} rotY={0} />
      {/* Cartazes: 2 na parede sul (z=−23) e 1 na parede oeste */}
      <Cartaz tipo={CARTAZES[0]} pos={[cx - 3.2, 1.7, -23.09]} rotY={Math.PI} />
      <Cartaz tipo={CARTAZES[1]} pos={[cx + 3.2, 1.7, -23.09]} rotY={Math.PI} />
      <Cartaz tipo={CARTAZES[2]} pos={[x0 + 0.11, 1.7, -27.5]} rotY={Math.PI / 2} />
      {/* Ventilador de teto no centro da sala */}
      <Ventilador pos={[cx, 2.95, -27.5]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Salas de aula 1–6 completas (mobiliário + carteiras instanciadas). */
export function Classrooms() {
  return (
    <group name="salas-de-aula-terreo">
      <CarteirasInstanciadas />
      {SALAS_TERREO.map((id) => (
        <MobiliarioSala key={id} salaId={id} />
      ))}
    </group>
  );
}
