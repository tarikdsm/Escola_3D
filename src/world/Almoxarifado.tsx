/**
 * Almoxarifado.tsx — Interior do ALMOXARIFADO (térreo do Bloco C, z −16…−6).
 *
 * - Mesa/balcão de atendimento na âncora ALMOXARIFADO.mesa: renderiza
 *   tampo + pés (o AABB sólido já existe em WALLS, para colisão — e, se o
 *   passe de paredes do térreo o renderizar, ele vira o corpo do balcão).
 * - Estantes metálicas procedurais nas paredes livres (norte, sul e os
 *   trechos da oeste ENTRE as janelas — derivados de SALAS[].janelas), com
 *   caixas de papelão instanciadas (1 InstancedMesh por tom, RNG semeado).
 *   A parede leste fica livre por causa da porta, da fila e da circulação.
 * - Máquina Fill sobre a mesa (âncora ALMOXARIFADO.posMaquina, no tampo):
 *   GLB local `public/models/maquina_fill_web.glb` — EXCEÇÃO à regra
 *   "100% procedural" (asset mandatório do usuário, ver docs/SPEC.md) —
 *   escala normalizada em runtime para ~0,4 m de altura total, centralizada
 *   sobre a mesa; Suspense + ErrorBoundary com fallback procedural.
 *
 * Tudo é estático (constantes de módulo / useMemo): zero alocação por frame.
 */

import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { ALMOXARIFADO, CONST, WALLS, getSala } from '../contracts/layout';
import { PALETTE } from '../contracts/palette';
import type { Vec3 } from '../contracts/types';
import {
  CAIXA_UNITARIA,
  Caixa,
  Instancias,
  materialCor,
  mesclarCaixas,
  type Instancia,
} from './groundFloor/props/furniture';

// ---------------------------------------------------------------------------
// Geometria da sala (derivada dos contratos — nada de hardcode)
// ---------------------------------------------------------------------------

const SALA = getSala('almoxarifado');
const { x: X0, z: Z0, w: LARG, d: PROF } = SALA.rect;
/** Cota y do piso do pavimento (térreo = 0). */
const Y_PISO = SALA.andar * CONST.ALTURA_PISO;

// ---------------------------------------------------------------------------
// Mesa/balcão (tampo + pés) — dimensões derivadas do AABB da mesa em WALLS
// ---------------------------------------------------------------------------

/** AABB sólido da mesa em WALLS (localizado pela âncora ALMOXARIFADO.mesa). */
const AABB_MESA = (() => {
  const [mx, , mz] = ALMOXARIFADO.mesa;
  const encontrado = WALLS.find((w) => {
    const cx = (w.min[0] + w.max[0]) / 2;
    const cz = (w.min[2] + w.max[2]) / 2;
    return Math.abs(cx - mx) < 0.6 && Math.abs(cz - mz) < 0.6 && w.max[1] <= 1.2;
  });
  // Fallback defensivo — o contrato (layout.ts/WALLS) garante a existência.
  return (
    encontrado ?? {
      min: [mx - 2, Y_PISO, mz - 0.15] as Vec3,
      max: [mx + 2, Y_PISO + 0.9, mz + 0.15] as Vec3,
    }
  );
})();

/** Tampo com balanço de 10 cm por lado + 4 pés recuados nos cantos. */
const GEO_MESA = (() => {
  const lx = AABB_MESA.max[0] - AABB_MESA.min[0];
  const lz = AABB_MESA.max[2] - AABB_MESA.min[2];
  const h = AABB_MESA.max[1] - AABB_MESA.min[1];
  const px = lx / 2 - 0.12;
  const pz = lz / 2 - 0.06;
  const pe = { size: [0.08, h, 0.08] as Vec3 };
  return mesclarCaixas([
    // Tampo: base afundada 5 mm no corpo do balcão (evita faces coplanares).
    { size: [lx + 0.2, 0.06, lz + 0.2], offset: [0, h + 0.025, 0] },
    { ...pe, offset: [-px, h / 2, -pz] },
    { ...pe, offset: [px, h / 2, -pz] },
    { ...pe, offset: [-px, h / 2, pz] },
    { ...pe, offset: [px, h / 2, pz] },
  ]);
})();

const MAT_MESA = materialCor(PALETTE.mesaProfessor);
const MAT_ESTANTE = materialCor(PALETTE.carteiraMetal, { metalness: 0.4, roughness: 0.5 });

// ---------------------------------------------------------------------------
// Estantes metálicas nas paredes livres (norte, sul, trechos da oeste)
// ---------------------------------------------------------------------------

/** Profundidade das estantes (encostadas na face interna da parede). */
const PROF_ESTANTE = 0.4;
/** Cotas y do topo das 4 tábuas (onde as caixas apoiam). */
const NIVEIS_ESTANTE = [0.2, 0.75, 1.3, 1.85] as const;

