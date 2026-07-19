/**
 * Roof.tsx — Telhado dos blocos A e B (sobre y=6).
 *
 * Estilo low-poly: duas águas por bloco (caixas inclinadas com cumeeira
 * cilíndrica e beirais avançando ~0,6 m além das paredes), empenas
 * triangulares fechando as laterais e teto interno plano em y≈5,8
 * (face inferior vista de dentro do 1º andar).
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../../contracts/palette';

/** Base das águas (topo das paredes do 2º pavimento). */
const Y_BASE = 6;
/** Avanço dos beirais além das paredes (~0,6 m). */
const BEIRAL = 0.6;

/** Triângulo da empena no plano local XY (base centrada em y=0, ápice no topo). */
function geometriaEmpena(base: number, altura: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -base / 2, 0, 0,
    base / 2, 0, 0,
    0, altura, 0,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

interface TelhadoProps {
  /** Centro X da planta do bloco. */
  cx: number;
  /** Cota Z da cumeeira (centro da planta). */
  zCumeeira: number;
  /** Comprimento total em X já com beirais. */
  largura: number;
  /** Profundidade corrida de cada água já com beiral. */
  corrida: number;
  /** Altura da cumeeira acima de yBase. */
  altura: number;
  /** Profundidade da planta (base da empena, sem beiral). */
  baseEmpena: number;
  /** X das duas empenas (paredes laterais). */
  xEmpenas: [number, number];
  cor: string;
  corEmpena: string;
  /** Dimensões do teto interno (caixa plana em y≈5,8). */
  teto: { w: number; d: number; cz: number };
}

function TelhadoDuasAguas({
  cx,
  zCumeeira,
  largura,
  corrida,
  altura,
  baseEmpena,
  xEmpenas,
  cor,
  corEmpena,
  teto,
}: TelhadoProps) {
  const geoEmpena = useMemo(() => geometriaEmpena(baseEmpena, altura), [baseEmpena, altura]);
  useEffect(() => () => geoEmpena.dispose(), [geoEmpena]);

  const ang = Math.atan2(altura, corrida);
  const compAgua = Math.hypot(corrida, altura);
  const yMeio = Y_BASE + altura / 2;
  const yCumeeira = Y_BASE + altura;

  return (
    <group>
      {/* Duas águas (caixas finas inclinadas) */}
      <mesh position={[cx, yMeio, zCumeeira - corrida / 2]} rotation={[ang, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[largura, 0.12, compAgua]} />
        <meshStandardMaterial color={cor} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[cx, yMeio, zCumeeira + corrida / 2]} rotation={[-ang, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[largura, 0.12, compAgua]} />
        <meshStandardMaterial color={cor} roughness={0.85} flatShading />
      </mesh>
      {/* Cumeeira */}
      <mesh position={[cx, yCumeeira + 0.02, zCumeeira]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, largura + 0.2, 8]} />
        <meshStandardMaterial color={cor} roughness={0.8} flatShading />
      </mesh>
      {/* Empenas laterais (rotY 90°: triângulo local XY passa a correr em Z) */}
      {xEmpenas.map((x) => (
        <mesh key={x} geometry={geoEmpena} position={[x, Y_BASE, zCumeeira]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color={corEmpena} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Teto interno do 1º andar (face inferior das águas) */}
      <mesh position={[cx, Y_BASE - 0.21, teto.cz]} receiveShadow>
        <boxGeometry args={[teto.w, 0.08, teto.d]} />
        <meshStandardMaterial color={PALETTE.paredeInterna} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Telhado completo: Bloco A (terracota clara) e Bloco B (terracota escura). */
export function Roof() {
  return (
    <group name="telhado">
      {/* Bloco A: x −33…+33, z −32…−20 (cumeeira em z=−26) */}
      <TelhadoDuasAguas
        cx={0}
        zCumeeira={-26}
        largura={66 + 2 * BEIRAL}
        corrida={6 + BEIRAL}
        altura={1.5}
        baseEmpena={12}
        xEmpenas={[-33, 33]}
        cor={PALETTE.telhadoA}
        corEmpena={PALETTE.paredeBlocoA}
        teto={{ w: 66, d: 12, cz: -26 }}
      />
      {/* Bloco B: x −29…+29, z +10…+20 (cumeeira em z=+15) */}
      <TelhadoDuasAguas
        cx={0}
        zCumeeira={15}
        largura={58 + 2 * BEIRAL}
        corrida={5 + BEIRAL}
        altura={1.3}
        baseEmpena={10}
        xEmpenas={[-29, 29]}
        cor={PALETTE.telhadoB}
        corEmpena={PALETTE.paredeBlocoB}
        teto={{ w: 58, d: 10, cz: 15 }}
      />
    </group>
  );
}
