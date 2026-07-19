/**
 * ball.ts — Bola de recreio da quadra (estado mutável + física simples).
 *
 * A bola só se move durante o período RECREIO (`ativa === true`); fora dele
 * fica parada no centro da quadra (é a "bola guardada"). Os agentes em modo
 * 'bola' correm até ela e chutam (ver agents.ts); aqui ficam apenas o
 * estado e a integração física: atrito no plano, gravidade no eixo Y,
 * quique amortecido e rebote nas bordas da quadra.
 */

import { QUADRA } from '../contracts/layout';
import type { Vec3 } from '../contracts/types';
import { faixa, type Rng } from './rng';

/** Raio visual/físico da bola (esfera de 0,22 m). */
export const RAIO_BOLA = 0.22;

export interface Bola {
  /** Centro da bola (y = RAIO_BOLA quando em repouso no chão). */
  pos: Vec3;
  /** Velocidade em m/s de jogo. */
  vel: Vec3;
  /** true apenas durante o RECREIO (fora dele a bola fica parada no centro). */
  ativa: boolean;
}

/** Cria a bola parada no centro da quadra. */
export function criarBola(): Bola {
  return {
    pos: [QUADRA.areaBola.centro[0], RAIO_BOLA, QUADRA.areaBola.centro[2]],
    vel: [0, 0, 0],
    ativa: false,
  };
}

/** Repõe a bola parada no centro da quadra (início do recreio / wrap do dia). */
export function resetBola(b: Bola): void {
  b.pos[0] = QUADRA.areaBola.centro[0];
  b.pos[1] = RAIO_BOLA;
  b.pos[2] = QUADRA.areaBola.centro[2];
  b.vel[0] = 0;
  b.vel[1] = 0;
  b.vel[2] = 0;
}

/**
 * Chute: direção horizontal aleatória apontando para um ponto DENTRO da
 * areaBola (para a bola não ficar presa nas bordas), |v| ~3–5 m/s de jogo,
 * mais um componente vertical para o quique.
 */
export function chutarBola(b: Bola, rng: Rng): void {
  const ang = rng() * Math.PI * 2;
  const raio = Math.sqrt(rng()) * QUADRA.areaBola.raio * 0.9;
  const alvoX = QUADRA.areaBola.centro[0] + Math.cos(ang) * raio;
  const alvoZ = QUADRA.areaBola.centro[2] + Math.sin(ang) * raio;
  let dx = alvoX - b.pos[0];
  let dz = alvoZ - b.pos[2];
  const d = Math.hypot(dx, dz);
  if (d < 0.001) {
    dx = 1;
    dz = 0;
  } else {
    dx /= d;
    dz /= d;
  }
  const forca = faixa(rng, 3, 5);
  b.vel[0] = dx * forca;
  b.vel[2] = dz * forca;
  b.vel[1] = faixa(rng, 1.8, 3.6);
}

/**
 * Integração física por frame. `dtJogo` em segundos DE JOGO.
 * Quando inativa, garante a bola parada no centro (sem deriva).
 */
export function atualizarBola(b: Bola, dtJogo: number): void {
  if (!b.ativa) {
    resetBola(b);
    return;
  }
  // Gravidade no eixo Y.
  b.vel[1] -= 9.8 * dtJogo;
  // Atrito do rolamento (decaimento exponencial no plano XZ).
  const atrito = Math.exp(-1.4 * dtJogo);
  b.vel[0] *= atrito;
  b.vel[2] *= atrito;

  b.pos[0] += b.vel[0] * dtJogo;
  b.pos[1] += b.vel[1] * dtJogo;
  b.pos[2] += b.vel[2] * dtJogo;

  // Qique amortecido no chão.
  if (b.pos[1] < RAIO_BOLA) {
    b.pos[1] = RAIO_BOLA;
    if (b.vel[1] < -0.6) {
      b.vel[1] = -b.vel[1] * 0.5;
    } else {
      b.vel[1] = 0;
    }
  }

  // Rebote nas bordas da quadra (com margem do raio; alambrado segura a bola).
  const minX = QUADRA.rect.x + RAIO_BOLA + 0.3;
  const maxX = QUADRA.rect.x + QUADRA.rect.w - RAIO_BOLA - 0.3;
  const minZ = QUADRA.rect.z + RAIO_BOLA + 0.3;
  const maxZ = QUADRA.rect.z + QUADRA.rect.d - RAIO_BOLA - 0.3;
  if (b.pos[0] < minX) {
    b.pos[0] = minX;
    b.vel[0] = -b.vel[0] * 0.5;
  } else if (b.pos[0] > maxX) {
    b.pos[0] = maxX;
    b.vel[0] = -b.vel[0] * 0.5;
  }
  if (b.pos[2] < minZ) {
    b.pos[2] = minZ;
    b.vel[2] = -b.vel[2] * 0.5;
  } else if (b.pos[2] > maxZ) {
    b.pos[2] = maxZ;
    b.vel[2] = -b.vel[2] * 0.5;
  }

  // Zera velocidades residuais para não tremer no chão.
  if (Math.abs(b.vel[0]) < 0.05) b.vel[0] = 0;
  if (Math.abs(b.vel[2]) < 0.05) b.vel[2] = 0;
}

/** Distância horizontal de um ponto até a bola (usada pelos jogadores). */
export function distanciaParaBola(b: Bola, x: number, z: number): number {
  return Math.hypot(b.pos[0] - x, b.pos[2] - z);
}