interface EstanteDef {
  centro: Vec3;
  /** Rotação em Y; a frente da estante é +Z no espaço local. */
  rotY: number;
  comprimento: number;
  geo: THREE.BufferGeometry;
}

/** Estante: 2 painéis laterais + 4 tábuas (geometria fundida, 1 draw call). */
function geoEstante(comp: number): THREE.BufferGeometry {
  const altura = NIVEIS_ESTANTE[NIVEIS_ESTANTE.length - 1] + 0.05;
  return mesclarCaixas([
    { size: [0.05, altura, PROF_ESTANTE], offset: [-(comp / 2 - 0.025), altura / 2, 0] },
    { size: [0.05, altura, PROF_ESTANTE], offset: [comp / 2 - 0.025, altura / 2, 0] },
    ...NIVEIS_ESTANTE.map((y) => ({
      size: [comp, 0.04, PROF_ESTANTE] as Vec3,
      offset: [0, y - 0.02, 0] as Vec3,
    })),
  ]);
}

/**
 * Trechos livres da parede oeste (x = X0) ENTRE as janelas declaradas no
 * contrato (com 15 cm de folga de cada lado e 40 cm dos cantos). Só entram
 * trechos onde cabe uma estante (≥ 1,2 m).
 */
const TRECHOS_OESTE: { de: number; ate: number }[] = (() => {
  const vaos = SALA.janelas
    .filter((j) => j.eixo === 'z' && Math.abs(j.x - X0) < 0.01)
    .map((j) => ({ de: j.z - j.largura / 2 - 0.15, ate: j.z + j.largura / 2 + 0.15 }))
    .sort((a, b) => a.de - b.de);
  const trechos: { de: number; ate: number }[] = [];
  let cursor = Z0 + 0.4;
  for (const v of vaos) {
    if (v.de > cursor) trechos.push({ de: cursor, ate: v.de });
    cursor = v.ate;
  }
  if (Z0 + PROF - 0.4 > cursor) trechos.push({ de: cursor, ate: Z0 + PROF - 0.4 });
  return trechos.filter((t) => t.ate - t.de >= 1.2);
})();

const ESTANTES: EstanteDef[] = (() => {
  const defs: EstanteDef[] = [];
  // Parede norte (z = Z0) e parede sul (z = Z0 + PROF): cheias, sem vãos.
  for (const sul of [false, true]) {
    const comp = LARG - 0.8;
    defs.push({
      centro: [X0 + LARG / 2, Y_PISO, sul ? Z0 + PROF - 0.1 - PROF_ESTANTE / 2 : Z0 + 0.1 + PROF_ESTANTE / 2],
      rotY: sul ? Math.PI : 0,
      comprimento: comp,
      geo: geoEstante(comp),
    });
  }
  // Parede oeste: uma estante por trecho livre entre as janelas.
  for (const t of TRECHOS_OESTE) {
    const comp = t.ate - t.de;
    defs.push({
      centro: [X0 + 0.1 + PROF_ESTANTE / 2, Y_PISO, (t.de + t.ate) / 2],
      rotY: Math.PI / 2,
      comprimento: comp,
      geo: geoEstante(comp),
    });
  }
  return defs;
})();

// ---------------------------------------------------------------------------
// Caixas de papelão nas estantes (instanciadas por tom, RNG semeado)
// ---------------------------------------------------------------------------

/** Tons de papelão (uma InstancedMesh por tom). */
const TONS_PAPELAO = ['#c9a26b', '#b78b52', '#dcc08f'] as const;

/** RNG determinístico (mulberry32) — composição estável entre recargas. */
function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Instâncias das caixas de papelão, agrupadas por tom (módulo, estável). */
const CAIXAS_PAPELAO: Instancia[][] = (() => {
  const rng = mulberry32(0xf111);
  const porTom: Instancia[][] = TONS_PAPELAO.map(() => []);
  for (const e of ESTANTES) {
    const slots = Math.max(1, Math.floor((e.comprimento - 0.3) / 0.55));
    const passo = (e.comprimento - 0.4) / slots;
    const cos = Math.cos(e.rotY);
    const sin = Math.sin(e.rotY);
    for (const nivel of NIVEIS_ESTANTE) {
      for (let s = 0; s < slots; s++) {
        if (rng() < 0.3) continue; // lacunas deixam o conjunto natural
        const bw = 0.32 + rng() * 0.18;
        const bh = Math.min(0.26 + rng() * 0.2, 0.46); // cabe entre as tábuas
        const bd = 0.26 + rng() * 0.1;
        const xl = -e.comprimento / 2 + 0.2 + (s + 0.5) * passo + (rng() - 0.5) * 0.04;
        const zl = (rng() - 0.5) * 0.04;
        const tom = Math.floor(rng() * TONS_PAPELAO.length);
        porTom[tom].push({
          pos: [e.centro[0] + xl * cos + zl * sin, Y_PISO + nivel + 0.001 + bh / 2, e.centro[2] - xl * sin + zl * cos],
          size: [bw, bh, bd],
          rotY: e.rotY + (rng() - 0.5) * 0.12,
        });
      }
    }
  }
  return porTom;
})();

