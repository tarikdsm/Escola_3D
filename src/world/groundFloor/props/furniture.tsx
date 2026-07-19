/**
 * furniture.tsx — Helpers de mobiliário do piso térreo.
 *
 * - `Caixa`: box unitário compartilhado escalado por mesh (geometria única,
 *   material cacheado por cor) — evita criar geometria/material por prop.
 * - `mesclarCaixas`: funde vários boxes num único BufferGeometry (para
 *   mobiliário repetido instanciado sem depender de utils externos).
 * - `Instancias`: wrapper tipado sobre THREE.InstancedMesh.
 * - `Mesa`, `Cadeira`, `Armario`, `Computador`: mobiliário composto.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../../../contracts/palette';
import type { Vec3 } from '../../../contracts/types';

/** Geometria de box 1×1×1 compartilhada por todas as `Caixa`. */
export const CAIXA_UNITARIA = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------------------
// Materiais cacheados por cor (evita explosão de materiais idênticos)
// ---------------------------------------------------------------------------

const cacheMateriais = new Map<string, THREE.MeshStandardMaterial>();

/** Material standard fosco cacheado por cor/parâmetros. */
export function materialCor(
  cor: string,
  opts: { metalness?: number; roughness?: number } = {},
): THREE.MeshStandardMaterial {
  const metalness = opts.metalness ?? 0;
  const roughness = opts.roughness ?? 0.85;
  const chave = `${cor}|${metalness}|${roughness}`;
  let m = cacheMateriais.get(chave);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: cor, metalness, roughness });
    cacheMateriais.set(chave, m);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Caixa genérica
// ---------------------------------------------------------------------------

