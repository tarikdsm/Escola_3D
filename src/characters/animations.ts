/**
 * animations.ts — ANIMAÇÃO PROCEDURAL dos personagens (funções PURAS, sem three).
 *
 * `computePose` recebe o estado de animação (AnimState), a fase individual
 * (0..1, para dessincronizar personagens), o tempo acumulado do personagem
 * (segundos) e a velocidade atual, e devolve os ângulos/offsets-alvo de cada
 * parte do corpo. A suavização entre poses (transição sem "pulos") é feita
 * por `suavizarPose`, chamada em Characters.tsx com fator ~10·delta.
 *
 * Convenções de eixo (espaço local do personagem, "de frente" = +Z):
 * - rotX negativo num membro → joga o membro para FRENTE/para cima;
 * - cabecaRotY positivo → vira o rosto para a esquerda; rotX positivo → olha p/ baixo.
 */

import type { AnimState } from '../contracts/types';

const TAU = Math.PI * 2;

/**
 * Pose de um personagem: ângulos (rad) e offsets (m) de cada parte.
 * Serve tanto de valor-alvo (saída de computePose) quanto de estado
 * suavizado por personagem (mantido em Characters.tsx).
 */
export interface Pose {
  /** Rotação X das pernas (pivô no quadril): negativo = perna à frente. */
  pernaEsqRotX: number;
  pernaDirRotX: number;
  /** Rotações dos braços (pivô no ombro): X = péndulo frente/trás; Z = abrir/fechar. */
  bracoEsqRotX: number;
  bracoEsqRotZ: number;
  bracoDirRotX: number;
  bracoDirRotZ: number;
  /** Tronco (pivô no quadril): X = inclinação frente/trás; Z = balanço lateral. */
  troncoRotX: number;
  troncoRotZ: number;
  /** Cabeça (pivô no pescoço): X = sim/não; Y = virar o rosto. */
  cabecaRotX: number;
  cabecaRotY: number;
  /** Deslocamento vertical do corpo inteiro (bob do passo / respiração). */
  bobY: number;
  /** 0 = em pé · 1 = sentado (quadril desce de 0,80 m para 0,45 m). Interpolável. */
  sentar: number;
}

/** Pose inicial (tudo zero = personagem em pé, neutro). */
export function criarPoseNeutra(): Pose {
  return {
    pernaEsqRotX: 0,
    pernaDirRotX: 0,
    bracoEsqRotX: 0,
    bracoEsqRotZ: 0,
    bracoDirRotX: 0,
    bracoDirRotZ: 0,
    troncoRotX: 0,
    troncoRotZ: 0,
    cabecaRotX: 0,
    cabecaRotY: 0,
    bobY: 0,
    sentar: 0,
  };
}

/** Zera `out` in-place (sem alocação). */
function zerarPose(out: Pose): void {
  out.pernaEsqRotX = 0;
  out.pernaDirRotX = 0;
  out.bracoEsqRotX = 0;
  out.bracoEsqRotZ = 0;
  out.bracoDirRotX = 0;
  out.bracoDirRotZ = 0;
  out.troncoRotX = 0;
  out.troncoRotZ = 0;
  out.cabecaRotX = 0;
  out.cabecaRotY = 0;
  out.bobY = 0;
  out.sentar = 0;
}

/**
 * Interpola cada campo de `atual` em direção a `alvo` com fator `k`
 * (em Characters.tsx, k = 1 − e^(−10·delta) ≈ 10·delta): transições de
 * animação ficam suaves sem alocar nada por frame.
 */
