/**
 * Vegetation.tsx — Árvores (pátio + extras pelo terreno) e arbustos ao longo
 * dos muros. Troncos, copas e arbustos são instanced.
 */
import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { PALETTE, PATIO } from '../../contracts';
import type { Vec3 } from '../../contracts';

/** Árvores extras distribuídas pelo terreno (perto dos muros e fundo norte). */
const ARVORES_EXTRAS: Vec3[] = [
  [-58, 0, -44],
  [-30, 0, -44.5],
  [8, 0, -44],
  [46, 0, -44],
  [73.5, 0, -38],
  [73.5, 0, -18],
  [73.5, 0, 26],
  [73.5, 0, 42],
  [-58, 0, 24],
  [-58, 0, 42],
  [22, 0, 38],
  [-40, 0, 36],
];

const TODAS_ARVORES: Vec3[] = [...PATIO.arvores, ...ARVORES_EXTRAS];

interface Copa {
  pos: Vec3;
  raio: number;
  cor: string;
}

/** 3 copas por árvore, com variação determinística de posição/raio/cor. */
function gerarCopas(): Copa[] {
  const copas: Copa[] = [];
  for (let i = 0; i < TODAS_ARVORES.length; i++) {
    const [x, , z] = TODAS_ARVORES[i];
    for (let j = 0; j < 3; j++) {
      const dx = Math.sin(i * 2.1 + j * 2.4) * 0.6;
      const dz = Math.cos(i * 1.7 + j * 2.1) * 0.6;
      const raio = 1.7 - j * 0.4 + ((i + j) % 3) * 0.12;
      copas.push({
        pos: [x + dx, 2.5 + j * 0.75, z + dz],
        raio,
        cor: (i + j) % 2 === 0 ? PALETTE.arvoreCopa : PALETTE.arvoreCopaClara,
      });
    }
  }
  return copas;
}

/** Arbustos baixos ao longo dos muros norte, oeste e leste. */
function gerarArbustos(): { pos: Vec3; escala: number }[] {
  const out: { pos: Vec3; escala: number }[] = [];
  for (let x = -55; x <= 70; x += 9) {
    out.push({ pos: [x, 0.35, -46.3], escala: 0.8 + ((x + 55) % 3) * 0.15 });
  }
  for (let z = -40; z <= 38; z += 11) {
    out.push({ pos: [-60.5, 0.35, z], escala: 0.8 + ((z + 40) % 3) * 0.15 });
  }
  for (let z = -42; z <= 34; z += 11) {
    out.push({ pos: [76.3, 0.35, z], escala: 0.8 + ((z + 42) % 3) * 0.15 });
  }
  return out;
}

/** Conjunto de vegetação da área externa. */
export function Vegetation() {
  const copas = useMemo(gerarCopas, []);
  const arbustos = useMemo(gerarArbustos, []);
  return (
    <group>
      {/* Troncos. */}
      <Instances limit={TODAS_ARVORES.length} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 2.4, 7]} />
        <meshStandardMaterial color={PALETTE.tronco} />
        {TODAS_ARVORES.map((a, i) => (
          <Instance key={i} position={[a[0], 1.2, a[2]]} />
        ))}
      </Instances>
      {/* Copas (esferas achatadas de icosaedro, tons variados). */}
      <Instances limit={copas.length} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial flatShading />
        {copas.map((c, i) => (
          <Instance
            key={i}
            position={c.pos}
            scale={[c.raio, c.raio * 0.8, c.raio]}
            color={c.cor}
          />
        ))}
      </Instances>
      {/* Arbustos rente aos muros. */}
      <Instances limit={arbustos.length}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={PALETTE.arvoreCopaClara} flatShading />
        {arbustos.map((a, i) => (
          <Instance
            key={i}
            position={a.pos}
            scale={[a.escala, a.escala * 0.6, a.escala]}
          />
        ))}
      </Instances>
    </group>
  );
}
