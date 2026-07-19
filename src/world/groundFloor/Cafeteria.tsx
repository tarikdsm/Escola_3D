/**
 * Cafeteria.tsx — Refeitório/Cantina (x −29…−11, z 13…20):
 * - 3 mesas comunitárias com bancos (âncoras REFEITORIO.mesas, instanciadas);
 * - balcão da cantina (o AABB já é renderizado como parede) com tampo de
 *   inox, bandejas e cartaz "MERENDA" pendurado;
 * - cozinha visível atrás do balcão (z 17,1…20): fogão industrial, panelas,
 *   pia, prateleiras e parede de azulejo.
 */

import * as THREE from 'three';
import { REFEITORIO } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import { Caixa, Instancias, materialCor, mesclarCaixas, type Instancia } from './props/furniture';
import { texturaAzulejo, texturaMerenda } from './props/canvasTextures';

// ---------------------------------------------------------------------------
// Mesas comunitárias + bancos (instanciados)
// ---------------------------------------------------------------------------

/** Mesa comunitária: tampo + 2 cavaletes. */
const GEO_MESA_REFEITORIO = mesclarCaixas([
  { size: [2.6, 0.06, 0.9], offset: [0, 0.72, 0] },
  { size: [0.12, 0.72, 0.7], offset: [-1.0, 0.36, 0] },
  { size: [0.12, 0.72, 0.7], offset: [1.0, 0.36, 0] },
]);

/** Banco comprido: assento + 2 pés. */
const GEO_BANCO_REFEITORIO = mesclarCaixas([
  { size: [2.6, 0.05, 0.3], offset: [0, 0.45, 0] },
  { size: [0.1, 0.45, 0.26], offset: [-1.0, 0.225, 0] },
  { size: [0.1, 0.45, 0.26], offset: [1.0, 0.225, 0] },
]);

const ITENS_MESAS: Instancia[] = REFEITORIO.mesas.map((m) => ({ pos: m.pos }));
const ITENS_BANCOS: Instancia[] = REFEITORIO.mesas.flatMap((m) => [
  { pos: [m.pos[0], 0, 14.35] as [number, number, number] },
  { pos: [m.pos[0], 0, 15.65] as [number, number, number] },
]);

// ---------------------------------------------------------------------------
// Cozinha (atrás do balcão)
// ---------------------------------------------------------------------------

const MAT_INOX = materialCor(PALETTE.balcaoInox, { metalness: 0.6, roughness: 0.35 });
const MAT_PRETO = materialCor('#2b2b2b', { roughness: 0.6 });
const MAT_MERENDA = new THREE.MeshStandardMaterial({
  map: texturaMerenda(),
  side: THREE.DoubleSide,
  roughness: 0.9,
});

function Fogao() {
  return (
    <group position={[-20, 0, 19.45]}>
      {/* Corpo do fogão industrial */}
      <Caixa pos={[0, 0.45, 0]} size={[1.8, 0.9, 0.7]} material={MAT_INOX} castShadow />
      {/* 4 bocas */}
      {[-0.45, 0.45].map((dx) =>
        [-0.17, 0.17].map((dz) => (
          <mesh key={`${dx}-${dz}`} position={[dx, 0.915, dz]} material={MAT_PRETO}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 12]} />
          </mesh>
        )),
      )}
      {/* Panelas sobre 2 bocas */}
      {[-0.45, 0.45].map((dx) => (
        <group key={dx} position={[dx, 0.93, -0.17]}>
          <mesh material={MAT_INOX} position={[0, 0.09, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.13, 0.18, 12]} />
          </mesh>
          <mesh material={MAT_INOX} position={[0, 0.19, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.025, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Pia() {
  return (
    <group position={[-24.5, 0, 19.5]}>
      {/* Balcão da pia */}
      <Caixa pos={[0, 0.45, 0]} size={[1.4, 0.9, 0.6]} material={MAT_INOX} castShadow />
      {/* Cuba */}
      <Caixa pos={[0, 0.92, 0]} size={[0.9, 0.05, 0.4]} material={MAT_PRETO} />
      {/* Torneira */}
      <Caixa pos={[0.3, 1.03, 0.22]} size={[0.04, 0.24, 0.04]} material={MAT_INOX} />
      <Caixa pos={[0.3, 1.14, 0.1]} size={[0.04, 0.04, 0.28]} material={MAT_INOX} />
    </group>
  );
}

function Prateleiras() {
  return (
    <group position={[-26.8, 0, 19.7]}>
      {[1.75, 2.15].map((y) => (
        <Caixa key={y} pos={[0, y, 0]} size={[2.0, 0.05, 0.35]} cor={PALETTE.estanteLivros} />
      ))}
      {/* Potes e travessas nas prateleiras */}
      {[-0.7, -0.2, 0.3].map((dx, i) => (
        <mesh key={i} position={[dx, 1.87, 0]} material={MAT_INOX}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 10]} />
        </mesh>
      ))}
      <Caixa pos={[0.6, 1.8, 0]} size={[0.4, 0.08, 0.28]} material={MAT_INOX} />
      <Caixa pos={[-0.4, 2.2, 0]} size={[0.5, 0.06, 0.3]} cor={PALETTE.balcaoCantina} />
      <mesh position={[0.5, 2.28, 0]} material={MAT_INOX}>
        <cylinderGeometry args={[0.14, 0.12, 0.16, 10]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Refeitório/cantina completo, com cozinha visível atrás do balcão. */
export function Cafeteria() {
  return (
    <group name="refeitorio">
      {/* Mesas e bancos instanciados */}
      <Instancias geo={GEO_MESA_REFEITORIO} mat={materialCor(PALETTE.mesaProfessor)} itens={ITENS_MESAS} castShadow receiveShadow />
      <Instancias geo={GEO_BANCO_REFEITORIO} mat={materialCor(PALETTE.banco)} itens={ITENS_BANCOS} castShadow />

      {/* Tampo de inox sobre o balcão (o corpo do balcão é um AABB de WALLS,
          já renderizado junto às paredes do térreo: x −27…−14, z ~17) */}
      <Caixa pos={[-20.5, 1.13, 17]} size={[13.3, 0.06, 0.34]} material={MAT_INOX} receiveShadow />
      {/* Bandejas sobre o balcão */}
      {[-26, -24, -22, -20, -18].map((x) => (
        <Caixa key={x} pos={[x, 1.175, 17]} size={[0.4, 0.03, 0.3]} cor={'#e8e8e8'} />
      ))}

      {/* Cartaz MERENDA pendurado sobre o balcão */}
      <mesh position={[-20.5, 2.45, 17]} material={MAT_MERENDA}>
        <planeGeometry args={[2.4, 0.9]} />
      </mesh>
      {/* Fios do cartaz */}
      <Caixa pos={[-21.5, 2.75, 17]} size={[0.02, 0.6, 0.02]} cor={'#3b3b3b'} />
      <Caixa pos={[-19.5, 2.75, 17]} size={[0.02, 0.6, 0.02]} cor={'#3b3b3b'} />

      {/* Parede de azulejo da cozinha (parede sul, trecho da cozinha) */}
      <mesh position={[-21.5, 1.35, 19.88]} rotation-y={Math.PI}>
        <planeGeometry args={[14.4, 1.5]} />
        <meshStandardMaterial map={texturaAzulejo('#bcd4de')} roughness={0.4} />
      </mesh>

      {/* Equipamentos da cozinha */}
      <Fogao />
      <Pia />
      <Prateleiras />
    </group>
  );
}
