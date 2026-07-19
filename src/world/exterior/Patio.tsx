/**
 * Patio.tsx — Pátio central: bancos, canteiros com flores, mastro com a
 * bandeira do Brasil (ondulando) e lixeiras.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { PALETTE, PATIO } from '../../contracts';
import { texturaBandeira } from './canvasTextures';

// ---------------------------------------------------------------------------
// Bancos de jardim (4 posições do contrato; assento + encosto + pés instanced)
// ---------------------------------------------------------------------------

function Bancos() {
  const bancos = PATIO.bancos;
  return (
    <group>
      {/* Assentos. */}
      <Instances limit={bancos.length} castShadow>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.banco} />
        {bancos.map((b, i) => (
          <Instance key={i} position={[b.pos[0], 0.45, b.pos[2]]} scale={[1.8, 0.09, 0.45]} />
        ))}
      </Instances>
      {/* Encostos. */}
      <Instances limit={bancos.length} castShadow>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.banco} />
        {bancos.map((b, i) => (
          <Instance
            key={i}
            position={[b.pos[0], 0.72, b.pos[2] - 0.19]}
            scale={[1.8, 0.42, 0.08]}
          />
        ))}
      </Instances>
      {/* Pés (2 por banco). */}
      <Instances limit={bancos.length * 2}>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.bancoPé} />
        {bancos.flatMap((b, i) => [
          <Instance
            key={`${i}a`}
            position={[b.pos[0] - 0.75, 0.21, b.pos[2]]}
            scale={[0.09, 0.42, 0.4]}
          />,
          <Instance
            key={`${i}b`}
            position={[b.pos[0] + 0.75, 0.21, b.pos[2]]}
            scale={[0.09, 0.42, 0.4]}
          />,
        ])}
      </Instances>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Canteiros: bordas de tijolo + terra + flores (hastes e miolos instanced)
// ---------------------------------------------------------------------------

const CORES_FLORES = [PALETTE.florVermelha, PALETTE.florAmarela, PALETTE.florRoxa];

/** 8 posições de flor por canteiro (2 fileiras), afastadas do tronco central. */
function posicoesFlores(pos: number[], w: number, d: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const fx = pos[0] - w / 2 + 0.7 + (k % 4) * ((w - 1.4) / 3);
    const fz = pos[2] + (k < 4 ? -(d / 2 - 0.55) : d / 2 - 0.55);
    out.push([fx, 0, fz]);
  }
  return out;
}

function Canteiros() {
  const canteiros = PATIO.canteiros;
  const flores = useMemo(
    () => canteiros.flatMap((c) => posicoesFlores(c.pos, c.w, c.d)),
    [canteiros],
  );
  return (
    <group>
      {/* Bordas de tijolo (4 por canteiro). */}
      <Instances limit={canteiros.length * 4} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.telhadoA} />
        {canteiros.flatMap((c, i) => [
          <Instance
            key={`${i}n`}
            position={[c.pos[0], 0.15, c.pos[2] - c.d / 2 + 0.075]}
            scale={[c.w, 0.3, 0.15]}
          />,
          <Instance
            key={`${i}s`}
            position={[c.pos[0], 0.15, c.pos[2] + c.d / 2 - 0.075]}
            scale={[c.w, 0.3, 0.15]}
          />,
          <Instance
            key={`${i}o`}
            position={[c.pos[0] - c.w / 2 + 0.075, 0.15, c.pos[2]]}
            scale={[0.15, 0.3, c.d]}
          />,
          <Instance
            key={`${i}l`}
            position={[c.pos[0] + c.w / 2 - 0.075, 0.15, c.pos[2]]}
            scale={[0.15, 0.3, c.d]}
          />,
        ])}
      </Instances>
      {/* Terra. */}
      <Instances limit={canteiros.length}>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.terraCanteiro} />
        {canteiros.map((c, i) => (
          <Instance
            key={i}
            position={[c.pos[0], 0.11, c.pos[2]]}
            scale={[c.w - 0.2, 0.22, c.d - 0.2]}
          />
        ))}
      </Instances>
      {/* Hastes. */}
      <Instances limit={flores.length}>
        <cylinderGeometry args={[0.015, 0.015, 0.28, 5]} />
        <meshStandardMaterial color={PALETTE.arvoreCopa} />
        {flores.map((f, i) => (
          <Instance key={i} position={[f[0], 0.22 + 0.14, f[2]]} />
        ))}
      </Instances>
      {/* Miolos coloridos. */}
      <Instances limit={flores.length}>
        <icosahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial flatShading />
        {flores.map((f, i) => (
          <Instance
            key={i}
            position={[f[0], 0.22 + 0.3, f[2]]}
            color={CORES_FLORES[i % CORES_FLORES.length]}
          />
        ))}
      </Instances>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mastro + bandeira do Brasil com ondulação suave
