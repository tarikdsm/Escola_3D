/**
 * Classrooms.tsx — Salas de aula do TÉRREO: sala-1…sala-4 (Bloco A) e
 * sala-25/sala-26 (Bloco C), mobiliadas:
 * - 120 carteiras (20/sala, grade 5×4) em DUAS InstancedMesh (partes de
 *   madeira + metal), cada sala com a rotação derivada da normal do quadro
 *   (Bloco A: quadro na parede norte; Bloco C: quadro na parede oeste);
 * - QUADRO BRANCO (âncoras QUADROS): moldura de alumínio por sala + bandeja
 *   com 3 marcadores e apagador; a superfície escrita/revelada vem de
 *   <QuadrosBrancos> (montado UMA vez no Classrooms, não por sala);
 * - mesa + cadeira do professor (âncoras MESAS_PROFESSOR);
 * - armário alto na parede do quadro, 3 cartazes educativos e ventilador de teto.
 *
 * Orientação 100% derivada dos contratos: QUADROS[id].normal aponta da parede
 * do quadro para dentro da sala; os alunos olham no sentido oposto (−normal).
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

/** Salas de aula do térreo (Bloco A: sala-1…4; Bloco C: sala-25 e sala-26). */
const SALAS_TERREO = IDS_SALAS_AULA.filter((id) => getSala(id).andar === 0);

// ---------------------------------------------------------------------------
// Orientação de cada sala, derivada da normal do seu quadro
// ---------------------------------------------------------------------------

interface OrientacaoSala {
  /** Normal do quadro (aponta p/ dentro da sala; os alunos olham p/ −n). */
  n: Vec3;
  cx: number;
  cz: number;
  w: number;
  d: number;
  /** Tangente horizontal da parede do quadro = lado ESQUERDO de quem olha o quadro. */
  t: [number, number];
  /** Centro (x, z) da parede do quadro. */
  paredeQuadro: [number, number];
  /** Comprimento da parede do quadro ao longo da tangente. */
  compQuadro: number;
  /** Centro (x, z) da parede dos fundos (oposta ao quadro). */
  paredeFundos: [number, number];
  /** rotY que leva a "frente −Z" das carteiras ao sentido do quadro (−n). */
  rotYCarteira: number;
  /** rotY da mesa do professor (largura paralela à parede do quadro). */
  rotYMesa: number;
  /** rotY da cadeira do professor (olhando p/ os alunos, sentido +n). */
  rotYCadeiraProf: number;
  /** rotY dos cartazes da parede dos fundos (estampa virada p/ −n). */
  rotYFundos: number;
  /** rotY do cartaz da parede lateral esquerda (estampa virada p/ −t). */
  rotYLateral: number;
}

function orientacaoSala(salaId: string): OrientacaoSala {
  const { x, z, w, d } = getSala(salaId).rect;
  const n = QUADROS[salaId].normal;
  const cx = x + w / 2;
  const cz = z + d / 2;
  // Girando a normal 90° em torno de Y: tangente da parede do quadro, que
  // coincide com a esquerda de quem olha o quadro (convenções deste projeto).
  const t: [number, number] = [-n[2], n[0]];
  return {
    n,
    cx,
    cz,
    w,
    d,
    t,
    paredeQuadro: [cx - n[0] * (w / 2), cz - n[2] * (d / 2)],
    compQuadro: n[0] !== 0 ? d : w,
    paredeFundos: [cx + n[0] * (w / 2), cz + n[2] * (d / 2)],
    rotYCarteira: Math.atan2(n[0], n[2]),
    rotYMesa: Math.atan2(-t[1], t[0]),
    rotYCadeiraProf: Math.atan2(-n[0], -n[2]),
    rotYFundos: Math.atan2(-n[0], -n[2]),
    rotYLateral: Math.atan2(-t[0], -t[1]),
  };
}

const ORIENTACOES = new Map(SALAS_TERREO.map((id) => [id, orientacaoSala(id)] as const));

