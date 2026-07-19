/**
 * Classrooms.tsx — Salas de aula 1–6 (térreo do Bloco A), mobiliadas:
 * - 180 carteiras (30/sala) em DUAS InstancedMesh (partes de madeira + metal);
 * - QUADRO BRANCO (âncoras QUADROS): moldura de alumínio por sala + bandeja
 *   com 3 marcadores e apagador; a superfície escrita/revelada vem de
 *   <QuadrosBrancos> (montado UMA vez no Classrooms, não por sala);
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
import { QuadrosBrancos } from '../QuadrosBrancos';
import { COR_MARCADOR } from '../quadroBranco';

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
// Quadro branco: moldura de alumínio + bandeja com marcadores e apagador.
// A SUPERFÍCIE com a aula escrita (textura revelada ao longo da AULA_1) NÃO
// fica aqui: vem de <QuadrosBrancos>, montado uma única vez no Classrooms.
// ---------------------------------------------------------------------------

/** Cinza-claro de alumínio escovado (cor local — contracts/palette intactos). */
const COR_ALUMINIO = '#c9ced4';
const MAT_ALUMINIO = materialCor(COR_ALUMINIO, { metalness: 0.6, roughness: 0.4 });

/** Tampas dos 3 marcadores de quadro branco (preto/azul/vermelho). */
const TAMPAS = [COR_MARCADOR.preto, COR_MARCADOR.azul, COR_MARCADOR.vermelho];

function QuadroSala({ salaId }: { salaId: string }) {
  const q = QUADROS[salaId];
  const rotY = Math.atan2(q.normal[0], q.normal[2]);
  return (
    <group position={q.pos} rotation-y={rotY}>
      {/* Moldura de alumínio (2,5 × 1,3 — mesmas dimensões da antiga de madeira) */}
      <Caixa pos={[0, 0, 0]} size={[2.5, 1.3, 0.05]} material={MAT_ALUMINIO} receiveShadow />
      {/* Bandeja de alumínio sob o quadro */}
      <Caixa pos={[0, -0.72, 0.1]} size={[1.1, 0.05, 0.12]} material={MAT_ALUMINIO} />
      {/* 3 marcadores deitados: corpo branco + tampa na cor da tinta */}
      {TAMPAS.map((cor, i) => (
        <group key={cor} position={[-0.32 + i * 0.18, -0.683, 0.1]}>
          <Caixa pos={[0, 0, 0]} size={[0.13, 0.024, 0.024]} cor={'#f4f4f2'} />
          <Caixa pos={[0.073, 0, 0]} size={[0.032, 0.027, 0.027]} cor={cor} />
        </group>
      ))}
      {/* Apagador: corpo cinza com feltro escuro embaixo */}
      <Caixa pos={[0.38, -0.668, 0.1]} size={[0.14, 0.03, 0.05]} cor={'#9aa0a8'} />
      <Caixa pos={[0.38, -0.689, 0.1]} size={[0.14, 0.012, 0.05]} cor={'#3a3f47'} />
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
      {/* Superfícies dos 6 quadros brancos (UMA montagem; revelação progressiva
          durante a AULA_1). Superfície 2,4 × 1,15 preenche melhor a moldura de
          2,5 × 1,3 do que a antiga lousa 2,32 × 1,12 — leve estiramento da
          textura 2,5:1, aceito para a escrita "respirar" até a borda. */}
      <QuadrosBrancos salaIds={SALAS_TERREO} tamanho={[2.4, 1.15]} offsetZ={0.03} />
    </group>
  );
}
