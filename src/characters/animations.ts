/**
 * animations.ts — ANIMAÇÃO PROCEDURAL dos personagens (funções PURAS, sem three).
 *
 * `computePose` recebe o estado de animação (AnimState), a fase individual
 * (0..1, para dessincronizar personagens), o tempo acumulado do personagem
 * (segundos) e a velocidade atual, e devolve os ângulos-alvo das JUNTAS do
 * esqueleto de 2 segmentos por membro (ver rig.ts). A suavização entre poses
 * (transição sem "pulos") é feita por `suavizarPose`, chamada em
 * Characters.tsx com fator ~10·delta.
 *
 * Convenções de eixo (espaço local do personagem, "de frente" = +Z):
 * - rotX negativo num membro → joga o membro para FRENTE/para cima;
 * - coxaX negativo = coxa à frente; joelho ≥ 0 = canela dobrada para trás;
 * - ombroX negativo = braço à frente; cotovelo ≥ 0 = flexão (antebraço à frente);
 * - peX positivo = ponta do pé para baixo (impulso); negativo = calcanhar primeiro;
 * - cabecaRotY positivo → vira o rosto para a esquerda; rotX positivo → olha p/ baixo.
 *
 * Passada consistente (pés não "patinam"): a fase da passada avança com
 * t·velocidade·GANHO — 1 ciclo (2 passos) cobre ~1,5 m andando (passada
 * ≈ 0,75 m a 1,7 m/s) e ~2,2 m correndo (passada ≈ 1,1 m). Mudanças bruscas
 * de velocidade causam saltinhos de fase que a suavização (~10·delta) absorve.
 */

import type { AnimState } from '../contracts/types';

const TAU = Math.PI * 2;

/** Andar: 1 ciclo (2 passos) ≈ 1,5 m → passada ≈ 0,75 m a 1,7 m/s. */
const GANHO_ANDAR = TAU / 1.5; // ≈ 4,19 rad por metro
/** Corrida: 1 ciclo ≈ 2,2 m → passada ≈ 1,1 m. */
const GANHO_CORRER = TAU / 2.2; // ≈ 2,86 rad por metro

/**
 * Pose de um personagem: ângulos (rad) das juntas e offsets (m).
 * Serve tanto de valor-alvo (saída de computePose) quanto de estado
 * suavizado por personagem (mantido em Characters.tsx).
 */
export interface Pose {
  /** Quadril→coxa (pivô no quadril): negativo = perna à frente. */
  coxaEsqX: number;
  coxaDirX: number;
  /** Joelho (pivô no joelho): ≥ 0, canela dobrada para trás. */
  joelhoEsq: number;
  joelhoDir: number;
  /** Tornozelo: positivo = ponta para baixo; negativo = calcanhar primeiro. */
  peEsqX: number;
  peDirX: number;
  /** Ombros: X = péndulo frente/trás (negativo à frente); Z = abrir/fechar. */
  ombroEsqX: number;
  ombroEsqZ: number;
  ombroDirX: number;
  ombroDirZ: number;
  /** Cotovelos: ≥ 0 = flexão (antebraço vem à frente). */
  cotoveloEsq: number;
  cotoveloDir: number;
  /** Peito (pivô no topo da pelve): X inclina frente/trás, Y torce, Z balanço lateral. */
  troncoRotX: number;
  troncoRotY: number;
  troncoRotZ: number;
  /** Pelve: torção Y oposta aos ombros na passada + deslize lateral (repouso). */
  quadrilRotY: number;
  quadrilDeslX: number;
  /** Cabeça (pivô no topo do pescoço): X = sim/não; Y = virar; Z = inclinar. */
  cabecaRotX: number;
  cabecaRotY: number;
  cabecaRotZ: number;
  /** Deslocamento vertical do corpo (bob do passo / respiração). */
  bobY: number;
  /** 0 = em pé · 1 = sentado (quadril desce p/ 0,45 m). Interpolável. */
  sentar: number;
}

