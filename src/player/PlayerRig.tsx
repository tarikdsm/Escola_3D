/**
 * PlayerRig.tsx — rig do jogador, vai DENTRO do <Canvas>.
 *
 * - modoCamera === 'andar' → <WalkControls/> (1ª pessoa com pointer lock);
 * - modoCamera === 'aereo' → <OrbitControls/> enquadrando a escola toda.
 * - Tab (global, com preventDefault) alterna os modos via toggleModoCamera.
 * - Ao entrar no modo aéreo (inclusive no mount, se já começar aéreo), a
 *   câmera é posicionada para ver a escola inteira.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSchoolStore } from '../state/useSchoolStore';
import { WalkControls } from './WalkControls';

/** Posição da câmera aérea (vê a escola toda) e alvo da órbita. */
const POS_AEREA: readonly [number, number, number] = [55, 45, 70];
const ALVO_AEREO: readonly [number, number, number] = [0, 2, -2];

export function PlayerRig() {
  const modo = useSchoolStore((s) => s.modoCamera);
  const camera = useThree((s) => s.camera);

  // Tab alterna caminhar/aéreo (preventDefault para não mover o foco).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        useSchoolStore.getState().toggleModoCamera();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Ao entrar no modo aéreo: enquadra a escola toda.
  useEffect(() => {
    if (modo !== 'aereo') return;
    camera.position.set(POS_AEREA[0], POS_AEREA[1], POS_AEREA[2]);
    camera.lookAt(ALVO_AEREO[0], ALVO_AEREO[1], ALVO_AEREO[2]);
  }, [modo, camera]);

  if (modo === 'andar') return <WalkControls />;

  return (
    <OrbitControls
      makeDefault
      target={[ALVO_AEREO[0], ALVO_AEREO[1], ALVO_AEREO[2]]}
      minDistance={8}
      maxDistance={170}
      maxPolarAngle={Math.PI / 2.15}
      enableDamping
    />
  );
}
