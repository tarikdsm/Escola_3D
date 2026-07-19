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
      {/* Aro (torus) e rede (cone de linhas). */}
      <mesh position={[0.82, 3.05, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.23, 0.02, 8, 20]} />
        <meshStandardMaterial color={PALETTE.aroBasquete} />
      </mesh>
      <mesh position={[0.82, 2.83, 0]}>
        <coneGeometry args={[0.23, 0.4, 8, 3, true]} />
        <meshBasicMaterial color={PALETTE.quadraLinha} wireframe />
      </mesh>
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
