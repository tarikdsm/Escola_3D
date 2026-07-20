/**
 * usePointerCoarse.ts — detecção de dispositivo de TOQUE (ponteiro "coarse":
 * dedo/caneta, sem mouse preciso), reativa a mudanças (ex.: conectar um mouse
 * no tablet, ou o DevTools alternando a emulação de dispositivo).
 *
 * Usado pelo TouchControls (só renderiza em touch) e pelo HUD (textos dos
 * chips adaptados: não há pointer lock nem ESC no toque).
 */

import { useEffect, useState } from 'react';

const QUERY = '(pointer: coarse)';

/** true se o ponteiro principal é "coarse" (tela de toque). */
export function usePointerCoarse(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return coarse;
}