// ---------------------------------------------------------------------------
// Carteiras: 2 InstancedMesh para as 120 carteiras (20 × 6 salas)
// ---------------------------------------------------------------------------

/** Partes de madeira da carteira escolar combinada (tampo + assento + encosto).
 *  Modelada com o aluno olhando para −Z (antes do rotY da sala). */
const GEO_CARTEIRA_MADEIRA = mesclarCaixas([
  // Tampo (à frente do aluno)
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

/** 120 posições de assento (âncoras CARTEIRAS) + rotY da sala correspondente. */
const ITENS_CARTEIRAS: Instancia[] = SALAS_TERREO.flatMap((id) => {
  const rotY = ORIENTACOES.get(id)!.rotYCarteira;
  return CARTEIRAS[id].map((pos) => ({ pos: [pos[0], pos[1], pos[2]] as Vec3, rotY }));
});

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
// Mobiliário individual de cada sala (tudo derivado da orientação do quadro)
// ---------------------------------------------------------------------------

const CARTAZES: TipoCartaz[] = ['alfabeto', 'tabuada', 'mapa'];

function MobiliarioSala({ salaId }: { salaId: string }) {
  const o = ORIENTACOES.get(salaId)!;
  const mesaProf = MESAS_PROFESSOR[salaId];
  const { n, t } = o;
  // Armário encostado na extremidade esquerda da parede do quadro (frente
  // virada p/ dentro da sala — mesmo rotY das carteiras).
  const armPos: Vec3 = [
    o.paredeQuadro[0] + t[0] * (o.compQuadro / 2 - 0.68) + n[0] * 0.38,
    0,
    o.paredeQuadro[1] + t[1] * (o.compQuadro / 2 - 0.68) + n[2] * 0.38,
  ];
  // Cartazes dos fundos, a 3,2 m do centro da parede (a porta do corredor
  // fica no centro dessa parede) e a 0,11 m dela.
  const cartazFundo = (sinal: number): Vec3 => [
    o.paredeFundos[0] + t[0] * 3.2 * sinal - n[0] * 0.11,
    1.7,
    o.paredeFundos[1] + t[1] * 3.2 * sinal - n[2] * 0.11,
  ];
  // Cartaz da lateral esquerda de quem olha o quadro (parede sem porta).
  const metadeLateral = Math.abs(t[0]) * (o.w / 2) + Math.abs(t[1]) * (o.d / 2);
  const cartazLateral: Vec3 = [
    o.cx + t[0] * metadeLateral - t[0] * 0.11,
    1.7,
    o.cz + t[1] * metadeLateral - t[1] * 0.11,
  ];
  return (
    <group>
      <QuadroSala salaId={salaId} />
      {/* Mesa do professor (largura paralela ao quadro) + cadeira atrás dela,
          olhando para os alunos */}
      <Mesa pos={mesaProf} w={1.5} d={0.7} h={0.76} rotY={o.rotYMesa} />
      <Cadeira
        pos={[mesaProf[0] - n[0] * 0.62, mesaProf[1], mesaProf[2] - n[2] * 0.62]}
        rotY={o.rotYCadeiraProf}
      />
      <Armario pos={armPos} rotY={o.rotYCarteira} />
      {/* Cartazes: 2 na parede dos fundos e 1 na lateral esquerda */}
      <Cartaz tipo={CARTAZES[0]} pos={cartazFundo(1)} rotY={o.rotYFundos} />
      <Cartaz tipo={CARTAZES[1]} pos={cartazFundo(-1)} rotY={o.rotYFundos} />
      <Cartaz tipo={CARTAZES[2]} pos={cartazLateral} rotY={o.rotYLateral} />
      {/* Ventilador de teto no centro da sala */}
      <Ventilador pos={[o.cx, 2.95, o.cz]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Salas de aula do térreo completas (mobiliário + carteiras instanciadas). */
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
