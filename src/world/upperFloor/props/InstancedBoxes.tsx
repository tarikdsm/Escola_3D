/**
 * InstancedBoxes.tsx — Helper de instancing para caixas repetidas
 * (carteiras, cadeiras, degraus, caixilhos, balaústres...).
 *
 * Uma única draw call por conjunto (InstancedMesh via drei <Instances>),
 * com geometria unitária 1×1×1 escalada por item. A cor final de cada item é
 * corBase × corDoItem (para cor exata por item, use color="#ffffff" no conjunto).
 */

import { Instances, Instance } from '@react-three/drei';
import type { Vec3 } from '../../../contracts/types';

/** Uma caixa instanciada: centro, tamanho e rotação Euler opcional. */
export interface ItemCaixa {
  /** Posição do centro da caixa. */
  pos: Vec3;
  /** Dimensões (largura X, altura Y, profundidade Z) antes da rotação. */
  size: Vec3;
  /** Rotação Euler em radianos (a escala aplica-se no espaço local já rotacionado). */
  rot?: Vec3;
  /** Cor multiplicada pela cor base do material (omitir = usa a cor base pura). */
  color?: string;
}

interface InstancedBoxesProps {
  items: ItemCaixa[];
  /** Cor base do material (multiplica a cor individual de cada item). */
  color?: string;
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  /** Cor emissiva (ex.: telas de computador, vidros iluminados). */
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Conjunto instanciado de caixas com um único material.
 * Reutiliza a mesma geometria unitária para todos os itens.
 */
export function InstancedBoxes({
  items,
  color = '#ffffff',
  roughness = 0.85,
  metalness = 0,
  flatShading = false,
  transparent = false,
  opacity = 1,
  depthWrite = true,
  emissive,
  emissiveIntensity,
  castShadow = false,
  receiveShadow = true,
}: InstancedBoxesProps) {
  if (items.length === 0) return null;
  return (
    <Instances
      limit={items.length}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        flatShading={flatShading}
        transparent={transparent}
        opacity={opacity}
        depthWrite={depthWrite}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity ?? 1}
      />
      {items.map((it, i) => (
        <Instance
          key={i}
          position={it.pos}
          scale={it.size}
          rotation={it.rot ?? [0, 0, 0]}
          {...(it.color !== undefined ? { color: it.color } : {})}
        />
      ))}
    </Instances>
  );
}
