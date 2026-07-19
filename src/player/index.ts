/**
 * index.ts — barrel do jogador: re-exporta a superfície pública.
 * ATENÇÃO: <PlayerRig/> deve ser montado DENTRO do <Canvas>.
 * moverComColisao/chaoEm são puros (podem ser usados em testes/scripts).
 */

export { PlayerRig } from './PlayerRig';
export { WalkControls } from './WalkControls';
export { moverComColisao, chaoEm } from './collision';
