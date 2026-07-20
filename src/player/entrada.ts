/**
 * entrada.ts — ENTRADA UNIFICADA do jogador (mouse + API imperativa p/ touch).
 *
 * Os controladores ativos (VooControls/PossuidoControls) convertem os eventos
 * DOM do mouse nos MESMOS canais desta fila (giro e zoom), então mouse e
 * touch passam pelo mesmo caminho. Nada aqui é React: objetos mutáveis,
 * zero alocação por frame.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * API PARA TOUCH (estável — o joystick mobile chama direto daqui):
 *
 * entradaMover(vx: number, vz: number): void
 *   Eixos de movimento com intensidade −1…1 (valores fora são clampados):
 *   - vz > 0 = para frente · vz < 0 = para trás;
 *   - vx > 0 = strafe p/ a direita · vx < 0 = strafe p/ a esquerda
 *     (plano horizontal relativo ao yaw da câmera/personagem).
 *   Chamar a cada atualização do joystick; zerar (0, 0) ao soltar.
 *
 * girarVisao(dx: number, dy: number): void
 *   Giro da visão em "pixels equivalentes" (mesma sensibilidade do mouse):
 *   dx > 0 gira p/ a direita; dy > 0 gira p/ baixo. Acumula até o
 *   controlador ativo consumir no próximo frame (não precisa throttle).
 *
 * zoomCam(delta: number): void
 *   Zoom: delta > 0 aproxima, delta < 0 afasta. No voo = deslocamento ao
 *   longo do olhar; na 3ª pessoa = distância da câmera ao personagem.
 *   Escala: ~100 ≈ um "notch" de rodinha (o listener de wheel normaliza).
 *
 * toqueTela(x: number, y: number): void
 *   Equivalente ao clique do mouse para INTERAGIR (coords de cliente, CSS
 *   px): no modo 'livre', tocar num personagem possui e tocar no vazio
 *   volta a voar (ver src/characters/picking.ts). Nos modos com pointer
 *   lock ('voo'/'possuido') não há cursor — não faz nada.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { interagirNoPonto } from '../characters/picking';

// --- Filas mutáveis (consumidas 1×/frame pelo controlador ativo) ---
const giroPendente = { dx: 0, dy: 0 };
let zoomPendente = 0;

/**
 * Eixos de movimento vindos da API touch (−1…1), lidos DIRETAMENTE pelos
 * controladores a cada frame e somados aos botões do mouse no mesmo canal.
 */
export const eixosTouch = { x: 0, z: 0 };

/** Clamp para a faixa −1…1. */
function clamp1(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** API touch: define os eixos de movimento (ver cabeçalho do módulo). */
export function entradaMover(vx: number, vz: number): void {
  eixosTouch.x = clamp1(vx);
  eixosTouch.z = clamp1(vz);
}

/** API touch + mouse (mousemove em pointer lock): acumula giro da visão. */
export function girarVisao(dx: number, dy: number): void {
  giroPendente.dx += dx;
  giroPendente.dy += dy;
}

/** API touch + mouse (wheel): acumula zoom pendente. */
export function zoomCam(delta: number): void {
  zoomPendente += delta;
}

/** API touch: equivalente ao clique para interagir/possuir (ver cabeçalho). */
export function toqueTela(x: number, y: number): void {
  interagirNoPonto(x, y);
}

// ---------------------------------------------------------------------------
// Consumo interno (NÃO faz parte da API touch): só o controlador ativo chama.
// ---------------------------------------------------------------------------

/** Lê e zera o giro acumulado, escrevendo em `out` (sem alocação). */
export function consumirGiro(out: { dx: number; dy: number }): void {
  out.dx = giroPendente.dx;
  out.dy = giroPendente.dy;
  giroPendente.dx = 0;
  giroPendente.dy = 0;
}

/** Lê e zera o zoom acumulado. */
export function consumirZoom(): number {
  const z = zoomPendente;
  zoomPendente = 0;
  return z;
}
