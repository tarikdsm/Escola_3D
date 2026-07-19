/**
 * Labs.tsx — Laboratório de Ciências/Informática (x −5…+11) e Sala de Artes
 * (x +11…+29), ambos no Bloco B superior (y base 3).
 *
 * Laboratório: bancadas com pias e torneiras, tubos de ensaio e beakers
 * coloridos (cilindros instanced), 2 microscópios estilizados e a ala de
 * informática (5 estações com monitores/teclados instanced, telas emissivas).
 * Sala de Artes: 4 cavaletes com telas abstratas (CanvasTexture), 2 mesas de
 * trabalho, potes de tinta coloridos e varal de desenhos na parede sul.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';
import { texturaArteAbstrata } from './props/textures';

const Y = 3;
/** Altura do tampo das bancadas/mesas. */
const H_BANCADA = 0.88;

/** Cores dos líquidos/tintas (cicla a paleta de livros do contrato). */
function corCiclo(i: number): string {
  return PALETTE.livros[i % PALETTE.livros.length];
}

// ---------------------------------------------------------------------------
// Laboratório — bancadas, pias, vidraria, microscópios, informática
// ---------------------------------------------------------------------------

/** Torneira simples: coluna vertical + bico horizontal. */
function Torneira({ pos, rotY }: { pos: Vec3; rotY: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.18, 8]} />
        <meshStandardMaterial color={PALETTE.balcaoInox} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.17, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
        <meshStandardMaterial color={PALETTE.balcaoInox} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Microscópio estilizado (base, platina, braço, tubo e ocular). */
