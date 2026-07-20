/**
 * SportsCourt.tsx — Quadra poliesportiva: piso com linhas demarcadas,
 * alambrado (postes + tela semitransparente), traves de futsal, tabelas de
 * basquete e bancos de reservas.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import { PALETTE, QUADRA } from '../../contracts';
import type { Vec3 } from '../../contracts';
import { texturaQuadra, texturaTelaAlambrado, texturaRede, texturaTabela } from './canvasTextures';

// ---------------------------------------------------------------------------
// Alambrado — NÃO renderizar os AABBs como caixas: postes + painéis de tela.
// Segmentos do perímetro (x +40…+70, z −15…+10), com os 2 vãos oeste abertos
// (z −6…−2 e z +4…+7 no lado x=40).
// ---------------------------------------------------------------------------

interface Segmento {
  eixo: 'x' | 'z';
  fixo: number;
  de: number;
  ate: number;
}

const SEGMENTOS: Segmento[] = [
  { eixo: 'z', fixo: 40, de: -15, ate: -6 }, // oeste, trecho norte
  { eixo: 'z', fixo: 40, de: -2, ate: 4 }, // oeste, trecho central
  { eixo: 'z', fixo: 40, de: 7, ate: 10 }, // oeste, trecho sul
  { eixo: 'z', fixo: 70, de: -15, ate: 10 }, // leste
  { eixo: 'x', fixo: -15, de: 40, ate: 70 }, // norte
  { eixo: 'x', fixo: 10, de: 40, ate: 70 }, // sul
];

/** Postes a cada ~3 m ao longo de todos os segmentos. */
const POSTES: Vec3[] = SEGMENTOS.flatMap((seg): Vec3[] => {
  const comp = seg.ate - seg.de;
  const n = Math.max(1, Math.ceil(comp / 3));
  const out: Vec3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = seg.de + (comp / n) * k;
    out.push(seg.eixo === 'z' ? [seg.fixo, 1.5, t] : [t, 1.5, seg.fixo]);
  }
  return out;
});