/** Pose inicial (tudo zero = personagem em pé, neutro). */
export function criarPoseNeutra(): Pose {
  return {
    coxaEsqX: 0,
    coxaDirX: 0,
    joelhoEsq: 0,
    joelhoDir: 0,
    peEsqX: 0,
    peDirX: 0,
    ombroEsqX: 0,
    ombroEsqZ: 0,
    ombroDirX: 0,
    ombroDirZ: 0,
    cotoveloEsq: 0,
    cotoveloDir: 0,
    troncoRotX: 0,
    troncoRotY: 0,
    troncoRotZ: 0,
    quadrilRotY: 0,
    quadrilDeslX: 0,
    cabecaRotX: 0,
    cabecaRotY: 0,
    cabecaRotZ: 0,
    bobY: 0,
    sentar: 0,
  };
}

/** Zera `out` in-place (sem alocação). */
function zerarPose(out: Pose): void {
  out.coxaEsqX = 0;
  out.coxaDirX = 0;
  out.joelhoEsq = 0;
  out.joelhoDir = 0;
  out.peEsqX = 0;
  out.peDirX = 0;
  out.ombroEsqX = 0;
  out.ombroEsqZ = 0;
  out.ombroDirX = 0;
  out.ombroDirZ = 0;
  out.cotoveloEsq = 0;
  out.cotoveloDir = 0;
  out.troncoRotX = 0;
  out.troncoRotY = 0;
  out.troncoRotZ = 0;
  out.quadrilRotY = 0;
  out.quadrilDeslX = 0;
  out.cabecaRotX = 0;
  out.cabecaRotY = 0;
  out.cabecaRotZ = 0;
  out.bobY = 0;
  out.sentar = 0;
}

/**
 * Interpola cada campo de `atual` em direção a `alvo` com fator `k`
 * (em Characters.tsx, k = 1 − e^(−10·delta) ≈ 10·delta): transições de
 * animação ficam suaves sem alocar nada por frame.
 */
export function suavizarPose(atual: Pose, alvo: Pose, k: number): void {
  atual.coxaEsqX += (alvo.coxaEsqX - atual.coxaEsqX) * k;
  atual.coxaDirX += (alvo.coxaDirX - atual.coxaDirX) * k;
  atual.joelhoEsq += (alvo.joelhoEsq - atual.joelhoEsq) * k;
  atual.joelhoDir += (alvo.joelhoDir - atual.joelhoDir) * k;
  atual.peEsqX += (alvo.peEsqX - atual.peEsqX) * k;
  atual.peDirX += (alvo.peDirX - atual.peDirX) * k;
  atual.ombroEsqX += (alvo.ombroEsqX - atual.ombroEsqX) * k;
  atual.ombroEsqZ += (alvo.ombroEsqZ - atual.ombroEsqZ) * k;
  atual.ombroDirX += (alvo.ombroDirX - atual.ombroDirX) * k;
  atual.ombroDirZ += (alvo.ombroDirZ - atual.ombroDirZ) * k;
  atual.cotoveloEsq += (alvo.cotoveloEsq - atual.cotoveloEsq) * k;
  atual.cotoveloDir += (alvo.cotoveloDir - atual.cotoveloDir) * k;
  atual.troncoRotX += (alvo.troncoRotX - atual.troncoRotX) * k;
  atual.troncoRotY += (alvo.troncoRotY - atual.troncoRotY) * k;
  atual.troncoRotZ += (alvo.troncoRotZ - atual.troncoRotZ) * k;
  atual.quadrilRotY += (alvo.quadrilRotY - atual.quadrilRotY) * k;
  atual.quadrilDeslX += (alvo.quadrilDeslX - atual.quadrilDeslX) * k;
  atual.cabecaRotX += (alvo.cabecaRotX - atual.cabecaRotX) * k;
  atual.cabecaRotY += (alvo.cabecaRotY - atual.cabecaRotY) * k;
  atual.cabecaRotZ += (alvo.cabecaRotZ - atual.cabecaRotZ) * k;
  atual.bobY += (alvo.bobY - atual.bobY) * k;
  atual.sentar += (alvo.sentar - atual.sentar) * k;
}

