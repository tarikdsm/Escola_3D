/**
 * index.ts — barrel da UI: re-exporta a superfície pública para o integrador.
 * Todos os componentes aqui são DOM comum: montar FORA do <Canvas>.
 * `initAudio()` deve ser chamado uma vez no arranque (é idempotente).
 * `TouchControls` só renderiza em dispositivos touch (pointer coarse).
 */

export { HUD } from './HUD';
export { PinceisPanel } from './PinceisPanel';
export { TimeSlider } from './TimeSlider';
export { HelpOverlay } from './HelpOverlay';
export { TouchControls } from './TouchControls';
export { initAudio } from './audio';
export { useAjudaStore } from './helpStore';
