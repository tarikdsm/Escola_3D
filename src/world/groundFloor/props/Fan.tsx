/**
 * Fan.tsx — Ventilador de teto das salas de aula (haste + motor + 3 pás).
 * As pás giram devagar num useFrame (6 unidades no térreo — custo baixo).
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PALETTE } from '../../../contracts/palette';
import type { Vec3 } from '../../../contracts/types';
import { materialCor } from './furniture';

const COR_VENTILADOR = '#d9d9d9';

export interface VentiladorProps {
  /** Posição do ponto de fixação no teto (y ≈ 2,95). */
  pos: Vec3;
}

/** Ventilador de teto girando lentamente. */
export function Ventilador({ pos }: VentiladorProps) {
  const pas = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (pas.current) pas.current.rotation.y += dt * 4;
  });
  const mat = materialCor(COR_VENTILADOR);
  const matEscuro = materialCor(PALETTE.carteiraMetal);
  return (
    <group position={pos}>
      {/* Haste de fixação */}
      <mesh material={matEscuro} position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.24, 8]} />
      </mesh>
      {/* Motor */}
      <mesh material={mat} position={[0, -0.3, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.14, 12]} />
      </mesh>
      {/* Pás (giram em torno de Y) */}
      <group ref={pas} position={[0, -0.36, 0]}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation-y={(i * Math.PI * 2) / 3}>
            <mesh material={mat} position={[0.42, 0, 0]} rotation-z={0.06}>
              <boxGeometry args={[0.62, 0.015, 0.13]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
