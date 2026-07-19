/**
 * Simulation.tsx — COMPONENTE R3F da simulação (montar DENTRO do <Canvas>).
 *
 * Orquestra tudo em UM único useFrame (relógio → período → agentes →
 * separação → bola → buffers → atividades a 1 Hz), sem nenhum React state
 * por frame: o estado dos agentes vive em arrays/objetos mutáveis locais
 * (estado.ts) e chega ao render pelos buffers SIM.
 *
 * Renderiza APENAS a bola de recreio (esfera branca de 0,22 m, cor lisa —
 * opção mais simples permitida pela missão); todo o resto (personagens,
 * portão, HUD) é responsabilidade dos outros agentes lendo SIM/store.
 *
 * A montagem cria o mundo e escreve os buffers iniciais ANTES do primeiro
 * frame (ninguém nasce em 0,0,0). A posição da bola é copiada ao mesh a
 * cada frame a partir do estado mutável.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { RAIO_BOLA } from './ball';
import { criarMundo, type Mundo } from './estado';
import { stepMundo } from './step';

export function Simulation() {
  const mundoRef = useRef<Mundo | null>(null);
  if (mundoRef.current === null) {
    mundoRef.current = criarMundo();
  }
  const bolaRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const m = mundoRef.current;
    if (!m) return;
    // Clamp de picos (aba em segundo plano) para não dar saltos de simulação.
    stepMundo(m, Math.min(delta, 0.1));
    const mesh = bolaRef.current;
    if (mesh) mesh.position.set(m.bola.pos[0], m.bola.pos[1], m.bola.pos[2]);
  });

  const p = mundoRef.current.bola.pos;
  return (
    <mesh ref={bolaRef} castShadow position={[p[0], p[1], p[2]]}>
      <sphereGeometry args={[RAIO_BOLA, 12, 10]} />
      <meshStandardMaterial color="#f5f5f0" roughness={0.55} flatShading />
    </mesh>
  );
}
