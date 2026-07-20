/**
 * GroundFloor.tsx — PISO TÉRREO completo dos Blocos A, B e C.
 *
 * - Paredes térreas: 1 box por AABB de WALLS cujo centro.y < 2,9 e centro
 *   dentro do Bloco A (x −33…+33, z −32…−20), Bloco B (x −33…+29, z +10…+20)
 *   ou Bloco C (x −45…−33, z −32…+20), numa única InstancedMesh. Inclui o
 *   balcão da cantina (tampo de inox é adicionado em Cafeteria.tsx) e a mesa
 *   do almoxarifado (AABB final de WALLS; o miolo mobiliado — máquina Fill,
 *   posto do almoxarife etc. — é montado por outro agente, NÃO aqui).
 * - Pisos em y=0: salas/cômodos com cerâmica quadriculada (CanvasTexture);
 *   corredor do Bloco A, passeio do Bloco B, corredor do Bloco C e os halls
 *   de convivência (A leste e C) em concreto liso.
 * - Janelas térreas (SALAS[].janelas, andar 0): caixilho + vidro translúcido.
 * - Colunas do passeio do Bloco B ao longo de z=+10 (a cada 6 m).
 * - Bancos simples procedurais nos halls de convivência.
 *
 * NÃO renderiza: laje/telhado/escadas (agente SUPERIOR) nem muros/guarita/
 * alambrado/pátio/quadra (agente EXTERNO).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { SALAS, WALLS } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { RectXZ, SalaDef, VaoPorta } from '../../contracts/types';
import { CAIXA_UNITARIA, Caixa, Instancias, materialCor, mesclarCaixas, type Instancia } from './props/furniture';
import { texturaPisoQuadriculado } from './props/canvasTextures';
import { Classrooms } from './Classrooms';
import { AdminRooms } from './AdminRooms';
import { Cafeteria } from './Cafeteria';
import { Library } from './Library';
import { Bathrooms } from './Bathrooms';
import { SalaProfessores } from './SalaProfessores';

// ---------------------------------------------------------------------------
// Paredes térreas (filtradas de WALLS pela convenção centro.y < 2,9 + blocos)
// ---------------------------------------------------------------------------

const PAREDES_TERREO: Instancia[] = WALLS.filter((w) => {
  const cx = (w.min[0] + w.max[0]) / 2;
  const cy = (w.min[1] + w.max[1]) / 2;
  const cz = (w.min[2] + w.max[2]) / 2;
  if (cy >= 2.9) return false;
  const noBlocoA = cx >= -33 && cx <= 33 && cz >= -32 && cz <= -20;
  const noBlocoB = cx >= -33 && cx <= 29 && cz >= 10 && cz <= 20;
  const noBlocoC = cx >= -45 && cx <= -33 && cz >= -32 && cz <= 20;
  return noBlocoA || noBlocoB || noBlocoC;
}).map((w) => ({
  pos: [(w.min[0] + w.max[0]) / 2, (w.min[1] + w.max[1]) / 2, (w.min[2] + w.max[2]) / 2],
  size: [w.max[0] - w.min[0], w.max[1] - w.min[1], w.max[2] - w.min[2]],
}));

const MAT_PAREDE = materialCor(PALETTE.paredeInterna);

// ---------------------------------------------------------------------------
// Pisos
// ---------------------------------------------------------------------------

/** Retângulos de piso fora das SALAS: corredores/passeio e halls de convivência. */
const PISO_CORREDOR_A: RectXZ = { x: -33, z: -23, w: 66, d: 3 };
/** Hall leste do Bloco A (x +11…+33, aberto ao corredor). */
const PISO_HALL_A: RectXZ = { x: 11, z: -32, w: 22, d: 9 };
const PISO_PASSEIO_B: RectXZ = { x: -33, z: 10, w: 62, d: 3 };
/** Corredor/varanda leste do Bloco C (x −36…−33), ao longo de todo o bloco. */
const PISO_CORREDOR_C: RectXZ = { x: -36, z: -32, w: 3, d: 52 };
/** Hall da escada do Bloco C (z −6…+2, aberto ao corredor e à sala dos profs). */
const PISO_HALL_C: RectXZ = { x: -45, z: -6, w: 9, d: 8 };