export function suavizarPose(atual: Pose, alvo: Pose, k: number): void {
  atual.pernaEsqRotX += (alvo.pernaEsqRotX - atual.pernaEsqRotX) * k;
  atual.pernaDirRotX += (alvo.pernaDirRotX - atual.pernaDirRotX) * k;
  atual.bracoEsqRotX += (alvo.bracoEsqRotX - atual.bracoEsqRotX) * k;
  atual.bracoEsqRotZ += (alvo.bracoEsqRotZ - atual.bracoEsqRotZ) * k;
  atual.bracoDirRotX += (alvo.bracoDirRotX - atual.bracoDirRotX) * k;
  atual.bracoDirRotZ += (alvo.bracoDirRotZ - atual.bracoDirRotZ) * k;
  atual.troncoRotX += (alvo.troncoRotX - atual.troncoRotX) * k;
  atual.troncoRotZ += (alvo.troncoRotZ - atual.troncoRotZ) * k;
  atual.cabecaRotX += (alvo.cabecaRotX - atual.cabecaRotX) * k;
  atual.cabecaRotY += (alvo.cabecaRotY - atual.cabecaRotY) * k;
  atual.bobY += (alvo.bobY - atual.bobY) * k;
  atual.sentar += (alvo.sentar - atual.sentar) * k;
}

/**
 * Calcula a pose-ALVO de um personagem para o estado de animação atual.
 *
 * @param anim       estado de animação (walk, sit, talk…)
 * @param fase       fase individual 0..1 (dessincroniza os ciclos entre personagens)
 * @param t          tempo acumulado do personagem, em segundos (sempre crescente)
 * @param velocidade velocidade escalar atual (m/s de jogo) — ajusta o passo
 * @param out        objeto Pose reutilizado (NUNCA aloque por frame)
 */