// ---------------------------------------------------------------------------
// Máquina Fill (GLB) + fallback procedural
// ---------------------------------------------------------------------------

/** URL pública do GLB (base `/Escola_3D/` no GitHub Pages). */
const URL_MAQUINA = `${import.meta.env.BASE_URL}models/maquina_fill_web.glb`;
/** Altura total alvo da máquina sobre a mesa (~40 cm). */
const ALTURA_MAQUINA = 0.4;

/** GLB da máquina Fill, com escala normalizada e base centrada na origem. */
function MaquinaFillGLB() {
  const { scene } = useGLTF(URL_MAQUINA);
  const modelo = useMemo(() => {
    const copia = scene.clone(true);
    // Mede o bounding box em runtime e normaliza a altura total.
    const caixa = new THREE.Box3().setFromObject(copia);
    const altura = caixa.max.y - caixa.min.y;
    copia.scale.setScalar(ALTURA_MAQUINA / (altura > 1e-6 ? altura : 1));
    // Recentraliza: centro XZ no eixo do grupo e base apoiada em y = 0.
    const caixaNorm = new THREE.Box3().setFromObject(copia);
    const centro = caixaNorm.getCenter(new THREE.Vector3());
    copia.position.set(-centro.x, -caixaNorm.min.y, -centro.z);
    copia.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return copia;
  }, [scene]);
  return <primitive object={modelo} />;
}

/** Modelo procedural da máquina Fill: corpo + reservatório (~0,4 m de altura). */
function MaquinaFillFallback() {
  return (
    <group>
      {/* Corpo da máquina */}
      <Caixa pos={[0, 0.13, 0]} size={[0.3, 0.26, 0.24]} cor={'#46688c'} castShadow />
      {/* Reservatório de tinta (translúcido) */}
      <Caixa pos={[0, 0.33, 0]} size={[0.2, 0.14, 0.16]} cor={PALETTE.janelaVidro} />
      {/* Bico de enchimento */}
      <Caixa pos={[0.13, 0.16, 0]} size={[0.07, 0.06, 0.08]} cor={'#2b2b2b'} />
    </group>
  );
}

interface FronteiraErroGLBProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface FronteiraErroGLBState {
  falhou: boolean;
}

/** ErrorBoundary simples: se o GLB falhar (rede/arquivo), mostra o fallback. */
class FronteiraErroGLB extends Component<FronteiraErroGLBProps, FronteiraErroGLBState> {
  override state: FronteiraErroGLBState = { falhou: false };

  static getDerivedStateFromError(): FronteiraErroGLBState {
    return { falhou: true };
  }

  override componentDidCatch(erro: unknown) {
    console.warn('[Almoxarifado] Falha ao carregar maquina_fill_web.glb — usando o modelo procedural.', erro);
  }

  override render() {
    return this.state.falhou ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/**
 * Interior do almoxarifado: mesa/balcão com a máquina Fill, estantes com
 * caixas de papelão. As paredes, o piso e a colisão vêm dos contratos
 * (WALLS/SALAS) e são renderizados pelos passes de arquitetura.
 */
export function Almoxarifado() {
  return (
    <group name="almoxarifado">
      {/* Mesa/balcão de atendimento (âncora ALMOXARIFADO.mesa) */}
      <mesh geometry={GEO_MESA} material={MAT_MESA} position={ALMOXARIFADO.mesa} castShadow receiveShadow />

      {/* Estantes metálicas nas paredes livres */}
      {ESTANTES.map((e, i) => (
        <mesh key={i} geometry={e.geo} material={MAT_ESTANTE} position={e.centro} rotation-y={e.rotY} castShadow receiveShadow />
      ))}

      {/* Caixas de papelão instanciadas (1 draw call por tom) */}
      {TONS_PAPELAO.map((tom, i) =>
        CAIXAS_PAPELAO[i].length > 0 ? (
          <Instancias key={tom} geo={CAIXA_UNITARIA} mat={materialCor(tom)} itens={CAIXAS_PAPELAO[i]} castShadow receiveShadow />
        ) : null,
      )}

      {/* Máquina Fill sobre a mesa (âncora posMaquina = base no tampo) */}
      <group position={ALMOXARIFADO.posMaquina}>
        <FronteiraErroGLB fallback={<MaquinaFillFallback />}>
          <Suspense fallback={<MaquinaFillFallback />}>
            <MaquinaFillGLB />
          </Suspense>
        </FronteiraErroGLB>
      </group>
    </group>
  );
}

// Pré-carrega o GLB junto com o módulo (não bloqueia a primeira renderização).
useGLTF.preload(URL_MAQUINA);
