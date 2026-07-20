/**
 * viagemTempo.ts — VIAGEM NO TEMPO (slider do rodapé, ver ui/TimeSlider.tsx):
 * estado e política, fora do React e SEM importar a store (é a store quem
 * importa este módulo — ver useSchoolStore.viajarPara/cancelarViagem; o loop
 * de perseguição fica no hook da viagem em step.ts).
 *
 * Modelo:
 * - FUTURO: a simulação "persegue" o alvo em passos grossos de 1–5 s de jogo
 *   (passoAdaptativoViagem), fatiados por frame (ORCAMENTO_MS_VIAGEM /
 *   MAX_PASSOS_VIAGEM) para não travar o render — no pior caso (dia inteiro)
 *   a espera fica na casa de poucos segundos reais;
 * - PASSADO (alvo < relógio atual): marca `precisaReset` — o 1º frame da
 *   viagem reinicia o dia (7h, todos nos spawns, pincéis resetados — replay
 *   consistente, mesmo efeito do wrap diário) e então persegue o alvo;
 * - novo arraste durante a viagem chama iniciarViagem de novo e REDEFINE o
 *   alvo (cancela a anterior; o reset só acontece se o NOVO alvo estiver no
 *   passado do relógio já avançado).
 *
 * Durante a viagem a store expõe viajando=true/minutoAlvoViagem e o tick
 * normal do relógio é substituído pelos passos de perseguição. Os eventos
 * 'sino'/'periodo' continuam disparando na lógica (tickClock) para um replay
 * fiel — só o SOM do sino fica mudo (ui/audio.ts lê a flag `viajando`).
 */

import { CONST } from '../contracts/layout';
import { resetDia, type Mundo } from './estado';
import { resetPinceis } from './pinceis';

/** Orçamento de tempo (ms reais) de perseguição por frame. */
export const ORCAMENTO_MS_VIAGEM = 12;
/** Teto de passos grossos por frame (complementa o orçamento em ms). */
export const MAX_PASSOS_VIAGEM = 96;
/**
 * Separação anti-sobreposição durante a perseguição: 0 = DESLIGADA enquanto
 * viaja (medida: ~90–100 % do custo do passo em aglomerações — 67 ms por
 * chamada no recreio, via empurra→cruzaParede varrendo WALLS por par — e é
 * só visual: o movimento segue waypoints, sem colisão; sem ela não há
 * empurrões nem tempestades de repath, o replay fica até mais limpo). Ao
 * CHEGAR ao alvo roda uma separação final e o jogo normal relaxa as
 * aglomerações nos frames seguintes. > 0 rodaria a cada K passos.
 */
export const SEPARACAO_A_CADA_PASSOS_VIAGEM = 0;

/** Minuto-alvo da viagem em curso (HORA_ABERTURA–HORA_FECHAMENTO); null = sem viagem. */
let alvoMin: number | null = null;
/** Relógio no início da perseguição (base do progresso 0..1). */
let inicioMin = CONST.HORA_ABERTURA;
/** Viagem ao passado: o dia deve ser reiniciado (7h) antes de perseguir. */
let precisaReset = false;

/**
 * Inicia (ou redefine) a viagem para `alvo` (minutos desde 00:00, já com
 * clamp aplicado pela store). `relogioAtual` decide passado × futuro.
 */
export function iniciarViagem(alvo: number, relogioAtual: number): void {
  alvoMin = alvo;
  precisaReset = alvo < relogioAtual;
  inicioMin = precisaReset ? CONST.HORA_ABERTURA : relogioAtual;
}

/** Cancela a viagem em curso (também usado por step.ts ao ATINGIR o alvo). */
export function cancelarViagem(): void {
  alvoMin = null;
  precisaReset = false;
}

export function viagemAtiva(): boolean {
  return alvoMin !== null;
}

export function alvoViagem(): number | null {
  return alvoMin;
}

/** Relógio de origem da perseguição (7h se houve reset; senão o ponto de partida). */
export function inicioViagem(): number {
  return inicioMin;
}

/** Devolve true UMA única vez quando a viagem ao passado deve resetar o dia. */
export function consumirResetViagem(): boolean {
  const r = precisaReset;
  precisaReset = false;
  return r;
}

/**
 * Reset da viagem ao passado: idêntico à parte de simulação do wrap diário
 * (ver clock.ts — resetDia + resetPinceis). A parte de relógio da store
 * (7h, período/turno, evento 'periodo') é aplicada pelo hook em step.ts.
 */
export function resetarDiaViagem(m: Mundo): void {
  resetDia(m);
  resetPinceis(); // cargas a 100 % e descartados zerados; estoque preserva
}

/**
 * Tamanho do passo (SEGUNDOS de jogo) conforme a distância restante ao alvo:
 * 5 s em saltos grandes, 2,5 s em médios e 1 s na aproximação final.
 */
export function passoAdaptativoViagem(restanteMin: number): number {
  if (restanteMin > 120) return 5;
  if (restanteMin > 20) return 2.5;
  return 1;
}

/** Progresso 0..1 da perseguição (preenchimento animado do slider). */
export function progressoViagem(relogioAtual: number): number {
  if (alvoMin === null) return 1;
  const span = alvoMin - inicioMin;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (relogioAtual - inicioMin) / span));
}