/** Base "sentado" compartilhada por sit / sitFidget / eat (coxas horizontais,
 *  canelas verticais, mãos sobre as coxas/carteira, respiração sutil). */
function poseSentado(out: Pose, t: number, fi: number): void {
  out.sentar = 1;
  out.coxaEsqX = -1.5;
  out.coxaDirX = -1.5;
  out.joelhoEsq = 1.5;
  out.joelhoDir = 1.5;
  out.peEsqX = 0.05;
  out.peDirX = 0.05;
  out.ombroEsqX = -0.55;
  out.ombroDirX = -0.55;
  out.cotoveloEsq = 0.45;
  out.cotoveloDir = 0.45;
  out.ombroEsqZ = 0.08;
  out.ombroDirZ = -0.08;
  out.troncoRotX = 0.03 + Math.sin((t * TAU) / 4 + fi) * 0.008;
  out.troncoRotZ = Math.sin(t * 0.8 + fi) * 0.02;
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
  // Bases naturais "em pé" (evitam pose em T): ombros levemente abertos,
  // cotovelos e joelhos com micro-flexão. Cada estado sobrescreve o que precisa.
  out.ombroEsqZ = 0.07;
  out.ombroDirZ = -0.07;
  out.cotoveloEsq = 0.15;
  out.cotoveloDir = 0.15;
  out.joelhoEsq = 0.06;
  out.joelhoDir = 0.06;
  const fi = fase * TAU;

  switch (anim) {
    case 'idle': {
      // Respiração (~4 s): peito sobe/desce ~1 cm (bob + leve inclinação).
      const resp = Math.sin((t * TAU) / 4 + fi);
      out.bobY = resp * 0.006;
      out.troncoRotX = 0.01 + resp * 0.008;
      // Transferência de peso entre as pernas (período 6–9 s por personagem):
      // quadril desliza ±2 cm e o tronco compensa sutilmente para o outro lado.
      const periodo = 6 + fase * 3;
      const desl = Math.sin((t * TAU) / periodo + fi * 2);
      out.quadrilDeslX = desl * 0.02;
      out.troncoRotZ = -desl * 0.025;
      // Micro-movimentos de cabeça e braços.
      out.cabecaRotY = Math.sin(t * 0.45 + fi) * 0.18;
      out.cabecaRotX = Math.sin(t * 0.7 + fi * 2) * 0.04;
      out.cabecaRotZ = Math.sin(t * 0.3 + fi) * 0.02;
      out.ombroEsqX = Math.sin(t * 0.5 + fi) * 0.03;
      out.ombroDirX = Math.sin(t * 0.5 + fi + 1) * 0.03;
      break;
    }

    case 'walk': {
      // Passada: coxas ±0,5 rad; joelho dobra na fase de balanço (canela
      // atrasa) e estica no apoio; pé faz calcanhar→ponta; braços em
      // contra-fase com cotovelo semi-flexionado (~0,4); quadril × ombros
      // com torção oposta sutil; bob ~3 cm; cabeça estável.
      const w = t * velocidade * GANHO_ANDAR + fi;
      const sw = Math.sin(w);
      out.coxaEsqX = -sw * 0.5;
      out.coxaDirX = sw * 0.5;
      out.joelhoEsq = 0.12 + 0.7 * Math.max(0, Math.cos(w + 0.6));
      out.joelhoDir = 0.12 + 0.7 * Math.max(0, Math.cos(w + 0.6 + Math.PI));
      out.peEsqX = 0.05 - 0.3 * Math.sin(w + 0.5);
      out.peDirX = 0.05 - 0.3 * Math.sin(w + 0.5 + Math.PI);
      out.ombroEsqX = sw * 0.45;
      out.ombroDirX = -sw * 0.45;
      out.cotoveloEsq = 0.4 + 0.25 * Math.max(0, -sw);
      out.cotoveloDir = 0.4 + 0.25 * Math.max(0, sw);
      out.quadrilRotY = sw * 0.06;
      out.troncoRotY = -sw * 0.06;
      out.troncoRotX = 0.05;
      out.troncoRotZ = sw * 0.03;
      out.bobY = Math.abs(Math.cos(w)) * 0.03;
      out.cabecaRotY = sw * 0.03;
      break;
    }

    case 'run': {
      // Amplitude maior, joelho sobe mais, tronco ~0,15 à frente,
      // cotovelos a ~90° (1,45 rad), bob maior.
      const w = t * velocidade * GANHO_CORRER + fi;
      const sw = Math.sin(w);
      out.coxaEsqX = -sw * 0.8;
      out.coxaDirX = sw * 0.8;
      out.joelhoEsq = 0.25 + 1.05 * Math.max(0, Math.cos(w + 0.6));
      out.joelhoDir = 0.25 + 1.05 * Math.max(0, Math.cos(w + 0.6 + Math.PI));
      out.peEsqX = 0.15 - 0.3 * Math.sin(w + 0.5);
      out.peDirX = 0.15 - 0.3 * Math.sin(w + 0.5 + Math.PI);
      out.ombroEsqX = sw * 0.55;
      out.ombroDirX = -sw * 0.55;
      out.cotoveloEsq = 1.45;
      out.cotoveloDir = 1.45;
      out.troncoRotX = 0.15;
      out.troncoRotZ = sw * 0.04;
      out.quadrilRotY = sw * 0.08;
      out.troncoRotY = -sw * 0.08;
      out.bobY = Math.abs(Math.cos(w)) * 0.06;
      out.cabecaRotX = -0.08; // compensa a inclinação, mantém o olhar à frente
      break;
    }

    case 'sit': {
      poseSentado(out, t, fi);
      out.cabecaRotY = Math.sin(t * 0.3 + fi) * 0.1;
      break;
    }

    case 'sitFidget': {
      poseSentado(out, t, fi);
      // Olhar para os lados ("pela janela") + batida de calcanhar rápida
      // e intermitente no pé direito (janela de 1,6 s a cada 5 s).
      out.cabecaRotY = Math.sin(t * 0.35 + fi) * 0.55;
      const ciclo = (t + fase * 5) % 5;
      if (ciclo < 1.6) {
        out.peDirX = 0.05 + Math.max(0, Math.sin(t * 11 + fi)) * 0.45;
        out.joelhoDir = 1.45 + Math.sin(t * 11 + fi) * 0.06;
      }
      break;
    }

    case 'write': {
      // Em pé no quadro: braço direito elevado, cotovelo conduz e a mão
      // desenha arcos pequenos; corpo com leve balanço lateral; cabeça acompanha.
      const w = t * 5.5 + fi;
      out.ombroDirX = -2.3 + Math.sin(w) * 0.12;
      out.ombroDirZ = -0.2 + Math.cos(w) * 0.12;
      out.cotoveloDir = 0.35 + Math.sin(w + 1.2) * 0.15;
      out.ombroEsqX = -0.15;
      out.cotoveloEsq = 0.3;
      out.cabecaRotX = -0.18;
      out.cabecaRotY = Math.sin(t * 0.4 + fi) * 0.05;
      out.troncoRotX = -0.03;
      out.troncoRotZ = Math.sin(t * 1.1 + fi) * 0.025;
      out.bobY = Math.sin(t * 1.8 + fi) * 0.006;
      break;
    }

    case 'talk': {
      // 3 padrões de gesto alternando a cada ~3 s (a troca é suavizada pelo
      // lerp de Characters.tsx): palma aberta · apontar · aceno de cabeça.
      // A VIRADA do rosto para SIM.talkTarget é aplicada em Characters.tsx.
      const padrao = Math.floor(t / 3 + fase * 3) % 3;
      const g = Math.sin(t * 3.2 + fi);
      out.bobY = Math.sin((t * TAU) / 4 + fi) * 0.005;
      out.troncoRotX = 0.02;
      if (padrao === 0) {
        // Palma aberta: antebraço direito sobe e "apresenta".
        out.ombroDirX = -0.5 + g * 0.08;
        out.cotoveloDir = 1.15 + Math.sin(t * 4.3 + fi) * 0.2;
        out.ombroDirZ = -0.3;
        out.ombroEsqX = -0.2;
        out.cotoveloEsq = 0.5;
      } else if (padrao === 1) {
        // Apontar: braço direito estendido à frente, oscilando pouco.
        out.ombroDirX = -1.15 + Math.sin(t * 2.2 + fi) * 0.1;
        out.cotoveloDir = 0.15;
        out.ombroEsqX = -0.15;
        out.cotoveloEsq = 0.4;
      } else {
        // Aceno de cabeça (concordando), braços relaxados.
        out.cabecaRotX = 0.03 + Math.sin(t * 3.4 + fi) * 0.12;
        out.ombroEsqX = -0.25;
        out.ombroDirX = -0.25;
        out.cotoveloEsq = 0.5;
        out.cotoveloDir = 0.5;
      }
      out.cabecaRotZ = Math.sin(t * 1.1 + fi) * 0.03;
      break;
    }

    case 'eat': {
      // Sentado: cotovelo direito leva a mão à boca em ciclo de ~1,2 s;
      // a cabeça inclina ao receber.
      poseSentado(out, t, fi);
      const u = ((t + fase * 1.2) % 1.2) / 1.2; // 0..1 a cada 1,2 s
      const subida = Math.sin(u * Math.PI); // sobe e desce suavemente
      out.ombroDirX = -0.55 - subida * 0.3;
      out.cotoveloDir = 0.45 + subida * 1.5;
      out.cabecaRotX = subida * 0.14;
      out.cabecaRotY = Math.sin(t * 0.4 + fi) * 0.08;
      break;
    }

    case 'sweep': {
      // Varrendo: tronco inclinado; as DUAS mãos à frente seguram a vassoura
      // (a vassoura é alinhada ao ponto médio das mãos em Characters.tsx).
      const g = Math.sin(t * 2.2 + fi);
      out.troncoRotX = 0.3;
      out.troncoRotZ = g * 0.05;
      out.quadrilRotY = g * 0.05;
      out.ombroEsqX = -0.75 + g * 0.15;
      out.cotoveloEsq = 0.45 - g * 0.1;
      out.ombroDirX = -0.95 - g * 0.12;
      out.cotoveloDir = 0.3 + g * 0.08;
      out.cabecaRotX = 0.18; // olha a área varrida
      break;
    }

    case 'playBall': {
      // Corrida de brincadeira + chute com a perna direita a cada ~2,6 s de
      // fase: a coxa estica à frente e a canela chicoteia (joelho começa
      // fechado e estica no impacto).
      const w = t * velocidade * GANHO_CORRER + fi;
      const sw = Math.sin(w);
      out.coxaEsqX = -sw * 0.65;
      out.coxaDirX = sw * 0.65;
      out.joelhoEsq = 0.2 + 0.9 * Math.max(0, Math.cos(w + 0.6));
      out.joelhoDir = 0.2 + 0.9 * Math.max(0, Math.cos(w + 0.6 + Math.PI));
      out.ombroEsqX = sw * 0.5;
      out.ombroDirX = -sw * 0.5;
      out.cotoveloEsq = 0.8;
      out.cotoveloDir = 0.8;
      out.troncoRotX = 0.12;
      out.bobY = Math.abs(Math.cos(w)) * 0.05;
      const ciclo = (t + fase * 2.6) % 2.6;
      if (ciclo < 0.45) {
        const u = ciclo / 0.45;
        const e = Math.sin(u * Math.PI); // envelope do chute
        out.coxaDirX = -1.25 * e;
        out.joelhoDir = 0.1 + e * 1.4 * (1 - u);
        out.peDirX = 0.4 * e;
        out.ombroEsqZ = 0.07 + 1.0 * e;
        out.ombroDirZ = -0.07 - 1.0 * e;
        out.troncoRotX = 0.12 - 0.08 * e;
      }
      break;
    }
  }

  return out;
}
