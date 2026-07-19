/**
 * Bathrooms.tsx — Banheiros M (x −11…−7) e F (x −7…−3) do Bloco B:
 * - azulejo até meia-parede (cores distintas M/F);
 * - 2 pias com espelho (metalness alto) em cada banheiro;
 * - 3 vasos estilizados com divisórias.
 * Porta na parede norte (z=13); janela alta na parede sul (z=20).
 */

import * as THREE from 'three';
import { Caixa } from './props/furniture';

const MAT_ESPELHO = new THREE.MeshStandardMaterial({
  color: '#dfe9f0',
  metalness: 1,
  roughness: 0.08,
});

const COR_PORCELANA = '#f5f5f0';

interface ConfigBanheiro {
  nome: string;
  xMin: number;
  xMax: number;
  corAzulejo: string;
  /** Parede das pias: 'leste' = x máx, 'oeste' = x mín. */
  ladoPias: 'leste' | 'oeste';
}

/** Vaso sanitário estilizado (frente em +Z local). */
function Vaso({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  return (
    <group position={pos} rotation-y={rotY}>
      {/* Base */}
      <Caixa pos={[0, 0.21, 0]} size={[0.38, 0.42, 0.5]} cor={COR_PORCELANA} castShadow />
      {/* Assento/tampa */}
      <mesh position={[0, 0.45, 0.02]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 12]} />
        <meshStandardMaterial color={COR_PORCELANA} roughness={0.4} />
      </mesh>
      {/* Caixa acoplada */}
      <Caixa pos={[0, 0.55, -0.3]} size={[0.38, 0.5, 0.16]} cor={COR_PORCELANA} />
    </group>
  );
}

/** Pia com cuba e espelho (frente em +Z local). */
function PiaComEspelho({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  return (
    <group position={pos} rotation-y={rotY}>
      {/* Tampo da pia */}
      <Caixa pos={[0, 0.82, 0]} size={[0.55, 0.07, 0.45]} cor={COR_PORCELANA} castShadow />
      {/* Cuba (reentrância escura) */}
      <Caixa pos={[0, 0.845, 0]} size={[0.36, 0.03, 0.28]} cor={'#c9d6d2'} />
      {/* Torneira */}
      <Caixa pos={[0, 0.95, -0.15]} size={[0.04, 0.18, 0.04]} cor={'#c0c6cc'} />
      <Caixa pos={[0, 1.03, -0.08]} size={[0.04, 0.04, 0.16]} cor={'#c0c6cc'} />
      {/* Espelho */}
      <mesh position={[0, 1.5, -0.2]} material={MAT_ESPELHO}>
        <planeGeometry args={[0.5, 0.6]} />
      </mesh>
    </group>
  );
}

function Banheiro({ cfg }: { cfg: ConfigBanheiro }) {
  const { xMin, xMax, corAzulejo } = cfg;
  const cx = (xMin + xMax) / 2;
  const largura = xMax - xMin;
  // Pias na parede indicada, olhando para dentro do banheiro.
  const xPias = cfg.ladoPias === 'leste' ? xMax - 0.35 : xMin + 0.35;
  const rotPias = cfg.ladoPias === 'leste' ? -Math.PI / 2 : Math.PI / 2;
  // Vasos na parede oposta.
  const xVasos = cfg.ladoPias === 'leste' ? xMin + 0.42 : xMax - 0.42;
  const rotVasos = cfg.ladoPias === 'leste' ? Math.PI / 2 : -Math.PI / 2;
  const xDivisorias = cfg.ladoPias === 'leste' ? xMin + 0.45 : xMax - 0.45;
  return (
    <group name={cfg.nome}>
      {/* Azulejo até meia-parede: sul e laterais (norte tem a porta) */}
      <Caixa pos={[cx, 0.7, 19.88]} size={[largura - 0.2, 1.4, 0.03]} cor={corAzulejo} />
      <Caixa pos={[xMin + 0.12, 0.7, 16.5]} size={[0.03, 1.4, 6.7]} cor={corAzulejo} />
      <Caixa pos={[xMax - 0.12, 0.7, 16.5]} size={[0.03, 1.4, 6.7]} cor={corAzulejo} />
      {/* Pias com espelho */}
      <PiaComEspelho pos={[xPias, 0, 18.3]} rotY={rotPias} />
      <PiaComEspelho pos={[xPias, 0, 17.1]} rotY={rotPias} />
      {/* Vasos com divisórias */}
      {[15.2, 16.5, 17.8].map((z) => (
        <Vaso key={z} pos={[xVasos, 0, z]} rotY={rotVasos} />
      ))}
      {[15.85, 17.15].map((z) => (
        <Caixa key={z} pos={[xDivisorias, 0.75, z]} size={[0.7, 1.5, 0.04]} cor={'#e8e0d0'} castShadow />
      ))}
    </group>
  );
}

/** Banheiros masculino e feminino mobiliados. */
export function Bathrooms() {
  return (
    <group name="banheiros-terreo">
      <Banheiro cfg={{ nome: 'banheiro-m', xMin: -11, xMax: -7, corAzulejo: '#7fb7d9', ladoPias: 'leste' }} />
      <Banheiro cfg={{ nome: 'banheiro-f', xMin: -7, xMax: -3, corAzulejo: '#e8a0bf', ladoPias: 'oeste' }} />
    </group>
  );
}