// ---------------------------------------------------------------------------

const LARGURA_BANDEIRA = 1.8;
const ALTURA_BANDEIRA = 1.26;

function Bandeira() {
  const malha = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => texturaBandeira(), []);
  // Guarda as posições originais para deformar por seno a cada frame.
  const base = useMemo(() => {
    const geo = new THREE.PlaneGeometry(LARGURA_BANDEIRA, ALTURA_BANDEIRA, 16, 10);
    return { geo, pos: Float32Array.from(geo.attributes.position.array) };
  }, []);
  useFrame(({ clock }) => {
    if (!malha.current) return;
    const attr = malha.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < attr.count; i++) {
      const x = base.pos[i * 3];
      // Amplitude cresce da haste (x=−0,9) para a ponta livre (x=+0,9).
      const fator = (x + LARGURA_BANDEIRA / 2) / LARGURA_BANDEIRA;
      attr.setZ(i, Math.sin(x * 3.5 + t * 4) * 0.08 * fator);
    }
    attr.needsUpdate = true;
    malha.current.geometry.computeVertexNormals();
  });
  return (
    <mesh
      ref={malha}
      geometry={base.geo}
      position={[0.06 + LARGURA_BANDEIRA / 2, 7.15, 0]}
    >
      <meshStandardMaterial map={tex} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Mastro() {
  const m = PATIO.mastro; // (0, 0, −5)
  return (
    <group position={[m[0], 0, m[2]]}>
      {/* Base de concreto + mastro branco de ~8 m. */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[0.35, 0.45, 0.3, 10]} />
        <meshStandardMaterial color={PALETTE.laje} />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 8, 8]} />
        <meshStandardMaterial color={PALETTE.mastro} />
      </mesh>
      <Bandeira />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lixeiras (bônus leve)
// ---------------------------------------------------------------------------

const LIXEIRAS: { pos: [number, number, number]; cor: string }[] = [
  { pos: [-17.5, 0, -12], cor: PALETTE.arvoreCopa },
  { pos: [21.5, 0, 4.2], cor: PALETTE.florAmarela },
  { pos: [-19, 0, 22], cor: PALETTE.portaoMetal },
];

function Lixeiras() {
  return (
    <group>
      <Instances limit={LIXEIRAS.length} castShadow>
        <cylinderGeometry args={[0.26, 0.22, 0.62, 10]} />
        <meshStandardMaterial />
        {LIXEIRAS.map((l, i) => (
          <Instance key={i} position={[l.pos[0], 0.31, l.pos[2]]} color={l.cor} />
        ))}
      </Instances>
      {/* Tampas. */}
      <Instances limit={LIXEIRAS.length}>
        <cylinderGeometry args={[0.28, 0.28, 0.06, 10]} />
        <meshStandardMaterial color={PALETTE.bancoPé} />
        {LIXEIRAS.map((l, i) => (
          <Instance key={i} position={[l.pos[0], 0.65, l.pos[2]]} />
        ))}
      </Instances>
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Pátio: bancos, canteiros, mastro com bandeira e lixeiras. */
export function Patio() {
  return (
    <group>
      <Bancos />
      <Canteiros />
      <Mastro />
      <Lixeiras />
    </group>
  );
}
