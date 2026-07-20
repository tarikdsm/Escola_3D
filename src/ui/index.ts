/**
 * index.ts — barrel da UI: re-exporta a superfície pública para o integrador.
 * Todos os componentes aqui são DOM comum: montar FORA do <Canvas>.
 * `initAudio()` deve ser chamado uma vez no arranque (é idempotente).
 */

export { HUD } from './HUD';
export { PinceisPanel } from './PinceisPanel';
export { TimeSlider } from './TimeSlider';
export { CharacterCard } from './CharacterCard';
export { HelpOverlay } from './HelpOverlay';
export { ControlsPanel } from './ControlsPanel';
export { initAudio } from './audio';
export { useAjudaStore } from './helpStore';
