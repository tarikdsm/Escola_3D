/**
 * PlayerRig.tsx — rig do jogador, vai DENTRO do <Canvas>.
 *
 * Máquina de modos (store.modoCam — modelo mouse-first, SEM teclado de
 * movimento; ver contracts/store.ts e docs no HelpOverlay):
 * - 'voo'      → <VooControls/> (mouse = direção; LMB/RMB = frente/trás;
 *   scroll = zoom). Sem pointer lock é o estado ARMADO: câmera parada e o
 *   clique no canvas pede a trava (chip do HUD avisa).
 * - 'livre'    → nenhum controlador: a câmera fica fixa onde estava e o
 *   cursor interage (picking: clique em personagem possui; clique no vazio
 *   volta a voar). Painéis de UI continuam clicáveis — a trava só é
 *   pedida a partir de cliques no CANVAS.
 * - 'possuido' → <PossuidoControls/> (3ª pessoa do NPC possuidoIdx;
 *   key={idx} remonta o controlador ao trocar de personagem).
 *
 * Regras de transição com pointer lock (listeners globais deste módulo):
 * - PERDA da trava (ESC é nativo do browser) com modo ≠ 'livre' → modo
 *   'livre'. Estando possuído, a posse CONTINUA — o NPC para onde está
 *   (cleanup do PossuidoControls) e o chip do HUD oferece "Soltar".
 * - ERRO de trava (ex.: cooldown pós-ESC do Chrome) estando 'possuido' →
 *   volta a 'livre' com a posse mantida (novo clique tenta de novo). No
 *   'voo' o erro só deixa o modo armado (chip reaparece).
 * - Botão direito NUNCA abre menu de contexto no canvas (RMB = ré no voo).
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSchoolStore } from '../state/useSchoolStore';
import { PossuidoControls } from './PossuidoControls';
import { VooControls } from './VooControls';

export function PlayerRig() {
  const modo = useSchoolStore((s) => s.modoCam);
  const possuidoIdx = useSchoolStore((s) => s.possuidoIdx);
  const gl = useThree((s) => s.gl);

  // Contextmenu suprimido + transições de pointer lock (uma vez por canvas).
  useEffect(() => {
    const canvas = gl.domElement;

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onLockChange = () => {
      if (document.pointerLockElement === canvas) return; // travou: nada a fazer
      const st = useSchoolStore.getState();
      // Destravou (ESC etc.): mouse livre — preserva a posse, se houver.
      if (st.modoCam !== 'livre') st.entrarLivre();
    };
    const onLockError = () => {
      // Falha ao travar estando possuído: volta ao livre com a posse
      // mantida (no 'voo' basta ficar armado — o chip já orienta).
      const st = useSchoolStore.getState();
      if (st.modoCam === 'possuido') st.entrarLivre();
    };

    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
    };
  }, [gl]);

  if (modo === 'voo') return <VooControls />;
  if (modo === 'possuido' && possuidoIdx !== null) {
    return <PossuidoControls key={possuidoIdx} />;
  }
  return null; // modo 'livre': câmera fixa, cursor com o picking/UI
}
