/**
 * Roof.tsx — Telhado dos blocos A, B e C sobre CONST.ALTURA_TELHADO (y=12).
 *
 * Estilo low-poly: duas águas por bloco (caixas inclinadas com cumeeira
 * cilíndrica e beirais avançando ~0,6 m além das paredes), empenas
 * triangulares fechando as laterais e teto interno plano em y≈11,8
 * (face inferior vista de dentro do 3º andar).
 *
 * Cada telhado é construído em coordenadas LOCAIS (cumeeira ao longo do
 * eixo X local, centro na origem) e posicionado/girado pelo grupo externo —
 * o Bloco C, alongado no eixo Z, usa rotY = 90°.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CONST } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';

/** Base das águas (topo das paredes do 4º pavimento). */
const Y_BASE = CONST.ALTURA_TELHADO;
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
  /** Centro da planta do bloco (mundo). */
  cx: number;
  cz: number;
  /** Giro do conjunto (0 para blocos alongados em X; π/2 para o Bloco C). */
  rotY: number;
  /** Comprimento da cumeeira no eixo X local, já com beirais. */
  largura: number;
  /** Profundidade corrida de cada água já com beiral. */
  corrida: number;
  /** Altura da cumeeira acima de Y_BASE. */
  altura: number;
  /** Profundidade da planta no eixo Z local (base da empena, sem beiral). */
  baseEmpena: number;
  /** X locais das duas empenas (extremos da cumeeira, sem beiral). */
  xEmpenas: [number, number];
  cor: string;
  corEmpena: string;
  /** Dimensões do teto interno em coordenadas locais (caixa plana em y≈11,8). */
  teto: { w: number; d: number };
}

function TelhadoDuasAguas({
  cx,
  cz,
  rotY,
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
    <group position={[cx, 0, cz]} rotation-y={rotY}>
      {/* Duas águas (caixas finas inclinadas) */}
      <mesh position={[0, yMeio, -corrida / 2]} rotation={[ang, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[largura, 0.12, compAgua]} />
        <meshStandardMaterial color={cor} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, yMeio, corrida / 2]} rotation={[-ang, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[largura, 0.12, compAgua]} />
        <meshStandardMaterial color={cor} roughness={0.85} flatShading />
      </mesh>
      {/* Cumeeira */}
      <mesh position={[0, yCumeeira + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, largura + 0.2, 8]} />
        <meshStandardMaterial color={cor} roughness={0.8} flatShading />
      </mesh>
      {/* Empenas laterais (rotY 90°: triângulo local XY passa a correr em Z) */}
      {xEmpenas.map((x) => (
        <mesh key={x} geometry={geoEmpena} position={[x, Y_BASE, 0]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color={corEmpena} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Teto interno do 3º andar (face inferior das águas) */}
      <mesh position={[0, Y_BASE - 0.21, 0]} receiveShadow>
        <boxGeometry args={[teto.w, 0.08, teto.d]} />
        <meshStandardMaterial color={PALETTE.paredeInterna} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Telhado completo: Bloco A (terracota clara), B (terracota escura) e C. */
export function Roof() {
  return (
    <group name="telhado">
      {/* Bloco A: x −33…+33, z −32…−20 (cumeeira em z=−26) */}
      <TelhadoDuasAguas
        cx={0}
        cz={-26}
        rotY={0}
        largura={66 + 2 * BEIRAL}
        corrida={6 + BEIRAL}
        altura={1.5}
        baseEmpena={12}
        xEmpenas={[-33, 33]}
        cor={PALETTE.telhadoA}
        corEmpena={PALETTE.paredeBlocoA}
        teto={{ w: 66, d: 12 }}
      />
      {/* Bloco B: x −33…+29, z +10…+20 (cumeeira em z=+15) */}
      <TelhadoDuasAguas
        cx={-2}
        cz={15}
        rotY={0}
        largura={62 + 2 * BEIRAL}
        corrida={5 + BEIRAL}
        altura={1.3}
        baseEmpena={10}
        xEmpenas={[-31, 31]}
        cor={PALETTE.telhadoB}
        corEmpena={PALETTE.paredeBlocoB}
        teto={{ w: 62, d: 10 }}
      />
      {/* Bloco C: x −45…−33, z −32…+20 (cumeeira em x=−39, ao longo de Z —
          girado 90°; reutiliza telhadoA/guarita da paleta, que não tem cor
          própria para o Bloco C — mesma convenção das paredes superiores) */}
      <TelhadoDuasAguas
        cx={-39}
        cz={-6}
        rotY={Math.PI / 2}
        largura={52 + 2 * BEIRAL}
        corrida={6 + BEIRAL}
        altura={1.2}
        baseEmpena={12}
        xEmpenas={[-26, 26]}
        cor={PALETTE.telhadoA}
        corEmpena={PALETTE.guarita}
        teto={{ w: 52, d: 12 }}
      />
    </group>
  );
}