/** Cores do piso quadriculado por tipo de cômodo. */
function coresPiso(sala: SalaDef): [string, string] {
  switch (sala.tipo) {
    case 'aula':
      return ['#eadfc6', '#dccba6'];
    case 'refeitorio':
      return ['#dbe7e3', '#c9d6d2'];
    case 'banheiro':
      return ['#d4e4ec', '#bcd4de'];
    case 'biblioteca':
      return ['#e6d9bd', '#d9c9a8'];
    default: // secretaria, diretoria, coordenação, almoxarifado, sala dos professores
      return ['#e9dcc2', '#dbcaa9'];
  }
}

/** Plano de piso em y≈0 com cerâmica quadriculada (ou cor lisa se corB omitida). */
function Piso({ rect, corA, corB }: { rect: RectXZ; corA: string; corB?: string }) {
  const tex = useMemo(() => {
    if (!corB) return null;
    const t = texturaPisoQuadriculado(corA, corB).clone();
    t.repeat.set(rect.w / 4, rect.d / 4);
    t.needsUpdate = true;
    return t;
  }, [corA, corB, rect.w, rect.d]);
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[rect.x + rect.w / 2, 0.02, rect.z + rect.d / 2]}
      receiveShadow
    >
      <planeGeometry args={[rect.w, rect.d]} />
      {tex ? (
        <meshStandardMaterial map={tex} roughness={0.9} />
      ) : (
        <meshStandardMaterial color={corA} roughness={0.95} />
      )}
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Janelas térreas (caixilho + vidro no vão — sem cortar parede)
// ---------------------------------------------------------------------------

const MAT_VIDRO = new THREE.MeshStandardMaterial({
  color: PALETTE.janelaVidro,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  roughness: 0.15,
  metalness: 0.1,
  side: THREE.DoubleSide,
});

/** Janela no vão: peitoril, verga, montantes, cruzeta e vidro. */
function Janela({ vao, banheiro }: { vao: VaoPorta; banheiro: boolean }) {
  // Alturas padronizadas dos vãos (ver layout.ts): janelas 1,0→2,2; banheiros 1,6→2,2.
  const yDe = banheiro ? 1.6 : 1.0;
  const altura = 2.2 - yDe;
  const meio = yDe + altura / 2;
  const L = vao.largura;
  const rotY = vao.eixo === 'x' ? 0 : Math.PI / 2;
  const moldura = PALETTE.janelaMoldura;
  return (
    <group position={[vao.x, 0, vao.z]} rotation-y={rotY}>
      {/* Peitoril e verga */}
      <Caixa pos={[0, yDe - 0.02, 0]} size={[L + 0.14, 0.12, 0.3]} cor={moldura} />
      <Caixa pos={[0, 2.24, 0]} size={[L + 0.14, 0.12, 0.3]} cor={moldura} />
      {/* Montantes laterais */}
      <Caixa pos={[-(L / 2) + 0.04, meio, 0]} size={[0.1, altura, 0.24]} cor={moldura} />
      <Caixa pos={[L / 2 - 0.04, meio, 0]} size={[0.1, altura, 0.24]} cor={moldura} />
      {/* Cruzeta central */}
      <Caixa pos={[0, meio, 0]} size={[0.05, altura - 0.1, 0.07]} cor={moldura} />
      <Caixa pos={[0, meio, 0]} size={[L - 0.1, 0.05, 0.07]} cor={moldura} />
      {/* Vidro */}
      <mesh position={[0, meio, 0]} material={MAT_VIDRO}>
        <planeGeometry args={[L - 0.06, altura - 0.06]} />
      </mesh>
    </group>
  );
}

const JANELAS_TERREO = SALAS.filter((s) => s.andar === 0).flatMap((s) =>
  s.janelas.map((vao) => ({ vao, banheiro: s.tipo === 'banheiro', chave: `${s.id}-${vao.x}-${vao.z}` })),
);

