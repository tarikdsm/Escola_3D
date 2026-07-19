/**
 * Exterior.tsx — Componente raiz da área externa (montado dentro do <Canvas>
 * pelo integrador, sem props). Reúne terreno, fachada/muros/portão, quadra,
 * pátio e vegetação. Não inclui céu, sol nem luzes (responsabilidade da
 * integração) nem paredes/pisos/mobília dos blocos (outros agentes).
 */
import { Terrain } from './Terrain';
import { Facade } from './Facade';
import { SportsCourt } from './SportsCourt';
import { Patio } from './Patio';
import { Vegetation } from './Vegetation';

/** Nuvens low-poly estáticas (bônus leve): grupos de esferas brancas altas. */
function Nuvens() {
  const nuvens: { centro: [number, number, number]; bolas: [number, number, number, number][] }[] = [
    {
      centro: [-30, 28, -30],
      bolas: [
        [0, 0, 0, 3],
        [2.8, 0.4, 0.6, 2.2],
        [-2.6, 0.2, -0.4, 2],
      ],
    },
    {
      centro: [30, 32, 10],
      bolas: [
        [0, 0, 0, 3.4],
        [3, 0.5, -0.6, 2.4],
        [-3, 0.3, 0.6, 2.1],
      ],
    },
    {
      centro: [60, 26, -35],
      bolas: [
        [0, 0, 0, 2.6],
        [2.4, 0.3, 0.5, 1.9],
        [-2.2, 0.2, -0.5, 1.7],
      ],
    },
  ];
  return (
    <group>
      {nuvens.map((n, i) => (
        <group key={i} position={n.centro}>
          {n.bolas.map((b, j) => (
            <mesh key={j} position={[b[0], b[1], b[2]]}>
              <icosahedronGeometry args={[b[3], 1]} />
              <meshStandardMaterial color="#ffffff" flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Área externa completa da escola. */
export function Exterior() {
  return (
    <group>
      <Terrain />
      <Facade />
      <SportsCourt />
      <Patio />
      <Vegetation />
      <Nuvens />
    </group>
  );
}