function Microscopio({ pos, rotY }: { pos: Vec3; rotY: number }) {
  const cor = '#2f3e5c';
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.18, 0.03, 0.22]} />
        <meshStandardMaterial color={cor} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.13, 0.02, 0.13]} />
        <meshStandardMaterial color={cor} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.17, -0.07]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.05, 0.24, 0.05]} />
        <meshStandardMaterial color={cor} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.28, 0.01]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.18, 10]} />
        <meshStandardMaterial color={cor} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.37, -0.02]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 10]} />
        <meshStandardMaterial color="#1b2436" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Laboratorio() {
  const d = useMemo(() => {
    // --- Bancadas (corpos em inox + tampos claros)
    const corpos: ItemCaixa[] = [
      { pos: [-3.9, Y + 0.41, 19.5], size: [2.0, 0.82, 0.7] }, // parede sul M1
      { pos: [-1.7, Y + 0.41, 19.5], size: [2.0, 0.82, 0.7] }, // parede sul M2
      { pos: [-2.3, Y + 0.41, 16.6], size: [3.2, 0.82, 1.1] }, // ilha central
      { pos: [-4.55, Y + 0.41, 15.0], size: [0.7, 0.82, 2.2] }, // parede oeste
    ];
    const tampos: ItemCaixa[] = corpos.map((c) => ({
      pos: [c.pos[0], Y + H_BANCADA - 0.03, c.pos[2]],
      size: [c.size[0] + 0.06, 0.06, c.size[2] + 0.06],
    }));
    // --- Cuba das pias (inset escuro sobre o tampo)
    const cubas: ItemCaixa[] = [
      { pos: [-3.9, Y + H_BANCADA + 0.005, 19.55], size: [0.55, 0.05, 0.4] },
      { pos: [-4.6, Y + H_BANCADA + 0.005, 14.8], size: [0.4, 0.05, 0.55] },
    ];
    // --- Suportes (racks) dos tubos de ensaio sobre a ilha
    const racks: ItemCaixa[] = [
      { pos: [-3.2, Y + H_BANCADA + 0.025, 16.35], size: [0.6, 0.05, 0.18] },
      { pos: [-1.3, Y + H_BANCADA + 0.025, 16.85], size: [0.6, 0.05, 0.18] },
    ];
    // --- Tubos de ensaio (6 por rack) e beakers
    const tubos: Vec3[] = [];
    for (let i = 0; i < 6; i++) {
      tubos.push([-3.425 + i * 0.09, Y + H_BANCADA + 0.1, 16.35]);
      tubos.push([-1.525 + i * 0.09, Y + H_BANCADA + 0.1, 16.85]);
    }
    const beakers: Vec3[] = [
      [-2.5, Y + H_BANCADA + 0.07, 16.9],
      [-2.15, Y + H_BANCADA + 0.07, 16.45],
      [-1.75, Y + H_BANCADA + 0.07, 17.0],
      [-1.9, Y + H_BANCADA + 0.07, 19.5],
      [-1.35, Y + H_BANCADA + 0.07, 19.45],
    ];
    // --- Ala de informática: 5 estações junto à parede leste (x=11)
    const zs = [14.3, 15.35, 16.4, 17.45, 18.5];
    const tamposInfo: ItemCaixa[] = zs.map((z) => ({
      pos: [10.5, Y + 0.72, z],
      size: [0.8, 0.05, 0.95],
    }));
    const paineisInfo: ItemCaixa[] = zs.flatMap((z) =>
      [-1, 1].map((s) => ({
        pos: [10.5, Y + 0.36, z + s * 0.43] as Vec3,
        size: [0.75, 0.72, 0.05] as Vec3,
      })),
    );
    const monitores: ItemCaixa[] = zs.map((z) => ({
      pos: [10.62, Y + 0.94, z],
      size: [0.06, 0.36, 0.54],
    }));
    const basesMonitor: ItemCaixa[] = zs.map((z) => ({
      pos: [10.64, Y + 0.755, z],
      size: [0.18, 0.03, 0.22],
    }));
    const telas: ItemCaixa[] = zs.map((z) => ({
      pos: [10.585, Y + 0.94, z],
      size: [0.02, 0.29, 0.47],
    }));
    const teclados: ItemCaixa[] = zs.map((z) => ({
      pos: [10.3, Y + 0.755, z],
      size: [0.18, 0.02, 0.4],
    }));
    return {
      corpos, tampos, cubas, racks, tubos, beakers,
      tamposInfo, paineisInfo, monitores, basesMonitor, telas, teclados,
    };
  }, []);

  return (
    <group name="laboratorio">
      {/* Bancadas e pias */}
      <InstancedBoxes items={d.corpos} color={PALETTE.balcaoInox} metalness={0.5} roughness={0.4} castShadow receiveShadow />
      <InstancedBoxes items={d.tampos} color={PALETTE.bancadaLab} roughness={0.5} receiveShadow />
      <InstancedBoxes items={d.cubas} color="#5b6470" metalness={0.6} roughness={0.4} />
      <InstancedBoxes items={d.racks} color={PALETTE.portaMadeira} roughness={0.8} />
      <Torneira pos={[-3.9, Y + H_BANCADA + 0.01, 19.72]} rotY={Math.PI} />
      <Torneira pos={[-4.78, Y + H_BANCADA + 0.01, 14.8]} rotY={Math.PI / 2} />

      {/* Tubos de ensaio: vidro + líquido colorido */}
      <Instances limit={d.tubos.length} frustumCulled={false}>
        <cylinderGeometry args={[0.024, 0.024, 0.13, 10]} />
        <meshStandardMaterial color="#dff4fa" transparent opacity={0.35} roughness={0.1} depthWrite={false} />
        {d.tubos.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={d.tubos.length} frustumCulled={false}>
        <cylinderGeometry args={[0.018, 0.018, 0.07, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
        {d.tubos.map((p, i) => (
          <Instance key={i} position={[p[0], p[1] - 0.025, p[2]]} color={corCiclo(i)} />
        ))}
      </Instances>

      {/* Beakers: vidro + líquido colorido */}
      <Instances limit={d.beakers.length} frustumCulled={false}>
        <cylinderGeometry args={[0.05, 0.045, 0.14, 12]} />
        <meshStandardMaterial color="#dff4fa" transparent opacity={0.35} roughness={0.1} depthWrite={false} />
        {d.beakers.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={d.beakers.length} frustumCulled={false}>
        <cylinderGeometry args={[0.042, 0.04, 0.08, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
        {d.beakers.map((p, i) => (
          <Instance key={i} position={[p[0], p[1] - 0.02, p[2]]} color={corCiclo(i + 3)} />
        ))}
      </Instances>

      {/* Microscópios sobre a ilha */}
      <Microscopio pos={[-3.3, Y + H_BANCADA, 17.0]} rotY={0.4} />
      <Microscopio pos={[-1.55, Y + H_BANCADA, 16.3]} rotY={-2.4} />

      {/* Informática: mesas, monitores, telas emissivas e teclados */}
      <InstancedBoxes items={d.tamposInfo} color={PALETTE.bancadaLab} roughness={0.6} receiveShadow />
      <InstancedBoxes items={d.paineisInfo} color={PALETTE.balcaoInox} metalness={0.5} roughness={0.4} receiveShadow />
      <InstancedBoxes items={d.monitores} color="#3d3d3d" roughness={0.5} />
      <InstancedBoxes items={d.basesMonitor} color="#3d3d3d" roughness={0.5} />
      <InstancedBoxes
        items={d.telas}
        color="#bfe8ff"
        emissive="#bfe8ff"
        emissiveIntensity={0.7}
        roughness={0.3}
      />
      <InstancedBoxes items={d.teclados} color="#5b6470" roughness={0.6} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sala de Artes — cavaletes, mesas de trabalho, potes de tinta, varal
// ---------------------------------------------------------------------------

/** Cavalete de pintura com tela abstrata (CanvasTexture). */
function Cavalete({ pos, rotY, textura }: { pos: Vec3; rotY: number; textura: THREE.Texture }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.33, 0.85, 0.02]} rotation={[0.08, 0, s * -0.06]} castShadow>
          <boxGeometry args={[0.05, 1.75, 0.05]} />
          <meshStandardMaterial color={PALETTE.portaMadeira} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.78, -0.34]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.05, 1.65, 0.05]} />
        <meshStandardMaterial color={PALETTE.portaMadeira} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, 0.08]}>
        <boxGeometry args={[0.78, 0.07, 0.1]} />
        <meshStandardMaterial color={PALETTE.portaMadeira} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.24, 0.045]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.78, 0.98, 0.035]} />
        <meshStandardMaterial color={PALETTE.janelaMoldura} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.24, 0.068]} rotation={[0.08, 0, 0]}>
        <planeGeometry args={[0.7, 0.9]} />
        <meshStandardMaterial map={textura} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Posições e giros dos 4 cavaletes + variante de tela. */