// ---------------------------------------------------------------------------
// Colunas do passeio coberto do Bloco B (z = +10, a cada 6 m)
// ---------------------------------------------------------------------------

const GEO_COLUNA = new THREE.CylinderGeometry(0.18, 0.22, 3, 10);
const COLUNAS_PASSEIO: Instancia[] = [-33, -27, -21, -15, -9, -3, 3, 9, 15, 21, 27].map((x) => ({
  pos: [x, 1.5, 10],
}));

// ---------------------------------------------------------------------------
// Bancos simples dos halls de convivência (frente −Z; encosto atrás, +Z local)
// ---------------------------------------------------------------------------

const GEO_BANCO_HALL = mesclarCaixas([
  // Assento e encosto
  { size: [1.8, 0.07, 0.45], offset: [0, 0.45, 0] },
  { size: [1.8, 0.4, 0.06], offset: [0, 0.68, 0.195] },
]);
const GEO_PE_BANCO_HALL = mesclarCaixas([
  { size: [0.08, 0.45, 0.4], offset: [-0.8, 0.225, 0] },
  { size: [0.08, 0.45, 0.4], offset: [0.8, 0.225, 0] },
]);

const BANCOS_HALLS: Instancia[] = [
  // Hall leste do Bloco A: 3 bancos sob as janelas da parede norte,
  // olhando para o pátio (sul, +Z → rotY = π).
  ...[0.25, 0.5, 0.75].map(
    (f): Instancia => ({
      pos: [PISO_HALL_A.x + PISO_HALL_A.w * f, 0, PISO_HALL_A.z + 0.45],
      rotY: Math.PI,
    }),
  ),
  // Hall da escada do Bloco C: 1 banco junto à fachada leste (x = −33),
  // olhando para o corredor (oeste, −X → rotY = π/2).
  { pos: [-33.42, 0, PISO_HALL_C.z + PISO_HALL_C.d * 0.2], rotY: Math.PI / 2 },
];

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Piso térreo completo (estrutura + mobiliário) dos Blocos A, B e C. */
export function GroundFloor() {
  return (
    <group name="piso-terreo">
      {/* Paredes térreas (inclui balcão da cantina e mesa do almoxarifado) */}
      <Instancias geo={CAIXA_UNITARIA} mat={MAT_PAREDE} itens={PAREDES_TERREO} castShadow receiveShadow />

      {/* Pisos dos cômodos do térreo */}
      {SALAS.filter((s) => s.andar === 0).map((s) => {
        const [corA, corB] = coresPiso(s);
        return <Piso key={s.id} rect={s.rect} corA={corA} corB={corB} />;
      })}
      {/* Corredores, passeio e halls (concreto liso) */}
      <Piso rect={PISO_CORREDOR_A} corA={PALETTE.pisoCorredor} />
      <Piso rect={PISO_HALL_A} corA={PALETTE.pisoCorredor} />
      <Piso rect={PISO_PASSEIO_B} corA={PALETTE.pisoCorredor} />
      <Piso rect={PISO_CORREDOR_C} corA={PALETTE.pisoCorredor} />
      <Piso rect={PISO_HALL_C} corA={PALETTE.pisoCorredor} />

      {/* Janelas térreas */}
      {JANELAS_TERREO.map((j) => (
        <Janela key={j.chave} vao={j.vao} banheiro={j.banheiro} />
      ))}

      {/* Colunas do passeio do Bloco B */}
      <Instancias geo={GEO_COLUNA} mat={materialCor(PALETTE.coluna)} itens={COLUNAS_PASSEIO} castShadow />

      {/* Bancos simples dos halls de convivência */}
      <Instancias geo={GEO_BANCO_HALL} mat={materialCor(PALETTE.banco)} itens={BANCOS_HALLS} castShadow receiveShadow />
      <Instancias geo={GEO_PE_BANCO_HALL} mat={materialCor(PALETTE.bancoPé)} itens={BANCOS_HALLS} />

      {/* Salas de aula e cômodos mobiliados */}
      <Classrooms />
      <AdminRooms />
      <Cafeteria />
      <Library />
      <Bathrooms />
      <SalaProfessores />
    </group>
  );
}
