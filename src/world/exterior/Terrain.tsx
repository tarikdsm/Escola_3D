/**
 * Terrain.tsx — Chão da área externa: grama do terreno, pátio cimentado,
 * faixas de circulação, calçada e rua fora do portão.
 */
import { useMemo } from 'react';
import { PALETTE, TERRENO } from '../../contracts';
import type { RectXZ } from '../../contracts';
import { texturaCimento } from './canvasTextures';

/** Faixas de cimento: pátio central + circulação oeste/leste + caminho ao portão. */
const FAIXAS_CIMENTO: RectXZ[] = [
  { x: -33, z: -20, w: 62, d: 30 }, // pátio central entre os blocos
  { x: -37, z: -32, w: 4, d: 74 }, // circulação oeste (contorna os blocos até o portão)
  { x: 29, z: -20, w: 4, d: 40 }, // lateral leste dos blocos
  { x: 33, z: -15, w: 7, d: 25 }, // ligação pátio → quadra
  { x: -24, z: 20, w: 10, d: 25 }, // caminho Bloco B → portão
];

/** Plano horizontal de cimento com textura quadriculada ajustada ao tamanho. */
function FaixaCimento({ rect }: { rect: RectXZ }) {
  const tex = useMemo(() => {
    const t = texturaCimento();
    // Tile de 4 m para o quadriculado ficar na escala certa.
    t.repeat.set(rect.w / 4, rect.d / 4);
    return t;
  }, [rect]);
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[rect.x + rect.w / 2, 0.005, rect.z + rect.d / 2]}
      receiveShadow
    >
      <planeGeometry args={[rect.w, rect.d]} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}

/** Gramado de todo o terreno + cimentos + calçada/rua além do muro sul. */
export function Terrain() {
  const largura = TERRENO.maxX - TERRENO.minX; // 140
  const profundidade = TERRENO.maxZ - TERRENO.minZ; // 92,5
  const centroX = (TERRENO.minX + TERRENO.maxX) / 2; // 8
  const centroZ = (TERRENO.minZ + TERRENO.maxZ) / 2; // −1,25

  // Textura própria para a calçada (quadriculado mais miúdo).
  const texCalcada = useMemo(() => {
    const t = texturaCimento();
    t.repeat.set(largura / 2, 3 / 2);
    return t;
  }, [largura]);

  return (
    <group>
      {/* Grama cobrindo o terreno inteiro (sob o cimento). */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[centroX, -0.01, centroZ]}
        receiveShadow
      >
        <planeGeometry args={[largura, profundidade]} />
        <meshStandardMaterial color={PALETTE.grama} />
      </mesh>

      {/* Pátio cimentado e faixas de circulação. */}
      {FAIXAS_CIMENTO.map((rect, i) => (
        <FaixaCimento key={i} rect={rect} />
      ))}

      {/* Calçada clara fora do portão (z 45…48). */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[centroX, 0.002, 46.5]}
        receiveShadow
      >
        <planeGeometry args={[largura, 3]} />
        <meshStandardMaterial map={texCalcada} color={PALETTE.calcada} />
      </mesh>

      {/* Asfalto da rua (z 48…55) com faixa amarela central. */}
      <mesh rotation-x={-Math.PI / 2} position={[centroX, -0.02, 51.5]}>
        <planeGeometry args={[largura, 7]} />
        <meshStandardMaterial color={PALETTE.rua} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[centroX, -0.015, 51.5]}>
        <planeGeometry args={[largura, 0.18]} />
        <meshStandardMaterial color={PALETTE.bandeiraAmarela} />
      </mesh>
      {/* Faixa de pedestre em frente ao portão. */}
      {[-21.4, -20.4, -19.4, -18.6].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, -0.015, 51.5]}>
          <planeGeometry args={[0.5, 6.4]} />
          <meshStandardMaterial color={PALETTE.faixaPedestre} />
        </mesh>
      ))}
    </group>
  );
}
