/**
 * index.ts — barrel do jogador: re-exporta a superfície pública.
 * ATENÇÃO: <PlayerRig/> deve ser montado DENTRO do <Canvas>.
 * moverComColisao/chaoEm são puros (podem ser usados em testes/scripts).
 *
 * API PARA TOUCH (estável — joystick mobile): entradaMover, girarVisao,
 * zoomCam e toqueTela (assinaturas documentadas em entrada.ts).
 * Ciclo de vida da posse: iniciarPosse/soltarPosse/soltarPosseEVoar
 * (possessao.ts) — o picking e o HUD chamam daqui.
 */

export { PlayerRig } from './PlayerRig';
export { moverComColisao, chaoEm } from './collision';
export { entradaMover, girarVisao, zoomCam, toqueTela } from './entrada';
export { iniciarPosse, soltarPosse, soltarPosseEVoar } from './possessao';
