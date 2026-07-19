/**
 * Library.tsx — Biblioteca (x 21…29, z 13…20):
 * - 3 estantes de madeira junto à parede sul, com ~114 livros coloridos
 *   (InstancedMesh com cor por instância, cores de PALETTE.livros);
 * - 2 mesas de leitura com cadeiras;
 * - balcão de atendimento perto da porta.
 */

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import { Cadeira, Caixa, Instancias, Mesa, materialCor, mesclarCaixas, type Instancia } from './props/furniture';

// ---------------------------------------------------------------------------
// Estantes (frente em +Z local; colocadas com rotY=π contra a parede sul)
// ---------------------------------------------------------------------------

/** Estante: 2 laterais, fundo e 4 prateleiras. */
const GEO_ESTANTE = mesclarCaixas([
  { size: [0.05, 2.0, 0.35], offset: [-1.125, 1.0, 0] },
  { size: [0.05, 2.0, 0.35], offset: [1.125, 1.0, 0] },
  { size: [2.2, 2.0, 0.03], offset: [0, 1.0, -0.16] },
  { size: [2.2, 0.05, 0.33], offset: [0, 0.1, 0] },
  { size: [2.2, 0.05, 0.33], offset: [0, 0.72, 0] },
  { size: [2.2, 0.05, 0.33], offset: [0, 1.34, 0] },
  { size: [2.2, 0.05, 0.33], offset: [0, 1.96, 0] },
]);

const X_ESTANTES = [22.4, 25.0, 27.6];
const Z_ESTANTE = 19.72;

const ITENS_ESTANTES: Instancia[] = X_ESTANTES.map((x) => ({
  pos: [x, 0, Z_ESTANTE],
  rotY: Math.PI,
}));

// ---------------------------------------------------------------------------
// Livros (InstancedMesh com instanceColor)
// ---------------------------------------------------------------------------

interface Livro {
  pos: Vec3;
  size: Vec3;
  cor: string;
}

/** Gera ~114 livros determinísticos sobre as prateleiras 0,72 e 1,34. */
function gerarLivros(): Livro[] {
  const livros: Livro[] = [];
  const niveis = [0.72, 1.34]; // prateleiras ocupadas
  X_ESTANTES.forEach((xe, ie) => {
    niveis.forEach((ny, iny) => {
      for (let c = 0; c < 38; c++) {
        // Deixa lacunas determinísticas (livros emprestados…).
        if ((ie * 7 + iny * 13 + c) % 2 !== 0) continue;
        const altura = 0.22 + ((c + ie + iny) % 3) * 0.035;
        livros.push({
          pos: [xe - 1.0 + c * 0.055, ny + 0.025 + altura / 2, Z_ESTANTE - 0.02],
          size: [0.045, altura, 0.2],
          cor: PALETTE.livros[(c + iny + ie) % PALETTE.livros.length],
        });
      }
    });
  });
  return livros;
}

const LIVROS = gerarLivros();
const GEO_LIVRO = new THREE.BoxGeometry(1, 1, 1);

function LivrosInstanciados() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const cor = new THREE.Color();
    LIVROS.forEach((l, i) => {
      dummy.position.set(l.pos[0], l.pos[1], l.pos[2]);
      dummy.scale.set(l.size[0], l.size[1], l.size[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, cor.set(l.cor));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, LIVROS.length]} geometry={GEO_LIVRO}>
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Biblioteca mobiliada: estantes, livros, mesas de leitura e balcão. */
export function Library() {
  return (
    <group name="biblioteca">
      {/* Estantes contra a parede sul */}
      <Instancias geo={GEO_ESTANTE} mat={materialCor(PALETTE.estanteLivros)} itens={ITENS_ESTANTES} castShadow receiveShadow />
      <LivrosInstanciados />

      {/* Mesas de leitura com 2 cadeiras cada */}
      {([23, 26] as const).map((x) => (
        <group key={x}>
          <Mesa pos={[x, 0, 15.3]} w={1.6} d={0.9} h={0.75} />
          <Cadeira pos={[x, 0, 14.5]} rotY={Math.PI} />
          <Cadeira pos={[x, 0, 16.1]} rotY={0} />
        </group>
      ))}

      {/* Balcão de atendimento junto à porta (x=25, z=13) */}
      <Caixa pos={[26.8, 0.5, 14.0]} size={[1.6, 1.0, 0.55]} cor={PALETTE.balcaoCantina} castShadow receiveShadow />
      <Caixa pos={[26.8, 1.03, 14.0]} size={[1.75, 0.05, 0.65]} cor={PALETTE.estanteLivros} />
      <Cadeira pos={[26.8, 0, 14.75]} rotY={Math.PI} />
      {/* Pilha de livros sobre o balcão */}
      <Caixa pos={[26.4, 1.09, 14.0]} size={[0.3, 0.05, 0.22]} cor={PALETTE.livros[0]} />
      <Caixa pos={[26.4, 1.14, 14.0]} size={[0.28, 0.05, 0.2]} cor={PALETTE.livros[2]} />
    </group>
  );
}
