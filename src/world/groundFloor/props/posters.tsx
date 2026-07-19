/**
 * posters.tsx — Cartazes educativos das salas de aula (alfabeto, tabuada,
 * mapa do Brasil), desenhados proceduralmente em CanvasTexture.
 * Frente do cartaz voltada a +Z com rotY = 0.
 */

import * as THREE from 'three';
import type { Vec3 } from '../../../contracts/types';
import { Caixa } from './furniture';
import { texturaAlfabeto, texturaMapaBrasil, texturaTabuada } from './canvasTextures';

export type TipoCartaz = 'alfabeto' | 'tabuada' | 'mapa';

/** Materiais dos cartazes (um por tipo, com textura compartilhada). */
const MATERIAIS: Record<TipoCartaz, THREE.MeshStandardMaterial | null> = {
  alfabeto: null,
  tabuada: null,
  mapa: null,
};

function materialCartaz(tipo: TipoCartaz): THREE.MeshStandardMaterial {
  let m = MATERIAIS[tipo];
  if (!m) {
    const map =
      tipo === 'alfabeto' ? texturaAlfabeto() : tipo === 'tabuada' ? texturaTabuada() : texturaMapaBrasil();
    m = new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
    MATERIAIS[tipo] = m;
  }
  return m;
}

export interface CartazProps {
  tipo: TipoCartaz;
  pos: Vec3;
  rotY?: number;
  w?: number;
  h?: number;
}

/** Cartaz escolar: moldura clara fina + estampa em CanvasTexture. */
export function Cartaz({ tipo, pos, rotY = 0, w = 1.1, h = 0.82 }: CartazProps) {
  return (
    <group position={pos} rotation-y={rotY}>
      {/* Fundo/moldura do cartaz */}
      <Caixa pos={[0, 0, -0.008]} size={[w + 0.06, h + 0.06, 0.016]} cor={'#f5f5f0'} />
      {/* Estampa */}
      <mesh position={[0, 0, 0.002]} material={materialCartaz(tipo)}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}
