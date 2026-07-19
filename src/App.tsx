/**
 * App.tsx — Composição final da aplicação.
 *
 * - <Canvas> (R3F): céu (cor de fundo + fog suave), iluminação de simulador
 *   (hemisférica + sol com sombras cobrindo o terreno inteiro, ~±90 m) e,
 *   dentro dele, os dois pavimentos, o exterior, os personagens (+ picking),
 *   a simulação e o rig do jogador.
 * - FORA do Canvas (DOM comum): HUD, minimapa, cartão de personagem e o
 *   overlay de ajuda (sempre montado — os atalhos H/? vivem nele).
 * - initAudio() é chamado uma vez no mount (idempotente; o AudioContext só
 *   é criado após o primeiro gesto do usuário, por política do browser).
 */

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PALETTE } from './contracts/palette';
import { GroundFloor } from './world/groundFloor/GroundFloor';
import { UpperFloor } from './world/upperFloor/UpperFloor';
import { Exterior } from './world/exterior/Exterior';
import { Characters } from './characters/Characters';
import { CharacterPicker } from './characters/picking';
import { Simulation } from './simulation/Simulation';
import { PlayerRig } from './player';
import { CharacterCard, ControlsPanel, HelpOverlay, HUD, Minimap, initAudio } from './ui';
import './app.css';

export default function App() {
  useEffect(() => {
    initAudio();
  }, []);

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 55, near: 0.3, far: 800, position: [55, 45, 70] }}
      >
        {/* Céu: cor de fundo + fog suave na mesma tonalidade. */}
        <color attach="background" args={[PALETTE.ceu]} />
        <fog attach="fog" args={[PALETTE.ceu, 200, 520]} />

        {/* Luz ambiente de céu/gramado + sol com sombras para o terreno todo. */}
        <hemisphereLight args={['#cfe5ff', '#7a9a58', 0.75]} />
        <directionalLight
          position={[65, 90, 45]}
          intensity={1.6}
          color={PALETTE.sol}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-95}
          shadow-camera-right={95}
          shadow-camera-top={95}
          shadow-camera-bottom={-95}
          shadow-camera-near={10}
          shadow-camera-far={320}
          shadow-bias={-0.0002}
          shadow-normalBias={0.5}
        />

        {/* Mundo (tudo deriva de src/contracts/layout.ts) */}
        <GroundFloor />
        <UpperFloor />
        <Exterior />

        {/* Seres vivos e cérebro da escola */}
        <Characters />
        <CharacterPicker />
        <Simulation />

        {/* Câmera/controles do jogador (Tab alterna caminhar/aéreo) */}
        <PlayerRig />
      </Canvas>

      {/* Interface DOM (fora do Canvas) */}
      <HUD />
      <ControlsPanel />
      <Minimap />
      <CharacterCard />
      <HelpOverlay />
    </div>
  );
}