/** Painel de tela losangular semitransparente para um segmento. */
function PainelTela({ seg }: { seg: Segmento }) {
  const tex = useMemo(() => {
    const t = texturaTelaAlambrado().clone();
    const comp = seg.ate - seg.de;
    t.repeat.set(comp * 2, 5.6); // tile ≈ 0,5 m
    t.needsUpdate = true;
    return t;
  }, [seg]);
  const comp = seg.ate - seg.de;
  const meio = (seg.de + seg.ate) / 2;
  const pos: Vec3 = seg.eixo === 'z' ? [seg.fixo, 1.5, meio] : [meio, 1.5, seg.fixo];
  return (
    <mesh position={pos} rotation-y={seg.eixo === 'z' ? Math.PI / 2 : 0}>
      <planeGeometry args={[comp, 2.8]} />
      <meshStandardMaterial
        map={tex}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Alambrado() {
  return (
    <group>
      <Instances limit={POSTES.length} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 3, 6]} />
        <meshStandardMaterial color={PALETTE.alambrado} />
        {POSTES.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      {SEGMENTOS.map((seg, i) => (
        <PainelTela key={i} seg={seg} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Piso com linhas
// ---------------------------------------------------------------------------

function PisoQuadra() {
  const tex = useMemo(() => texturaQuadra(), []);
  const r = QUADRA.rect;
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[r.x + r.w / 2, 0.006, r.z + r.d / 2]}
      receiveShadow
    >
      <planeGeometry args={[r.w, r.d]} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Trave de futsal (boca voltada ao `dir`; conteúdo local olha para +X)
// ---------------------------------------------------------------------------

function Trave({ pos, dir }: { pos: Vec3; dir: Vec3 }) {
  const texRede = useMemo(() => {
    const t = texturaRede().clone();
    t.repeat.set(6, 4);
    t.needsUpdate = true;
    return t;
  }, []);
  const rotY = dir[0] >= 0 ? 0 : Math.PI;
  return (
    <group position={pos} rotation-y={rotY}>
      {/* Postes e travessão brancos (3 m × 2 m). */}
      {[-1.5, 1.5].map((z) => (
        <mesh key={z} position={[0, 1, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
          <meshStandardMaterial color={PALETTE.trave} />
        </mesh>
      ))}
      <mesh position={[0, 2, 0]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3.1, 8]} />
        <meshStandardMaterial color={PALETTE.trave} />
      </mesh>
      {/* Rede simplificada: fundo vertical + teto. */}
      <mesh position={[-0.65, 1, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[3.1, 2]} />
        <meshStandardMaterial
          map={texRede}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-0.32, 1.97, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.66, 3.1]} />
        <meshStandardMaterial
          map={texRede}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rede da cesta — cone truncado pendurado SOB o aro: 3 anéis horizontais
// decrescentes (a boca de cima é presa ao aro) ligados por 10 cordões em
// malha diagonal (2 segmentos por cordão), branco semitransparente, ≈ 0,40 m.
// ---------------------------------------------------------------------------

/** Centro do aro no espaço local da tabela (altura oficial 3,05 m). */
const ARO = { x: 0.82, y: 3.05, raio: 0.23 } as const;

/** Anéis da rede (raio e altura relativos ao centro do aro). */
const REDE_ANEIS = [
  { r: 0.225, y: -0.02 }, // boca de cima, presa ao aro
  { r: 0.16, y: -0.215 },
  { r: 0.115, y: -0.41 }, // fundo da rede (≈ 0,40 m abaixo do aro)
] as const;

const REDE_N = 10; // cordões por trecho entre anéis

interface Cordao {
  pos: Vec3;
  quat: THREE.Quaternion;
  comp: number;
}

/** Cordões em malha diagonal: cada um desce de um anel ao seguinte com meio
 *  passo de giro, alternando o sentido a cada trecho (zigue-zague). */
const REDE_CORDOES: Cordao[] = (() => {
  const meioPasso = Math.PI / REDE_N;
  const up = new THREE.Vector3(0, 1, 0);
  const out: Cordao[] = [];
  for (let i = 0; i < REDE_N; i++) {
    const t = (i / REDE_N) * Math.PI * 2;
    for (let k = 0; k < REDE_ANEIS.length - 1; k++) {
      const a0 = t + (k === 0 ? 0 : meioPasso);
      const a1 = t + (k === 0 ? meioPasso : 0);
      const p0 = new THREE.Vector3(
        Math.cos(a0) * REDE_ANEIS[k].r,
        REDE_ANEIS[k].y,
        Math.sin(a0) * REDE_ANEIS[k].r,
      );
      const p1 = new THREE.Vector3(
        Math.cos(a1) * REDE_ANEIS[k + 1].r,
        REDE_ANEIS[k + 1].y,
        Math.sin(a1) * REDE_ANEIS[k + 1].r,
      );
      const dir = p1.clone().sub(p0);
      const comp = dir.length();
      out.push({
        pos: [(p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2],
        quat: new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()),
        comp,
      });
    }
  }
  return out;
})();

/** Rede instanciada: 1 Instances de anéis (torus unitário escalado ao raio)
 *  + 1 Instances de cordões (cilindro unitário orientado ao segmento). */
function RedeCesta() {
  return (
    <group position={[ARO.x, ARO.y, 0]}>
      <Instances limit={REDE_ANEIS.length}>
        <torusGeometry args={[1, 0.04, 6, 28]} />
        <meshStandardMaterial color={PALETTE.quadraLinha} transparent opacity={0.85} />
        {REDE_ANEIS.map((a, i) => (
          <Instance key={i} position={[0, a.y, 0]} rotation-x={Math.PI / 2} scale={a.r} />
        ))}
      </Instances>
      <Instances limit={REDE_CORDOES.length}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color={PALETTE.quadraLinha} transparent opacity={0.85} />
        {REDE_CORDOES.map((c, i) => (
          <Instance key={i} position={c.pos} quaternion={c.quat} scale={[0.006, c.comp, 0.006]} />
        ))}
      </Instances>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tabela de basquete (poste, tabela, aro e rede)
// ---------------------------------------------------------------------------

function TabelaBasquete({ pos, dir }: { pos: Vec3; dir: Vec3 }) {
  const tex = useMemo(() => texturaTabela(), []);
  const rotY = dir[0] >= 0 ? 0 : Math.PI;
  return (
    <group position={pos} rotation-y={rotY}>
      {/* Poste. */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 3.9, 8]} />
        <meshStandardMaterial color={PALETTE.carteiraMetal} />
      </mesh>
      {/* Braço + suporte da tabela. */}
      <mesh position={[0.22, 3.75, 0]}>
        <boxGeometry args={[0.45, 0.08, 0.08]} />
        <meshStandardMaterial color={PALETTE.carteiraMetal} />
      </mesh>
      <mesh position={[0.42, 3.45, 0]}>
        <boxGeometry args={[0.05, 1.1, 1.85]} />
        <meshStandardMaterial color={PALETTE.carteiraMetal} />
      </mesh>
      {/* Tabela (face branca com quadrado alaranjado). */}
      <mesh position={[0.46, 3.45, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.8, 1.05]} />
        <meshStandardMaterial map={tex} />
      </mesh>
      {/* Aro (torus) preso à tabela por um bracket; rede pendurada sob ele. */}
      <mesh position={[ARO.x, ARO.y, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[ARO.raio, 0.02, 8, 20]} />
        <meshStandardMaterial color={PALETTE.aroBasquete} />
      </mesh>
      {/* Bracket ligando o aro ao suporte da tabela. */}
      <mesh position={[0.52, ARO.y, 0]}>
        <boxGeometry args={[0.15, 0.04, 0.06]} />
        <meshStandardMaterial color={PALETTE.aroBasquete} />
      </mesh>
      <RedeCesta />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bancos de reservas
// ---------------------------------------------------------------------------

function BancosReservas() {
  const bancos: Vec3[] = [
    [50, 0, -13.5],
    [60, 0, 8.5],
  ];
  return (
    <group>
      <Instances limit={bancos.length} castShadow>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.banco} />
        {bancos.map((p, i) => (
          <Instance key={i} position={[p[0], 0.45, p[2]]} scale={[3, 0.08, 0.4]} />
        ))}
      </Instances>
      <Instances limit={bancos.length * 2}>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.bancoPé} />
        {bancos.flatMap((p, i) => [
          <Instance key={`${i}a`} position={[p[0] - 1.3, 0.21, p[2]]} scale={[0.08, 0.42, 0.34]} />,
          <Instance key={`${i}b`} position={[p[0] + 1.3, 0.21, p[2]]} scale={[0.08, 0.42, 0.34]} />,
        ])}
      </Instances>
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Quadra completa: piso, alambrado, traves, tabelas e bancos. */
export function SportsCourt() {
  return (
    <group>
      <PisoQuadra />
      <Alambrado />
      {QUADRA.traves.map((t, i) => (
        <Trave key={i} pos={t.pos} dir={t.dir} />
      ))}
      {QUADRA.tabelas.map((t, i) => (
        <TabelaBasquete key={i} pos={t.pos} dir={t.dir} />
      ))}
      <BancosReservas />
    </group>
  );
}