export function computePose(
  anim: AnimState,
  fase: number,
  t: number,
  velocidade: number,
  out: Pose,
): Pose {
  zerarPose(out);
  const fi = fase * TAU;

  switch (anim) {
    case 'idle': {
      // Balanço lateral sutil do tronco + respiração + micro-movimento de cabeça.
      out.troncoRotZ = Math.sin(t * 0.9 + fi) * 0.03;
      out.bobY = Math.sin(t * 1.8 + fi) * 0.008;
      out.cabecaRotY = Math.sin(t * 0.45 + fi) * 0.18;
      out.cabecaRotX = Math.sin(t * 0.7 + fi * 2) * 0.04;
      out.bracoEsqRotZ = 0.06;
      out.bracoDirRotZ = -0.06;
      break;
    }

    case 'walk': {
      // Pernas em seno oposto; braços contrários; bob vertical sutil.
      const w = t * (3 + velocidade * 1.2) + fi;
      const sw = Math.sin(w);
      out.pernaEsqRotX = sw * 0.55;
      out.pernaDirRotX = -sw * 0.55;
      out.bracoEsqRotX = -sw * 0.4;
      out.bracoDirRotX = sw * 0.4;
      out.bracoEsqRotZ = 0.05;
      out.bracoDirRotZ = -0.05;
      out.troncoRotX = 0.06;
      out.troncoRotZ = Math.sin(w) * 0.03;
      out.bobY = Math.abs(Math.cos(w)) * 0.035;
      break;
    }

    case 'run': {
      // Amplitude e frequência maiores; tronco levemente inclinado à frente.
      const w = t * (5.2 + velocidade * 0.8) + fi;
      const sw = Math.sin(w);
      out.pernaEsqRotX = sw * 0.85;
      out.pernaDirRotX = -sw * 0.85;
      out.bracoEsqRotX = -sw * 0.65;
      out.bracoDirRotX = sw * 0.65;
      out.troncoRotX = 0.22;
      out.bobY = Math.abs(Math.cos(w)) * 0.06;
      break;
    }

    case 'sit': {
      // Sentado: pernas dobradas ~90°, braços sobre a carteira, leve balanço.
      out.sentar = 1;
      out.pernaEsqRotX = -1.5;
      out.pernaDirRotX = -1.5;
      out.bracoEsqRotX = -0.5;
      out.bracoDirRotX = -0.5;
      out.bracoEsqRotZ = 0.08;
      out.bracoDirRotZ = -0.08;
      out.troncoRotZ = Math.sin(t * 0.8 + fi) * 0.02;
      out.cabecaRotY = Math.sin(t * 0.3 + fi) * 0.1;
      break;
    }

    case 'sitFidget': {
      // Sentado inquieto: perna balançando rápido em intervalos + cabeça
      // virando para os lados ("olhando pela janela", yaw periódico suave).
      out.sentar = 1;
      out.pernaEsqRotX = -1.5;
      out.pernaDirRotX = -1.5;
      out.bracoEsqRotX = -0.5;
      out.bracoDirRotX = -0.5;
      out.cabecaRotY = Math.sin(t * 0.35 + fi) * 0.55;
      out.troncoRotZ = Math.sin(t * 0.7 + fi) * 0.03;
      const ciclo = (t + fase * 5) % 5;
      if (ciclo < 1.6) {
        out.pernaDirRotX = -1.5 + Math.sin(t * 11 + fi) * 0.25;
      }
      break;
    }

    case 'write': {
      // Em pé no quadro: braço direito esticado para cima desenhando
      // pequenos círculos; cabeça levemente para cima.
      const w = t * 5.5 + fi;
      out.bracoDirRotX = -2.35 + Math.sin(w) * 0.16;
      out.bracoDirRotZ = -0.25 + Math.cos(w) * 0.16;
      out.bracoEsqRotX = -0.15;
      out.bracoEsqRotZ = 0.08;
      out.cabecaRotX = -0.18;
      out.troncoRotX = -0.03;
      out.bobY = Math.sin(t * 1.8 + fi) * 0.006;
      break;
    }

    case 'talk': {
      // Gestos alternados dos braços + pequenos nods de cabeça.
      // (A VIRADA do rosto para o interlocutor é aplicada em Characters.tsx,
      // somando um yaw suavizado a cabecaRotY — aqui fica só o balanço.)
      const g = Math.sin(t * 3.2 + fi);
      out.bracoEsqRotX = -0.55 + g * 0.35;
      out.bracoDirRotX = -0.55 - g * 0.35;
      out.bracoEsqRotZ = 0.12;
      out.bracoDirRotZ = -0.12;
      out.cabecaRotX = Math.sin(t * 3.2 + fi * 2) * 0.07 + 0.02;
      break;
    }

    case 'eat': {
      // Sentado comendo: mão direita sobe à boca em loop de ~1,2 s;
      // a cabeça acompanha levemente.
      out.sentar = 1;
      out.pernaEsqRotX = -1.5;
      out.pernaDirRotX = -1.5;
      out.bracoEsqRotX = -0.45;
      const u = ((t + fase * 1.2) % 1.2) / 1.2; // 0..1 a cada 1,2 s
      const subida = Math.sin(u * Math.PI); // sobe e desce suavemente
      out.bracoDirRotX = -0.45 - subida * 1.35;
      out.cabecaRotX = subida * 0.12;
      out.troncoRotZ = Math.sin(t * 0.8 + fi) * 0.02;
      break;
    }

    case 'sweep': {
      // Varrendo: tronco inclinado ~0,3; braços à frente empurrando
      // a vassoura em arcos alternados (a vassoura em si é montada em
      // Characters.tsx, alinhada às mãos).
      const g = Math.sin(t * 2.2 + fi);
      out.troncoRotX = 0.3;
      out.bracoEsqRotX = -0.85 + g * 0.22;
      out.bracoDirRotX = -0.85 - g * 0.18;
      out.bracoEsqRotZ = 0.15;
      out.bracoDirRotZ = -0.15;
      out.cabecaRotX = 0.15;
      break;
    }

    case 'playBall': {
      // Corrida de brincadeira + chute periódico (a cada ~2,6 s de fase):
      // perna direita estica à frente e os braços abrem.
      const w = t * 6 + fi;
      const sw = Math.sin(w);
      out.pernaEsqRotX = sw * 0.7;
      out.pernaDirRotX = -sw * 0.7;
      out.bracoEsqRotX = -sw * 0.5;
      out.bracoDirRotX = sw * 0.5;
      out.troncoRotX = 0.15;
      out.bobY = Math.abs(Math.cos(w)) * 0.05;
      const ciclo = (t + fase * 2.6) % 2.6;
      if (ciclo < 0.45) {
        const e = Math.sin((ciclo / 0.45) * Math.PI); // envelope do chute
        out.pernaDirRotX = -1.5 * e + sw * 0.2;
        out.bracoEsqRotZ = 1.1 * e;
        out.bracoDirRotZ = -1.1 * e;
        out.troncoRotX = 0.15 - 0.1 * e;
      }
      break;
    }
  }

  return out;
}