export interface CaixaProps {
  pos: Vec3;
  size: Vec3;
  cor?: string;
  /** Material explícito (vidro, espelho, texturas…); tem precedência sobre `cor`. */
  material?: THREE.Material;
  rotY?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** Box escalado a partir da geometria unitária compartilhada. */
export function Caixa({
  pos,
  size,
  cor = '#ffffff',
  material,
  rotY = 0,
  castShadow = false,
  receiveShadow = false,
}: CaixaProps) {
  return (
    <mesh
      geometry={CAIXA_UNITARIA}
      material={material ?? materialCor(cor)}
      position={pos}
      scale={size}
      rotation-y={rotY}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

// ---------------------------------------------------------------------------
// Fusão de boxes num único BufferGeometry (não-indexado)
// ---------------------------------------------------------------------------

export interface ParteCaixa {
  size: Vec3;
  offset: Vec3;
}

/** Funde vários boxes (com translação) num único BufferGeometry. */
export function mesclarCaixas(partes: ParteCaixa[]): THREE.BufferGeometry {
  const posicoes: number[] = [];
  const normais: number[] = [];
  const uvs: number[] = [];
  for (const p of partes) {
    const g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]).toNonIndexed();
    g.translate(p.offset[0], p.offset[1], p.offset[2]);
    posicoes.push(...g.getAttribute('position').array);
    normais.push(...g.getAttribute('normal').array);
    uvs.push(...g.getAttribute('uv').array);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

// ---------------------------------------------------------------------------
// InstancedMesh declarativa
// ---------------------------------------------------------------------------

export interface Instancia {
  pos: Vec3;
  /** Escala por instância (default [1,1,1]). */
  size?: Vec3;
  rotY?: number;
}

export interface InstanciasProps {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  itens: readonly Instancia[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * InstancedMesh configurada por array de itens. `itens` deve ser estável
 * (constante de módulo ou useMemo) para não regravar as matrizes por frame.
 */
export function Instancias({
  geo,
  mat,
  itens,
  castShadow = false,
  receiveShadow = false,
}: InstanciasProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    itens.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.rotY ?? 0, 0);
      const s = it.size ?? [1, 1, 1];
      dummy.scale.set(s[0], s[1], s[2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [geo, mat, itens]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, itens.length]}
      geometry={geo}
      material={mat}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

// ---------------------------------------------------------------------------
// Mesa (tampo + 4 pernas, geometria fundida)
// ---------------------------------------------------------------------------

export interface MesaProps {
  pos: Vec3;
  w?: number;
  d?: number;
  h?: number;
  cor?: string;
  rotY?: number;
}

export function Mesa({ pos, w = 1.4, d = 0.7, h = 0.75, cor = PALETTE.mesaProfessor, rotY = 0 }: MesaProps) {
  const geo = useMemo(() => {
    const px = w / 2 - 0.08;
    const pz = d / 2 - 0.08;
    return mesclarCaixas([
      { size: [w, 0.05, d], offset: [0, h - 0.025, 0] },
      { size: [0.06, h - 0.05, 0.06], offset: [-px, (h - 0.05) / 2, -pz] },
      { size: [0.06, h - 0.05, 0.06], offset: [px, (h - 0.05) / 2, -pz] },
      { size: [0.06, h - 0.05, 0.06], offset: [-px, (h - 0.05) / 2, pz] },
      { size: [0.06, h - 0.05, 0.06], offset: [px, (h - 0.05) / 2, pz] },
    ]);
  }, [w, d, h]);
  return (
    <mesh
      geometry={geo}
      material={materialCor(cor)}
      position={pos}
      rotation-y={rotY}
      castShadow
      receiveShadow
    />
  );
}

// ---------------------------------------------------------------------------
// Cadeira (assento + encosto + 4 pernas). Frente voltada a −Z com rotY = 0.
// ---------------------------------------------------------------------------

const GEO_CADEIRA = mesclarCaixas([
  { size: [0.42, 0.05, 0.42], offset: [0, 0.45, 0] },
  { size: [0.42, 0.45, 0.05], offset: [0, 0.7, 0.185] },
  { size: [0.05, 0.45, 0.05], offset: [-0.17, 0.225, -0.17] },
  { size: [0.05, 0.45, 0.05], offset: [0.17, 0.225, -0.17] },
  { size: [0.05, 0.45, 0.05], offset: [-0.17, 0.225, 0.17] },
  { size: [0.05, 0.45, 0.05], offset: [0.17, 0.225, 0.17] },
]);

export interface CadeiraProps {
  pos: Vec3;
  rotY?: number;
  cor?: string;
}

export function Cadeira({ pos, rotY = 0, cor = PALETTE.cadeira }: CadeiraProps) {
  return (
    <mesh
      geometry={GEO_CADEIRA}
      material={materialCor(cor)}
      position={pos}
      rotation-y={rotY}
      castShadow
    />
  );
}

// ---------------------------------------------------------------------------
// Armário alto (corpo + 2 portas com puxadores). Frente em +Z com rotY = 0.
// ---------------------------------------------------------------------------

export interface ArmarioProps {
  pos: Vec3;
  rotY?: number;
  w?: number;
  h?: number;
  d?: number;
  cor?: string;
}

export function Armario({ pos, rotY = 0, w = 0.9, h = 2.0, d = 0.45, cor = PALETTE.portaMadeira }: ArmarioProps) {
  return (
    <group position={pos} rotation-y={rotY}>
      <Caixa pos={[0, h / 2, 0]} size={[w, h, d]} cor={cor} castShadow receiveShadow />
      {/* Linha das portas e puxadores */}
      <Caixa pos={[0, h / 2, d / 2 + 0.005]} size={[0.02, h - 0.2, 0.01]} cor={'#5b3a1e'} />
      <Caixa pos={[-0.06, h / 2, d / 2 + 0.02]} size={[0.03, 0.12, 0.03]} cor={PALETTE.carteiraMetal} />
      <Caixa pos={[0.06, h / 2, d / 2 + 0.02]} size={[0.03, 0.12, 0.03]} cor={PALETTE.carteiraMetal} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Computador (monitor + teclado). Tela voltada a +Z com rotY = 0.
// `pos` = ponto sobre a superfície da mesa.
// ---------------------------------------------------------------------------

const MAT_TELA = new THREE.MeshStandardMaterial({
  color: '#20313f',
  emissive: '#2a4a5f',
  emissiveIntensity: 0.6,
  roughness: 0.4,
});

export interface ComputadorProps {
  pos: Vec3;
  rotY?: number;
}

export function Computador({ pos, rotY = 0 }: ComputadorProps) {
  return (
    <group position={pos} rotation-y={rotY}>
      {/* Base do monitor */}
      <Caixa pos={[0, 0.01, -0.05]} size={[0.2, 0.02, 0.15]} cor={'#3b3b3b'} />
      {/* Haste */}
      <Caixa pos={[0, 0.09, -0.05]} size={[0.05, 0.16, 0.05]} cor={'#3b3b3b'} />
      {/* Monitor */}
      <Caixa pos={[0, 0.34, -0.05]} size={[0.52, 0.34, 0.04]} cor={'#1b1b1b'} />
      {/* Tela */}
      <mesh position={[0, 0.34, -0.028]} material={MAT_TELA}>
        <planeGeometry args={[0.46, 0.28]} />
      </mesh>
      {/* Teclado */}
      <Caixa pos={[0, 0.012, 0.16]} size={[0.4, 0.025, 0.15]} cor={'#d9d9d9'} />
    </group>
  );
}
