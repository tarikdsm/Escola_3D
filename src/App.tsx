/**
 * App.tsx — Composição final da aplicação.
 *
 * - <Canvas> (R3F): ciclo de iluminação dia/noite (<Iluminacao>, autossuficiente:
 *   céu/fog, sol/lua com sombras cobrindo o terreno inteiro, ~±90 m, holofotes
 *   noturnos da quadra) e, dentro dele, os pavimentos (térreo + 3 superiores,
 *   U de 4 andares com Bloco C), o almoxarifado, o exterior, os personagens
 *   (+ picking), a simulação e o rig do jogador.
 * - FORA do Canvas (DOM comum): HUD, painel de pincéis (substitui o antigo
 *   minimapa), cartão de personagem e o overlay de ajuda (sempre montado —
 *   os atalhos H/? vivem nele).
 * - initAudio() é chamado uma vez no mount (idempotente; o AudioContext só
 *   é criado após o primeiro gesto do usuário, por política do browser).
 */

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { GroundFloor } from './world/groundFloor/GroundFloor';
import { UpperFloor } from './world/upperFloor/UpperFloor';
import { Exterior } from './world/exterior/Exterior';
import { Almoxarifado } from './world/Almoxarifado';
import { Iluminacao } from './world/Iluminacao';
import { Characters } from './characters/Characters';
import { CharacterPicker } from './characters/picking';
import { Simulation } from './simulation/Simulation';
import { PlayerRig } from './player';
import { CharacterCard, ControlsPanel, HelpOverlay, HUD, PinceisPanel, initAudio } from './ui';
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
        {/* Ciclo de iluminação dia/noite (céu/fog, sol/lua c/ sombras,
            holofotes noturnos) — substitui o antigo bloco de luz fixo. */}
        <Iluminacao />

        {/* Mundo (tudo deriva de src/contracts/layout.ts) */}
        <GroundFloor />
        <UpperFloor />
        <Exterior />
        <Almoxarifado />

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
      <PinceisPanel />
      <CharacterCard />
      <HelpOverlay />
    </div>
  );
}
