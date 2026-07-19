/**
 * Classrooms.tsx — Salas de aula 7–12 (Bloco A superior, y base = 3).
 *
 * Mesmo padrão do térreo, ancorado nos contratos:
 * - CARTEIRAS[salaId]: 30 lugares/sala (grade 6×5) — partes instanciadas;
 * - QUADROS[salaId]: lousa verde com moldura na parede norte;
 * - MESAS_PROFESSOR[salaId]: mesa do professor junto ao quadro;
 * - armário no canto da parede do fundo; 3 cartazes educativos (CanvasTexture);
 * - ventilador de teto girando (useFrame).
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  CARTEIRAS,
  IDS_SALAS_AULA,
  MESAS_PROFESSOR,
  QUADROS,
  getSala,
} from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';
import { texturaCartaz } from './props/textures';

/** Ids das salas do andar superior (índices 6–11 de IDS_SALAS_AULA). */
const SALAS_SUPERIORES = IDS_SALAS_AULA.slice(6);

/** Piso do 1º andar. */
const Y = 3;

// ---------------------------------------------------------------------------
// Mobiliário instanciado (todas as 6 salas em poucos draw calls)
// ---------------------------------------------------------------------------

function MobiliarioSalas() {
  const conjuntos = useMemo(() => {
    const tampos: ItemCaixa[] = [];
    const assentos: ItemCaixa[] = [];
    const encostos: ItemCaixa[] = [];
    const estrutura: ItemCaixa[] = [];
    const molduras: ItemCaixa[] = [];
    const lousas: ItemCaixa[] = [];
    const bandejas: ItemCaixa[] = [];
    const mesaProf: ItemCaixa[] = [];
    const carcacas: ItemCaixa[] = [];
    const portasArmario: ItemCaixa[] = [];
    const puxadores: ItemCaixa[] = [];

    for (const salaId of SALAS_SUPERIORES) {
      // --- Carteiras: assento na âncora; tampo à frente (−Z, lado do quadro).
      for (const [x, , z] of CARTEIRAS[salaId]) {
        tampos.push({ pos: [x, Y + 0.72, z - 0.42], size: [0.6, 0.05, 0.45] });
        assentos.push({ pos: [x, Y + 0.435, z], size: [0.42, 0.05, 0.42] });
        encostos.push({ pos: [x, Y + 0.7, z + 0.21], size: [0.42, 0.4, 0.05] });
        for (const s of [-1, 1]) {
          estrutura.push({ pos: [x + s * 0.26, Y + 0.36, z - 0.42], size: [0.05, 0.72, 0.45] });
        }
        estrutura.push({ pos: [x, Y + 0.21, z], size: [0.07, 0.42, 0.07] });
      }

      // --- Quadro verde + moldura + bandeja de giz (parede norte, normal +Z).
      const q = QUADROS[salaId];
      molduras.push({ pos: [q.pos[0], q.pos[1], q.pos[2] - 0.015], size: [3.4, 1.5, 0.05] });
      lousas.push({ pos: [q.pos[0], q.pos[1], q.pos[2] + 0.015], size: [3.2, 1.3, 0.04] });
      bandejas.push({ pos: [q.pos[0], Y + 0.93, q.pos[2] + 0.06], size: [1.4, 0.05, 0.1] });

      // --- Mesa do professor (tampo + 2 painéis laterais).
      const m = MESAS_PROFESSOR[salaId];
      mesaProf.push({ pos: [m[0], Y + 0.735, m[2]], size: [1.2, 0.06, 0.6] });
      for (const s of [-1, 1]) {
        mesaProf.push({ pos: [m[0] + s * 0.55, Y + 0.36, m[2]], size: [0.06, 0.72, 0.55] });
      }

      // --- Armário no canto da parede do fundo (z=−23), portas voltadas à sala.
      const x0 = getSala(salaId).rect.x;
      carcacas.push({ pos: [x0 + 10.3, Y + 0.9, -23.335], size: [0.9, 1.8, 0.45] });
      for (const s of [-1, 1]) {
        portasArmario.push({ pos: [x0 + 10.3 + s * 0.225, Y + 0.9, -23.575], size: [0.42, 1.68, 0.03] });
        puxadores.push({ pos: [x0 + 10.3 + s * 0.11, Y + 0.9, -23.6], size: [0.035, 0.14, 0.03] });
      }
    }
    return {
      tampos, assentos, encostos, estrutura, molduras, lousas, bandejas,
      mesaProf, carcacas, portasArmario, puxadores,
    };
  }, []);

  return (
    <group name="mobiliario-salas-superiores">
      {/* 180 carteiras (30 × 6 salas) em 5 draw calls */}
      <InstancedBoxes items={conjuntos.tampos} color={PALETTE.carteira} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.assentos} color={PALETTE.carteira} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.encostos} color={PALETTE.carteira} roughness={0.8} receiveShadow />
      <InstancedBoxes items={conjuntos.estrutura} color={PALETTE.carteiraMetal} metalness={0.5} roughness={0.45} receiveShadow />
      {/* Quadros */}
      <InstancedBoxes items={conjuntos.molduras} color={PALETTE.portaMadeira} roughness={0.8} receiveShadow />
      <InstancedBoxes items={conjuntos.lousas} color={PALETTE.quadroVerde} roughness={0.9} receiveShadow />
      <InstancedBoxes items={conjuntos.bandejas} color={PALETTE.janelaMoldura} roughness={0.7} />
      {/* Mesas do professor */}
      <InstancedBoxes items={conjuntos.mesaProf} color={PALETTE.mesaProfessor} roughness={0.8} castShadow receiveShadow />
      {/* Armários */}
      <InstancedBoxes items={conjuntos.carcacas} color={PALETTE.estanteLivros} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.portasArmario} color={PALETTE.portaMadeira} roughness={0.8} receiveShadow />
      <InstancedBoxes items={conjuntos.puxadores} color={PALETTE.carteiraMetal} metalness={0.6} roughness={0.4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cartazes educativos (CanvasTexture procedural; 4 desenhos ciclando por sala)
// ---------------------------------------------------------------------------

function Cartazes() {
  const texturas = useMemo(() => [0, 1, 2, 3].map((v) => texturaCartaz(v)), []);
  useEffect(() => () => texturas.forEach((t) => t.dispose()), [texturas]);

  const cartazes = useMemo(() => {
    const lista: { pos: Vec3; rotY: number; variante: number }[] = [];
    SALAS_SUPERIORES.forEach((salaId, i) => {
      const x0 = getSala(salaId).rect.x;
      // Dois cartazes na divisória oeste (face interior olha para +X)…
      lista.push({ pos: [x0 + 0.115, Y + 1.65, -28.6], rotY: Math.PI / 2, variante: i % 4 });
      lista.push({ pos: [x0 + 0.115, Y + 1.65, -26.4], rotY: Math.PI / 2, variante: (i + 1) % 4 });
      // …e um na divisória leste (face olha para −X).
      lista.push({ pos: [x0 + 10.885, Y + 1.65, -27.5], rotY: -Math.PI / 2, variante: (i + 2) % 4 });
    });
    return lista;
  }, []);

  return (
    <group name="cartazes-salas-superiores">
      {cartazes.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={[0, c.rotY, 0]}>
          <planeGeometry args={[0.95, 1.25]} />
          <meshStandardMaterial map={texturas[c.variante]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ventiladores de teto (3 pás, rotação contínua via useFrame)
// ---------------------------------------------------------------------------

function Ventiladores() {
  const rotores = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, delta) => {
    for (const g of rotores.current) {
      if (g) g.rotation.y += delta * 10;
    }
  });

  return (
    <group name="ventiladores-superiores">
      {SALAS_SUPERIORES.map((salaId, i) => {
        const cx = getSala(salaId).rect.x + 5.5;
        return (
          <group key={salaId} position={[cx, 0, -27.5]}>
            {/* Haste até o teto (y≈5,8) */}
            <mesh position={[0, 5.55, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
              <meshStandardMaterial color="#d9d9d9" metalness={0.4} roughness={0.5} />
            </mesh>
            {/* Motor */}
            <mesh position={[0, 5.28, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 0.14, 12]} />
              <meshStandardMaterial color={PALETTE.janelaMoldura} metalness={0.3} roughness={0.5} />
            </mesh>
            {/* Rotor com 3 pás (fase inicial dessincronizada por sala) */}
            <group
              ref={(g) => {
                rotores.current[i] = g;
              }}
              position={[0, 5.2, 0]}
              rotation={[0, i * 1.1, 0]}
            >
              {[0, 1, 2].map((k) => (
                <mesh key={k} rotation={[0, (k * Math.PI * 2) / 3, 0]}>
                  <mesh position={[0.48, 0, 0]}>
                    <boxGeometry args={[0.85, 0.02, 0.15]} />
                    <meshStandardMaterial color={PALETTE.janelaMoldura} roughness={0.6} />
                  </mesh>
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Salas de aula 7–12 completas (mobiliário + cartazes + ventiladores). */
export function Classrooms() {
  return (
    <group name="salas-superiores">
      <MobiliarioSalas />
      <Cartazes />
      <Ventiladores />
    </group>
  );
}
