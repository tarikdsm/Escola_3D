/**
 * App.tsx — Composição final da aplicação.
 *
 * - <Canvas> (R3F): ciclo de iluminação dia/noite (<Iluminacao>, autossuficiente:
 *   céu/fog, sol/lua com sombras cobrindo o terreno inteiro, ~±90 m, holofotes
 *   noturnos da quadra) e, dentro dele, os pavimentos (térreo + 3 superiores,
 *   U de 4 andares com Bloco C), o almoxarifado, o exterior, os personagens
 *   (+ picking), a simulação e o rig do jogador.
 * - Câmera/interação (PlayerRig): abre no modo VOO armado (o 1º clique no
 *   canvas trava o ponteiro); ESC libera o mouse; com o mouse livre, clique
 *   em personagem possui (3ª pessoa) e clique no vazio volta a voar.
 * - FORA do Canvas (DOM comum): HUD (com os chips de voo armado/personagem
 *   controlado), painel de pincéis (substitui o antigo minimapa), overlay
 *   de ajuda (sempre montado — os atalhos H/? vivem nele), o slider de
 *   viagem no tempo (rodapé centro: arrastar leva ao futuro/passado,
 *   botões ◀ ▶ de ±30 min) e os controles de toque (só aparecem em
 *   dispositivos com pointer coarse — ver ui/TouchControls.tsx).
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
import { HelpOverlay, HUD, PinceisPanel, TimeSlider, TouchControls, initAudio } from './ui';
import './app.css';

export default function App() {
  useEffect(() => {
    initAudio();
  }, []);

  return (
    <div className="app">
      <Canvas
        shadows
        // dpr limitado: telas mobile de alta densidade derrubariam o FPS.
        dpr={[1, 1.75]}
        camera={{ fov: 55, near: 0.3, far: 800, position: [55, 45, 70] }}
        // Enquadramento inicial: escola inteira (o modo voo herda a pose).
        onCreated={({ camera }) => camera.lookAt(0, 2, -2)}
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

        {/* Câmera/controles do jogador (voo ↔ mouse livre ↔ 3ª pessoa) */}
        <PlayerRig />
      </Canvas>

      {/* Interface DOM (fora do Canvas) */}
      <HUD />
      <PinceisPanel />
      <HelpOverlay />
      {/* Viagem no tempo: slider do dia letivo (7h–23h) no rodapé centro */}
      <TimeSlider />
      {/* Joystick + gestos de câmera (não renderiza nada no desktop) */}
      <TouchControls />
    </div>
  );
}