const CAVALETES: { pos: Vec3; rotY: number }[] = [
  { pos: [14.3, Y, 15.6], rotY: 0.5 },
  { pos: [16.8, Y, 17.2], rotY: -0.9 },
  { pos: [14.8, Y, 18.5], rotY: 2.7 },
  { pos: [17.6, Y, 14.7], rotY: 3.05 },
];

/** Cores pastel dos desenhos no varal. */
const CORES_VARAL = ['#f5f5f0', '#ffe4b3', '#ffc6ff', '#b5e48c', '#a0c4ff', '#ffd166', '#ffadad'];

function SalaDeArtes() {
  const texturas = useMemo(() => [0, 1, 2, 3].map((v) => texturaArteAbstrata(v)), []);
  useEffect(() => () => texturas.forEach((t) => t.dispose()), [texturas]);

  const d = useMemo(() => {
    // Mesas de trabalho (tampos + pernas)
    const tampos: ItemCaixa[] = [15.3, 17.9].map((z) => ({
      pos: [24.3, Y + 0.78, z],
      size: [2.2, 0.06, 1.1],
    }));
    const pernas: ItemCaixa[] = [15.3, 17.9].flatMap((z) =>
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          pos: [24.3 + sx * 0.95, Y + 0.39, z + sz * 0.45] as Vec3,
          size: [0.07, 0.78, 0.07] as Vec3,
        })),
      ),
    );
    // Potes de tinta: 5 por mesa + 2 no chão junto aos cavaletes
    const potes: { pos: Vec3; color: string }[] = [];
    [15.3, 17.9].forEach((z, m) => {
      for (let i = 0; i < 5; i++) {
        potes.push({
          pos: [23.6 + i * 0.38, Y + 0.86, z - 0.3 + (i % 2) * 0.55],
          color: corCiclo(i + m * 2),
        });
      }
    });
    potes.push({ pos: [14.0, Y + 0.05, 16.3], color: corCiclo(4) });
    potes.push({ pos: [17.2, Y + 0.05, 16.0], color: corCiclo(5) });
    // Desenhos no varal (parede sul, x 22,3…27,7)
    const desenhos: ItemCaixa[] = Array.from({ length: 7 }, (_, i) => ({
      pos: [22.3 + i * 0.9, Y + 1.68, 19.86],
      size: [0.34, 0.44, 0.01],
      rot: [0, 0, (i % 2 === 0 ? 1 : -1) * 0.04],
      color: CORES_VARAL[i % CORES_VARAL.length],
    }));
    return { tampos, pernas, potes, desenhos };
  }, []);

  return (
    <group name="sala-de-artes">
      {CAVALETES.map((c, i) => (
        <Cavalete key={i} pos={c.pos} rotY={c.rotY} textura={texturas[i % texturas.length]} />
      ))}
      <InstancedBoxes items={d.tampos} color={PALETTE.carteira} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={d.pernas} color={PALETTE.portaMadeira} roughness={0.8} receiveShadow />
      {/* Potes de tinta (cilindros instanced com cor por item) */}
      <Instances limit={d.potes.length} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
        {d.potes.map((p, i) => (
          <Instance key={i} position={p.pos} color={p.color} />
        ))}
      </Instances>
      {/* Varal de desenhos: corda + papéis */}
      <mesh position={[25, Y + 1.95, 19.87]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 6.2, 6]} />
        <meshStandardMaterial color="#6e6a63" roughness={0.8} />
      </mesh>
      <InstancedBoxes items={d.desenhos} color="#ffffff" roughness={0.9} />
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Laboratório de Ciências/Informática + Sala de Artes (andar superior). */
export function Labs() {
  return (
    <group name="labs-e-artes">
      <Laboratorio />
      <SalaDeArtes />
    </group>
  );
}
